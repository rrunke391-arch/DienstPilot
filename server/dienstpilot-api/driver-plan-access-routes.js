'use strict';

const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

module.exports = function registerDriverPlanAccessRoutes(app) {
  if (!app || typeof app.use !== 'function' || typeof app.get !== 'function') {
    throw new Error('DienstPilot Fahrerplan-Rechte: Express-App fehlt.');
  }
  if (app.__dienstpilotDriverPlanAccessInstalled) return;
  app.__dienstpilotDriverPlanAccessInstalled = true;

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('DienstPilot Fahrerplan-Rechte: JWT_SECRET fehlt.');

  const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'dienstpilot.sqlite');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS vacation_requests (
      id TEXT PRIMARY KEY,
      profile TEXT NOT NULL,
      label TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🌴',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      decided_by TEXT,
      decided_at TEXT,
      decision_note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vacation_requests_profile
      ON vacation_requests(profile, start_date, requested_at);
  `);

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function bearerToken(req) {
    const header = String(req.headers.authorization || '');
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : '';
  }

  function quoteIdentifier(name) {
    return '"' + String(name).replace(/"/g, '""') + '"';
  }

  function columnName(columns, candidates) {
    const lookup = new Map(columns.map((column) => [String(column.name).toLowerCase(), column.name]));
    for (const candidate of candidates) {
      const found = lookup.get(String(candidate).toLowerCase());
      if (found) return found;
    }
    return '';
  }

  function userSchema() {
    const columns = db.prepare('PRAGMA table_info(users)').all();
    if (!columns.length) throw new Error('Die Benutzertabelle users wurde nicht gefunden.');
    const schema = {
      id: columnName(columns, ['id', 'user_id', 'userId']),
      username: columnName(columns, ['username', 'user_name', 'login', 'name']),
      role: columnName(columns, ['role', 'rolle', 'user_role']),
      driverProfile: columnName(columns, ['driver_profile', 'driverProfile', 'assigned_driver', 'fahrer']),
      displayName: columnName(columns, ['display_name', 'displayName', 'full_name', 'name'])
    };
    if (!schema.username || !schema.role) {
      throw new Error('Die Benutzertabelle hat kein erkanntes Benutzername-/Rollenfeld.');
    }
    return schema;
  }

  function decodedIdentity(decoded) {
    let username = String(decoded?.username || decoded?.user || decoded?.name || '').trim();
    let id = decoded?.id ?? decoded?.userId ?? decoded?.user_id ?? null;
    if (!username && decoded?.sub !== undefined && decoded?.sub !== null) {
      const subject = String(decoded.sub).trim();
      if (/^\d+$/.test(subject)) id = id ?? Number(subject);
      else username = subject;
    }
    return { username, id };
  }

  function authenticatedUser(decoded) {
    const schema = userSchema();
    const identity = decodedIdentity(decoded);
    let user = null;
    if (identity.username) {
      user = db.prepare(
        `SELECT * FROM users WHERE lower(${quoteIdentifier(schema.username)}) = lower(?)`
      ).get(identity.username);
    }
    if (!user && schema.id && identity.id !== null && identity.id !== undefined && identity.id !== '') {
      user = db.prepare(
        `SELECT * FROM users WHERE ${quoteIdentifier(schema.id)} = ?`
      ).get(identity.id);
    }
    return { schema, user };
  }

  function authenticate(req, res) {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Anmeldung erforderlich.' });
      return null;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      res.status(401).json({
        ok: false,
        error: error && error.name === 'TokenExpiredError'
          ? 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.'
          : 'Die Anmeldung konnte nicht geprüft werden.'
      });
      return null;
    }

    let auth;
    try {
      auth = authenticatedUser(decoded);
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
      return null;
    }
    if (!auth.user) {
      res.status(401).json({ ok: false, error: 'Benutzerkonto wurde nicht gefunden.' });
      return null;
    }
    return auth;
  }

  function roleName(schema, user) {
    return normalize(user?.[schema.role]);
  }

  function mayManagePlans(role) {
    return ['administrator', 'geschaftsleitung', 'geschaeftsleitung', 'disposition', 'disponent', 'disponentin'].includes(role);
  }

  function mayReviewVacation(role) {
    return ['geschaftsleitung', 'geschaeftsleitung', 'disposition', 'disponent', 'disponentin'].includes(role);
  }

  function mayReadAllVacation(role) {
    return mayManagePlans(role);
  }

  function ownProfiles(schema, user) {
    const profiles = new Set();
    [
      user?.[schema.username],
      schema.driverProfile ? user?.[schema.driverProfile] : '',
      schema.displayName ? user?.[schema.displayName] : ''
    ].forEach((value) => {
      const normalized = normalize(value);
      if (normalized) profiles.add(normalized);
    });
    return profiles;
  }

  function primaryProfile(schema, user) {
    return normalize(
      (schema.driverProfile ? user?.[schema.driverProfile] : '')
      || user?.[schema.username]
      || (schema.displayName ? user?.[schema.displayName] : '')
    );
  }

  function publicRequest(row) {
    return {
      id: row.id,
      profile: row.profile,
      label: row.label,
      emoji: row.emoji || '🌴',
      start: row.start_date,
      end: row.end_date,
      status: row.status,
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      decidedBy: row.decided_by || '',
      decidedAt: row.decided_at || '',
      decisionNote: row.decision_note || ''
    };
  }

  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  }

  app.get('/api/driver-plan-access/status', (req, res) => {
    try {
      const schema = userSchema();
      return res.json({
        ok: true,
        active: true,
        version: 4,
        usernameColumn: schema.username,
        roleColumn: schema.role,
        protectedPrefix: 'plan_',
        vacationRequestWorkflow: true,
        vacationReviewRoles: ['Geschäftsleitung', 'Disposition', 'Disponent']
      });
    } catch (error) {
      return res.status(500).json({ ok: false, active: false, error: error.message });
    }
  });

  app.get('/api/vacation-requests/:profile', (req, res) => {
    const auth = authenticate(req, res);
    if (!auth) return;
    const role = roleName(auth.schema, auth.user);
    const target = normalize(req.params.profile);
    const ownsTarget = role === 'fahrer' && ownProfiles(auth.schema, auth.user).has(target);
    if (!mayReadAllVacation(role) && !ownsTarget) {
      return res.status(403).json({ ok: false, error: 'Kein Zugriff auf die Urlaubswünsche dieses Fahrers.' });
    }
    const rows = db.prepare(
      'SELECT * FROM vacation_requests WHERE profile = ? ORDER BY start_date ASC, requested_at ASC'
    ).all(target);
    return res.json({ ok: true, profile: target, requests: rows.map(publicRequest) });
  });

  app.post('/api/vacation-requests', (req, res) => {
    const auth = authenticate(req, res);
    if (!auth) return;
    const role = roleName(auth.schema, auth.user);
    const own = ownProfiles(auth.schema, auth.user);
    let profile = normalize(req.body?.profile);

    if (role === 'fahrer') {
      if (!profile) profile = primaryProfile(auth.schema, auth.user);
      if (!own.has(profile)) {
        return res.status(403).json({ ok: false, error: 'Fahrer dürfen Urlaubswünsche nur für sich selbst eintragen.' });
      }
    } else if (!mayReadAllVacation(role)) {
      return res.status(403).json({ ok: false, error: 'Keine Berechtigung zum Eintragen eines Urlaubswunsches.' });
    }

    const label = String(req.body?.label || 'Urlaubswunsch').trim().slice(0, 80) || 'Urlaubswunsch';
    const emoji = String(req.body?.emoji || '🌴').trim().slice(0, 8) || '🌴';
    const start = String(req.body?.start || '');
    const end = String(req.body?.end || '');
    if (!profile || !validDate(start) || !validDate(end) || end < start) {
      return res.status(400).json({ ok: false, error: 'Fahrer, Beginn und Ende des Urlaubswunsches sind ungültig.' });
    }

    const id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `vac-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const requestedBy = String(
      (auth.schema.displayName ? auth.user?.[auth.schema.displayName] : '')
      || auth.user?.[auth.schema.username]
      || profile
    );
    const requestedAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO vacation_requests
        (id, profile, label, emoji, start_date, end_date, status, requested_by, requested_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, profile, label, emoji, start, end, requestedBy, requestedAt);

    const row = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(id);
    return res.status(201).json({ ok: true, request: publicRequest(row) });
  });

  app.put('/api/vacation-requests/:id/decision', (req, res) => {
    const auth = authenticate(req, res);
    if (!auth) return;
    const role = roleName(auth.schema, auth.user);
    if (!mayReviewVacation(role)) {
      return res.status(403).json({
        ok: false,
        error: 'Nur Geschäftsleitung und Disposition dürfen Urlaubswünsche genehmigen oder ablehnen.'
      });
    }

    const status = String(req.body?.status || '').toLowerCase();
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Ungültige Entscheidung.' });
    }

    const existing = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(String(req.params.id || ''));
    if (!existing) return res.status(404).json({ ok: false, error: 'Urlaubswunsch wurde nicht gefunden.' });

    const decidedBy = String(
      (auth.schema.displayName ? auth.user?.[auth.schema.displayName] : '')
      || auth.user?.[auth.schema.username]
      || role
    );
    const decidedAt = new Date().toISOString();
    const note = String(req.body?.note || '').trim().slice(0, 500);

    db.prepare(`
      UPDATE vacation_requests
      SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?
      WHERE id = ?
    `).run(status, decidedBy, decidedAt, note, existing.id);

    const row = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(existing.id);
    return res.json({ ok: true, request: publicRequest(row) });
  });

  app.delete('/api/vacation-requests/:id', (req, res) => {
    const auth = authenticate(req, res);
    if (!auth) return;
    const role = roleName(auth.schema, auth.user);
    const row = db.prepare('SELECT * FROM vacation_requests WHERE id = ?').get(String(req.params.id || ''));
    if (!row) return res.status(404).json({ ok: false, error: 'Urlaubswunsch wurde nicht gefunden.' });

    const ownsTarget = role === 'fahrer' && ownProfiles(auth.schema, auth.user).has(normalize(row.profile));
    const driverMayWithdraw = ownsTarget && row.status === 'pending';
    if (!driverMayWithdraw && !mayReviewVacation(role)) {
      return res.status(403).json({
        ok: false,
        error: 'Fahrer dürfen nur einen noch offenen eigenen Urlaubswunsch zurückziehen.'
      });
    }

    db.prepare('DELETE FROM vacation_requests WHERE id = ?').run(row.id);
    return res.json({ ok: true, deleted: row.id });
  });

  app.use('/api/data/:key', (req, res, next) => {
    const key = String(req.params.key || '');
    const isPlan = key.startsWith('plan_');
    const isLegacyVacation = key.startsWith('vacation_');
    if (!isPlan && !isLegacyVacation) return next();

    const auth = authenticate(req, res);
    if (!auth) return;
    const role = roleName(auth.schema, auth.user);
    const prefix = isPlan ? 'plan_' : 'vacation_';
    const targetProfile = normalize(key.slice(prefix.length));
    const method = String(req.method || 'GET').toUpperCase();
    const ownsTarget = role === 'fahrer' && ownProfiles(auth.schema, auth.user).has(targetProfile);

    if (isPlan) {
      if (method === 'PUT') {
        if (!mayManagePlans(role)) {
          return res.status(403).json({
            ok: false,
            error: 'Nur Administrator, Geschäftsleitung und Disposition dürfen Fahrerpläne ändern.'
          });
        }
        return next();
      }
      if (method === 'GET') {
        if (mayManagePlans(role) || ownsTarget) return next();
        return res.status(403).json({ ok: false, error: 'Fahrer dürfen ausschließlich ihren eigenen Dienstplan ansehen.' });
      }
      return next();
    }

    if (method === 'GET' && (mayReadAllVacation(role) || ownsTarget)) return next();
    if (method === 'PUT' && mayReadAllVacation(role)) return next();
    return res.status(403).json({
      ok: false,
      error: 'Urlaubswünsche müssen über den Genehmigungsablauf gespeichert werden.'
    });
  });

  console.log('DienstPilot: Fahrerplan- und Urlaubswunsch-Rechte aktiv (Version 4).');
};
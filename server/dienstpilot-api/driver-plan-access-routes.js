'use strict';

const path = require('path');
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

  function roleName(schema, user) {
    return normalize(user?.[schema.role]);
  }

  function mayManage(role) {
    return ['administrator', 'geschaftsleitung', 'geschaeftsleitung', 'disposition'].includes(role);
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

  app.get('/api/driver-plan-access/status', (req, res) => {
    try {
      const schema = userSchema();
      return res.json({
        ok: true,
        active: true,
        version: 2,
        usernameColumn: schema.username,
        roleColumn: schema.role,
        protectedPrefixes: ['plan_', 'vacation_'],
        driverVacationWrite: true
      });
    } catch (error) {
      return res.status(500).json({ ok: false, active: false, error: error.message });
    }
  });

  app.use('/api/data/:key', (req, res, next) => {
    const key = String(req.params.key || '');
    const isPlan = key.startsWith('plan_');
    const isVacation = key.startsWith('vacation_');
    if (!isPlan && !isVacation) return next();

    const auth = authenticate(req, res);
    if (!auth) return;

    const role = roleName(auth.schema, auth.user);
    const prefix = isPlan ? 'plan_' : 'vacation_';
    const targetProfile = normalize(key.slice(prefix.length));
    const method = String(req.method || 'GET').toUpperCase();
    const ownsTarget = role === 'fahrer' && ownProfiles(auth.schema, auth.user).has(targetProfile);

    if (isPlan) {
      if (method === 'PUT') {
        if (!mayManage(role)) {
          return res.status(403).json({
            ok: false,
            error: 'Nur Administrator, Geschäftsleitung und Disposition dürfen Fahrerpläne ändern.'
          });
        }
        return next();
      }

      if (method === 'GET') {
        if (mayManage(role) || ownsTarget) return next();
        return res.status(403).json({
          ok: false,
          error: 'Fahrer dürfen ausschließlich ihren eigenen Dienstplan ansehen.'
        });
      }

      return next();
    }

    if (isVacation) {
      if (method === 'GET' || method === 'PUT') {
        if (mayManage(role) || ownsTarget) return next();
        return res.status(403).json({
          ok: false,
          error: 'Fahrer dürfen ausschließlich ihren eigenen Jahresurlaub bearbeiten.'
        });
      }
      return res.status(405).json({ ok: false, error: 'Diese Aktion ist für Jahresurlaub nicht erlaubt.' });
    }

    return next();
  });

  console.log('DienstPilot: Fahrerplan- und Jahresurlaub-Rechte aktiv (Version 2).');
};
'use strict';

const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) {}

module.exports = function registerInvitationRoutes(app) {
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
    throw new Error('DienstPilot invitation routes: Express-App fehlt.');
  }
  if (app.__dienstpilotInvitationRoutesInstalled) return;
  app.__dienstpilotInvitationRoutesInstalled = true;

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('DienstPilot invitation routes: JWT_SECRET fehlt.');

  const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'dienstpilot.sqlite');
  const APP_URL = process.env.APP_URL || 'https://rrunke391-arch.github.io/DienstPilot/';
  const INVITE_HOURS = 48;
  const CHANGE_MINUTES = 20;
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      start_password_hash TEXT NOT NULL,
      change_token_hash TEXT UNIQUE,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      driver_profile TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      change_expires_at TEXT,
      verified_at TEXT,
      used_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_invitations_username ON invitations(username);
    CREATE INDEX IF NOT EXISTS idx_invitations_expires ON invitations(expires_at);
  `);

  const nowIso = () => new Date().toISOString();
  const addMsIso = (milliseconds) => new Date(Date.now() + milliseconds).toISOString();
  const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
  const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
  const randomPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!$%&*+-=?';
    const all = upper + lower + numbers + symbols;
    const pick = (set) => set[crypto.randomInt(0, set.length)];
    const chars = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
    while (chars.length < 14) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = crypto.randomInt(0, i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  };
  const normalize = (value) => String(value || '').trim();
  const normalizeRole = (value) => {
    const role = normalize(value);
    const allowed = new Set(['Fahrer', 'Disposition', 'Geschaeftsleitung', 'Administrator']);
    return allowed.has(role) ? role : 'Fahrer';
  };

  function bearerToken(req) {
    const header = String(req.headers.authorization || '');
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : '';
  }

  function decodedUsername(decoded) {
    if (!decoded || typeof decoded !== 'object') return '';
    return normalize(decoded.username || decoded.user || decoded.name || decoded.sub || '');
  }

  function decodedRole(decoded) {
    if (!decoded || typeof decoded !== 'object') return '';
    return normalize(decoded.role || decoded.userRole || '');
  }

  function requireAdmin(req, res, next) {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Anmeldung erforderlich.' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decodedRole(decoded) !== 'Administrator') {
        return res.status(403).json({ ok: false, error: 'Nur Administratoren dürfen Einladungen senden.' });
      }
      req.inviteAdmin = decoded;
      return next();
    } catch (_) {
      return res.status(401).json({ ok: false, error: 'Die Anmeldung ist abgelaufen.' });
    }
  }

  function findInvitation(rawToken) {
    return db.prepare('SELECT * FROM invitations WHERE token_hash = ?').get(sha256(rawToken));
  }

  function invitationState(invitation) {
    if (!invitation) return { ok: false, status: 404, error: 'Einladung wurde nicht gefunden.' };
    if (invitation.used_at) return { ok: false, status: 410, error: 'Dieser Einladungslink wurde bereits verwendet.' };
    if (Date.parse(invitation.expires_at) <= Date.now()) {
      return { ok: false, status: 410, error: 'Dieser Einladungslink ist abgelaufen.' };
    }
    return { ok: true };
  }

  function publicInvitation(invitation) {
    return {
      username: invitation.username,
      displayName: invitation.display_name,
      email: invitation.email,
      role: invitation.role,
      driverProfile: invitation.driver_profile,
      expiresAt: invitation.expires_at
    };
  }

  async function maybeSendMail(invitation, inviteUrl, startPassword) {
    if (!nodemailer) return { sent: false, reason: 'nodemailer ist nicht installiert' };
    const host = normalize(process.env.SMTP_HOST);
    const port = Number(process.env.SMTP_PORT || 587);
    const user = normalize(process.env.SMTP_USER);
    const pass = String(process.env.SMTP_PASS || '');
    const from = normalize(process.env.SMTP_FROM || user);
    if (!host || !user || !pass || !from) return { sent: false, reason: 'SMTP ist nicht eingerichtet' };

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
      auth: { user, pass }
    });

    const expiryText = new Date(invitation.expires_at).toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin'
    });
    const text = [
      `Hallo ${invitation.display_name},`,
      '',
      'du wurdest zu DienstPilot eingeladen.',
      '',
      `Einmal-Link: ${inviteUrl}`,
      `Benutzername: ${invitation.username}`,
      `Einmal-Passwort: ${startPassword}`,
      '',
      `Link und Einmal-Passwort sind bis ${expiryText} gültig und nur einmal verwendbar.`,
      'Nach der Anmeldung musst du sofort ein eigenes Passwort festlegen.',
      '',
      'Viele Grüße',
      'Runke'
    ].join('\n');

    await transporter.sendMail({ from, to: invitation.email, subject: 'DienstPilot Einladung', text });
    return { sent: true };
  }

  function userColumns() {
    const columns = db.prepare('PRAGMA table_info(users)').all();
    if (!columns.length) throw new Error('Die Benutzertabelle users wurde nicht gefunden.');
    return columns;
  }

  function columnName(columns, candidates) {
    const byLower = new Map(columns.map((column) => [String(column.name).toLowerCase(), column.name]));
    for (const candidate of candidates) {
      const found = byLower.get(candidate.toLowerCase());
      if (found) return found;
    }
    return '';
  }

  function quoteIdentifier(name) {
    return '"' + String(name).replace(/"/g, '""') + '"';
  }

  function mapUserSchema() {
    const columns = userColumns();
    const schema = {
      columns,
      id: columnName(columns, ['id', 'user_id', 'userId']),
      username: columnName(columns, ['username', 'user_name', 'login', 'name']),
      displayName: columnName(columns, ['display_name', 'displayName', 'fullname', 'full_name']),
      email: columnName(columns, ['email', 'email_address']),
      role: columnName(columns, ['role', 'user_role']),
      driverProfile: columnName(columns, ['driver_profile', 'driverProfile', 'profile']),
      passwordHash: columnName(columns, ['password_hash', 'passwordHash', 'pass_hash']),
      mustChange: columnName(columns, ['must_change_password', 'mustChangePassword', 'password_change_required']),
      active: columnName(columns, ['active', 'is_active', 'enabled']),
      createdAt: columnName(columns, ['created_at', 'createdAt']),
      updatedAt: columnName(columns, ['updated_at', 'updatedAt'])
    };
    if (!schema.username || !schema.passwordHash) {
      throw new Error('Die Benutzertabelle hat kein erkanntes Benutzername-/Passwortfeld.');
    }
    return schema;
  }

  function valueForRequiredUnknown(column, invitation) {
    const type = String(column.type || '').toUpperCase();
    const name = String(column.name || '').toLowerCase();
    if (name.includes('name')) return invitation.display_name || invitation.username;
    if (name.includes('role')) return invitation.role;
    if (name.includes('profile')) return invitation.driver_profile;
    if (name.includes('email')) return invitation.email;
    if (name.includes('active') || name.includes('enabled')) return 1;
    if (name.includes('created') || name.includes('updated')) return nowIso();
    if (type.includes('INT') || type.includes('REAL') || type.includes('NUM')) return 0;
    return '';
  }

  function upsertUser(invitation, passwordHash) {
    const schema = mapUserSchema();
    const existing = db.prepare(
      `SELECT * FROM users WHERE lower(${quoteIdentifier(schema.username)}) = lower(?)`
    ).get(invitation.username);

    const values = new Map();
    values.set(schema.username, invitation.username);
    values.set(schema.passwordHash, passwordHash);
    if (schema.displayName) values.set(schema.displayName, invitation.display_name);
    if (schema.email) values.set(schema.email, invitation.email);
    if (schema.role) values.set(schema.role, invitation.role);
    if (schema.driverProfile) values.set(schema.driverProfile, invitation.driver_profile);
    if (schema.mustChange) values.set(schema.mustChange, 0);
    if (schema.active) values.set(schema.active, 1);
    if (schema.updatedAt) values.set(schema.updatedAt, nowIso());

    if (existing) {
      const updates = [...values.entries()].filter(([name]) => name !== schema.username);
      const sql = `UPDATE users SET ${updates.map(([name]) => `${quoteIdentifier(name)} = ?`).join(', ')} WHERE lower(${quoteIdentifier(schema.username)}) = lower(?)`;
      db.prepare(sql).run(...updates.map(([, value]) => value), invitation.username);
    } else {
      if (schema.createdAt) values.set(schema.createdAt, nowIso());
      for (const column of schema.columns) {
        if (column.pk || values.has(column.name) || column.dflt_value !== null || !column.notnull) continue;
        values.set(column.name, valueForRequiredUnknown(column, invitation));
      }
      const entries = [...values.entries()].filter(([name]) => name);
      const sql = `INSERT INTO users (${entries.map(([name]) => quoteIdentifier(name)).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`;
      db.prepare(sql).run(...entries.map(([, value]) => value));
    }

    const row = db.prepare(
      `SELECT * FROM users WHERE lower(${quoteIdentifier(schema.username)}) = lower(?)`
    ).get(invitation.username);
    return { row, schema };
  }

  function publicUser(row, schema, invitation) {
    const id = schema.id ? row[schema.id] : undefined;
    return {
      id,
      username: row[schema.username] || invitation.username,
      displayName: (schema.displayName && row[schema.displayName]) || invitation.display_name,
      email: (schema.email && row[schema.email]) || invitation.email,
      role: (schema.role && row[schema.role]) || invitation.role,
      driverProfile: (schema.driverProfile && row[schema.driverProfile]) || invitation.driver_profile
    };
  }

  app.post('/api/invitations', requireAdmin, async (req, res) => {
    const username = normalize(req.body && req.body.username);
    const displayName = normalize(req.body && req.body.displayName) || username;
    const email = normalize(req.body && req.body.email);
    const role = normalizeRole(req.body && req.body.role);
    const driverProfile = normalize(req.body && req.body.driverProfile) || username.toLowerCase();

    if (!username || !email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Benutzername und gültige E-Mail-Adresse sind erforderlich.' });
    }
    if (username.toLowerCase() === 'runke') {
      return res.status(400).json({ ok: false, error: 'Der Hauptadministrator kann nicht eingeladen werden.' });
    }

    const rawToken = randomToken(32);
    const startPassword = randomPassword();
    const tokenHash = sha256(rawToken);
    const startPasswordHash = await bcrypt.hash(startPassword, 12);
    const createdAt = nowIso();
    const expiresAt = addMsIso(INVITE_HOURS * 60 * 60 * 1000);
    const createdBy = decodedUsername(req.inviteAdmin) || 'Administrator';

    const insert = db.transaction(() => {
      db.prepare('UPDATE invitations SET used_at = ? WHERE used_at IS NULL AND (lower(username) = lower(?) OR lower(email) = lower(?))')
        .run(createdAt, username, email);
      db.prepare(`
        INSERT INTO invitations (
          token_hash, start_password_hash, username, display_name, email, role,
          driver_profile, expires_at, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(tokenHash, startPasswordHash, username, displayName, email, role, driverProfile, expiresAt, createdAt, createdBy);
    });
    insert();

    const inviteUrl = APP_URL + (APP_URL.includes('?') ? '&' : '?') + 'invite=' + encodeURIComponent(rawToken);
    let mailResult = { sent: false };
    try {
      mailResult = await maybeSendMail({
        username,
        display_name: displayName,
        email,
        role,
        driver_profile: driverProfile,
        expires_at: expiresAt
      }, inviteUrl, startPassword);
    } catch (error) {
      mailResult = { sent: false, reason: error.message };
    }

    return res.json({
      ok: true,
      sent: Boolean(mailResult.sent),
      mailError: mailResult.sent ? '' : (mailResult.reason || ''),
      inviteUrl,
      startPassword,
      expiresAt
    });
  });

  app.get('/api/invitations/:token', (req, res) => {
    const invitation = findInvitation(req.params.token);
    const state = invitationState(invitation);
    if (!state.ok) return res.status(state.status).json({ ok: false, error: state.error });
    return res.json({ ok: true, invitation: publicInvitation(invitation) });
  });

  app.post('/api/invitations/:token/verify', async (req, res) => {
    const invitation = findInvitation(req.params.token);
    const state = invitationState(invitation);
    if (!state.ok) return res.status(state.status).json({ ok: false, error: state.error });

    const startPassword = String((req.body && req.body.startPassword) || '');
    const valid = startPassword && await bcrypt.compare(startPassword, invitation.start_password_hash);
    if (!valid) return res.status(401).json({ ok: false, error: 'Das Einmal-Passwort ist falsch.' });

    const changeToken = randomToken(32);
    const changeTokenHash = sha256(changeToken);
    const verifiedAt = nowIso();
    const changeExpiresAt = addMsIso(CHANGE_MINUTES * 60 * 1000);

    const result = db.prepare(`
      UPDATE invitations
      SET verified_at = ?, used_at = ?, change_token_hash = ?, change_expires_at = ?
      WHERE id = ? AND used_at IS NULL
    `).run(verifiedAt, verifiedAt, changeTokenHash, changeExpiresAt, invitation.id);

    if (result.changes !== 1) {
      return res.status(409).json({ ok: false, error: 'Dieser Einladungslink wurde gerade bereits verwendet.' });
    }

    return res.json({ ok: true, changeToken });
  });

  app.post('/api/invitations/password', async (req, res) => {
    const changeToken = String((req.body && req.body.changeToken) || '');
    const newPassword = String((req.body && req.body.newPassword) || '');
    if (!changeToken || newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'Ein gültiges Änderungskennzeichen und mindestens 8 Zeichen sind erforderlich.' });
    }

    const hash = sha256(changeToken);
    const invitation = db.prepare('SELECT * FROM invitations WHERE change_token_hash = ?').get(hash);
    if (!invitation || !invitation.verified_at || !invitation.used_at) {
      return res.status(410).json({ ok: false, error: 'Die Passwortänderung ist nicht mehr gültig.' });
    }
    if (!invitation.change_expires_at || Date.parse(invitation.change_expires_at) <= Date.now()) {
      return res.status(410).json({ ok: false, error: 'Die Zeit für die Passwortänderung ist abgelaufen.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    let saved;
    try {
      saved = db.transaction(() => {
        const userResult = upsertUser(invitation, passwordHash);
        const cleared = db.prepare(`
          UPDATE invitations
          SET change_token_hash = NULL, change_expires_at = NULL
          WHERE id = ? AND change_token_hash = ?
        `).run(invitation.id, hash);
        if (cleared.changes !== 1) throw new Error('Die Passwortänderung wurde bereits abgeschlossen.');
        return userResult;
      })();
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Benutzer konnte nicht gespeichert werden: ' + error.message });
    }

    const user = publicUser(saved.row, saved.schema, invitation);
    const authToken = jwt.sign(
      { id: user.id, userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    return res.json({ ok: true, token: authToken, user });
  });

  console.log('DienstPilot: sichere Einladungsrouten aktiv (48 Stunden, einmalig).');
};

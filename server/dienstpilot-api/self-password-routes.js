'use strict';

const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

module.exports = function registerSelfPasswordRoutes(app) {
  if (!app || typeof app.post !== 'function' || typeof app.get !== 'function') {
    throw new Error('DienstPilot self-password routes: Express-App fehlt.');
  }
  if (app.__dienstpilotSelfPasswordRoutesInstalled) return;
  app.__dienstpilotSelfPasswordRoutesInstalled = true;

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('DienstPilot self-password routes: JWT_SECRET fehlt.');

  const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'dienstpilot.sqlite');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const normalize = (value) => String(value || '').trim();
  const nowIso = () => new Date().toISOString();

  function bearerToken(req) {
    const header = String(req.headers.authorization || '');
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : '';
  }

  function userColumns() {
    const columns = db.prepare('PRAGMA table_info(users)').all();
    if (!columns.length) throw new Error('Die Benutzertabelle users wurde nicht gefunden.');
    return columns;
  }

  function columnName(columns, candidates) {
    const byLower = new Map(columns.map((column) => [String(column.name).toLowerCase(), column.name]));
    for (const candidate of candidates) {
      const found = byLower.get(String(candidate).toLowerCase());
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
      passwordHash: columnName(columns, ['password_hash', 'passwordHash', 'pass_hash', 'password']),
      mustChange: columnName(columns, ['must_change_password', 'mustChangePassword', 'password_change_required']),
      active: columnName(columns, ['active', 'is_active', 'enabled']),
      updatedAt: columnName(columns, ['updated_at', 'updatedAt'])
    };
    if (!schema.username || !schema.passwordHash) {
      throw new Error('Die Benutzertabelle hat kein erkanntes Benutzername-/Passwortfeld.');
    }
    return schema;
  }

  function decodedIdentity(decoded) {
    if (!decoded || typeof decoded !== 'object') return { username: '', id: null };

    let username = normalize(decoded.username || decoded.user || decoded.name || '');
    let id = decoded.id ?? decoded.userId ?? decoded.user_id ?? null;
    const subject = decoded.sub;

    if (!username && subject !== undefined && subject !== null) {
      const text = normalize(subject);
      if (/^\d+$/.test(text)) {
        if (id === null || id === undefined || id === '') id = Number(text);
      } else {
        username = text;
      }
    }

    return { username, id };
  }

  function findAuthenticatedUser(decoded) {
    const schema = mapUserSchema();
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

    if (!user) return { schema, user: null, username: identity.username };
    return {
      schema,
      user,
      username: normalize(user[schema.username]) || identity.username
    };
  }

  function requireUser(req, res, next) {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Anmeldung erforderlich.' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const authenticated = findAuthenticatedUser(decoded);
      if (!authenticated.user || !authenticated.username) {
        return res.status(401).json({ ok: false, error: 'Benutzer konnte aus der Anmeldung nicht ermittelt werden. Bitte neu anmelden.' });
      }
      req.passwordUser = { decoded, ...authenticated };
      return next();
    } catch (error) {
      return res.status(401).json({
        ok: false,
        error: error && error.name === 'TokenExpiredError'
          ? 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.'
          : 'Die Anmeldung konnte nicht geprüft werden. Bitte neu anmelden.'
      });
    }
  }

  app.get('/api/account/password/status', (req, res) => {
    try {
      const schema = mapUserSchema();
      return res.json({
        ok: true,
        active: true,
        version: 3,
        database: path.basename(DB_PATH),
        usernameColumn: schema.username,
        passwordColumn: schema.passwordHash
      });
    } catch (error) {
      return res.status(500).json({ ok: false, active: false, error: error.message });
    }
  });

  app.post('/api/account/password', requireUser, async (req, res) => {
    const currentPassword = String((req.body && req.body.currentPassword) || '');
    const newPassword = String((req.body && req.body.newPassword) || '');

    if (!currentPassword) {
      return res.status(400).json({ ok: false, error: 'Das aktuelle Passwort fehlt.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'Das neue Passwort muss mindestens 8 Zeichen haben.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ ok: false, error: 'Das neue Passwort muss sich vom bisherigen Passwort unterscheiden.' });
    }

    const { schema, user, username } = req.passwordUser;
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Das angemeldete Benutzerkonto wurde nicht gefunden.' });
    }
    if (schema.active && Number(user[schema.active]) === 0) {
      return res.status(403).json({ ok: false, error: 'Dieses Benutzerkonto ist nicht aktiv.' });
    }

    let currentValid = false;
    try {
      currentValid = await bcrypt.compare(currentPassword, String(user[schema.passwordHash] || ''));
    } catch (_) {
      currentValid = false;
    }
    if (!currentValid) {
      return res.status(401).json({ ok: false, error: 'Das aktuelle Passwort ist falsch.' });
    }

    try {
      const newHash = await bcrypt.hash(newPassword, 12);
      const updates = [[schema.passwordHash, newHash]];
      if (schema.mustChange) updates.push([schema.mustChange, 0]);
      if (schema.updatedAt) updates.push([schema.updatedAt, nowIso()]);

      const result = db.prepare(
        `UPDATE users SET ${updates.map(([name]) => `${quoteIdentifier(name)} = ?`).join(', ')} WHERE lower(${quoteIdentifier(schema.username)}) = lower(?)`
      ).run(...updates.map(([, value]) => value), username);

      if (result.changes !== 1) {
        return res.status(500).json({ ok: false, error: 'Das Passwort konnte nicht gespeichert werden.' });
      }
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Das Passwort konnte nicht gespeichert werden: ' + error.message });
    }

    return res.json({ ok: true, message: 'Passwort wurde geändert.' });
  });

  console.log('DienstPilot: persönliche Passwortänderung aktiv (Version 3).');
};
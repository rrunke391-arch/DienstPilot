'use strict';

const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

module.exports = function registerSelfPasswordRoutes(app) {
  if (!app || typeof app.post !== 'function') {
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

  function decodedUsername(decoded) {
    if (!decoded || typeof decoded !== 'object') return '';
    return normalize(decoded.username || decoded.user || decoded.name || decoded.sub || '');
  }

  function requireUser(req, res, next) {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Anmeldung erforderlich.' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const username = decodedUsername(decoded);
      if (!username) return res.status(401).json({ ok: false, error: 'Benutzer konnte nicht ermittelt werden.' });
      req.passwordUser = { decoded, username };
      return next();
    } catch (_) {
      return res.status(401).json({ ok: false, error: 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.' });
    }
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
      passwordHash: columnName(columns, ['password_hash', 'passwordHash', 'pass_hash']),
      mustChange: columnName(columns, ['must_change_password', 'mustChangePassword', 'password_change_required']),
      active: columnName(columns, ['active', 'is_active', 'enabled']),
      updatedAt: columnName(columns, ['updated_at', 'updatedAt'])
    };
    if (!schema.username || !schema.passwordHash) {
      throw new Error('Die Benutzertabelle hat kein erkanntes Benutzername-/Passwortfeld.');
    }
    return schema;
  }

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

    let schema;
    let user;
    try {
      schema = mapUserSchema();
      user = db.prepare(
        `SELECT * FROM users WHERE lower(${quoteIdentifier(schema.username)}) = lower(?)`
      ).get(req.passwordUser.username);
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Benutzerdaten konnten nicht gelesen werden: ' + error.message });
    }

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
      ).run(...updates.map(([, value]) => value), req.passwordUser.username);

      if (result.changes !== 1) {
        return res.status(500).json({ ok: false, error: 'Das Passwort konnte nicht gespeichert werden.' });
      }
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Das Passwort konnte nicht gespeichert werden: ' + error.message });
    }

    return res.json({ ok: true, message: 'Passwort wurde geändert.' });
  });

  console.log('DienstPilot: persönliche Passwortänderung aktiv.');
};
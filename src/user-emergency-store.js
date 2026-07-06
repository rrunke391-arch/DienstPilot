(() => {
  'use strict';

  const MAIN = 'dienstpilot_users_v1';
  const COPY = 'dienstpilot_users_reserve_v1';
  const CARD = 'dienstpilotUserAdminCard';
  const DB = 'dienstpilot_user_reserve_db';
  const STORE = 'reserve';
  const ID = 'latest';

  function n(v) { return String(v || '').trim().toLowerCase(); }
  function readRaw(key) { return localStorage.getItem(key) || ''; }

  function readList(raw) {
    try {
      const value = JSON.parse(raw || '[]');
      if (Array.isArray(value)) return value;
      if (Array.isArray(value.users)) return value.users;
      if (typeof value.raw === 'string') return readList(value.raw);
      return [];
    } catch { return []; }
  }

  function useful(list) {
    return list.some(user => user && user.username && n(user.username) !== 'runke');
  }

  function makePack(raw) {
    return {
      app: 'DienstPilot',
      type: 'Benutzer-Notfallsicherung',
      version: 3,
      savedAt: new Date().toISOString(),
      raw
    };
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB nicht verfügbar'));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB Fehler'));
    });
  }

  async function writeDb(pack) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id: ID, pack });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Sicherung nicht gespeichert'));
    });
    db.close();
  }

  async function readDb() {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(ID);
      req.onsuccess = () => resolve(req.result?.pack || null);
      req.onerror = () => reject(req.error || new Error('Sicherung nicht gelesen'));
    });
    db.close();
    return result;
  }

  async function saveCopy(raw) {
    const list = readList(raw);
    if (!useful(list)) return false;
    const pack = makePack(raw);
    localStorage.setItem(COPY, JSON.stringify(pack));
    try { await writeDb(pack); } catch {}
    return true;
  }

  async function bestPack() {
    const localPack = JSON.parse(readRaw(COPY) || '{}');
    if (useful(readList(localPack.raw || JSON.stringify(localPack.users || [])))) return localPack;
    try {
      const dbPack = await readDb();
      if (dbPack && useful(readList(dbPack.raw || JSON.stringify(dbPack.users || [])))) return dbPack;
    } catch {}
    return null;
  }

  async function autoCopy() {
    return saveCopy(readRaw(MAIN));
  }

  async function autoRestoreIfNeeded() {
    if (useful(readList(readRaw(MAIN)))) {
      await autoCopy();
      return;
    }
    const pack = await bestPack();
    if (!pack) return;
    const raw = typeof pack.raw === 'string' ? pack.raw : JSON.stringify(pack.users || []);
    const list = readList(raw).filter(user => n(user.username) !== 'runke');
    if (!useful(list)) return;
    localStorage.setItem(MAIN, JSON.stringify(list));
    setStatus('Benutzer wurden automatisch aus der Notfallsicherung wiederhergestellt.');
    setTimeout(() => document.querySelector('#dpRefreshUsers')?.click(), 150);
  }

  async function restoreFromCopy() {
    const pack = await bestPack();
    if (!pack) return setStatus('Keine brauchbare Notfallsicherung gefunden.', true);
    const raw = typeof pack.raw === 'string' ? pack.raw : JSON.stringify(pack.users || []);
    const list = readList(raw).filter(user => n(user.username) !== 'runke');
    if (!useful(list)) return setStatus('Keine brauchbare Notfallsicherung gefunden.', true);
    localStorage.setItem(MAIN, JSON.stringify(list));
    await saveCopy(JSON.stringify(list));
    setStatus('Benutzer wurden aus der Notfallsicherung wiederhergestellt.');
    document.querySelector('#dpRefreshUsers')?.click();
  }

  async function exportText() {
    await autoCopy();
    const pack = await bestPack();
    const area = document.querySelector('#dpUserBackupText');
    if (!area || !pack) return setStatus('Keine brauchbare Notfallsicherung zum Exportieren gefunden.', true);
    area.value = JSON.stringify(pack);
    area.focus();
    area.select();
    setStatus('Notfallsicherung wurde erzeugt. Text bitte extern speichern.');
  }

  async function importText() {
    const area = document.querySelector('#dpUserBackupText');
    if (!area) return;
    try {
      const pack = JSON.parse(area.value || '{}');
      const raw = typeof pack.raw === 'string' ? pack.raw : JSON.stringify(pack.users || pack || []);
      const list = readList(raw).filter(user => n(user.username) !== 'runke');
      if (!useful(list)) return setStatus('Im Text wurde keine brauchbare Benutzer-Notfallsicherung gefunden.', true);
      localStorage.setItem(MAIN, JSON.stringify(list));
      await saveCopy(JSON.stringify(list));
      setStatus('Benutzer wurden aus dem Notfalltext wiederhergestellt.');
      document.querySelector('#dpRefreshUsers')?.click();
    } catch {
      setStatus('Notfalltext konnte nicht gelesen werden.', true);
    }
  }

  function setStatus(text, error) {
    const box = document.querySelector('#dpUserAdminStatus');
    if (!box) return;
    box.textContent = text;
    box.style.color = error ? '#b91c1c' : '#166534';
  }

  function button(id, text, action) {
    let btn = document.getElementById(id);
    if (btn) return btn;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = 'btn-secondary';
    btn.textContent = text;
    btn.addEventListener('click', action);
    return btn;
  }

  function addControls() {
    const card = document.getElementById(CARD);
    const area = document.querySelector('#dpUserBackupText');
    if (!card || !area || document.getElementById('dpEmergencyExport')) return;
    const row = document.createElement('div');
    row.className = 'dp-user-admin-actions';
    row.append(
      button('dpEmergencyExport', 'Notfallsicherung exportieren', exportText),
      button('dpEmergencyImport', 'Notfallsicherung importieren', importText),
      button('dpEmergencyRestore', 'Lokale Notfallsicherung wiederherstellen', restoreFromCopy)
    );
    area.insertAdjacentElement('afterend', row);
  }

  function start() {
    autoRestoreIfNeeded();
    addControls();
    document.addEventListener('click', () => {
      setTimeout(addControls, 250);
      setTimeout(autoCopy, 500);
    }, true);
    setInterval(autoCopy, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

(() => {
  'use strict';

  const MAIN = 'dienstpilot_users_v1';
  const COPY = 'dienstpilot_users_reserve_v1';
  const CARD = 'dienstpilotUserAdminCard';

  function n(v) { return String(v || '').trim().toLowerCase(); }

  function readRaw(key) {
    return localStorage.getItem(key) || '';
  }

  function readList(raw) {
    try {
      const value = JSON.parse(raw || '[]');
      if (Array.isArray(value)) return value;
      if (Array.isArray(value.users)) return value.users;
      if (typeof value.raw === 'string') return readList(value.raw);
      return [];
    } catch {
      return [];
    }
  }

  function useful(list) {
    return list.some(user => user && user.username && n(user.username) !== 'runke');
  }

  function saveCopy(raw) {
    const list = readList(raw);
    if (!useful(list)) return false;
    const pack = {
      app: 'DienstPilot',
      type: 'Benutzer-Notfallsicherung',
      version: 2,
      savedAt: new Date().toISOString(),
      raw
    };
    localStorage.setItem(COPY, JSON.stringify(pack));
    return true;
  }

  function autoCopy() {
    return saveCopy(readRaw(MAIN));
  }

  function restoreFromCopy() {
    const pack = JSON.parse(readRaw(COPY) || '{}');
    const raw = typeof pack.raw === 'string' ? pack.raw : JSON.stringify(pack.users || []);
    const list = readList(raw).filter(user => n(user.username) !== 'runke');
    if (!useful(list)) return setStatus('Keine brauchbare Notfallsicherung gefunden.', true);
    localStorage.setItem(MAIN, JSON.stringify(list));
    setStatus('Benutzer wurden aus der lokalen Notfallsicherung wiederhergestellt.');
    document.querySelector('#dpRefreshUsers')?.click();
  }

  function exportText() {
    autoCopy();
    const area = document.querySelector('#dpUserBackupText');
    if (!area) return;
    area.value = readRaw(COPY);
    area.focus();
    area.select();
    setStatus('Notfallsicherung wurde erzeugt. Text bitte extern speichern.');
  }

  function importText() {
    const area = document.querySelector('#dpUserBackupText');
    if (!area) return;
    try {
      const pack = JSON.parse(area.value || '{}');
      const raw = typeof pack.raw === 'string' ? pack.raw : JSON.stringify(pack.users || pack || []);
      const list = readList(raw).filter(user => n(user.username) !== 'runke');
      if (!useful(list)) return setStatus('Im Text wurde keine brauchbare Benutzer-Notfallsicherung gefunden.', true);
      localStorage.setItem(MAIN, JSON.stringify(list));
      saveCopy(JSON.stringify(list));
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

  function wrapStorage() {
    if (localStorage.__dienstpilotUserReserve === 'yes') return;
    const oldSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      oldSet(key, value);
      if (key === MAIN) setTimeout(autoCopy, 50);
    };
    localStorage.__dienstpilotUserReserve = 'yes';
  }

  function start() {
    wrapStorage();
    autoCopy();
    addControls();
    document.addEventListener('click', () => setTimeout(addControls, 250), true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

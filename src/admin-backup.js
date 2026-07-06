(() => {
  'use strict';

  const USERS_KEY = 'dienstpilot_users_v1';
  const CARD_ID = 'dienstpilotUserAdminCard';

  function currentUser() {
    return window.DienstPilotAuth?.getCurrentUser?.() || null;
  }

  function isAdmin() {
    return currentUser()?.role === 'Administrator';
  }

  function norm(value) {
    return String(value || '').trim().toLowerCase();
  }

  function readLocalUsers() {
    try {
      const data = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveLocalUsers(list) {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  }

  function publicUsers() {
    return window.DienstPilotAuth?.getAllUsers?.() || [];
  }

  function setStatus(text, error) {
    const box = document.querySelector('#dpUserAdminStatus');
    if (!box) return;
    box.textContent = text;
    box.style.color = error ? '#b91c1c' : '#166534';
  }

  function textValue(value) {
    return String(value || '').trim();
  }

  function preferNew(newValue, oldValue) {
    const cleaned = textValue(newValue);
    return cleaned || textValue(oldValue);
  }

  function cleanUsers(list) {
    return (Array.isArray(list) ? list : [])
      .filter(u => u && u.username && norm(u.username) !== 'runke')
      .map(u => ({
        username: textValue(u.username),
        displayName: textValue(u.displayName || u.username),
        email: textValue(u.email),
        role: textValue(u.role || 'Fahrer'),
        functionTitle: textValue(u.functionTitle),
        driverProfile: textValue(u.driverProfile),
        access: textValue(u.access)
      }));
  }

  function showBackupText() {
    const area = document.querySelector('#dpUserBackupText');
    if (!area) return;
    const backup = {
      app: 'DienstPilot',
      type: 'Benutzer-Sicherung',
      version: 1,
      savedAt: new Date().toISOString(),
      users: cleanUsers(publicUsers())
    };
    area.value = JSON.stringify(backup, null, 2);
    area.focus();
    area.select();
    setStatus('Benutzer-Sicherung wurde erzeugt. Text kopieren und sicher ablegen.');
  }

  function mergeUser(old, incoming) {
    return {
      ...old,
      ...incoming,
      username: preferNew(incoming.username, old.username),
      displayName: preferNew(incoming.displayName, old.displayName || incoming.username),
      email: preferNew(incoming.email, old.email),
      role: preferNew(incoming.role, old.role || 'Fahrer'),
      functionTitle: preferNew(incoming.functionTitle, old.functionTitle),
      driverProfile: preferNew(incoming.driverProfile, old.driverProfile),
      access: preferNew(incoming.access, old.access),
      passwordHash: old.passwordHash || '',
      startPasswordHash: old.startPasswordHash || '',
      mustChangePassword: old.mustChangePassword === true,
      isBuiltin: false
    };
  }

  function readBackupText() {
    const area = document.querySelector('#dpUserBackupText');
    if (!area) return;
    try {
      const data = JSON.parse(area.value || '{}');
      const incoming = cleanUsers(data.users || data);
      if (!incoming.length) {
        setStatus('Keine Benutzer in der Sicherung gefunden.', true);
        return;
      }
      const map = new Map(readLocalUsers().filter(u => norm(u.username) !== 'runke').map(u => [norm(u.username), u]));
      incoming.forEach(u => {
        const old = map.get(norm(u.username)) || {};
        map.set(norm(u.username), mergeUser(old, u));
      });
      saveLocalUsers(Array.from(map.values()));
      setStatus('Benutzer-Sicherung wurde eingelesen. Vorhandene E-Mail-Adressen bleiben erhalten, wenn die Sicherung dort leer ist.');
      setTimeout(() => document.querySelector('#dpRefreshUsers')?.click(), 150);
    } catch {
      setStatus('Sicherung konnte nicht gelesen werden.', true);
    }
  }

  function addControls() {
    if (!isAdmin()) return;
    const card = document.getElementById(CARD_ID);
    if (!card || card.querySelector('#dpUserBackupBox')) return;

    const box = document.createElement('div');
    box.id = 'dpUserBackupBox';
    box.className = 'dp-user-admin-mail';
    box.innerHTML = `
      <h3>Benutzer exportieren / importieren</h3>
      <p class="muted">Sicherungstext kopieren oder hier wieder einfügen. Kennwörter werden dabei nicht gesichert.</p>
      <textarea id="dpUserBackupText" rows="8" placeholder="Hier erscheint die Sicherung oder hier Sicherung einfügen"></textarea>
      <div class="dp-user-admin-actions">
        <button type="button" class="btn-secondary" id="dpShowUserBackup">Benutzer exportieren</button>
        <button type="button" class="btn-secondary" id="dpReadUserBackup">Benutzer importieren</button>
      </div>
    `;

    const table = card.querySelector('.dp-user-admin-table');
    if (table) card.insertBefore(box, table);
    else card.appendChild(box);

    box.querySelector('#dpShowUserBackup').addEventListener('click', showBackupText);
    box.querySelector('#dpReadUserBackup').addEventListener('click', readBackupText);
  }

  function start() {
    addControls();
    document.addEventListener('click', e => {
      if (e.target.closest?.('[data-tab="einstellungen"],#loginButton,#dpRefreshUsers,#dpSaveUser')) {
        setTimeout(addControls, 300);
      }
    }, true);
    new MutationObserver(() => addControls()).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

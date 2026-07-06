(() => {
  'use strict';

  const USERS_KEY = 'dienstpilot_users_v1';
  const CARD_ID = 'dienstpilotUserAdminCard';

  function currentUser() { return window.DienstPilotAuth?.getCurrentUser?.() || null; }
  function isAdmin() { return currentUser()?.role === 'Administrator'; }
  function norm(value) { return String(value || '').trim().toLowerCase(); }

  function users() {
    try {
      const data = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  function saveUsers(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
  function publicUsers() { return window.DienstPilotAuth?.getAllUsers?.() || []; }

  function setStatus(text, error) {
    const box = document.querySelector('#dpUserAdminStatus');
    if (!box) return;
    box.textContent = text;
    box.style.color = error ? '#b91c1c' : '#166534';
  }

  function normalizeRole(value) {
    const cleaned = norm(value).replace(/\./g, '').replace(/ae/g, 'ä');
    if (cleaned === 'fahrer') return 'Fahrer';
    if (cleaned === 'disposition' || cleaned === 'dispo') return 'Disposition';
    if (cleaned === 'geschäftsleitung' || cleaned === 'geschaftsleitung' || cleaned === 'leitung') return 'Geschäftsleitung';
    if (cleaned === 'administrator' || cleaned === 'admin') return 'Administrator';
    return '';
  }

  function roleAccess(role) {
    if (role === 'Administrator') return 'Vollzugriff';
    if (role === 'Geschäftsleitung') return 'Leitung';
    if (role === 'Disposition') return 'Planung';
    return 'Eigener Bereich';
  }

  function getUser(username) {
    const stored = users().find(x => norm(x.username) === norm(username));
    const visible = publicUsers().find(x => norm(x.username) === norm(username));
    if (!stored && !visible) return null;
    return { ...(visible || {}), ...(stored || {}) };
  }

  function upsert(user) {
    const list = users();
    const key = norm(user.username);
    const index = list.findIndex(x => norm(x.username) === key);
    if (index >= 0) list[index] = user;
    else list.push(user);
    saveUsers(list);
  }

  function ask(text, oldValue) {
    const result = window.prompt(text, oldValue || '');
    if (result === null) return null;
    return String(result || '').trim();
  }

  function editUser(username) {
    if (norm(username) === 'runke') {
      setStatus('Runke ist geschützt und wird hier nicht bearbeitet.', true);
      return;
    }

    const old = getUser(username);
    if (!old) { setStatus('Benutzer wurde nicht gefunden.', true); return; }

    const displayName = ask('Anzeigename:', old.displayName || old.username || username);
    if (displayName === null) return;
    const email = ask('E-Mail:', old.email || '');
    if (email === null) return;
    const roleInput = ask('Rolle: Fahrer, Disposition, Geschäftsleitung oder Administrator', old.role || 'Fahrer');
    if (roleInput === null) return;

    const role = normalizeRole(roleInput);
    if (!role) {
      setStatus('Ungültige Rolle. Verwende bitte Fahrer, Disposition, Geschäftsleitung oder Administrator.', true);
      return;
    }

    const driverDefault = old.driverProfile || (role === 'Fahrer' ? norm(displayName || username) : 'alle');
    const driverProfile = ask('Zugeordneter Fahrer:', driverDefault);
    if (driverProfile === null) return;

    upsert({
      ...old,
      username: old.username || username,
      displayName: displayName || old.username || username,
      email,
      role,
      functionTitle: old.functionTitle || '',
      driverProfile: driverProfile || (role === 'Fahrer' ? norm(displayName || username) : 'alle'),
      access: roleAccess(role),
      isBuiltin: false
    });

    setStatus('Benutzer ' + username + ' wurde bearbeitet.');
    setTimeout(() => document.querySelector('#dpRefreshUsers')?.click(), 100);
  }

  function loadBackupAddon() {
    if (document.getElementById('dpAdminBackupScript')) return;
    const script = document.createElement('script');
    script.id = 'dpAdminBackupScript';
    script.src = 'src/admin-backup.js?v=dienstpilot-1';
    document.head.appendChild(script);
  }

  function addButtons() {
    if (!isAdmin()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    card.querySelectorAll('#dpUserAdminRows tr').forEach(row => {
      const name = row.querySelector('td strong')?.textContent?.trim();
      const actionCell = row.querySelector('td:last-child');
      if (!name || !actionCell || norm(name) === 'runke') return;
      if (actionCell.querySelector('.dp-edit-user')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary dp-edit-user';
      btn.textContent = 'Bearbeiten';
      btn.addEventListener('click', () => editUser(name));
      actionCell.prepend(btn);
    });
  }

  function start() {
    loadBackupAddon();
    addButtons();
    document.addEventListener('click', e => {
      if (e.target.closest?.('[data-tab="einstellungen"],#dpRefreshUsers,#dpSaveUser,#loginButton,.dp-reset-login')) setTimeout(addButtons, 300);
    }, true);
    new MutationObserver(() => addButtons()).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

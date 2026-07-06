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

  function users() {
    try {
      const data = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveUsers(list) {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  }

  async function hash(text) {
    const bytes = new TextEncoder().encode(String(text || ''));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function setStatus(text, error) {
    const box = document.querySelector('#dpUserAdminStatus');
    if (!box) return;
    box.textContent = text;
    box.style.color = error ? '#b91c1c' : '#166534';
  }

  function publicUsers() {
    return window.DienstPilotAuth?.getAllUsers?.() || [];
  }

  function upsert(user) {
    const list = users();
    const key = norm(user.username);
    const index = list.findIndex(x => norm(x.username) === key);
    if (index >= 0) list[index] = user;
    else list.push(user);
    saveUsers(list);
  }

  function baseUser(username) {
    const stored = users().find(x => norm(x.username) === norm(username));
    const visible = publicUsers().find(x => norm(x.username) === norm(username));
    if (!visible && !stored) return null;
    const u = { ...(visible || {}), ...(stored || {}) };
    return {
      username: u.username || username,
      displayName: u.displayName || u.username || username,
      email: u.email || '',
      role: u.role || 'Fahrer',
      functionTitle: u.functionTitle || '',
      driverProfile: u.driverProfile || '',
      access: u.access || (u.role === 'Administrator' ? 'Vollzugriff' : 'Eigener Bereich'),
      isBuiltin: false
    };
  }

  async function resetLogin(username) {
    if (norm(username) === 'runke') {
      setStatus('Runke ist geschützt.', true);
      return;
    }

    const value = window.prompt('Neues Startkennwort für ' + username + ':', username + '-Reset-DP2026!');
    if (value === null) return;
    const clean = String(value || '').trim();
    if (clean.length < 8) {
      setStatus('Das Startkennwort muss mindestens 8 Zeichen haben.', true);
      return;
    }

    const u = baseUser(username);
    if (!u) {
      setStatus('Benutzer wurde nicht gefunden.', true);
      return;
    }

    upsert({
      ...u,
      passwordHash: '',
      startPasswordHash: await hash(clean),
      mustChangePassword: true,
      isBuiltin: false
    });

    setStatus('Startkennwort für ' + username + ' wurde zurückgesetzt. Der Benutzer muss beim nächsten Login ein neues Kennwort festlegen.');
    setTimeout(() => document.querySelector('#dpRefreshUsers')?.click(), 100);
  }

  function addButtons() {
    if (!isAdmin()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    const rows = card.querySelectorAll('#dpUserAdminRows tr');
    rows.forEach(row => {
      const name = row.querySelector('td strong')?.textContent?.trim();
      const actionCell = row.querySelector('td:last-child');
      if (!name || !actionCell || norm(name) === 'runke') return;
      if (actionCell.querySelector('.dp-reset-login')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary dp-reset-login';
      btn.textContent = 'Kennwort zurücksetzen';
      btn.addEventListener('click', () => resetLogin(name));
      actionCell.prepend(btn);
    });
  }

  function start() {
    addButtons();
    document.addEventListener('click', e => {
      if (e.target.closest?.('[data-tab="einstellungen"],#dpRefreshUsers,#dpSaveUser,#loginButton')) {
        setTimeout(addButtons, 300);
      }
    }, true);
    new MutationObserver(() => addButtons()).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

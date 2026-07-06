(() => {
  'use strict';

  const KEY = 'dienstpilot_users_v1';

  function norm(value) {
    return String(value || '').trim().toLowerCase();
  }

  function readUsers() {
    try {
      const users = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(users) ? users : [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(KEY, JSON.stringify(users));
  }

  function ensureGerding() {
    const users = readUsers();
    if (users.some(user => norm(user.username) === 'gerding')) return;

    users.push({
      username: 'Gerding',
      displayName: 'Gerding',
      email: '',
      role: 'Fahrer',
      functionTitle: 'Fahrer',
      driverProfile: 'gerding',
      access: 'Eigener Bereich',
      passwordHash: '',
      startPasswordHash: '366f65916062bc7d0c630da89862e086a038218890e193b2697e098afdb60632',
      mustChangePassword: true,
      isBuiltin: false
    });

    saveUsers(users);
  }

  ensureGerding();
})();

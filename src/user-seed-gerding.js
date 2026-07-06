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

  function ensureGerding(users) {
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
  }

  function fixTestfahrer(users) {
    const index = users.findIndex(user => norm(user.username) === 'testfahrer');
    if (index < 0) return;
    const old = users[index] || {};
    users[index] = {
      ...old,
      username: old.username || 'Testfahrer',
      displayName: old.displayName || 'Testfahrer',
      role: 'Fahrer',
      functionTitle: 'Testzugang Fahrer',
      driverProfile: 'testfahrer',
      access: 'Eigener Bereich',
      isBuiltin: false
    };
  }

  function run() {
    const users = readUsers();
    ensureGerding(users);
    fixTestfahrer(users);
    saveUsers(users);
  }

  run();
})();

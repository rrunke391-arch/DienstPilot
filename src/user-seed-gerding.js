(() => {
  'use strict';

  const KEY = 'dienstpilot_users_v1';
  const RUNKE_HASH = '6c651e36960ed17a84e0ab3c3e927efc05f896976a1c29144b55a75a283c4e92';
  const RUNKE_MAIL = 'rrunke391@gmail.com';

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

  function ensureRunkeEmail(users) {
    const index = users.findIndex(user => norm(user.username) === 'runke');
    if (index < 0) {
      users.push({
        username: 'Runke',
        displayName: 'Runke',
        email: RUNKE_MAIL,
        role: 'Administrator',
        functionTitle: 'Entwickler von DienstPilot 2026',
        driverProfile: 'runke',
        access: 'Vollzugriff',
        passwordHash: RUNKE_HASH,
        startPasswordHash: '',
        mustChangePassword: false,
        isBuiltin: false
      });
      return;
    }

    const old = users[index] || {};
    users[index] = {
      ...old,
      username: old.username || 'Runke',
      displayName: old.displayName || 'Runke',
      email: old.email || RUNKE_MAIL,
      role: 'Administrator',
      functionTitle: old.functionTitle || 'Entwickler von DienstPilot 2026',
      driverProfile: 'runke',
      access: 'Vollzugriff',
      passwordHash: old.passwordHash || RUNKE_HASH,
      startPasswordHash: old.startPasswordHash || '',
      mustChangePassword: old.mustChangePassword === true,
      isBuiltin: false
    };
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
    ensureRunkeEmail(users);
    ensureGerding(users);
    fixTestfahrer(users);
    saveUsers(users);
  }

  function install() {
    run();
    document.addEventListener('click', event => {
      if (event.target.closest?.('#dpReadUserBackup,#dpRefreshUsers,[data-tab="einstellungen"]')) {
        setTimeout(run, 250);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

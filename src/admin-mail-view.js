(() => {
  'use strict';

  const MAIL = 'rrunke391' + '@' + 'gmail.com';
  const USER_KEY = 'dienstpilot_users_v1';
  const FIXED_USERS = new Set(['testfahrer', 'gerding']);

  function norm(value) {
    return String(value || '').trim().toLowerCase();
  }

  function cleanFixedUsersFromLocalStorage() {
    try {
      const list = JSON.parse(localStorage.getItem(USER_KEY) || '[]');
      if (!Array.isArray(list)) return;
      const cleaned = list.filter(user => !FIXED_USERS.has(norm(user && user.username)));
      if (cleaned.length !== list.length) localStorage.setItem(USER_KEY, JSON.stringify(cleaned));
    } catch {}
  }

  function run() {
    cleanFixedUsersFromLocalStorage();
    const button = document.getElementById('dpSaveUser');
    if (button) button.textContent = 'Neuen Benutzer speichern';
    document.querySelectorAll('#dpUserAdminRows tr').forEach(row => {
      const name = String(row.querySelector('td strong')?.textContent || '').trim().toLowerCase();
      if (name !== 'runke') return;
      const small = row.querySelector('.dp-user-admin-small');
      if (small && small.textContent.trim() === 'Keine E-Mail') small.textContent = MAIL;
    });
  }

  function start() {
    run();
    document.addEventListener('click', () => setTimeout(run, 300), true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

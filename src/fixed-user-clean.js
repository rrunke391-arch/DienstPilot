(() => {
  'use strict';

  const KEY = 'dienstpilot_users_v1';
  const FIXED = new Set(['testfahrer', 'gerding']);

  function norm(value) {
    return String(value || '').trim().toLowerCase();
  }

  function cleanStoredFixedUsers() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(list)) return;
      const cleaned = list.filter(user => !FIXED.has(norm(user && user.username)));
      if (cleaned.length !== list.length) {
        localStorage.setItem(KEY, JSON.stringify(cleaned));
      }
    } catch {}
  }

  cleanStoredFixedUsers();
  document.addEventListener('click', () => setTimeout(cleanStoredFixedUsers, 250), true);
})();

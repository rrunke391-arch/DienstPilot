(() => {
  'use strict';

  const MAIL = 'rrunke391' + '@' + 'gmail.com';

  function run() {
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

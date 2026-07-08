(() => {
  'use strict';

  function clearOldStatus() {
    const status = document.querySelector('#dpUserAdminStatus');
    const rows = document.querySelectorAll('#dpUserAdminRows tr');
    if (!status || rows.length === 0) return;
    if (status.textContent.trim() === 'Keine Administratorrechte') {
      status.textContent = '';
    }
  }

  function start() {
    clearOldStatus();
    document.addEventListener('click', () => setTimeout(clearOldStatus, 250), true);
    new MutationObserver(clearOldStatus).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

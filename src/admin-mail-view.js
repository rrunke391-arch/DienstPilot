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

  function cleanVacationButtons() {
    const buttons = [...document.querySelectorAll('button')].filter((button) => {
      const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
      return text.includes('Jahresurlaub') && button.closest('.toolbar');
    });

    if (buttons.length <= 1) return;

    const fixed = buttons.find((button) => button.id === 'openJahresurlaubFix');
    if (fixed) {
      buttons.forEach((button) => {
        if (button !== fixed) button.remove();
      });
      return;
    }

    buttons.slice(0, -1).forEach((button) => button.remove());
  }

  function refresh() {
    clearOldStatus();
    cleanVacationButtons();
  }

  function start() {
    refresh();
    document.addEventListener('click', () => setTimeout(refresh, 250), true);
    new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

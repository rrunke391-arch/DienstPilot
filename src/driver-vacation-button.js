(() => {
  'use strict';

  if (window.__dienstpilotDriverVacationButton) return;
  window.__dienstpilotDriverVacationButton = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const BUTTON_ID = 'openJahresurlaubFix';

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isDriver() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
      return normalize(user?.role || sessionStorage.getItem(ROLE_KEY)) === 'fahrer';
    } catch {
      return normalize(sessionStorage.getItem(ROLE_KEY)) === 'fahrer';
    }
  }

  function install() {
    if (!isDriver()) {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }

    const actions = document.querySelector('#dpDriverHome .dp-home-actions');
    if (!actions || document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'dp-home-light-button';
    button.textContent = '📁 Jahresurlaub';
    button.setAttribute('aria-label', 'Jahresurlaub öffnen');
    actions.appendChild(button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="eingabe"],#dpSignoutButton,[data-home-action],[data-week],[data-date]')) {
      [0, 100, 350, 900].forEach((delay) => window.setTimeout(install, delay));
    }
  }, true);

  [150, 500, 1200, 2500].forEach((delay) => window.setTimeout(install, delay));
  window.addEventListener('pageshow', install);
  window.addEventListener('focus', install);
})();
(() => {
  'use strict';

  const eyeIcon = (slashed) => `
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
      ${slashed ? '<path d="M4 4 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>' : ''}
    </svg>
  `;

  function startPasswordEye() {
    const input = document.getElementById('appPassword');
    if (!input || document.getElementById('togglePasswordVisibility')) return;

    const row = document.createElement('div');
    row.id = 'dienstpilotPasswordRow';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    row.style.width = '100%';

    input.parentElement.insertBefore(row, input);
    row.appendChild(input);
    input.style.flex = '1 1 auto';
    input.style.minWidth = '0';
    input.style.margin = '0';

    const button = document.createElement('button');
    button.id = 'togglePasswordVisibility';
    button.type = 'button';
    button.innerHTML = eyeIcon(false);
    button.title = 'Passwort anzeigen';
    button.setAttribute('aria-label', 'Passwort anzeigen');
    button.setAttribute('aria-pressed', 'false');
    button.style.minWidth = '48px';
    button.style.minHeight = '44px';
    button.style.borderRadius = '12px';
    button.style.border = '1px solid #cbd5e1';
    button.style.background = '#ffffff';
    button.style.color = '#0f172a';
    button.style.cursor = 'pointer';
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    row.appendChild(button);

    button.addEventListener('click', () => {
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.innerHTML = eyeIcon(showPassword);
      button.title = showPassword ? 'Passwort verbergen' : 'Passwort anzeigen';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', showPassword ? 'true' : 'false');
      input.focus({ preventScroll: true });
    });
  }

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem('dienstpilot_user') || 'null') || {};
    } catch {
      return {};
    }
  }

  function normalizedRole() {
    const user = readUser();
    return String(user.role || sessionStorage.getItem('dienstpilot_role') || '')
      .trim()
      .toLowerCase();
  }

  function canEditCatalog() {
    const role = normalizedRole();
    return role === 'administrator'
      || role === 'geschaeftsleitung'
      || role === 'geschäftsleitung';
  }

  function canonicalizeRole() {
    const role = normalizedRole();
    let canonical = '';
    if (role === 'administrator') canonical = 'Administrator';
    if (role === 'geschaeftsleitung') canonical = 'Geschaeftsleitung';
    if (role === 'geschäftsleitung') canonical = 'Geschäftsleitung';
    if (!canonical) return;

    sessionStorage.setItem('dienstpilot_role', canonical);
    const user = readUser();
    if (user && user.role !== canonical) {
      user.role = canonical;
      sessionStorage.setItem('dienstpilot_user', JSON.stringify(user));
    }
  }

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  function ensureCatalogModules() {
    loadScript('dpCatalogEditor', 'src/catalog-editor.js?v=20260711-2');
    loadScript('dpCatalogTimeScale', 'src/catalog-time-scale.js?v=20260711-3');
    loadScript('dpCatalogEditorSimplify', 'src/catalog-editor-simplify.js?v=20260711-2');
    loadScript('dpCatalogAddDuty', 'src/catalog-add-duty.js?v=20260711-5');
  }

  function ensureCatalogAddButton() {
    canonicalizeRole();
    ensureCatalogModules();

    const toolbar = document.querySelector('#tab-katalog .toolbar');
    if (!toolbar) return;

    let group = toolbar.querySelector('.toolbar-group');
    if (!group) {
      group = document.createElement('div');
      group.className = 'toolbar-group';
      toolbar.prepend(group);
    }

    let button = document.getElementById('dpCatalogAddDuty');
    if (!button) {
      button = document.createElement('button');
      button.id = 'dpCatalogAddDuty';
      button.type = 'button';
      button.className = 'btn-primary dp-catalog-add';
      button.textContent = '＋ Dienst hinzufügen';
      group.prepend(button);
    }

    const permitted = canEditCatalog();
    button.hidden = !permitted;
    button.disabled = !permitted;
    button.style.display = permitted ? '' : 'none';
    button.setAttribute('aria-hidden', permitted ? 'false' : 'true');
  }

  function start() {
    startPasswordEye();
    ensureCatalogAddButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="katalog"]')) {
      [0, 150, 500, 1000, 2000].forEach((delay) => window.setTimeout(ensureCatalogAddButton, delay));
    }
  }, true);

  window.addEventListener('focus', ensureCatalogAddButton);
  window.addEventListener('pageshow', ensureCatalogAddButton);
  [300, 1000, 2500, 5000].forEach((delay) => window.setTimeout(ensureCatalogAddButton, delay));
  window.setInterval(ensureCatalogAddButton, 4000);
})();
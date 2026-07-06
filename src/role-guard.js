(() => {
  'use strict';

  const USER_KEY = 'dienstpilot_user';
  const STATE_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_TAB_KEY = 'lrz-active-tab';

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isDriver(user) {
    return user && user.role === 'Fahrer';
  }

  function driverProfile(user) {
    return normalize(user.driverProfile || user.username || '');
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      const state = JSON.parse(raw || '{}');
      return state && typeof state === 'object' ? state : {};
    } catch {
      return {};
    }
  }

  function saveState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function prepareDriverState() {
    const user = readUser();
    if (!isDriver(user)) return;

    const profile = driverProfile(user);
    if (!profile) return;

    document.body.classList.add('role-fahrer');
    localStorage.setItem('dienstpilot_aktiver_kollege', profile);
    localStorage.setItem(ACTIVE_TAB_KEY, 'eingabe');

    const state = loadState();
    const currentProfile = normalize(state?.appSettings?.activeProfile || '');

    if (currentProfile && currentProfile !== profile) {
      saveState({
        ...state,
        duties: [],
        appSettings: {
          ...(state.appSettings || {}),
          activeProfile: profile,
          shownMonths: []
        }
      });
    } else if (!currentProfile) {
      saveState({
        ...state,
        appSettings: {
          ...(state.appSettings || {}),
          activeProfile: profile
        }
      });
    }
  }

  function addStyles() {
    if (document.getElementById('dpRoleGuardStyles')) return;

    const style = document.createElement('style');
    style.id = 'dpRoleGuardStyles';
    style.textContent = `
      body.role-fahrer .tab[data-tab="statistik"],
      body.role-fahrer .tab[data-tab="einstellungen"],
      body.role-fahrer .tab[data-tab="auswertung"],
      body.role-fahrer .tab[data-tab="tests"],
      body.role-fahrer #loadRunke,
      body.role-fahrer #loadLady,
      body.role-fahrer #clearDuties,
      body.role-fahrer #uploadDienstkarteCatalog,
      body.role-fahrer #dienstkarteFilesCatalog,
      body.role-fahrer #uploadStatusCatalog,
      body.role-fahrer .toolbar-pick,
      body.role-fahrer .toolbar-toggle,
      body.role-fahrer .delete-duty,
      body.role-fahrer .convert-to-duty,
      body.role-fahrer .refresh-from-catalog,
      body.role-fahrer .open-catalog-link,
      body.role-fahrer .catalog-settings,
      body.role-fahrer .catalog-card-review,
      body.role-fahrer .cat-review-note-edit,
      body.role-fahrer .delete-template {
        display: none !important;
      }
      body.role-fahrer .duty-card input,
      body.role-fahrer .duty-card select,
      body.role-fahrer .catalog-card input,
      body.role-fahrer .catalog-card select {
        pointer-events: none !important;
        background: #f8fafc !important;
        color: #475569 !important;
      }
      body.role-fahrer .duty-card::after {
        content: 'Nur Lesezugriff';
        display: inline-flex;
        margin-top: 12px;
        border-radius: 999px;
        padding: 5px 10px;
        background: #f1f5f9;
        color: #475569;
        font-size: 12px;
        font-weight: 900;
      }
    `;
    document.head.appendChild(style);
  }

  function applyDriverLock() {
    const user = readUser();
    document.body.classList.toggle('role-fahrer', isDriver(user));
    if (!isDriver(user)) return;

    document.querySelectorAll('.duty-card input, .duty-card select, .catalog-card input, .catalog-card select').forEach((el) => {
      el.readOnly = true;
      el.disabled = true;
      el.setAttribute('aria-readonly', 'true');
    });

    const activeForbidden = document.querySelector('.tab.active[data-tab="statistik"], .tab.active[data-tab="einstellungen"], .tab.active[data-tab="auswertung"], .tab.active[data-tab="tests"]');
    if (activeForbidden) {
      const overview = document.querySelector('.tab[data-tab="eingabe"]');
      if (overview) overview.click();
    }
  }

  function shouldStop(target) {
    return Boolean(target.closest(
      '.delete-duty,.convert-to-duty,.refresh-from-catalog,.open-catalog-link,.delete-template,.review-btn,.cat-review-note-edit,#loadRunke,#loadLady,#clearDuties,#uploadDienstkarteCatalog,.tab[data-tab="statistik"],.tab[data-tab="einstellungen"],.tab[data-tab="auswertung"],.tab[data-tab="tests"]'
    ));
  }

  function installEventLocks() {
    document.addEventListener('click', (event) => {
      const user = readUser();
      if (!isDriver(user)) return;
      if (!shouldStop(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    document.addEventListener('change', (event) => {
      const user = readUser();
      if (!isDriver(user)) return;
      if (!event.target.closest('.duty-card,.catalog-card,#blSettingsBody')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function observeChanges() {
    const observer = new MutationObserver(() => applyDriverLock());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function loadStrictDriverRules() {
    if (document.getElementById('dpDriverReadonlyScript')) return;
    const script = document.createElement('script');
    script.id = 'dpDriverReadonlyScript';
    script.src = 'src/driver-readonly.js?v=dienstpilot-1';
    document.head.appendChild(script);
  }

  prepareDriverState();
  addStyles();
  loadStrictDriverRules();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyDriverLock();
      installEventLocks();
      observeChanges();
    }, { once: true });
  } else {
    applyDriverLock();
    installEventLocks();
    observeChanges();
  }
})();

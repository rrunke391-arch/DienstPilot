(() => {
  'use strict';

  const USER_KEY = 'dienstpilot_user';
  const STATE_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_TAB_KEY = 'lrz-active-tab';

  function readUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
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
    const appSettings = { ...(state.appSettings || {}), activeProfile: profile };

    if (currentProfile && currentProfile !== profile) {
      saveState({ ...state, duties: [], appSettings: { ...appSettings, shownMonths: [] } });
    } else {
      saveState({ ...state, appSettings });
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
      body.role-fahrer #loadKollege,
      body.role-fahrer #reloadKollegeTemplate,
      body.role-fahrer #kollegeSelect,
      body.role-fahrer .kollegen-panel,
      body.role-fahrer #clearDuties,
      body.role-fahrer #uploadDienstkarteCatalog,
      body.role-fahrer #dienstkarteFilesCatalog,
      body.role-fahrer #uploadStatusCatalog,
      body.role-fahrer .toolbar-toggle,
      body.role-fahrer .open-catalog-link,
      body.role-fahrer .catalog-settings,
      body.role-fahrer .catalog-card-review,
      body.role-fahrer .cat-review-note-edit,
      body.role-fahrer .delete-template {
        display: none !important;
      }
      body.role-fahrer .catalog-card input,
      body.role-fahrer .catalog-card select,
      body.role-fahrer .catalog-card textarea {
        pointer-events: none !important;
        background: #f8fafc !important;
        color: #475569 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyDriverRules() {
    const user = readUser();
    document.body.classList.toggle('role-fahrer', isDriver(user));
    if (!isDriver(user)) return;

    const activeForbidden = document.querySelector('.tab.active[data-tab="statistik"], .tab.active[data-tab="einstellungen"], .tab.active[data-tab="auswertung"], .tab.active[data-tab="tests"]');
    if (activeForbidden) document.querySelector('.tab[data-tab="eingabe"]')?.click();

    document.querySelectorAll('#loadRunke,#loadLady,#loadKollege,#reloadKollegeTemplate,#kollegeSelect,.kollegen-panel,#clearDuties,#uploadDienstkarteCatalog,.catalog-settings,.catalog-card-review,.cat-review-note-edit,.delete-template').forEach((el) => {
      el.style.display = 'none';
      if ('disabled' in el) el.disabled = true;
    });

    document.querySelectorAll('.catalog-card input,.catalog-card select,.catalog-card textarea').forEach((el) => {
      if ('readOnly' in el) el.readOnly = true;
      if ('disabled' in el) el.disabled = true;
    });
  }

  function shouldStop(target) {
    return Boolean(target.closest('#loadRunke,#loadLady,#loadKollege,#reloadKollegeTemplate,#kollegeSelect,.kollegen-panel,#clearDuties,#uploadDienstkarteCatalog,.tab[data-tab="statistik"],.tab[data-tab="einstellungen"],.tab[data-tab="auswertung"],.tab[data-tab="tests"],.open-catalog-link,.delete-template,.review-btn,.cat-review-note-edit'));
  }

  function installEventLocks() {
    document.addEventListener('click', (event) => {
      const user = readUser();
      if (!isDriver(user)) return;
      if (!shouldStop(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applyDriverRules();
    }, true);

    document.addEventListener('change', (event) => {
      const user = readUser();
      if (!isDriver(user)) return;
      if (!event.target.closest('#kollegeSelect,.catalog-card,#blSettingsBody')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applyDriverRules();
    }, true);
  }

  function observeChanges() {
    const observer = new MutationObserver(() => applyDriverRules());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function loadDriverEditRules() {
    if (document.getElementById('dpDriverReadonlyScript')) return;
    const script = document.createElement('script');
    script.id = 'dpDriverReadonlyScript';
    script.src = 'src/driver-readonly.js?v=dienstpilot-2';
    document.head.appendChild(script);
  }

  prepareDriverState();
  addStyles();
  loadDriverEditRules();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyDriverRules();
      installEventLocks();
      observeChanges();
    }, { once: true });
  } else {
    applyDriverRules();
    installEventLocks();
    observeChanges();
  }
})();

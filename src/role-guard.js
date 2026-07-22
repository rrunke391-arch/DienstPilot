(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const UNLOCKED_KEY = 'dienstpilot_unlocked';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function setLoginMessage(text) {
    const info = document.querySelector('#loginScreen .login-box p');
    if (info) info.textContent = text;
  }

  function setLoginError(text) {
    const error = document.getElementById('loginError');
    if (error) error.textContent = text;
  }

  function replaceNode(node) {
    if (!node || !node.parentNode) return node;
    const clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    return clone;
  }

  function getLoginFields() {
    let passwordInput = document.getElementById('appPassword');
    if (!passwordInput) return null;

    let usernameInput = document.getElementById('appUsername');
    if (!usernameInput) {
      usernameInput = document.createElement('input');
      usernameInput.id = 'appUsername';
      usernameInput.type = 'text';
      usernameInput.placeholder = 'Benutzername';
      usernameInput.autocomplete = 'username';
      usernameInput.value = 'Runke';
      passwordInput.parentElement.insertBefore(usernameInput, passwordInput);
    }

    const oldUsername = usernameInput.value || 'Runke';
    const oldPassword = passwordInput.value || '';

    usernameInput = replaceNode(usernameInput);
    passwordInput = replaceNode(passwordInput);

    usernameInput.value = oldUsername;
    usernameInput.placeholder = 'Benutzername';
    usernameInput.autocomplete = 'username';

    passwordInput.value = oldPassword;
    passwordInput.placeholder = 'Passwort';
    passwordInput.autocomplete = 'current-password';

    return { usernameInput, passwordInput };
  }

  function makePublicUser(serverUser) {
    const username = String(serverUser.username || '').trim();
    const role = String(serverUser.role || 'Fahrer').trim();
    const profile = normalize(serverUser.driverProfile || username);
    return {
      username,
      displayName: String(serverUser.displayName || username).trim(),
      role,
      functionTitle: role === 'Administrator' ? 'Administrator DienstPilot Server' : 'Server-Benutzer',
      driverProfile: profile,
      access: role === 'Fahrer' ? 'Eigener Bereich' : 'Vollzugriff'
    };
  }

  function unlockApp() {
    document.body.classList.remove('auth-locked');
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';
  }

  function lockApp() {
    document.body.classList.add('auth-locked');
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = '';
  }

  function saveServerSession(data) {
    const user = makePublicUser(data.user || {});
    sessionStorage.setItem(UNLOCKED_KEY, 'yes');
    sessionStorage.setItem(TOKEN_KEY, data.token || '');
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(ROLE_KEY, user.role);
    if (user.driverProfile) localStorage.setItem(ACTIVE_DRIVER_KEY, user.driverProfile);
    document.body.classList.toggle('role-fahrer', user.role === 'Fahrer');
    unlockApp();
  }

  async function serverLogin(fields) {
    const username = fields.usernameInput.value.trim();
    const password = fields.passwordInput.value;

    if (!username || !password) {
      setLoginError('Bitte Benutzername und Passwort eingeben.');
      return;
    }

    setLoginError('Anmeldung wird geprüft ...');

    try {
      const response = await fetch(API_BASE + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setLoginError(data.error || 'Benutzername oder Passwort ist falsch.');
        fields.passwordInput.value = '';
        fields.passwordInput.focus();
        return;
      }

      setLoginError('');
      saveServerSession(data);
    } catch (error) {
      setLoginError('Server nicht erreichbar. Bitte Internetverbindung prüfen.');
    }
  }

  function installServerLogin() {
    const existingToken = sessionStorage.getItem(TOKEN_KEY);
    const existingUser = sessionStorage.getItem(USER_KEY);

    if (existingToken && existingUser && sessionStorage.getItem(UNLOCKED_KEY) === 'yes') {
      unlockApp();
      return;
    }

    sessionStorage.removeItem(UNLOCKED_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    lockApp();

    const fields = getLoginFields();
    if (!fields) return;

    setLoginMessage('Bitte mit dem Server-Benutzer anmelden.');

    let button = document.getElementById('loginButton');
    if (button) {
      button = replaceNode(button);
      button.textContent = 'Am Server anmelden';
      button.addEventListener('click', () => serverLogin(fields));
    }

    [fields.usernameInput, fields.passwordInput].forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopImmediatePropagation();
          serverLogin(fields);
        }
      }, true);
    });

    fields.passwordInput.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installServerLogin, { once: true });
  } else {
    installServerLogin();
  }
})();

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

  function loadAdminResetRules() {
    if (document.getElementById('dpAdminResetScript')) return;
    const script = document.createElement('script');
    script.id = 'dpAdminResetScript';
    script.src = 'src/admin-reset.js?v=dienstpilot-1';
    document.head.appendChild(script);
  }

  function loadAdminEditRules() {
    if (document.getElementById('dpAdminEditScript')) return;
    const script = document.createElement('script');
    script.id = 'dpAdminEditScript';
    script.src = 'src/admin-edit.js?v=dienstpilot-1';
    document.head.appendChild(script);
  }

  function loadAdminMailView() {
    if (document.getElementById('dpAdminMailViewScript')) return;
    const script = document.createElement('script');
    script.id = 'dpAdminMailViewScript';
    script.src = 'src/admin-mail-view.js?v=dienstpilot-1';
    document.head.appendChild(script);
  }

  function loadEmergencyStore() {
    if (document.getElementById('dpEmergencyStoreScript')) return;
    const script = document.createElement('script');
    script.id = 'dpEmergencyStoreScript';
    script.src = 'src/user-emergency-store.js?v=dienstpilot-2';
    document.head.appendChild(script);
  }

  prepareDriverState();
  addStyles();
  loadDriverEditRules();
  loadAdminResetRules();
  loadAdminEditRules();
  loadAdminMailView();
  loadEmergencyStore();

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


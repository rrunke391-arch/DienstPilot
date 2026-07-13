(() => {
  'use strict';

  if (window.__dienstpilotVacationPersistenceV4ReadOnly) return;
  window.__dienstpilotVacationPersistenceV4ReadOnly = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const ACTIVE_PROFILE_KEY = 'dienstpilot_aktiver_kollege';

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function user() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {}; }
    catch { return {}; }
  }

  function profile() {
    const current = user();
    if (normalizeRole(current.role || sessionStorage.getItem(ROLE_KEY)) === 'fahrer') {
      return normalize(current.driverProfile || current.username || current.displayName);
    }

    let fromApp = '';
    try {
      if (typeof appSettings !== 'undefined' && appSettings) fromApp = appSettings.activeProfile || '';
    } catch {}

    return normalize(
      fromApp
      || document.getElementById('kollegeSelect')?.value
      || document.getElementById('profileSelect')?.value
      || localStorage.getItem(ACTIVE_PROFILE_KEY)
    );
  }

  async function load(profileHint) {
    const target = normalize(profileHint || profile());
    if (!target) return false;

    const workflow = window.dienstpilotVacationRequestWorkflow;
    if (workflow && typeof workflow.load === 'function') {
      return workflow.load(target);
    }

    return false;
  }

  async function save() {
    // Urlaub wird nicht direkt gespeichert. Fahrer reichen Wünsche ein;
    // Geschäftsleitung oder Disposition entscheiden darüber.
    return true;
  }

  window.dienstpilotVacationPersistence = { load, save, profile };
  window.dienstpilotFlushBeforeSignout = async () => true;

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#openJahresurlaubFix,#loginButton,#loadKollege,#loadRunke,#loadLady')) {
      [250, 700, 1400].forEach((delay) => window.setTimeout(() => void load(), delay));
    }
  }, true);
})();
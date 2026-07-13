(() => {
  'use strict';

  if (window.__dienstpilotVacationPersistenceV4) return;
  window.__dienstpilotVacationPersistenceV4 = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_PROFILE_KEY = 'dienstpilot_aktiver_kollege';

  let saveTimer = null;
  let saveInProgress = null;
  let lastLoadedProfile = '';

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

  function readJson(storage, key, fallback) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function sessionUser() {
    return readJson(sessionStorage, USER_KEY, null) || {};
  }

  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function activeProfile() {
    const user = sessionUser();
    if (normalizeRole(user.role) === 'fahrer') {
      return normalize(user.driverProfile || user.username || user.displayName);
    }

    let fromApp = '';
    try {
      if (typeof appSettings !== 'undefined' && appSettings) fromApp = appSettings.activeProfile || '';
    } catch {}

    const main = readJson(localStorage, MAIN_KEY, {});
    const select = document.getElementById('kollegeSelect')?.value
      || document.getElementById('profileSelect')?.value
      || '';

    return normalize(
      fromApp
      || main?.appSettings?.activeProfile
      || localStorage.getItem(ACTIVE_PROFILE_KEY)
      || select
      || user.driverProfile
      || user.username
    );
  }

  function vacationKey(profile) {
    return 'dienstpilot-vacations-' + normalize(profile);
  }

  function vacationUrl(profile) {
    return API_BASE + '/api/data/vacation_' + encodeURIComponent(normalize(profile));
  }

  function legacyPlanUrl(profile) {
    return API_BASE + '/api/data/plan_' + encodeURIComponent(normalize(profile));
  }

  function authHeaders(extra) {
    const headers = new Headers(extra || {});
    if (token()) headers.set('Authorization', 'Bearer ' + token());
    return headers;
  }

  function liveVacations() {
    try {
      return typeof vacations !== 'undefined' && Array.isArray(vacations) ? vacations : null;
    } catch {
      return null;
    }
  }

  function liveEntitlement() {
    try {
      return typeof vacationEntitlement !== 'undefined' && Number.isFinite(vacationEntitlement)
        ? vacationEntitlement
        : null;
    } catch {
      return null;
    }
  }

  function setStatus(profile, text, ok = true) {
    const element = document.getElementById('syncStatus');
    if (!element) return;
    const label = profile ? profile.charAt(0).toUpperCase() + profile.slice(1) : '';
    element.textContent = label ? `Aktiv: ${label} · ${text}` : text;
    element.className = `sync-status ${ok ? 'synced' : 'offline'}`;
  }

  async function readData(url) {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: authHeaders()
    });
    if (response.status === 404) return {};
    const wrapper = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(wrapper.error || `Serverfehler ${response.status}`);
    return wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data')
      ? (wrapper.data || {})
      : (wrapper || {});
  }

  function localPayload(profile) {
    const dedicated = readJson(localStorage, vacationKey(profile), {});
    const main = readJson(localStorage, MAIN_KEY, {});
    return {
      vacations: Array.isArray(dedicated.vacations)
        ? dedicated.vacations
        : (Array.isArray(main.vacations) ? main.vacations : []),
      vacationEntitlement: Number.isFinite(dedicated.vacationEntitlement)
        ? dedicated.vacationEntitlement
        : (Number.isFinite(main.vacationEntitlement) ? main.vacationEntitlement : 30),
      savedAt: dedicated.savedAt || ''
    };
  }

  function storeLocal(profile, payload) {
    const clean = normalize(profile);
    if (!clean) return;

    const normalizedPayload = {
      vacations: Array.isArray(payload?.vacations) ? payload.vacations : [],
      vacationEntitlement: Number.isFinite(payload?.vacationEntitlement)
        ? payload.vacationEntitlement
        : 30,
      profile: clean,
      savedAt: payload?.savedAt || new Date().toISOString()
    };

    localStorage.setItem(vacationKey(clean), JSON.stringify(normalizedPayload));
    localStorage.setItem(ACTIVE_PROFILE_KEY, clean);

    const main = readJson(localStorage, MAIN_KEY, {});
    localStorage.setItem(MAIN_KEY, JSON.stringify({
      ...main,
      vacations: normalizedPayload.vacations,
      vacationEntitlement: normalizedPayload.vacationEntitlement,
      appSettings: { ...(main.appSettings || {}), activeProfile: clean }
    }));
  }

  function applyState(profile, payload) {
    const value = {
      vacations: Array.isArray(payload?.vacations) ? payload.vacations : [],
      vacationEntitlement: Number.isFinite(payload?.vacationEntitlement)
        ? payload.vacationEntitlement
        : 30,
      savedAt: payload?.savedAt || new Date().toISOString()
    };

    try { vacations = value.vacations; } catch {}
    try { vacationEntitlement = value.vacationEntitlement; } catch {}
    storeLocal(profile, value);

    try {
      if (typeof renderVacationSection === 'function') renderVacationSection();
      if (typeof renderDuties === 'function') renderDuties();
    } catch (error) {
      console.warn('Urlaubsanzeige konnte nicht aktualisiert werden:', error);
    }
  }

  async function loadNow(profileHint) {
    const profile = normalize(profileHint || activeProfile());
    if (!profile || !token()) return false;

    try {
      const dedicated = await readData(vacationUrl(profile));
      let source = dedicated;

      const hasDedicated = Array.isArray(dedicated?.vacations)
        || Number.isFinite(dedicated?.vacationEntitlement);

      if (!hasDedicated) {
        try {
          const legacy = await readData(legacyPlanUrl(profile));
          if (Array.isArray(legacy?.vacations) || Number.isFinite(legacy?.vacationEntitlement)) {
            source = {
              vacations: Array.isArray(legacy.vacations) ? legacy.vacations : [],
              vacationEntitlement: Number.isFinite(legacy.vacationEntitlement)
                ? legacy.vacationEntitlement
                : 30,
              savedAt: legacy.savedAt || ''
            };
          } else {
            source = localPayload(profile);
          }
        } catch {
          source = localPayload(profile);
        }
      }

      applyState(profile, source || localPayload(profile));
      lastLoadedProfile = profile;
      setStatus(profile, 'Urlaub geladen');
      return true;
    } catch (error) {
      console.warn('Jahresurlaub konnte nicht geladen werden:', error);
      applyState(profile, localPayload(profile));
      setStatus(profile, 'Urlaub nur lokal geladen', false);
      return false;
    }
  }

  async function saveNow(options) {
    const profile = normalize(options?.profile || activeProfile());
    if (!profile || !token()) return false;
    if (saveInProgress) await saveInProgress.catch(() => false);

    saveInProgress = (async () => {
      try {
        const local = localPayload(profile);
        const payload = {
          vacations: liveVacations() ?? local.vacations,
          vacationEntitlement: liveEntitlement() ?? local.vacationEntitlement,
          profile,
          savedAt: new Date().toISOString()
        };

        storeLocal(profile, payload);
        setStatus(profile, 'speichere Urlaub…');

        const response = await fetch(vacationUrl(profile), {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Serverfehler ${response.status}`);

        setStatus(profile, 'Urlaub gespeichert');
        return true;
      } catch (error) {
        console.error('Jahresurlaub konnte nicht gespeichert werden:', error);
        setStatus(profile, error.message || 'Urlaub nicht gespeichert', false);
        return false;
      } finally {
        saveInProgress = null;
      }
    })();

    return saveInProgress;
  }

  function scheduleSave(delay = 0) {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      void saveNow();
    }, delay);
  }

  function installEvents() {
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#vacationFormSave')) {
        scheduleSave(50);
        return;
      }
      if (event.target.closest?.('.vacation-card-action.delete')) {
        scheduleSave(80);
        return;
      }
      if (event.target.closest?.('#openJahresurlaubFix') || /jahresurlaub/i.test(String(event.target.closest?.('button')?.textContent || ''))) {
        window.setTimeout(() => void loadNow(), 80);
        return;
      }
      if (event.target.closest?.('#loadKollege,#loadRunke,#loadLady,#reloadKollegeTemplate,#loginButton')) {
        [500, 1200, 2500].forEach((delay) => window.setTimeout(() => void loadNow(), delay));
      }
    }, true);

    document.addEventListener('change', (event) => {
      if (event.target?.id === 'vacationEntitlement') scheduleSave(50);
      if (event.target?.id === 'kollegeSelect' || event.target?.id === 'profileSelect') {
        window.setTimeout(() => void loadNow(event.target.value), 300);
      }
    }, true);
  }

  window.dienstpilotFlushBeforeSignout = async function () {
    clearTimeout(saveTimer);
    saveTimer = null;
    return saveNow();
  };

  window.dienstpilotVacationPersistence = {
    save: saveNow,
    load: loadNow,
    profile: activeProfile
  };

  installEvents();

  [300, 900, 1800, 3200].forEach((delay) => {
    window.setTimeout(() => {
      const profile = activeProfile();
      if (profile && profile !== lastLoadedProfile) void loadNow(profile);
    }, delay);
  });

  window.addEventListener('pageshow', () => void loadNow());
})();
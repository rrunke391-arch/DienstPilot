(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_PROFILE_KEY = 'dienstpilot_aktiver_kollege';
  const MARK = '__dienstpilotVacationPersistenceV3';

  if (window[MARK]) return;
  window[MARK] = true;

  let saveTimer = null;
  let saveInProgress = null;
  let loadSequence = 0;
  let lastObservedSession = '';

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_');
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
    let fromApp = '';
    try {
      if (typeof appSettings !== 'undefined' && appSettings) {
        fromApp = appSettings.activeProfile || '';
      }
    } catch {}

    const main = readJson(localStorage, MAIN_KEY, {});
    const select = document.getElementById('kollegeSelect')?.value
      || document.getElementById('profileSelect')?.value
      || '';
    const user = sessionUser();

    return normalize(
      fromApp
      || main?.appSettings?.activeProfile
      || localStorage.getItem(ACTIVE_PROFILE_KEY)
      || select
      || user.driverProfile
      || user.username
    );
  }

  function planKey(profile) {
    return 'lrz-plan-' + normalize(profile);
  }

  function vacationKey(profile) {
    return 'dienstpilot-vacations-' + normalize(profile);
  }

  function dataUrl(profile) {
    return API_BASE + '/api/data/plan_' + encodeURIComponent(normalize(profile));
  }

  function authHeaders(extra) {
    const headers = new Headers(extra || {});
    const value = token();
    if (value) headers.set('Authorization', 'Bearer ' + value);
    return headers;
  }

  function liveDuties() {
    try {
      return typeof duties !== 'undefined' && Array.isArray(duties) ? duties : null;
    } catch {
      return null;
    }
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

  function liveSettings() {
    try {
      return typeof appSettings !== 'undefined' && appSettings && typeof appSettings === 'object'
        ? appSettings
        : null;
    } catch {
      return null;
    }
  }

  function setStatus(profile, state, detail) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const label = profile ? profile.charAt(0).toUpperCase() + profile.slice(1) : '';
    const messages = {
      saving: 'speichere Urlaub…',
      synced: 'Urlaub gespeichert',
      offline: 'Urlaub nicht gespeichert'
    };
    const message = detail || messages[state] || state;
    el.textContent = label ? `Aktiv: ${label} · ${message}` : message;
    el.className = `sync-status ${state === 'synced' ? 'synced' : state}`;
  }

  async function readRemote(profile) {
    if (!profile || !token()) return null;
    const response = await fetch(dataUrl(profile), {
      method: 'GET',
      headers: authHeaders(),
      cache: 'no-store'
    });
    if (response.status === 404) return {};
    if (!response.ok) throw new Error('Serverfehler ' + response.status);
    const wrapper = await response.json().catch(() => ({}));
    const data = wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data')
      ? wrapper.data
      : wrapper;
    return data && typeof data === 'object' ? data : {};
  }

  function chooseDuties(profile, remote, allowEmptyLive) {
    const live = liveDuties();
    const named = readJson(localStorage, planKey(profile), {});
    const main = readJson(localStorage, MAIN_KEY, {});

    if (live && (allowEmptyLive || live.length > 0)) return live;
    if (Array.isArray(remote?.duties) && remote.duties.length > 0) return remote.duties;
    if (Array.isArray(named.duties) && named.duties.length > 0) return named.duties;
    if (Array.isArray(main.duties) && main.duties.length > 0) return main.duties;
    return live || [];
  }

  function chooseVacations(profile, remote) {
    const live = liveVacations();
    if (live !== null) return live;

    const dedicated = readJson(localStorage, vacationKey(profile), {});
    const named = readJson(localStorage, planKey(profile), {});
    const main = readJson(localStorage, MAIN_KEY, {});

    if (Array.isArray(dedicated.vacations)) return dedicated.vacations;
    if (Array.isArray(named.vacations)) return named.vacations;
    if (Array.isArray(main.vacations)) return main.vacations;
    if (Array.isArray(remote?.vacations)) return remote.vacations;
    return [];
  }

  function chooseEntitlement(profile, remote) {
    const live = liveEntitlement();
    if (live !== null) return live;

    const dedicated = readJson(localStorage, vacationKey(profile), {});
    const named = readJson(localStorage, planKey(profile), {});
    const main = readJson(localStorage, MAIN_KEY, {});

    if (Number.isFinite(dedicated.vacationEntitlement)) return dedicated.vacationEntitlement;
    if (Number.isFinite(named.vacationEntitlement)) return named.vacationEntitlement;
    if (Number.isFinite(main.vacationEntitlement)) return main.vacationEntitlement;
    if (Number.isFinite(remote?.vacationEntitlement)) return remote.vacationEntitlement;
    return 30;
  }

  function storeLocal(profile, payload) {
    const p = normalize(profile);
    if (!p) return;

    const main = readJson(localStorage, MAIN_KEY, {});
    const settings = liveSettings() || main.appSettings || {};
    const storedSettings = {
      ...settings,
      activeProfile: p
    };

    localStorage.setItem(planKey(p), JSON.stringify(payload));
    localStorage.setItem(vacationKey(p), JSON.stringify({
      vacations: Array.isArray(payload.vacations) ? payload.vacations : [],
      vacationEntitlement: Number.isFinite(payload.vacationEntitlement) ? payload.vacationEntitlement : 30,
      savedAt: payload.savedAt || new Date().toISOString()
    }));
    localStorage.setItem(MAIN_KEY, JSON.stringify({
      ...main,
      duties: Array.isArray(payload.duties) ? payload.duties : [],
      vacations: Array.isArray(payload.vacations) ? payload.vacations : [],
      vacationEntitlement: Number.isFinite(payload.vacationEntitlement) ? payload.vacationEntitlement : 30,
      appSettings: storedSettings
    }));
    localStorage.setItem(ACTIVE_PROFILE_KEY, p);
  }

  function applyVacationState(profile, payload) {
    const list = Array.isArray(payload?.vacations) ? payload.vacations : [];
    const entitlement = Number.isFinite(payload?.vacationEntitlement)
      ? payload.vacationEntitlement
      : 30;

    try { vacations = list; } catch {}
    try { vacationEntitlement = entitlement; } catch {}
    try {
      if (typeof appSettings !== 'undefined' && appSettings) {
        appSettings = { ...appSettings, activeProfile: profile };
      }
    } catch {}

    storeLocal(profile, {
      ...payload,
      duties: Array.isArray(payload?.duties) ? payload.duties : (liveDuties() || []),
      vacations: list,
      vacationEntitlement: entitlement,
      savedAt: payload?.savedAt || new Date().toISOString()
    });

    try {
      if (typeof renderVacationSection === 'function') renderVacationSection();
      if (typeof renderDuties === 'function') renderDuties();
    } catch (error) {
      console.warn('Urlaubsanzeige konnte nicht neu aufgebaut werden:', error);
    }
  }

  async function saveNow(options) {
    const opts = options || {};
    const profile = normalize(opts.profile || activeProfile());
    if (!profile) return false;
    if (!token()) {
      setStatus(profile, 'offline', 'keine Server-Anmeldung');
      return false;
    }

    if (saveInProgress) {
      await saveInProgress.catch(() => false);
    }

    saveInProgress = (async () => {
      setStatus(profile, 'saving');
      try {
        let remote = {};
        try { remote = await readRemote(profile) || {}; } catch {}

        const settings = liveSettings() || readJson(localStorage, MAIN_KEY, {}).appSettings || {};
        const payload = {
          ...remote,
          duties: chooseDuties(profile, remote, Boolean(opts.allowEmptyDuties)),
          vacations: chooseVacations(profile, remote),
          vacationEntitlement: chooseEntitlement(profile, remote),
          bundeslaender: settings.bundeslaender || remote.bundeslaender || null,
          hideSundays: typeof settings.hideSundays === 'boolean'
            ? settings.hideSundays
            : Boolean(remote.hideSundays),
          profile,
          savedAt: new Date().toISOString()
        };

        storeLocal(profile, payload);

        const response = await fetch(dataUrl(profile), {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error('Serverfehler ' + response.status + (text ? ': ' + text : ''));
        }

        setStatus(profile, 'synced');
        return true;
      } catch (error) {
        console.error('DienstPilot-Urlaubsspeicherung fehlgeschlagen:', error);
        setStatus(profile, 'offline');
        return false;
      } finally {
        saveInProgress = null;
      }
    })();

    return saveInProgress;
  }

  function scheduleSave(delay, options) {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      void saveNow(options);
    }, Number.isFinite(delay) ? delay : 0);
  }

  async function loadNow(profileHint) {
    const profile = normalize(profileHint || activeProfile());
    if (!profile || !token()) return false;
    const sequence = ++loadSequence;

    try {
      const remote = await readRemote(profile);
      if (sequence !== loadSequence) return false;

      const dedicated = readJson(localStorage, vacationKey(profile), {});
      const named = readJson(localStorage, planKey(profile), {});
      const localSource = {
        ...named,
        ...dedicated,
        duties: Array.isArray(named.duties) ? named.duties : (liveDuties() || [])
      };

      const remoteHasVacationData = Boolean(remote) && (
        Array.isArray(remote.vacations)
        || Number.isFinite(remote.vacationEntitlement)
      );
      const localHasVacationData = Array.isArray(localSource.vacations)
        || Number.isFinite(localSource.vacationEntitlement);
      const remoteTime = Date.parse(remote?.savedAt || '') || 0;
      const localTime = Math.max(
        Date.parse(named.savedAt || '') || 0,
        Date.parse(dedicated.savedAt || '') || 0
      );

      const useLocal = localHasVacationData && (!remoteHasVacationData || localTime > remoteTime);
      const source = useLocal ? localSource : (remoteHasVacationData ? remote : localSource);

      applyVacationState(profile, source || {});
      if (useLocal && token()) window.setTimeout(() => void saveNow({ profile }), 50);
      return true;
    } catch (error) {
      console.warn('Urlaub konnte nicht vom Server geladen werden:', error);
      return false;
    }
  }

  function patchLocalPlanFunctions() {
    try {
      saveNamedPlan = function dynamicSaveNamedPlan(name) {
        const profile = normalize(name);
        if (!profile) return false;
        const settings = liveSettings() || {};
        const payload = {
          duties: liveDuties() || [],
          vacations: liveVacations() || [],
          vacationEntitlement: liveEntitlement() ?? 30,
          bundeslaender: settings.bundeslaender || null,
          hideSundays: Boolean(settings.hideSundays),
          profile,
          savedAt: new Date().toISOString()
        };
        storeLocal(profile, payload);
        return true;
      };

      loadNamedPlan = function dynamicLoadNamedPlan(name) {
        const profile = normalize(name);
        if (!profile) return null;
        const named = readJson(localStorage, planKey(profile), null);
        const dedicated = readJson(localStorage, vacationKey(profile), {});
        if (!named && !Array.isArray(dedicated.vacations)) return null;
        return {
          ...(named || {}),
          vacations: Array.isArray(dedicated.vacations)
            ? dedicated.vacations
            : (Array.isArray(named?.vacations) ? named.vacations : []),
          vacationEntitlement: Number.isFinite(dedicated.vacationEntitlement)
            ? dedicated.vacationEntitlement
            : (Number.isFinite(named?.vacationEntitlement) ? named.vacationEntitlement : 30)
        };
      };

      const originalSaveLocalState = saveLocalState;
      if (typeof originalSaveLocalState === 'function' && !originalSaveLocalState.__vacationV3) {
        const wrapped = function vacationAwareSaveLocalState(...args) {
          const result = originalSaveLocalState.apply(this, args);
          const profile = activeProfile();
          if (profile) {
            const settings = liveSettings() || {};
            storeLocal(profile, {
              duties: liveDuties() || [],
              vacations: liveVacations() || [],
              vacationEntitlement: liveEntitlement() ?? 30,
              bundeslaender: settings.bundeslaender || null,
              hideSundays: Boolean(settings.hideSundays),
              profile,
              savedAt: new Date().toISOString()
            });
          }
          return result;
        };
        wrapped.__vacationV3 = true;
        saveLocalState = wrapped;
      }
    } catch (error) {
      console.warn('Dynamische Urlaubsspeicherung konnte nicht vollständig aktiviert werden:', error);
    }
  }

  function installEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target;

      if (target.closest?.('#vacationFormSave')) {
        scheduleSave(0, { allowEmptyDuties: false });
        return;
      }

      if (target.closest?.('.vacation-card-action.delete')) {
        scheduleSave(20, { allowEmptyDuties: false });
        return;
      }

      if (target.closest?.('#dpManualServerSave')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void saveNow({ allowEmptyDuties: true });
        return;
      }

      if (target.closest?.('#loadKollege, #loadRunke, #loadLady, #reloadKollegeTemplate, #loginButton')) {
        window.setTimeout(() => void loadNow(), 700);
      }
    }, true);

    document.addEventListener('change', (event) => {
      if (event.target?.id === 'vacationEntitlement') {
        scheduleSave(0, { allowEmptyDuties: false });
      }
      if (event.target?.id === 'kollegeSelect' || event.target?.id === 'profileSelect') {
        window.setTimeout(() => void loadNow(event.target.value), 500);
      }
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target?.id === 'vacationFormLabel') {
        scheduleSave(0, { allowEmptyDuties: false });
      }
      if (event.key === 'Enter' && (event.target?.id === 'appUsername' || event.target?.id === 'appPassword')) {
        [700, 1500, 3000].forEach((delay) => window.setTimeout(() => void loadNow(), delay));
      }
    }, true);
  }

  function installSessionWatcher() {
    window.setInterval(() => {
      const currentToken = token();
      const profile = activeProfile();
      const signature = currentToken && profile ? currentToken.slice(-12) + '|' + profile : '';
      if (!signature || signature === lastObservedSession) return;
      lastObservedSession = signature;
      void loadNow(profile);
    }, 1000);
  }

  window.dienstpilotFlushBeforeSignout = async function dienstpilotFlushBeforeSignout() {
    clearTimeout(saveTimer);
    saveTimer = null;
    return saveNow({ allowEmptyDuties: false });
  };

  window.dienstpilotVacationPersistence = {
    save: saveNow,
    load: loadNow,
    profile: activeProfile
  };

  patchLocalPlanFunctions();
  installEvents();
  installSessionWatcher();

  [300, 900, 1800].forEach((delay) => {
    window.setTimeout(() => {
      patchLocalPlanFunctions();
      void loadNow();
    }, delay);
  });
})();
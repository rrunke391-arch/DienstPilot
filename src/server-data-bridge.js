(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const originalFetch = window.fetch.bind(window);

  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function apiHeaders(extra) {
    const headers = new Headers(extra || {});
    const t = token();
    if (t) headers.set('Authorization', 'Bearer ' + t);
    return headers;
  }

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function dataKey(prefix, raw) {
    return prefix + '_' + String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  }

  async function getData(key, fallback) {
    const response = await originalFetch(API_BASE + '/api/data/' + encodeURIComponent(key), {
      method: 'GET',
      headers: apiHeaders()
    });
    if (!response.ok) return response;
    const wrapper = await response.json().catch(() => ({}));
    return jsonResponse(wrapper.data === null || wrapper.data === undefined ? fallback : wrapper.data, 200);
  }

  async function putData(key, body) {
    return originalFetch(API_BASE + '/api/data/' + encodeURIComponent(key), {
      method: 'PUT',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: body || '{}'
    });
  }

  window.fetch = function dienstPilotServerFetch(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const options = init || {};
    const method = String(options.method || 'GET').toUpperCase();

    if (url.startsWith('/api/plan/')) {
      const profile = decodeURIComponent(url.slice('/api/plan/'.length));
      const key = dataKey('plan', profile);
      if (method === 'PUT') return putData(key, options.body);
      return getData(key, {});
    }

    if (url === '/api/catalog-review') {
      const key = 'catalog_review';
      if (method === 'PUT') return putData(key, options.body);
      return getData(key, {});
    }

    return originalFetch(input, init);
  };
})();

(() => {
  'use strict';

  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_PROFILE_KEY = 'dienstpilot_aktiver_kollege';
  const USER_KEY = 'dienstpilot_user';
  let vacationSaveTimer = null;
  let vacationSaveRunning = false;
  let vacationSaveQueued = false;

  function readJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function currentUser() {
    return readJson(sessionStorage, USER_KEY, null);
  }

  function activeProfile() {
    const main = readJson(localStorage, MAIN_KEY, {});
    const user = currentUser() || {};

    if (String(user.role || "").trim() === "Fahrer") {
      return normalize(user.driverProfile || user.username);
    }

    return normalize(
      main?.appSettings?.activeProfile ||
      localStorage.getItem(ACTIVE_PROFILE_KEY) ||
      user.driverProfile ||
      user.username
    );
  }

  function globalArray(name) {
    try {
      if (name === 'duties' && typeof duties !== 'undefined' && Array.isArray(duties)) return duties;
      if (name === 'vacations' && typeof vacations !== 'undefined' && Array.isArray(vacations)) return vacations;
    } catch {}
    return null;
  }

  function globalNumber(name) {
    try {
      if (name === 'vacationEntitlement' && typeof vacationEntitlement !== 'undefined' && Number.isFinite(vacationEntitlement)) {
        return vacationEntitlement;
      }
    } catch {}
    return null;
  }

  function globalSettings() {
    try {
      if (typeof appSettings !== 'undefined' && appSettings && typeof appSettings === 'object') return appSettings;
    } catch {}
    return null;
  }

  function setSyncStatus(profile, state) {
    const element = document.getElementById('syncStatus');
    if (!element) return;
    const name = profile ? profile.charAt(0).toUpperCase() + profile.slice(1) : '';
    const labels = {
      saving: 'speichere Urlaub…',
      synced: 'Urlaub gespeichert',
      offline: 'Urlaub nicht gespeichert'
    };
    element.textContent = name ? `Aktiv: ${name} · ${labels[state] || state}` : (labels[state] || state);
    element.className = `sync-status ${state === 'synced' ? 'synced' : state}`;
  }

  async function persistVacationNow() {
    if (vacationSaveRunning) {
      vacationSaveQueued = true;
      return;
    }

    const profile = activeProfile();
    if (!profile) return;

    vacationSaveRunning = true;
    setSyncStatus(profile, 'saving');

    try {
      const main = readJson(localStorage, MAIN_KEY, {});
      const namedKey = 'lrz-plan-' + profile;
      const vacationKey = 'dienstpilot-vacations-' + profile;
      const named = readJson(localStorage, namedKey, {});

      let remote = {};
      try {
        const response = await fetch('/api/plan/' + encodeURIComponent(profile), { cache: 'no-store' });
        if (response.ok) remote = await response.json().catch(() => ({}));
      } catch {}

      const liveDuties = globalArray('duties');
      const liveVacations = globalArray('vacations');
      const liveEntitlement = globalNumber('vacationEntitlement');
      const liveSettings = globalSettings();

      const selectedDuties = liveDuties && liveDuties.length
        ? liveDuties
        : (Array.isArray(named.duties) && named.duties.length
          ? named.duties
          : (Array.isArray(main.duties) && main.duties.length
            ? main.duties
            : (Array.isArray(remote.duties) ? remote.duties : [])));

      const selectedVacations = liveVacations !== null
        ? liveVacations
        : (Array.isArray(named.vacations)
          ? named.vacations
          : (Array.isArray(main.vacations)
            ? main.vacations
            : (Array.isArray(remote.vacations) ? remote.vacations : [])));

      const selectedEntitlement = liveEntitlement !== null
        ? liveEntitlement
        : (Number.isFinite(named.vacationEntitlement)
          ? named.vacationEntitlement
          : (Number.isFinite(main.vacationEntitlement)
            ? main.vacationEntitlement
            : (Number.isFinite(remote.vacationEntitlement) ? remote.vacationEntitlement : 30)));

      const settings = liveSettings || main.appSettings || {};
      const payload = {
        ...remote,
        ...named,
        duties: selectedDuties,
        vacations: selectedVacations,
        vacationEntitlement: selectedEntitlement,
        bundeslaender: settings.bundeslaender || remote.bundeslaender || named.bundeslaender || null,
        hideSundays: typeof settings.hideSundays === 'boolean'
          ? settings.hideSundays
          : (typeof remote.hideSundays === 'boolean' ? remote.hideSundays : !!named.hideSundays),
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(namedKey, JSON.stringify(payload));
      localStorage.setItem(vacationKey, JSON.stringify({
        vacations: selectedVacations,
        vacationEntitlement: selectedEntitlement,
        savedAt: payload.savedAt
      }));
      localStorage.setItem(MAIN_KEY, JSON.stringify({
        ...main,
        duties: selectedDuties,
        vacations: selectedVacations,
        vacationEntitlement: selectedEntitlement,
        appSettings: { ...settings, activeProfile: profile }
      }));

      const saveResponse = await fetch('/api/plan/' + encodeURIComponent(profile), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!saveResponse.ok) throw new Error('Server hat die Urlaubsspeicherung abgelehnt.');
      setSyncStatus(profile, 'synced');
    } catch (error) {
      console.error('DienstPilot Urlaub konnte nicht gespeichert werden:', error);
      setSyncStatus(profile, 'offline');
    } finally {
      vacationSaveRunning = false;
      if (vacationSaveQueued) {
        vacationSaveQueued = false;
        window.setTimeout(persistVacationNow, 50);
      }
    }
  }

  function scheduleVacationSave(delay = 100) {
    window.clearTimeout(vacationSaveTimer);
    vacationSaveTimer = window.setTimeout(persistVacationNow, delay);
  }

  function installVacationPersistence() {
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#vacationFormSave')) scheduleVacationSave(80);
      if (event.target.closest?.('.vacation-card-action.delete')) scheduleVacationSave(180);
    }, false);

    document.addEventListener('change', (event) => {
      if (event.target?.id === 'vacationEntitlement') scheduleVacationSave(80);
    }, false);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target?.id === 'vacationFormLabel') scheduleVacationSave(100);
    }, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installVacationPersistence, { once: true });
  } else {
    installVacationPersistence();
  }
})();

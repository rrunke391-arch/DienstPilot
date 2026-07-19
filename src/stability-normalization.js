(() => {
  'use strict';

  if (window.__dienstpilotStabilityNormalizationV1) return;
  window.__dienstpilotStabilityNormalizationV1 = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const WORKSHOP_LOCAL_KEY = 'dienstpilot_workshop_vehicles_v1';
  const WORKSHOP_API = 'https://api.dienstpilot-runke.de/api/data/workshop_vehicles';
  const OLD_PLATE = 'OS-JF 215';
  const NEW_PLATE = 'OS-IF 215';

  let remoteTimer = 0;
  let workshopFunctionsPatched = false;

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function canonicalRole(value) {
    const role = normalizeText(value);
    if (role === 'administrator' || role === 'admin') return 'Administrator';
    if (role === 'geschaftsleitung' || role === 'geschaeftsleitung') return 'Geschäftsleitung';
    if (role === 'disposition' || role === 'disponent' || role === 'disponentin') return 'Disposition';
    if (role === 'fahrer' || role === 'driver') return 'Fahrer';
    return String(value || '').trim();
  }

  function normalizeCurrentRole() {
    let user = null;
    try {
      user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch {}

    const existing = user?.role || sessionStorage.getItem(ROLE_KEY) || '';
    const role = canonicalRole(existing);
    if (!role) return;

    if (sessionStorage.getItem(ROLE_KEY) !== role) sessionStorage.setItem(ROLE_KEY, role);
    if (user && user.role !== role) {
      user.role = role;
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  function normalizePlate(value) {
    const plate = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
    return plate === OLD_PLATE ? NEW_PLATE : plate;
  }

  function normalizeVehicleData(value) {
    let changed = false;

    function walk(item, key = '') {
      if (Array.isArray(item)) return item.map((entry) => walk(entry, key));
      if (item && typeof item === 'object') {
        const result = {};
        Object.entries(item).forEach(([childKey, childValue]) => {
          result[childKey] = walk(childValue, childKey);
        });
        return result;
      }
      if (typeof item !== 'string') return item;

      const vehicleField = key === 'plate' || key === 'bus' || key === 'vehicle' || key === 'kennzeichen';
      if (!vehicleField) return item;
      const next = normalizePlate(item);
      if (next !== item) changed = true;
      return next;
    }

    return { value: walk(value), changed };
  }

  function normalizeWorkshopLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(WORKSHOP_LOCAL_KEY) || '{}');
      const normalized = normalizeVehicleData(raw);
      if (normalized.changed) localStorage.setItem(WORKSHOP_LOCAL_KEY, JSON.stringify(normalized.value));
      return normalized.changed;
    } catch {
      return false;
    }
  }

  function authHeaders(extra = {}) {
    const headers = new Headers(extra);
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  async function normalizeWorkshopRemote() {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;

    try {
      const response = await fetch(WORKSHOP_API, {
        cache: 'no-store',
        headers: authHeaders()
      });
      if (!response.ok) return;

      const wrapper = await response.json().catch(() => ({}));
      const wrapped = wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data');
      const source = wrapped ? (wrapper.data || {}) : wrapper;
      const normalized = normalizeVehicleData(source);
      if (!normalized.changed) return;

      await fetch(WORKSHOP_API, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(normalized.value)
      });
      localStorage.setItem(WORKSHOP_LOCAL_KEY, JSON.stringify(normalized.value));
      window.dispatchEvent(new CustomEvent('dienstpilot-workshop-changed', {
        detail: { normalizedPlate: NEW_PLATE }
      }));
    } catch (error) {
      console.warn('Werkstattkennzeichen konnte nicht zentral vereinheitlicht werden:', error);
    }
  }

  function scheduleRemote(delay = 500) {
    window.clearTimeout(remoteTimer);
    remoteTimer = window.setTimeout(() => void normalizeWorkshopRemote(), delay);
  }

  function normalizeWorkshopControls() {
    document.querySelectorAll('#dpWorkshopPlate option').forEach((option) => {
      const next = normalizePlate(option.value || option.textContent);
      if (next !== OLD_PLATE && next !== NEW_PLATE) return;
      if (option.value !== NEW_PLATE) option.value = NEW_PLATE;
      if (option.textContent !== NEW_PLATE) option.textContent = NEW_PLATE;
    });

    const manual = document.getElementById('dpWorkshopManualPlate');
    if (manual && normalizePlate(manual.value) === NEW_PLATE && manual.value !== NEW_PLATE) manual.value = NEW_PLATE;
  }

  function patchWorkshopFunctions() {
    if (workshopFunctionsPatched) return;
    const checker = window.dienstpilotIsVehicleInWorkshop;
    const getter = window.dienstpilotGetWorkshopVehicles;
    if (typeof checker !== 'function' || typeof getter !== 'function') return;

    const wrappedChecker = (plate) => checker(normalizePlate(plate));
    const wrappedGetter = () => getter().map((entry) => ({ ...entry, plate: normalizePlate(entry?.plate) }));
    wrappedChecker.__dpCanonicalPlate = true;
    wrappedGetter.__dpCanonicalPlate = true;
    window.dienstpilotIsVehicleInWorkshop = wrappedChecker;
    window.dienstpilotGetWorkshopVehicles = wrappedGetter;
    workshopFunctionsPatched = true;
  }

  function refresh() {
    normalizeCurrentRole();
    const changed = normalizeWorkshopLocal();
    normalizeWorkshopControls();
    patchWorkshopFunctions();
    if (changed) scheduleRemote(120);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton')) {
      [0, 120, 400, 900].forEach((delay) => window.setTimeout(refresh, delay));
      scheduleRemote(1000);
    }
    if (event.target.closest?.('#dpWorkshopAdd')) {
      normalizeWorkshopControls();
      window.setTimeout(() => {
        normalizeWorkshopLocal();
        scheduleRemote(120);
      }, 80);
    }
  }, true);

  window.addEventListener('dienstpilot-workshop-changed', () => {
    window.setTimeout(() => {
      normalizeWorkshopLocal();
      normalizeWorkshopControls();
      patchWorkshopFunctions();
      scheduleRemote(150);
    }, 40);
  });

  const start = () => {
    refresh();
    [120, 400, 900, 1800].forEach((delay) => window.setTimeout(refresh, delay));
    scheduleRemote(1400);

    const observer = new MutationObserver(() => {
      normalizeWorkshopControls();
      patchWorkshopFunctions();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
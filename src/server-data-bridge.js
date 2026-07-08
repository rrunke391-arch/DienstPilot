(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
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

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function activeProfileFromMain() {
    const main = readJson(MAIN_KEY) || {};
    return String(main?.appSettings?.activeProfile || localStorage.getItem('dienstpilot_aktiver_kollege') || '').trim().toLowerCase();
  }

  function localShownMonths(profile) {
    const p = String(profile || '').trim().toLowerCase();
    const main = readJson(MAIN_KEY) || {};
    if (activeProfileFromMain() === p && Array.isArray(main?.appSettings?.shownMonths)) {
      return main.appSettings.shownMonths;
    }
    const named = readJson('lrz-plan-' + p) || {};
    if (Array.isArray(named.shownMonths)) return named.shownMonths;
    return [];
  }

  function normalizeShownMonths(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(v => String(v || '').trim()).filter(v => /^\d{4}-\d{2}$/.test(v)))].sort();
  }

  function rememberShownMonths(profile, data) {
    const months = normalizeShownMonths(data && data.shownMonths);
    if (months.length === 0) return;

    const p = String(profile || '').trim().toLowerCase();
    const main = readJson(MAIN_KEY) || {};
    const nextMain = {
      ...main,
      appSettings: {
        ...(main.appSettings || {}),
        shownMonths: months
      }
    };
    if (activeProfileFromMain() === p || !main?.appSettings?.activeProfile) {
      nextMain.appSettings.activeProfile = p;
    }
    localStorage.setItem(MAIN_KEY, JSON.stringify(nextMain));

    const namedKey = 'lrz-plan-' + p;
    const named = readJson(namedKey) || {};
    localStorage.setItem(namedKey, JSON.stringify({ ...named, ...data, shownMonths: months }));
  }

  function enrichPlanBody(profile, body) {
    let data;
    try {
      data = JSON.parse(body || '{}');
    } catch {
      data = {};
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};

    const months = normalizeShownMonths(data.shownMonths).length
      ? normalizeShownMonths(data.shownMonths)
      : normalizeShownMonths(localShownMonths(profile));

    if (months.length) data.shownMonths = months;
    return JSON.stringify(data);
  }

  async function getData(key, fallback, profile) {
    const response = await originalFetch(API_BASE + '/api/data/' + encodeURIComponent(key), {
      method: 'GET',
      headers: apiHeaders()
    });
    if (!response.ok) return response;
    const wrapper = await response.json().catch(() => ({}));
    let data = wrapper.data === null || wrapper.data === undefined ? fallback : wrapper.data;

    if (profile && data && typeof data === 'object' && !Array.isArray(data)) {
      const serverMonths = normalizeShownMonths(data.shownMonths);
      const browserMonths = normalizeShownMonths(localShownMonths(profile));
      const mergedMonths = normalizeShownMonths([...serverMonths, ...browserMonths]);
      if (mergedMonths.length) {
        data = { ...data, shownMonths: mergedMonths };
        rememberShownMonths(profile, data);
      }
    }

    return jsonResponse(data, 200);
  }

  async function putData(key, body, profile) {
    const finalBody = profile ? enrichPlanBody(profile, body) : (body || '{}');
    return originalFetch(API_BASE + '/api/data/' + encodeURIComponent(key), {
      method: 'PUT',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: finalBody
    });
  }

  window.fetch = function dienstPilotServerFetch(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const options = init || {};
    const method = String(options.method || 'GET').toUpperCase();

    if (url.startsWith('/api/plan/')) {
      const profile = decodeURIComponent(url.slice('/api/plan/'.length));
      const key = dataKey('plan', profile);
      if (method === 'PUT') return putData(key, options.body, profile);
      return getData(key, {}, profile);
    }

    if (url === '/api/catalog-review') {
      const key = 'catalog_review';
      if (method === 'PUT') return putData(key, options.body);
      return getData(key, {});
    }

    return originalFetch(input, init);
  };
})();

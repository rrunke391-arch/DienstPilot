(() => {
  'use strict';

  if (window.__dienstpilotPlanApiBridge) return;
  window.__dienstpilotPlanApiBridge = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const previousFetch = window.fetch.bind(window);

  function normalizeProfile(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function planKey(profile) {
    return 'plan_' + normalizeProfile(profile);
  }

  function headers(extra) {
    const result = new Headers(extra || {});
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  window.fetch = async function dienstpilotPlanFetch(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const absolutePrefix = API_BASE + '/api/plan/';
    if (!url.startsWith(absolutePrefix)) return previousFetch(input, init);

    const options = init || {};
    const method = String(options.method || 'GET').toUpperCase();
    const profile = decodeURIComponent(url.slice(absolutePrefix.length));
    const dataUrl = API_BASE + '/api/data/' + encodeURIComponent(planKey(profile));

    if (method === 'PUT') {
      return previousFetch(dataUrl, {
        ...options,
        method: 'PUT',
        headers: headers({ ...(options.headers || {}), 'Content-Type': 'application/json' })
      });
    }

    const response = await previousFetch(dataUrl, {
      ...options,
      method: 'GET',
      cache: 'no-store',
      headers: headers(options.headers)
    });
    if (!response.ok) return response;
    const wrapper = await response.json().catch(() => ({}));
    return jsonResponse(wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data') ? (wrapper.data || {}) : wrapper, 200);
  };
})();
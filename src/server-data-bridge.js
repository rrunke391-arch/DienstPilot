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

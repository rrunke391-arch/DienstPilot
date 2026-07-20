(() => {
  'use strict';

  if (window.__dienstpilotDriverProfileRouteFixV1) return;
  window.__dienstpilotDriverProfileRouteFixV1 = true;

  const API = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const originalFetch = window.fetch.bind(window);
  const aliases = new Map();
  let aliasesReady = false;
  let aliasesPromise = null;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function addAlias(source, target) {
    const from = normalize(source);
    const to = normalize(target);
    if (from && to) aliases.set(from, to);
  }

  function headers() {
    const result = new Headers();
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  async function loadAliases() {
    if (aliasesReady) return aliases;
    if (aliasesPromise) return aliasesPromise;

    aliasesPromise = (async () => {
      try {
        const response = await originalFetch(API + '/api/users', {
          cache: 'no-store',
          headers: headers()
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(data.users)) {
          data.users.forEach((entry) => {
            const profile = entry.driverProfile || entry.assignedDriver || '';
            if (!profile) return;
            addAlias(profile, profile);
            addAlias(entry.username, profile);
            addAlias(entry.displayName, profile);
          });
        }
      } catch (error) {
        console.warn('Fahrerprofil-Zuordnung konnte nicht geladen werden:', error);
      }
      aliasesReady = true;
      return aliases;
    })();

    return aliasesPromise;
  }

  function canonicalProfile(value) {
    const key = normalize(value);
    return aliases.get(key) || key;
  }

  function rewritePlanDataUrl(url) {
    const prefix = API + '/api/data/plan_';
    if (!url.startsWith(prefix)) return url;
    const raw = decodeURIComponent(url.slice(prefix.length));
    const canonical = canonicalProfile(raw);
    return prefix + encodeURIComponent(canonical);
  }

  window.fetch = async function dienstpilotDriverProfileRouteFetch(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!url.startsWith(API + '/api/data/plan_')) return originalFetch(input, init);

    await loadAliases();
    const rewrittenUrl = rewritePlanDataUrl(url);

    if (typeof input === 'string') return originalFetch(rewrittenUrl, init);

    const request = new Request(rewrittenUrl, input);
    return originalFetch(request, init);
  };

  loadAliases();
})();
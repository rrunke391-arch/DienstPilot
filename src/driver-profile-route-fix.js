(() => {
  'use strict';

  if (window.__dienstpilotDriverProfileRouteFixV2) return;
  window.__dienstpilotDriverProfileRouteFixV2 = true;

  const API = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const originalFetch = window.fetch.bind(window);
  const aliases = new Map();
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

  function rosterProfiles() {
    const profiles = new Set();
    document.querySelectorAll('#kollegeSelect option').forEach((option) => {
      const value = normalize(option.value || option.textContent);
      const label = normalize(option.textContent || option.value);
      if (value) profiles.add(value);
      if (label) profiles.add(label);
    });
    return profiles;
  }

  function addRosterFallbacks() {
    const roster = rosterProfiles();
    roster.forEach((profile) => addAlias(profile, profile));

    // Benutzer wie A.Kocdemir werden nur dann auf Kocdemir abgebildet,
    // wenn Kocdemir tatsächlich als eigenständiger Fahrer in der Kollegenliste steht.
    // Dadurch bleiben A.Hergerdt und L.Hergerdt getrennt, solange es keinen
    // allgemeinen Kollegen "Hergerdt" gibt.
    for (const source of [...aliases.keys(), ...roster]) {
      const match = source.match(/^[a-z]_([a-z0-9_-]+)$/);
      if (match && roster.has(match[1])) addAlias(source, match[1]);
    }
  }

  function headers() {
    const result = new Headers();
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  async function loadAliases() {
    if (aliasesPromise) return aliasesPromise;
    aliasesPromise = (async () => {
      addRosterFallbacks();
      try {
        const response = await originalFetch(API + '/api/users', {
          cache: 'no-store',
          headers: headers()
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(data.users)) {
          data.users.forEach((entry) => {
            const profile = entry.driverProfile || entry.assignedDriver || entry.driver || '';
            if (profile) {
              addAlias(profile, profile);
              addAlias(entry.username, profile);
              addAlias(entry.displayName, profile);
            } else {
              addAlias(entry.username, entry.username);
              addAlias(entry.displayName, entry.username);
            }
          });
        }
      } catch (error) {
        console.warn('Fahrerprofil-Zuordnung konnte nicht geladen werden:', error);
      }
      addRosterFallbacks();
      return aliases;
    })();
    return aliasesPromise;
  }

  function canonicalProfile(value) {
    const key = normalize(value);
    const direct = aliases.get(key);
    if (direct) return direct;

    const roster = rosterProfiles();
    const match = key.match(/^[a-z]_([a-z0-9_-]+)$/);
    if (match && roster.has(match[1])) return match[1];
    return key;
  }

  function rewritePlanDataUrl(url) {
    const prefix = API + '/api/data/plan_';
    if (!url.startsWith(prefix)) return url;
    const raw = decodeURIComponent(url.slice(prefix.length));
    return prefix + encodeURIComponent(canonicalProfile(raw));
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
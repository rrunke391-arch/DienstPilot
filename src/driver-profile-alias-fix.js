(() => {
  'use strict';

  if (window.__dienstpilotDriverProfileAliasFixV2) return;
  window.__dienstpilotDriverProfileAliasFixV2 = true;

  const API = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const aliases = new Map();

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function remember(alias, profile) {
    const source = normalize(alias);
    const target = normalize(profile);
    if (source && target) aliases.set(source, target);
  }

  async function loadAliases() {
    try {
      const headers = new Headers();
      const token = sessionStorage.getItem(TOKEN_KEY) || '';
      if (token) headers.set('Authorization', 'Bearer ' + token);
      const response = await fetch(API + '/api/users', { cache: 'no-store', headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.users)) return;

      data.users.forEach((entry) => {
        const profile = entry.driverProfile || entry.assigned_driver || entry.fahrer || entry.displayName || entry.username;
        if (!profile) return;
        remember(profile, profile);
        remember(entry.username, profile);
        remember(entry.displayName, profile);
      });
    } catch {}
  }

  function canonicalProfile(value) {
    const normalized = normalize(value);
    return aliases.get(normalized) || normalized;
  }

  function correctAssignmentDriver() {
    const input = document.getElementById('dpAssignDriverV2');
    if (!input || !input.value) return;
    const canonical = canonicalProfile(input.value);
    if (canonical && canonical !== normalize(input.value)) input.value = canonical;
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpAssignSaveV2,#dpAssignLoadV2')) correctAssignmentDriver();
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpAssignDriverV2') correctAssignmentDriver();
  }, true);

  loadAliases().then(correctAssignmentDriver);
  window.addEventListener('pageshow', () => loadAliases().then(correctAssignmentDriver));
  window.addEventListener('focus', () => loadAliases().then(correctAssignmentDriver));
})();
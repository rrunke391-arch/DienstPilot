(() => {
  'use strict';

  if (window.__dienstpilotDriverProfileAliasFixV1) return;
  window.__dienstpilotDriverProfileAliasFixV1 = true;

  const ALIASES = new Map([
    ['a.gerding', 'gerding'],
    ['a_gerding', 'gerding']
  ]);

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function canonicalProfile(value) {
    const raw = String(value || '').trim();
    const normalized = normalize(raw);
    return ALIASES.get(raw.toLowerCase()) || ALIASES.get(normalized) || normalized;
  }

  function correctAssignmentDriver() {
    const input = document.getElementById('dpAssignDriverV2');
    if (!input || !input.value) return;
    const canonical = canonicalProfile(input.value);
    if (canonical && canonical !== normalize(input.value)) input.value = canonical;
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpAssignSaveV2,#dpAssignLoadV2')) {
      correctAssignmentDriver();
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpAssignDriverV2') correctAssignmentDriver();
  }, true);

  window.addEventListener('pageshow', correctAssignmentDriver);
  window.addEventListener('focus', correctAssignmentDriver);
})();

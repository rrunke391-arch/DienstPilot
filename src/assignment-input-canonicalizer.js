(() => {
  'use strict';

  if (window.__dienstpilotAssignmentInputCanonicalizerV1) return;
  window.__dienstpilotAssignmentInputCanonicalizerV1 = true;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
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

  function canonicalProfile(value) {
    const key = normalize(value);
    const roster = rosterProfiles();
    if (roster.has(key)) return key;

    const match = key.match(/^[a-z]_([a-z0-9_-]+)$/);
    if (match && roster.has(match[1])) return match[1];

    return key;
  }

  function canonicalizeAssignmentInput() {
    const input = document.getElementById('dpAssignDriverV2');
    if (!input) return '';
    const canonical = canonicalProfile(input.value);
    if (canonical && normalize(input.value) !== canonical) {
      input.value = canonical;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return canonical;
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('#dpAssignLoadV2,#dpAssignSaveV2')) return;
    canonicalizeAssignmentInput();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.target?.id !== 'dpAssignDriverV2') return;
    canonicalizeAssignmentInput();
  }, true);

  window.DienstPilotCanonicalizeAssignmentDriver = canonicalizeAssignmentInput;
})();
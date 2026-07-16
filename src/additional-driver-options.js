(() => {
  'use strict';

  if (window.__dienstpilotAdditionalDriverOptions) return;
  window.__dienstpilotAdditionalDriverOptions = true;

  if (!document.getElementById('dpNiedersachsenHolidayDutyPlanScript')) {
    const script = document.createElement('script');
    script.id = 'dpNiedersachsenHolidayDutyPlanScript';
    script.src = 'src/niedersachsen-holiday-duty-plan.js?v=20260715-1';
    script.async = false;
    document.head.appendChild(script);
  }

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const BLOCKED_DRIVERS = ['seidensticker'];
  const DRIVERS = [
    'L.Hergerdt',
    'A.Hergerdt',
    'A.Hasan',
    'D.Knigge',
    'N.Awdullahi',
    'K.Giotis',
    'K.Igelbrink',
    'A.Alrobaie',
    'A.Morzsa',
    'C.Strotmann',
    'M.Eggern'
  ];

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function canonicalName(value) {
    const name = String(value || '').trim();
    return normalize(name) === 'hergerdt' ? 'L.Hergerdt' : name;
  }

  function profileKey(value) {
    const normalized = normalize(value);
    if (normalized === 'hergerdt' || normalized === 'l.hergerdt' || normalized === 'l_hergerdt') return 'hergerdt';
    return normalized.replace(/[^a-z0-9_-]+/g, '_');
  }

  function isBlocked(value) {
    const normalized = normalize(value);
    const profile = profileKey(value);
    return BLOCKED_DRIVERS.some((name) => normalized === name || profile === profileKey(name));
  }

  function currentRole() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
      return normalize(user?.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalize(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function permitted() {
    return [
      'geschaftsleitung',
      'geschaeftsleitung',
      'disposition',
      'disponent',
      'disponentin'
    ].includes(currentRole());
  }

  function correctHergerdtNames() {
    document.querySelectorAll('#kollegeSelect option').forEach((option) => {
      const shown = option.textContent || option.label || option.value;
      if (normalize(shown) === 'hergerdt') option.textContent = 'L.Hergerdt';
    });

    document.querySelectorAll('#dpAssignDriversV2 option').forEach((option) => {
      const shown = option.label || option.textContent || option.value;
      if (normalize(shown) === 'hergerdt' || profileKey(option.value) === 'hergerdt') {
        option.value = 'hergerdt';
        option.label = 'L.Hergerdt';
        option.textContent = 'L.Hergerdt';
      }
    });

    document.querySelectorAll('#dpDailyPlanRows .dp-daily-driver-select option').forEach((option) => {
      if (normalize(option.value || option.textContent) === 'hergerdt') {
        option.value = 'L.Hergerdt';
        option.textContent = 'L.Hergerdt';
      }
    });

    document.querySelectorAll('#dpDailyPlanRows input[data-field="name"]').forEach((input) => {
      if (normalize(input.value) !== 'hergerdt') return;
      input.value = 'L.Hergerdt';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function removeBlockedOptions() {
    document.querySelectorAll('#dpAssignDriversV2 option').forEach((option) => {
      if (isBlocked(option.value) || isBlocked(option.label) || isBlocked(option.textContent)) option.remove();
    });

    document.querySelectorAll('#dpDailyPlanRows .dp-daily-driver-select option').forEach((option) => {
      if (isBlocked(option.value) || isBlocked(option.textContent)) option.remove();
    });
  }

  function addAssignmentOptions() {
    const list = document.getElementById('dpAssignDriversV2');
    if (!list) return;

    const existing = new Set(
      [...list.querySelectorAll('option')].map((option) => profileKey(option.value || option.label))
    );

    DRIVERS.forEach((rawName) => {
      const name = canonicalName(rawName);
      const value = profileKey(name);
      if (!value || isBlocked(name) || existing.has(value)) return;
      const option = document.createElement('option');
      option.value = value;
      option.label = name;
      option.textContent = name;
      list.appendChild(option);
      existing.add(value);
    });
  }

  function addDailyPlanOptions() {
    document.querySelectorAll('#dpDailyPlanRows .dp-daily-driver-select').forEach((select) => {
      const existing = new Set(
        [...select.options].map((option) => normalize(option.value || option.textContent))
      );

      DRIVERS.forEach((rawName) => {
        const name = canonicalName(rawName);
        const key = normalize(name);
        if (!key || isBlocked(name) || existing.has(key)) return;
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
        existing.add(key);
      });
    });
  }

  function install() {
    if (!permitted()) return;
    correctHergerdtNames();
    removeBlockedOptions();
    addAssignmentOptions();
    addDailyPlanOptions();
    correctHergerdtNames();
    removeBlockedOptions();
  }

  function scheduleInstall() {
    [0, 100, 300, 800, 1600, 3200, 5200].forEach((delay) => window.setTimeout(install, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.(
      '#loginButton,#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailyPlanRows [data-action],#dpDutyAssignmentV2'
    )) scheduleInstall();
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target.id === 'dpDailyPlanDate' || event.target.matches?.('#dpDailyPlanRows input[data-field="duty"]')) {
      scheduleInstall();
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInstall, { once: true });
  } else {
    scheduleInstall();
  }

  window.addEventListener('pageshow', scheduleInstall);
  window.addEventListener('focus', scheduleInstall);
})();
(() => {
  'use strict';

  const FLAG_KEY = 'dienstpilot_august_2026_clean_start_done';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const START_MONTH = '2026-08';
  const START_DATE = '2026-08-01';

  if (localStorage.getItem(FLAG_KEY) === 'yes') return;

  const bundeslaender = { ferien: ['NI'], feiertage: ['NI'] };
  const savedAt = new Date().toISOString();

  const cleanPlan = (profile) => ({
    duties: [],
    vacations: [],
    vacationEntitlement: 30,
    bundeslaender,
    hideSundays: false,
    shownMonths: [START_MONTH],
    startDate: START_DATE,
    savedAt,
    profile
  });

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key.startsWith('lrz-plan-') ||
      key.startsWith('dienstpilot-vacations-') ||
      key === MAIN_KEY ||
      key === ACTIVE_DRIVER_KEY ||
      key === 'catalogReviewStatus'
    ) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  localStorage.setItem(MAIN_KEY, JSON.stringify({
    duties: [],
    customCatalog: {},
    appSettings: {
      hideSundays: false,
      shownMonths: [START_MONTH],
      activeProfile: 'runke',
      bundeslaender
    }
  }));

  localStorage.setItem('lrz-plan-runke', JSON.stringify(cleanPlan('runke')));
  localStorage.setItem('lrz-plan-gerding', JSON.stringify(cleanPlan('gerding')));
  localStorage.setItem('lrz-plan-testfahrer', JSON.stringify(cleanPlan('testfahrer')));
  localStorage.setItem(ACTIVE_DRIVER_KEY, 'runke');
  localStorage.setItem(FLAG_KEY, 'yes');

  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  }
})();

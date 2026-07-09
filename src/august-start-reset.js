(() => {
  'use strict';

  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const USER_KEY = 'dienstpilot_user';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const START_MONTH = '2026-08';
  const START_DATE = '2026-08-01';
  const PLAN_PREFIX = 'lrz-plan-';

  const bundeslaender = { ferien: ['NI'], feiertage: ['NI'] };

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function cleanPlan(profile, extra) {
    const now = new Date().toISOString();
    return {
      duties: [],
      vacations: [],
      vacationEntitlement: 30,
      bundeslaender,
      hideSundays: false,
      shownMonths: [START_MONTH],
      startDate: START_DATE,
      savedAt: now,
      profile,
      ...(extra || {})
    };
  }

  function normalizeProfile(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  }

  function currentProfile() {
    const user = readJson(USER_KEY);
    if (user && user.role === 'Fahrer') return normalizeProfile(user.driverProfile || user.username || 'testfahrer');
    const main = readJson(MAIN_KEY) || {};
    return normalizeProfile(main?.appSettings?.activeProfile || localStorage.getItem(ACTIVE_DRIVER_KEY) || 'runke');
  }

  function hasNoMonths(plan) {
    const months = Array.isArray(plan?.shownMonths) ? plan.shownMonths : [];
    return months.length === 0;
  }

  function hasOldMonths(plan) {
    const months = Array.isArray(plan?.shownMonths) ? plan.shownMonths : [];
    return months.some((month) => String(month || '') < START_MONTH);
  }

  function hasOldDuties(plan) {
    const duties = Array.isArray(plan?.duties) ? plan.duties : [];
    return duties.some((duty) => String(duty?.date || '') < START_DATE);
  }

  function localStateNeedsAugustReset() {
    const main = readJson(MAIN_KEY) || {};
    if (hasNoMonths(main?.appSettings) || hasOldMonths(main?.appSettings) || hasOldDuties(main)) return true;

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PLAN_PREFIX)) continue;
      const plan = readJson(key);
      if (hasOldMonths(plan) || hasOldDuties(plan)) return true;
    }
    return false;
  }

  function removeOldLocalPlanKeys() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith(PLAN_PREFIX) ||
        key.startsWith('dienstpilot-vacations-') ||
        key === MAIN_KEY ||
        key === ACTIVE_DRIVER_KEY ||
        key === 'catalogReviewStatus'
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  function writeLocalProfile(profile, plan) {
    const p = normalizeProfile(profile || plan?.profile || 'runke');
    const body = {
      ...cleanPlan(p),
      ...(plan && typeof plan === 'object' ? plan : {})
    };
    if (!Array.isArray(body.duties)) body.duties = [];
    if (!Array.isArray(body.vacations)) body.vacations = [];
    if (!Array.isArray(body.shownMonths) || body.shownMonths.length === 0) body.shownMonths = [START_MONTH];
    body.startDate = body.startDate || START_DATE;
    body.profile = p;

    localStorage.setItem(PLAN_PREFIX + p, JSON.stringify(body));
    localStorage.setItem(ACTIVE_DRIVER_KEY, p);
    localStorage.setItem(MAIN_KEY, JSON.stringify({
      duties: body.duties,
      customCatalog: {},
      appSettings: {
        hideSundays: !!body.hideSundays,
        shownMonths: body.shownMonths,
        activeProfile: p,
        bundeslaender: body.bundeslaender || bundeslaender
      }
    }));
  }

  function resetLocalStateToAugust() {
    const active = currentProfile();
    removeOldLocalPlanKeys();
    localStorage.setItem(PLAN_PREFIX + 'runke', JSON.stringify(cleanPlan('runke')));
    localStorage.setItem(PLAN_PREFIX + 'gerding', JSON.stringify(cleanPlan('gerding')));
    localStorage.setItem(PLAN_PREFIX + 'testfahrer', JSON.stringify(cleanPlan('testfahrer')));
    writeLocalProfile(active, cleanPlan(active));
  }

  if (localStateNeedsAugustReset()) {
    resetLocalStateToAugust();
  }

  async function loadProfileFromServer(profile) {
    const p = normalizeProfile(profile || currentProfile() || 'runke');
    try {
      const response = await fetch('/api/plan/' + encodeURIComponent(p), { cache: 'no-store' });
      if (response.ok) {
        const plan = await response.json().catch(() => ({}));
        writeLocalProfile(p, plan && typeof plan === 'object' ? plan : cleanPlan(p));
        return;
      }
    } catch {}
    writeLocalProfile(p, cleanPlan(p));
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    const button = target && target.closest ? target.closest('#loadRunke,#loadSelectedProfile,#loadKollege') : null;
    if (!button) return;

    let profile = 'runke';
    const select = document.getElementById('profileSelect') || document.getElementById('kollegeSelect');
    if (button.id !== 'loadRunke' && select && select.value) profile = select.value;

    event.preventDefault();
    event.stopImmediatePropagation();

    loadProfileFromServer(profile).then(() => {
      window.location.reload();
    });
  }, true);

  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
  }
})();

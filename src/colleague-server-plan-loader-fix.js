(() => {
  'use strict';

  if (window.__dienstpilotColleagueServerPlanLoaderFixV1) return;
  window.__dienstpilotColleagueServerPlanLoaderFixV1 = true;

  const API = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_PROFILE_KEY = 'dienstpilot_aktiver_kollege';
  let loading = false;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function readJson(storage, key, fallback) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function headers() {
    const result = new Headers();
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  function selectedProfile() {
    const select = document.getElementById('kollegeSelect');
    const raw = select?.value || select?.selectedOptions?.[0]?.textContent || '';
    return normalize(raw);
  }

  async function loadServerPlan(profile) {
    const response = await fetch(API + '/api/data/' + encodeURIComponent('plan_' + profile), {
      cache: 'no-store',
      headers: headers()
    });
    const wrapper = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(wrapper.error || 'Fahrerplan konnte nicht vom Server geladen werden.');
    const plan = Object.prototype.hasOwnProperty.call(wrapper, 'data') ? wrapper.data : wrapper;
    return plan && typeof plan === 'object' ? plan : { duties: [] };
  }

  async function applySelectedPlan(event) {
    const button = event.target.closest?.('#loadKollege');
    if (!button || loading) return;

    const profile = selectedProfile();
    if (!profile) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    loading = true;
    button.disabled = true;

    try {
      const plan = await loadServerPlan(profile);
      const duties = Array.isArray(plan.duties) ? plan.duties : [];
      const main = readJson(localStorage, MAIN_KEY, {});
      const appSettings = main.appSettings && typeof main.appSettings === 'object' ? main.appSettings : {};
      const next = {
        ...main,
        duties,
        vacations: Array.isArray(plan.vacations) ? plan.vacations : [],
        vacationEntitlement: Number.isFinite(plan.vacationEntitlement) ? plan.vacationEntitlement : 30,
        appSettings: {
          ...appSettings,
          activeProfile: profile,
          ...(plan.bundeslaender && typeof plan.bundeslaender === 'object' ? { bundeslaender: plan.bundeslaender } : {}),
          ...(typeof plan.hideSundays === 'boolean' ? { hideSundays: plan.hideSundays } : {})
        }
      };

      localStorage.setItem(MAIN_KEY, JSON.stringify(next));
      localStorage.setItem(ACTIVE_PROFILE_KEY, profile);
      localStorage.setItem('lrz-plan-' + profile, JSON.stringify({ ...plan, duties }));
      location.reload();
    } catch (error) {
      console.error('Kollegenplan konnte nicht in die Übersicht übernommen werden:', error);
      const status = document.getElementById('syncStatus');
      if (status) {
        status.textContent = 'Fahrerplan konnte nicht geladen werden';
        status.className = 'sync-status offline';
      }
      loading = false;
      button.disabled = false;
    }
  }

  document.addEventListener('click', applySelectedPlan, true);
})();

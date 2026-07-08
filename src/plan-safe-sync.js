(() => {
  'use strict';

  const mainKey = 'lenkRuhezeitenRunke20260413';
  const previousFetch = window.fetch.bind(window);

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function hasDuties(plan) {
    return Boolean(plan && Array.isArray(plan.duties) && plan.duties.length > 0);
  }

  function localPlan(profile) {
    const p = String(profile || '').trim().toLowerCase();
    const named = readJson('lrz-plan-' + p) || {};
    const main = readJson(mainKey) || {};
    const vacation = readJson('dienstpilot-vacations-' + p) || {};
    const plan = { ...named };

    if (!hasDuties(plan) && String(main?.appSettings?.activeProfile || '').toLowerCase() === p && Array.isArray(main.duties)) {
      plan.duties = main.duties;
    }

    if (!Array.isArray(plan.vacations) && Array.isArray(vacation.vacations)) plan.vacations = vacation.vacations;
    if (!Number.isFinite(plan.vacationEntitlement) && Number.isFinite(vacation.vacationEntitlement)) plan.vacationEntitlement = vacation.vacationEntitlement;
    if (!Array.isArray(plan.vacations)) plan.vacations = [];
    if (!Number.isFinite(plan.vacationEntitlement)) plan.vacationEntitlement = 30;
    return plan;
  }

  function responseJson(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  }

  window.fetch = async function planSafeFetch(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const options = init || {};
    const method = String(options.method || 'GET').toUpperCase();

    if (!url.startsWith('/api/plan/')) return previousFetch(input, init);

    const profile = decodeURIComponent(url.slice('/api/plan/'.length));
    const fallback = localPlan(profile);

    if (method === 'PUT') {
      let body = {};
      try { body = JSON.parse(options.body || '{}'); } catch {}
      if (!hasDuties(body) && hasDuties(fallback)) body.duties = fallback.duties;
      if (!Array.isArray(body.vacations) && Array.isArray(fallback.vacations)) body.vacations = fallback.vacations;
      if (!Number.isFinite(body.vacationEntitlement) && Number.isFinite(fallback.vacationEntitlement)) body.vacationEntitlement = fallback.vacationEntitlement;
      return previousFetch(input, { ...options, body: JSON.stringify(body) });
    }

    const response = await previousFetch(input, init);
    if (!response.ok) return hasDuties(fallback) ? responseJson(fallback) : response;

    const serverPlan = await response.clone().json().catch(() => ({}));
    if (!hasDuties(serverPlan) && hasDuties(fallback)) {
      return responseJson({ ...serverPlan, duties: fallback.duties, vacations: Array.isArray(serverPlan.vacations) ? serverPlan.vacations : fallback.vacations, vacationEntitlement: Number.isFinite(serverPlan.vacationEntitlement) ? serverPlan.vacationEntitlement : fallback.vacationEntitlement });
    }

    return response;
  };
})();

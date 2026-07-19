(() => {
  'use strict';

  if (window.__dienstpilotDailyDutyStorageGuardV1) return;
  window.__dienstpilotDailyDutyStorageGuardV1 = true;

  const API_URL = 'https://api.dienstpilot-runke.de/api/data/daily_duty_plans';
  const LOCAL_KEY = 'dienstpilot_daily_duty_plans_v1';
  const BASELINE_KEY = 'dienstpilot_daily_duty_plans_baseline_v1';
  const originalFetch = window.fetch.bind(window);

  let baseline = readSessionBaseline();
  let writeQueue = Promise.resolve();

  function requestUrl(input) {
    try {
      return new URL(typeof input === 'string' || input instanceof URL ? input : input?.url, location.href);
    } catch {
      return null;
    }
  }

  function isDailyPlanRequest(input) {
    const url = requestUrl(input);
    if (!url) return false;
    const target = new URL(API_URL);
    return url.origin === target.origin && url.pathname === target.pathname;
  }

  function requestMethod(input, init) {
    return String(init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
  }

  function unwrap(value) {
    return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'data')
      ? (value.data || {})
      : (value || {});
  }

  function normalizeStore(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawPlans = source.plans && typeof source.plans === 'object' ? source.plans : source;
    const plans = {};

    Object.entries(rawPlans || {}).forEach(([date, plan]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !plan || typeof plan !== 'object') return;
      plans[date] = {
        ...plan,
        date,
        rows: Array.isArray(plan.rows) ? plan.rows : [],
        savedAt: String(plan.savedAt || '')
      };
    });

    return { plans };
  }

  function readSessionBaseline() {
    try {
      return normalizeStore(JSON.parse(sessionStorage.getItem(BASELINE_KEY) || '{}'));
    } catch {
      return { plans: {} };
    }
  }

  function rememberBaseline(value) {
    baseline = normalizeStore(value);
    try {
      sessionStorage.setItem(BASELINE_KEY, JSON.stringify(baseline));
    } catch {}
  }

  function stablePlan(plan) {
    if (!plan || typeof plan !== 'object') return '';
    const normalized = {
      date: String(plan.date || ''),
      rows: Array.isArray(plan.rows) ? plan.rows : [],
      savedAt: String(plan.savedAt || '')
    };
    return JSON.stringify(normalized);
  }

  function combinedHeaders(input, init, forceJson = false) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (forceJson) headers.set('Content-Type', 'application/json');
    return headers;
  }

  async function readBody(input, init) {
    if (typeof init?.body === 'string') return init.body;
    if (init?.body instanceof Blob) return init.body.text();
    if (input instanceof Request) {
      try {
        return await input.clone().text();
      } catch {
        return '';
      }
    }
    return '';
  }

  function payloadWithPlans(payload, plans) {
    if (payload && typeof payload === 'object' && payload.plans && typeof payload.plans === 'object') {
      return { ...payload, plans };
    }
    return plans;
  }

  function localPlanIsNewer(localPlan, remotePlan) {
    if (!remotePlan) return true;
    const localTime = Date.parse(localPlan?.savedAt || '');
    const remoteTime = Date.parse(remotePlan?.savedAt || '');
    if (Number.isFinite(localTime) && Number.isFinite(remoteTime)) return localTime >= remoteTime;
    return stablePlan(localPlan) !== stablePlan(remotePlan);
  }

  function mergeLatest(latestStore, localStore) {
    const latest = normalizeStore(latestStore);
    const local = normalizeStore(localStore);
    const reference = normalizeStore(baseline);
    const hasReference = Object.keys(reference.plans).length > 0;
    const mergedPlans = { ...latest.plans };
    const changedDates = [];
    const deletedDates = [];

    if (hasReference) {
      const dates = new Set([...Object.keys(reference.plans), ...Object.keys(local.plans)]);
      dates.forEach((date) => {
        const before = reference.plans[date];
        const current = local.plans[date];
        if (before && !current) {
          delete mergedPlans[date];
          deletedDates.push(date);
          return;
        }
        if (current && stablePlan(current) !== stablePlan(before)) {
          mergedPlans[date] = current;
          changedDates.push(date);
        }
      });
    } else {
      Object.entries(local.plans).forEach(([date, current]) => {
        if (localPlanIsNewer(current, latest.plans[date])) {
          mergedPlans[date] = current;
          changedDates.push(date);
        }
      });
    }

    return {
      store: { plans: mergedPlans },
      changedDates,
      deletedDates
    };
  }

  function persistMerged(store) {
    const normalized = normalizeStore(store);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized));
    } catch {}
    rememberBaseline(normalized);
    window.dispatchEvent(new CustomEvent('dienstpilot:daily-plans-safely-merged', {
      detail: { planCount: Object.keys(normalized.plans).length }
    }));
  }

  async function captureGet(response) {
    if (!response?.ok) return;
    try {
      const wrapper = await response.clone().json();
      rememberBaseline(normalizeStore(unwrap(wrapper)));
    } catch {}
  }

  async function performSafePut(input, init) {
    const rawBody = await readBody(input, init);
    let payload;
    try {
      payload = JSON.parse(rawBody || '{}');
    } catch {
      return originalFetch(input, init);
    }

    const localStore = normalizeStore(payload);
    const headers = combinedHeaders(input, init);
    let latestResponse;

    try {
      latestResponse = await originalFetch(API_URL, {
        method: 'GET',
        cache: 'no-store',
        headers
      });
    } catch {
      return originalFetch(input, init);
    }

    if (!latestResponse.ok) return originalFetch(input, init);

    let latestStore;
    try {
      latestStore = normalizeStore(unwrap(await latestResponse.json()));
    } catch {
      return originalFetch(input, init);
    }

    const merged = mergeLatest(latestStore, localStore);
    const nextPayload = payloadWithPlans(payload, merged.store.plans);
    const nextInit = {
      ...(init || {}),
      method: 'PUT',
      headers: combinedHeaders(input, init, true),
      body: JSON.stringify(nextPayload)
    };

    const response = await originalFetch(typeof input === 'string' || input instanceof URL ? input : API_URL, nextInit);
    if (response.ok) {
      persistMerged(merged.store);
      window.setTimeout(() => persistMerged(merged.store), 0);
    }
    return response;
  }

  window.fetch = function dienstpilotSafeDailyPlanFetch(input, init) {
    if (!isDailyPlanRequest(input)) return originalFetch(input, init);
    const method = requestMethod(input, init);

    if (method === 'GET') {
      return originalFetch(input, init).then(async (response) => {
        await captureGet(response);
        return response;
      });
    }

    if (method === 'PUT') {
      const run = () => performSafePut(input, init);
      writeQueue = writeQueue.then(run, run);
      return writeQueue;
    }

    return originalFetch(input, init);
  };
})();
(() => {
  'use strict';

  if (window.__dienstpilotAssignedPlanPutNormalizerV1) return;
  window.__dienstpilotAssignedPlanPutNormalizerV1 = true;

  const originalFetch = window.fetch.bind(window);

  function isDriverPlanPut(url, method) {
    return method === 'PUT' && /\/api\/data\/plan_/i.test(String(url || ''));
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    if (entry.type !== 'dienst') return entry;
    return {
      ...entry,
      type: 'duty',
      breaks: typeof entry.breaks === 'string' ? entry.breaks : '',
      drivingBlocks: typeof entry.drivingBlocks === 'string' ? entry.drivingBlocks : '',
      lineMode: entry.lineMode || 'linie50',
      stopDistance: entry.stopDistance || 'gt3',
      pauseRule: entry.pauseRule || 'auto',
      tariffEight: !!entry.tariffEight
    };
  }

  function normalizeBody(body) {
    if (typeof body !== 'string') return body;
    try {
      const plan = JSON.parse(body);
      if (!plan || typeof plan !== 'object' || !Array.isArray(plan.duties)) return body;
      return JSON.stringify({
        ...plan,
        duties: plan.duties.map(normalizeEntry)
      });
    } catch {
      return body;
    }
  }

  window.fetch = function dienstpilotNormalizedPlanPut(input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (!isDriverPlanPut(url, method)) return originalFetch(input, init);

    const options = { ...(init || {}) };
    options.body = normalizeBody(options.body);
    return originalFetch(input, options);
  };
})();

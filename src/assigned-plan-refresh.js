(() => {
  'use strict';

  if (window.__dienstpilotAssignedPlanRefreshV1) return;
  window.__dienstpilotAssignedPlanRefreshV1 = true;

  const API_PREFIX = 'https://api.dienstpilot-runke.de/api/data/plan_';
  const originalFetch = window.fetch.bind(window);

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function selectedProfile() {
    const select = document.getElementById('kollegeSelect');
    const selected = select?.selectedOptions?.[0];
    return normalize(select?.value || selected?.textContent || '');
  }

  function refreshVisiblePlan(profile) {
    if (!profile || selectedProfile() !== profile) return;

    const loadButton = document.getElementById('loadKollege');
    if (loadButton) {
      window.setTimeout(() => loadButton.click(), 80);
      window.setTimeout(() => loadButton.click(), 350);
      return;
    }

    window.dispatchEvent(new CustomEvent('dienstpilot:assigned-plan-updated', {
      detail: { profile }
    }));
  }

  window.fetch = async function assignedPlanRefreshFetch(input, init) {
    const response = await originalFetch(input, init);

    try {
      const url = typeof input === 'string' ? input : (input?.url || '');
      const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method !== 'PUT' || !url.startsWith(API_PREFIX) || !response.ok) return response;

      const profile = normalize(decodeURIComponent(url.slice(API_PREFIX.length)));
      let savedPlan = null;
      const body = init?.body;
      if (typeof body === 'string') savedPlan = JSON.parse(body);

      if (savedPlan && typeof savedPlan === 'object') {
        localStorage.setItem('lrz-plan-' + profile, JSON.stringify(savedPlan));
      }

      window.dispatchEvent(new CustomEvent('dienstpilot:assigned-plan-saved', {
        detail: { profile, plan: savedPlan }
      }));
      refreshVisiblePlan(profile);
    } catch (error) {
      console.warn('Zugewiesener Fahrerplan konnte nicht sofort aktualisiert werden:', error);
    }

    return response;
  };
})();
(() => {
  'use strict';

  if (window.__dienstpilotAssignedPlanTypeFixV1) return;
  window.__dienstpilotAssignedPlanTypeFixV1 = true;

  const API = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';

  function normalizeProfile(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function normalizePlan(plan) {
    if (!plan || typeof plan !== 'object') return { plan, changed: false };
    let changed = false;
    const duties = Array.isArray(plan.duties) ? plan.duties.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      if (entry.type === 'dienst') {
        changed = true;
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
      return entry;
    }) : [];
    return { plan: { ...plan, duties }, changed };
  }

  function headers() {
    const result = new Headers({ 'Content-Type': 'application/json' });
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  async function persistNormalized(profile, sourcePlan) {
    const clean = normalizeProfile(profile);
    if (!clean) return;
    const normalized = normalizePlan(sourcePlan);
    if (!normalized.changed) return;

    const fixedPlan = {
      ...normalized.plan,
      savedAt: new Date().toISOString()
    };

    const response = await fetch(API + '/api/data/' + encodeURIComponent('plan_' + clean), {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(fixedPlan)
    });
    if (!response.ok) return;

    try { localStorage.setItem('lrz-plan-' + clean, JSON.stringify(fixedPlan)); } catch {}

    window.dispatchEvent(new CustomEvent('dienstpilot:assigned-plan-type-corrected', {
      detail: { profile: clean, plan: fixedPlan }
    }));

    const selected = document.getElementById('kollegeSelect');
    const selectedProfile = normalizeProfile(selected?.value || selected?.selectedOptions?.[0]?.textContent || '');
    if (selectedProfile === clean) {
      [80, 300, 700].forEach((delay) => window.setTimeout(() => document.getElementById('loadKollege')?.click(), delay));
    }
  }

  window.addEventListener('dienstpilot:assigned-plan-saved', (event) => {
    persistNormalized(event.detail?.profile, event.detail?.plan).catch((error) => {
      console.warn('Zugewiesener Dienst konnte nicht in das Monatsplanformat umgewandelt werden:', error);
    });
  });
})();
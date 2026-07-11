(() => {
  'use strict';

  const MARKER_KEY = 'dienstpilot_photo_bus_defaults_v3';
  let lastTrigger = 0;

  function markers() {
    try {
      const value = JSON.parse(localStorage.getItem(MARKER_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function refresh() {
    const section = document.getElementById('tab-daily-duty-plan');
    if (!section || section.classList.contains('hidden')) return;

    const date = String(document.getElementById('dpDailyPlanDate')?.value || '').trim();
    if (!date || markers()[date]) return;

    const now = Date.now();
    if (now - lastTrigger < 1200) return;
    lastTrigger = now;

    if (typeof window.dienstpilotPopulateDailyPlan === 'function') {
      window.dienstpilotPopulateDailyPlan();
      return;
    }

    const fallback = document.getElementById('dpDailyInsertDefaults');
    if (fallback && !fallback.disabled) fallback.click();
  }

  [0, 300, 800, 1600, 3000].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpDailyPlanDate') window.setTimeout(refresh, 180);
  });
  window.setInterval(refresh, 1000);
})();
(() => {
  'use strict';

  const MARKER_KEY = 'dienstpilot_photo_bus_defaults_v3';
  const HOLIDAY_PERIODS = [
    ['2025-10-13', '2025-10-25'], ['2025-12-22', '2026-01-05'],
    ['2026-02-02', '2026-02-03'], ['2026-03-23', '2026-04-07'],
    ['2026-05-15', '2026-05-15'], ['2026-05-26', '2026-05-26'],
    ['2026-07-02', '2026-08-12'], ['2026-10-12', '2026-10-24'],
    ['2026-12-23', '2027-01-09'], ['2027-02-01', '2027-02-02'],
    ['2027-03-22', '2027-04-03'], ['2027-05-07', '2027-05-07'],
    ['2027-05-18', '2027-05-18'], ['2027-07-08', '2027-08-18'],
    ['2027-10-16', '2027-10-30'], ['2027-12-23', '2028-01-08']
  ];

  let lastTrigger = 0;

  function markers() {
    try {
      const value = JSON.parse(localStorage.getItem(MARKER_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function isHolidayWeekday(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    if (day === 0 || day === 6) return false;
    return HOLIDAY_PERIODS.some(([start, end]) => date >= start && date <= end);
  }

  function refresh() {
    const section = document.getElementById('tab-daily-duty-plan');
    if (!section || section.classList.contains('hidden')) return;
    if (window.__dienstpilotHolidayPhotoRebuilding) return;

    const date = String(document.getElementById('dpDailyPlanDate')?.value || '').trim();
    if (!date || isHolidayWeekday(date) || markers()[date]) return;

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
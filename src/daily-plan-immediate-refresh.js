(() => {
  'use strict';

  if (window.__dienstpilotDailyPlanImmediateRefreshV1) return;
  window.__dienstpilotDailyPlanImmediateRefreshV1 = true;

  const SECTION_ID = 'tab-daily-duty-plan';
  const DATE_ID = 'dpDailyPlanDate';
  const TABLE_ID = 'dpDailyPlanRows';

  let refreshTimer = 0;

  function sectionVisible() {
    const section = document.getElementById(SECTION_ID);
    return Boolean(section && !section.classList.contains('hidden'));
  }

  function nudge() {
    if (!sectionVisible()) return;

    const date = document.getElementById(DATE_ID);
    if (date) {
      date.dispatchEvent(new Event('input', { bubbles: true }));
      date.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const firstDuty = document.querySelector(`#${TABLE_ID} input[data-field="duty"]`);
    if (firstDuty) firstDuty.dispatchEvent(new Event('input', { bubbles: true }));

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
  }

  function refreshBurst() {
    window.clearTimeout(refreshTimer);
    [0, 80, 180, 350, 700, 1200, 2200, 4000, 7000].forEach((delay) => {
      window.setTimeout(nudge, delay);
    });
  }

  window.addEventListener('dienstpilot:authenticated', refreshBurst);
  window.addEventListener('pageshow', refreshBurst);
  window.addEventListener('focus', () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(nudge, 120);
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,[data-tab="daily-duty-plan"],#loginButton')) {
      refreshBurst();
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshBurst, { once: true });
  } else {
    refreshBurst();
  }
})();

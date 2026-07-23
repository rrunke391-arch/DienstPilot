(() => {
  'use strict';

  if (window.__dienstpilotDailyPlanImmediateRefreshV4) {
    window.__dienstpilotHolidayUiRepairV2?.restart?.();
    window.__dienstpilotHolidayUiRepairV1?.restart?.();
    return;
  }
  window.__dienstpilotDailyPlanImmediateRefreshV4 = true;

  function loadRepair() {
    const api = window.__dienstpilotHolidayUiRepairV2 || window.__dienstpilotHolidayUiRepairV1;
    if (api?.restart) {
      api.restart();
      return;
    }
    if (document.getElementById('dpHolidayUiRepairV2')) return;
    const script = document.createElement('script');
    script.id = 'dpHolidayUiRepairV2';
    script.src = 'src/holiday-ui-repair.js?v=20260723-2';
    script.async = false;
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadRepair, { once: true });
  } else {
    loadRepair();
  }

  window.addEventListener('dienstpilot:authenticated', () => {
    [0,150,500,1200].forEach((delay) => setTimeout(loadRepair, delay));
  });
})();

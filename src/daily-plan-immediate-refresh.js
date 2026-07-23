(() => {
  'use strict';

  if (window.__dienstpilotDailyPlanImmediateRefreshV5) {
    window.__dienstpilotHolidayUiRepairV2?.restart?.();
    window.__dienstpilotHolidayUiRepairV1?.restart?.();
    return;
  }
  window.__dienstpilotDailyPlanImmediateRefreshV5 = true;

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  function loadRepairs() {
    const api = window.__dienstpilotHolidayUiRepairV2 || window.__dienstpilotHolidayUiRepairV1;
    if (api?.restart) api.restart();
    else loadScript('dpHolidayUiRepairV2', 'src/holiday-ui-repair.js?v=20260723-2');

    loadScript('dpSplitShiftStartupTriggerV1', 'src/split-shift-startup-trigger.js?v=20260723-1');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadRepairs, { once: true });
  } else {
    loadRepairs();
  }

  window.addEventListener('dienstpilot:authenticated', () => {
    [0,150,500,1200].forEach((delay) => setTimeout(loadRepairs, delay));
  });
})();

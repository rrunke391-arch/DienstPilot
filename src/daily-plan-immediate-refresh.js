(() => {
  'use strict';

  if (window.__dienstpilotDailyPlanImmediateRefreshV3) {
    window.__dienstpilotHolidayUiRepairV1?.restart?.();
    return;
  }
  window.__dienstpilotDailyPlanImmediateRefreshV3 = true;

  // Keine kuenstlichen Eingabe- oder Tab-Ereignisse. Diese hatten den
  // Werktagsplan zuvor unbeabsichtigt auf die Wochenendansicht umgeschaltet.
  function loadRepair() {
    if (window.__dienstpilotHolidayUiRepairV1?.restart) {
      window.__dienstpilotHolidayUiRepairV1.restart();
      return;
    }
    if (document.getElementById('dpHolidayUiRepairV1')) return;
    const script = document.createElement('script');
    script.id = 'dpHolidayUiRepairV1';
    script.src = 'src/holiday-ui-repair.js?v=20260723-1';
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

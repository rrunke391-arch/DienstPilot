(() => {
  'use strict';

  if (window.__dienstpilotDailyPlanImmediateRefreshV2) return;
  window.__dienstpilotDailyPlanImmediateRefreshV2 = true;

  // Absichtlich keine kuenstlichen input/change/focus/pageshow-Ereignisse mehr.
  // Diese Ereignisse konnten nach der Anmeldung den aktiven Tagesplan
  // unbeabsichtigt auf die Wochenendansicht umschalten.
})();

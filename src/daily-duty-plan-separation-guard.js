(() => {
  'use strict';

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  function loadExtras() {
    loadScript('dpDailyDutyWeekdayRepairV2', 'src/daily-duty-plan-weekday-repair.js?v=20260719-2');
    loadScript('dpDailyDutyStartRepairV2', 'src/daily-duty-plan-start-duties-repair.js?v=20260719-2');
    loadScript('dpHolidayPlanRecoveryV1', 'src/holiday-plan-recovery.js?v=20260719-1');
    loadScript('dpXlsmCore', 'src/xlsm-core.js?v=20260711-1');
    loadScript('dpXlsmExchange', 'src/xlsm-exchange.js?v=20260711-1');
  }

  loadExtras();

  function setStatus(text) {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    if (status.textContent !== text) status.textContent = text;
    if (status.className !== 'dp-daily-status error') status.className = 'dp-daily-status error';
  }

  function duties() {
    return [...document.querySelectorAll('#dpDailyPlanRows input[data-field="duty"]')]
      .map((input) => String(input.value || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function weekendDuty(value) {
    return /^(305[0-7]|3061|3062)$/.test(value) || value === '1340' || value === '11541' || value === '1943';
  }

  function weekdayDuty(value) {
    return /^(300[1-9]|301\d|302[0-5])$/.test(value) || value === '1341' || value === '1743' || value === '1941';
  }

  document.addEventListener('click', (event) => {
    if (window.dienstpilotPrintAnytimeReady) return;

    const weekdayButton = event.target.closest?.('#dpDailyPrintWeekday');
    const weekendButton = event.target.closest?.('#dpDailyPrintWeekend');
    if (!weekdayButton && !weekendButton) return;

    const values = duties();
    if (weekdayButton && values.some(weekendDuty)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setStatus('Der Werktagsplan enthält noch einen Samstag- oder Sonntagsdienst. Bitte diesen Eintrag entfernen oder das richtige Datum wählen.');
      return;
    }

    if (weekendButton && values.some(weekdayDuty)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setStatus('Der Wochenendplan enthält noch einen Dienst von Montag bis Freitag. Bitte diesen Eintrag entfernen oder das richtige Datum wählen.');
    }
  }, true);
})();
(() => {
  'use strict';

  function loadWeekdayRepair() {
    if (document.getElementById('dpDailyDutyWeekdayRepair')) return;
    const script = document.createElement('script');
    script.id = 'dpDailyDutyWeekdayRepair';
    script.src = 'src/daily-duty-plan-weekday-repair.js?v=20260711-1';
    script.async = false;
    document.head.appendChild(script);
  }

  loadWeekdayRepair();

  function setStatus(text) {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status error';
  }

  function duties() {
    return [...document.querySelectorAll('#dpDailyPlanRows input[data-field="duty"]')]
      .map((input) => String(input.value || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function weekendDuty(value) {
    return /^(305[0-7]|3061|3062)$/.test(value) || value === '1340' || value === '1943';
  }

  function weekdayDuty(value) {
    return /^(300[1-9]|301\d|302[0-5])$/.test(value) || value === '1341' || value === '1941';
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
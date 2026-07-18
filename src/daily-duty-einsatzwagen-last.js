(() => {
  'use strict';

  if (window.__dienstpilotDailyEinsatzwagenLastV1) return;
  window.__dienstpilotDailyEinsatzwagenLastV1 = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const DUTY_FIELD = 'input[data-field="duty"]';
  const MAX_STEPS = 80;

  let fixing = false;
  let timer = 0;
  let observer = null;
  let observedTable = null;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function selectedDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function appliesToSelectedDate() {
    const date = selectedDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    return day >= 1 && day <= 6;
  }

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  }

  function duty(row) {
    return normalize(row?.querySelector(DUTY_FIELD)?.value);
  }

  function isEinsatzwagen(row) {
    return duty(row) === 'einsatzwagen';
  }

  function isService(row) {
    const value = duty(row);
    return Boolean(value) && value !== 'einsatzwagen' && value !== 'frei';
  }

  function moveOneStep(row, direction) {
    const button = row?.querySelector(`[data-action="${direction}"]`);
    if (!button) return false;
    const wasDisabled = button.disabled;
    if (wasDisabled) button.disabled = false;
    button.click();
    if (button.isConnected && wasDisabled) button.disabled = true;
    return true;
  }

  function correctOrder() {
    if (fixing || !appliesToSelectedDate()) return false;
    fixing = true;
    let changed = false;

    try {
      for (let step = 0; step < MAX_STEPS; step += 1) {
        const currentRows = rows();
        const wagon = currentRows.find(isEinsatzwagen);
        if (!wagon) break;

        const wagonIndex = currentRows.indexOf(wagon);
        let lastServiceIndex = -1;
        currentRows.forEach((row, index) => {
          if (isService(row)) lastServiceIndex = index;
        });
        if (lastServiceIndex < 0) break;

        const targetIndex = lastServiceIndex + (wagonIndex < lastServiceIndex ? 0 : 1);
        if (wagonIndex === targetIndex) break;

        const direction = wagonIndex < targetIndex ? 'down' : 'up';
        if (!moveOneStep(wagon, direction)) break;
        changed = true;
      }
    } finally {
      fixing = false;
    }

    return changed;
  }

  function schedule(delay = 60) {
    window.clearTimeout(timer);
    timer = window.setTimeout(correctOrder, delay);
  }

  function installObserver() {
    const table = document.getElementById(TABLE_ID);
    if (!table || table === observedTable) return;
    observer?.disconnect();
    observedTable = table;
    observer = new MutationObserver(() => schedule(35));
    observer.observe(table, { childList: true, subtree: true });
  }

  function refresh() {
    installObserver();
    [0, 80, 220, 600, 1200].forEach((delay) => window.setTimeout(correctOrder, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyEditSaturday,#dpDailyInsertDefaults,#dpDailyAddRow,#dpDailySave,#dpDailyPrint,#dpDailyPrintA4,#dpDailyPrintWeekday,#dpDailyPrintWeekend,#dpDailyPlanRows [data-action],#loginButton')) {
      schedule(20);
    }
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.matches?.(`#${TABLE_ID} ${DUTY_FIELD}`)) schedule(30);
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID || event.target.matches?.(`#${TABLE_ID} ${DUTY_FIELD},#${TABLE_ID} .dp-daily-duty-select`)) {
      refresh();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();

  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
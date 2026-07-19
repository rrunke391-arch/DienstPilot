(() => {
  'use strict';

  if (window.__dienstpilotWeekdayRepairV2) return;
  window.__dienstpilotWeekdayRepairV2 = true;

  const DATE_ID = 'dpDailyPlanDate';
  const TABLE_ID = 'dpDailyPlanRows';
  const MARKER_KEY = 'dienstpilot_weekday_list_repair_v1';
  const START_DUTIES = ['3001', '3003', '3004'];
  const WEEKDAY_ORDER = [
    '3001', '3003', '3004', '3005', '3006', '3007', '3008', '3009',
    '3010', '3011', '3012', '3013', '3014', '3015', '3016', '3017',
    '3018', '3019', '3020', '3021', '3022', '3023', '3024', '3025',
    '1341', '1941', '3002', 'einsatzwagen'
  ];

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

  let running = false;

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function currentDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function dayOfWeek(date) {
    const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return -1;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0).getDay();
  }

  function isWeekday(date) {
    const day = dayOfWeek(date);
    return day >= 1 && day <= 5;
  }

  function isHolidayWeekday(date) {
    return isWeekday(date) && HOLIDAY_PERIODS.some(([start, end]) => date >= start && date <= end);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  }

  function rowDuty(row) {
    return normalize(row?.querySelector('input[data-field="duty"]')?.value);
  }

  function duties() {
    return rows().map(rowDuty).filter(Boolean);
  }

  function readMarkers() {
    try {
      const value = JSON.parse(localStorage.getItem(MARKER_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function isMarked(date) {
    return Boolean(date && readMarkers()[date]);
  }

  function mark(date) {
    if (!date) return;
    const markers = readMarkers();
    markers[date] = true;
    localStorage.setItem(MARKER_KEY, JSON.stringify(markers));
  }

  function setStatus(text, kind = 'ok') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    const className = `dp-daily-status ${kind}`;
    if (status.textContent !== text) status.textContent = text;
    if (status.className !== className) status.className = className;
  }

  async function waitForDuty(duty, timeoutMs = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (duties().includes(normalize(duty))) return true;
      await wait(80);
    }
    return false;
  }

  async function moveDutyToIndex(duty, targetIndex) {
    const wanted = normalize(duty);
    let guard = 0;

    while (guard < 80) {
      const currentRows = rows();
      const index = currentRows.findIndex((row) => rowDuty(row) === wanted);
      if (index < 0 || index <= targetIndex) return;

      const up = currentRows[index]?.querySelector('[data-action="up"]');
      if (!up || up.disabled) return;
      up.click();
      guard += 1;
      await wait(28);
    }
  }

  async function repair() {
    const date = currentDate();
    if (running || !date || !isWeekday(date) || isHolidayWeekday(date) || isMarked(date)) return;

    const table = document.getElementById(TABLE_ID);
    const addButton = document.getElementById('dpDailyAddRow');
    if (!table || !addButton || addButton.disabled) return;

    const current = new Set(duties());
    const missing = START_DUTIES.filter((duty) => !current.has(duty));
    if (!missing.length) {
      mark(date);
      return;
    }

    running = true;
    try {
      if (typeof window.dienstpilotApplyDailyTemplate === 'function') {
        await Promise.resolve(window.dienstpilotApplyDailyTemplate());
      } else {
        const insertButton = document.getElementById('dpDailyInsertDefaults');
        if (insertButton && !insertButton.disabled) insertButton.click();
      }

      for (const duty of missing) await waitForDuty(duty);

      for (let index = 0; index < WEEKDAY_ORDER.length; index += 1) {
        await moveDutyToIndex(WEEKDAY_ORDER[index], index);
      }

      mark(date);
      const saveButton = document.getElementById('dpDailySave');
      if (saveButton && !saveButton.disabled) {
        saveButton.click();
        await wait(120);
      }

      setStatus('Die fehlenden Dienste 3001, 3003 und 3004 wurden ergänzt und an den Anfang der Werktagsliste gesetzt.');
    } finally {
      running = false;
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton')) {
      [250, 700, 1400, 2600].forEach((delay) => window.setTimeout(repair, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) {
      [180, 500, 1000].forEach((delay) => window.setTimeout(repair, delay));
    }
  });

  [400, 900, 1800, 3200].forEach((delay) => window.setTimeout(repair, delay));
  window.addEventListener('pageshow', repair);
  window.addEventListener('focus', repair);
})();
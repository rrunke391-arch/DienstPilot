(() => {
  'use strict';

  if (window.__dienstpilotStartDutyRepairV2) return;
  window.__dienstpilotStartDutyRepairV2 = true;

  const DATE_ID = 'dpDailyPlanDate';
  const TABLE_ID = 'dpDailyPlanRows';
  const ADD_ID = 'dpDailyAddRow';
  const SAVE_ID = 'dpDailySave';

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

  const START_DUTIES = [
    { duty: '3001', name: 'I.Janzen', bus: 'OS-LK 621', start: '05:03', end: '12:12', departure: '05:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3003', name: 'R.Runke', bus: 'OS-TG 324', start: '05:47', end: '14:10', departure: '06:12', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '3004', name: 'A.Muth', bus: 'OS-GZ 123', start: '05:50', end: '15:40', departure: '06:15', stop: 'Melle, ZOB' }
  ];

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function currentDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function isHolidayWeekday(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    return day >= 1 && day <= 5 && HOLIDAY_PERIODS.some(([start, end]) => date >= start && date <= end);
  }

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  }

  function rowDuty(row) {
    return normalize(row?.querySelector('input[data-field="duty"]')?.value);
  }

  function findRow(duty) {
    const wanted = normalize(duty);
    return rows().find((row) => rowDuty(row) === wanted) || null;
  }

  function visibleDuties() {
    return rows().map(rowDuty).filter(Boolean);
  }

  function looksLikeWeekdayList() {
    const duties = visibleDuties();
    const weekdayHits = duties.filter((duty) => /^(300[5-9]|301\d|302[0-5])$/.test(duty)).length;
    return duties.includes('3005') || weekdayHits >= 4;
  }

  function dispatchInput(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setField(row, field, value) {
    const input = row?.querySelector(`input[data-field="${field}"]`);
    if (!input || input.disabled) return;
    const next = String(value ?? '');
    if (input.value === next) return;
    input.value = next;
    dispatchInput(input);
  }

  async function createDuty(item) {
    const add = document.getElementById(ADD_ID);
    if (!add || add.disabled) return null;

    add.click();
    await wait(50);
    const blank = rows().find((row) => !rowDuty(row));
    if (!blank) return null;

    const dutyInput = blank.querySelector('input[data-field="duty"]');
    if (!dutyInput || dutyInput.disabled) return null;
    dutyInput.dataset.dpDutyCommit = '1';
    dutyInput.value = item.duty;
    dispatchInput(dutyInput);
    delete dutyInput.dataset.dpDutyCommit;
    await wait(90);

    const row = findRow(item.duty);
    if (!row) return null;
    for (const field of ['name', 'bus', 'start', 'end', 'departure', 'stop']) {
      setField(row, field, item[field]);
      await wait(15);
    }
    return findRow(item.duty);
  }

  async function moveToTop(duty, targetIndex) {
    let guard = 0;
    while (guard < 100) {
      const currentRows = rows();
      const index = currentRows.findIndex((row) => rowDuty(row) === normalize(duty));
      if (index < 0 || index <= targetIndex) return;
      const up = currentRows[index]?.querySelector('[data-action="up"]');
      if (!up || up.disabled) return;
      up.click();
      guard += 1;
      await wait(35);
    }
  }

  function setStatus(text, kind = 'ok') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    const className = `dp-daily-status ${kind}`;
    if (status.textContent !== text) status.textContent = text;
    if (status.className !== className) status.className = className;
  }

  async function repair() {
    const date = currentDate();
    if (running || !date || isHolidayWeekday(date) || !document.getElementById(TABLE_ID) || !looksLikeWeekdayList()) return;

    const missing = START_DUTIES.filter((item) => !findRow(item.duty));
    if (!missing.length) return;

    running = true;
    try {
      for (const item of missing) await createDuty(item);
      for (let index = 0; index < START_DUTIES.length; index += 1) {
        await moveToTop(START_DUTIES[index].duty, index);
      }

      const save = document.getElementById(SAVE_ID);
      if (save && !save.disabled) {
        save.click();
        await wait(180);
      }

      setStatus('Die Dienste 3001, 3003 und 3004 sind jetzt vollständig vorhanden, bearbeitbar und an den Anfang der Liste gesetzt.');
    } catch (error) {
      setStatus(`Die fehlenden Dienste konnten nicht vollständig ergänzt werden: ${error.message}`, 'error');
    } finally {
      running = false;
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton,#dpDailySave,#dpDailyAddRow')) {
      [120, 400, 900, 1600].forEach((delay) => window.setTimeout(repair, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) {
      [150, 450, 900, 1500].forEach((delay) => window.setTimeout(repair, delay));
    }
  });

  [250, 700, 1300, 2200, 3500].forEach((delay) => window.setTimeout(repair, delay));
  window.addEventListener('pageshow', repair);
  window.addEventListener('focus', repair);
})();
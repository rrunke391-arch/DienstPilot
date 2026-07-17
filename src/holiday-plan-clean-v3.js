(() => {
  'use strict';

  if (window.__dienstpilotHolidayPlanCleanV3) return;
  window.__dienstpilotHolidayPlanCleanV3 = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const ADD_ID = 'dpDailyAddRow';
  const SECTION_ID = 'tab-daily-duty-plan';

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

  const REQUIRED_ROWS = [
    { duty: '3031', name: 'A.Gerding', bus: 'OS-LF 223', start: '05:03', end: '13:21', departure: '05:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3032', name: 'D.Knigge', bus: 'OS-VH 721', start: '04:45', end: '12:04', departure: '05:26', stop: 'Osnabrück, HBF' },
    { duty: '3033', name: 'Y.Yasar', bus: 'OS-QS 519', start: '05:43', end: '12:21', departure: '06:16', stop: 'Buer, Schulzentrum' },
    { duty: '3034', name: 'S.Wittwer', bus: 'OS-SU 722', start: '05:47', end: '15:39', departure: '06:12', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '3035', name: 'H.Al Sayek', bus: 'OS-IF 215', start: '05:51', end: '17:21', departure: '06:18', stop: 'Westerhausen, Vinkenaue' },
    { duty: '3036', name: 'P.Lhommel', bus: 'OS-XB 925', start: '06:03', end: '18:04', departure: '06:27', stop: 'Gesmold, Schimmweg' },
    { duty: '3037', name: 'K.Igelbrink', bus: 'OS-YG 120', start: '06:03', end: '16:05', departure: '06:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3038', name: 'W.Wüllner', bus: 'OS-DZ 116', start: '06:03', end: '12:06', departure: '06:28', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '3039', name: 'A.Hergerdt', bus: 'OS-ZT 626', start: '06:42', end: '13:05', departure: '07:15', stop: 'Bruchmühlen, Schule' },
    { duty: '3040', name: 'N.Awdullahi', bus: 'OS-EV 118', start: '07:20', end: '19:33', departure: '07:45', stop: 'Melle, ZOB' },
    { duty: '3041', name: 'A.Hasan', bus: 'OS-BU 816', start: '08:20', end: '19:41', departure: '08:45', stop: 'Melle, ZOB' },
    { duty: '3042', name: 'K.Giotis', bus: 'OS-KX 220', start: '11:20', end: '21:05', departure: '11:45', stop: 'Melle, ZOB' },
    { duty: '3043', name: 'T.Wiemann', bus: 'OS-UL 818', start: '12:03', end: '20:21', departure: '12:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3044', name: 'A.Alrobaie', bus: 'OS-PK 216', start: '12:20', end: '22:03', departure: '12:45', stop: 'Melle, ZOB' },
    { duty: '3045', name: 'N.Murad', bus: 'OS-HD 124', start: '13:03', end: '21:50', departure: '13:20', stop: 'Wellingholzhausen, Schule' },
    { duty: 'Einsatzwagen', name: 'Einsatzwagen', bus: 'OS-QS 519', start: '', end: '', departure: '', stop: 'Melle, ZOB' }
  ];

  const REQUIRED_DUTIES = new Set(REQUIRED_ROWS.map((row) => row.duty));
  const REMOVE_DUTIES = new Set(['1341', '1743', '1941']);
  let running = false;
  let timer = 0;

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function selectedDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function isHolidayWeekday(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    if (day === 0 || day === 6) return false;
    return HOLIDAY_PERIODS.some(([start, end]) => date >= start && date <= end);
  }

  function sectionVisible() {
    const section = document.getElementById(SECTION_ID);
    return Boolean(section && !section.classList.contains('hidden'));
  }

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  }

  function input(row, field) {
    return row?.querySelector(`input[data-field="${field}"]`) || null;
  }

  function value(row, field) {
    return String(input(row, field)?.value || '').trim();
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status' + (kind ? ` ${kind}` : '');
  }

  function dispatch(inputElement) {
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setIfEmpty(row, field, next) {
    const element = input(row, field);
    if (!element || element.disabled || String(element.value || '').trim()) return;
    element.value = String(next || '');
    dispatch(element);
  }

  async function deleteRow(row) {
    const button = row?.querySelector('[data-action="delete"]');
    if (!button || button.disabled) return false;
    button.click();
    await wait(45);
    return true;
  }

  async function removeDuplicatesAndSpecials() {
    const seen = new Set();
    let removed = 0;

    for (const row of [...rows()]) {
      const duty = value(row, 'duty');
      if (!duty) continue;

      const mustRemove = REMOVE_DUTIES.has(duty)
        || (REQUIRED_DUTIES.has(duty) && seen.has(duty))
        || (!REQUIRED_DUTIES.has(duty) && duty !== 'Frei');

      if (mustRemove) {
        if (await deleteRow(row)) removed += 1;
        continue;
      }

      if (REQUIRED_DUTIES.has(duty)) seen.add(duty);
    }

    return removed;
  }

  async function createRow(data) {
    const add = document.getElementById(ADD_ID);
    if (!add || add.disabled) return false;
    const before = new Set(rows().map((row) => String(row.dataset.rowId || '')));
    add.click();
    await wait(70);
    let row = rows().find((candidate) => !before.has(String(candidate.dataset.rowId || ''))) || rows().at(-1);
    if (!row) return false;

    const dutyInput = input(row, 'duty');
    if (!dutyInput || dutyInput.disabled) return false;
    dutyInput.dataset.dpDutyCommit = '1';
    dutyInput.value = data.duty;
    dispatch(dutyInput);
    delete dutyInput.dataset.dpDutyCommit;
    await wait(110);

    row = rows().find((candidate) => String(candidate.dataset.rowId || '') === String(row.dataset.rowId || '')) || row;
    for (const field of ['name', 'bus', 'start', 'end', 'departure', 'stop']) {
      const element = input(row, field);
      if (!element || element.disabled) continue;
      element.value = data[field] || '';
      dispatch(element);
    }
    return true;
  }

  async function ensureRequiredRows() {
    for (const data of REQUIRED_ROWS) {
      let row = rows().find((candidate) => value(candidate, 'duty') === data.duty);
      if (!row) {
        await createRow(data);
        row = rows().find((candidate) => value(candidate, 'duty') === data.duty);
      }
      if (!row) continue;
      setIfEmpty(row, 'name', data.name);
      setIfEmpty(row, 'bus', data.bus);
      setIfEmpty(row, 'start', data.start);
      setIfEmpty(row, 'end', data.end);
      setIfEmpty(row, 'departure', data.departure);
      setIfEmpty(row, 'stop', data.stop);
    }
  }

  async function repair() {
    const date = selectedDate();
    if (running || !sectionVisible() || !isHolidayWeekday(date) || !rows().length) return;
    if (window.__dienstpilotHolidayPhotoRebuilding) {
      schedule(1400);
      return;
    }

    running = true;
    try {
      const removed = await removeDuplicatesAndSpecials();
      await ensureRequiredRows();
      const current = rows();
      const correct = current.length === REQUIRED_ROWS.length
        && REQUIRED_ROWS.every((data) => current.some((row) => value(row, 'duty') === data.duty));

      if (correct && removed) {
        setStatus('Die doppelten unteren Zeilen 3039, 1941, 1341 und 1743 wurden entfernt. Der Ferienplan enthält jetzt 16 Bearbeitungszeilen. Bitte einmal speichern.', 'ok');
      }
    } finally {
      running = false;
    }
  }

  function schedule(delay = 700) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void repair(), delay);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyInsertDefaults,#dpDailyAddRow,#loginButton,#dpDailyPlanRows [data-action]')) {
      schedule(1200);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) schedule(1400);
  });

  [1500, 3600, 7000].forEach((delay) => window.setTimeout(() => schedule(0), delay));
  window.addEventListener('pageshow', () => schedule(1200));
  window.addEventListener('focus', () => schedule(1200));
})();
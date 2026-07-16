(() => {
  'use strict';

  if (window.__dienstpilotHolidayPhotoTemplateV1) return;
  window.__dienstpilotHolidayPhotoTemplateV1 = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const ADD_ID = 'dpDailyAddRow';
  const SECTION_ID = 'tab-daily-duty-plan';
  const MARKER_KEY = 'dienstpilot_holiday_photo_template_21_v1';

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

  // Exakt die 21 Zeilen der übermittelten Ferien-Dienstplanvorlage.
  const PHOTO_ROWS = [
    { name: 'A.Gerding', duty: '3031', bus: 'OS-LF 223', start: '05:03', end: '13:21', departure: '05:20', stop: 'Wellingholzhausen, Schule' },
    { name: 'D.Knigge', duty: '3032', bus: 'OS-VH 721', start: '04:45', end: '12:04', departure: '05:26', stop: 'Osnabrück, HBF' },
    { name: 'Y.Yasar', duty: '3033', bus: 'OS-QS 519', start: '05:43', end: '12:21', departure: '06:16', stop: 'Buer, Schulzentrum' },
    { name: 'S.Wittwer', duty: '3034', bus: 'OS-SU 722', start: '05:47', end: '15:39', departure: '06:12', stop: 'Neuenkirchen, Schulzentrum' },
    { name: 'H.Al Sayek', duty: '3035', bus: 'OS-IF 215', start: '05:51', end: '17:21', departure: '06:18', stop: 'Westerhausen, Vinkenaue' },
    { name: 'P.Lhommel', duty: '3036', bus: 'OS-XB 925', start: '06:03', end: '18:04', departure: '06:27', stop: 'Gesmold, Schimmweg' },
    { name: 'K.Igelbrink', duty: '3037', bus: 'OS-YG 120', start: '06:03', end: '16:05', departure: '06:20', stop: 'Wellingholzhausen, Schule' },
    { name: 'W.Wüllner', duty: '3038', bus: 'OS-DZ 116', start: '06:03', end: '12:06', departure: '06:28', stop: 'Neuenkirchen, Schulzentrum' },
    { name: 'A.Hergerdt', duty: '3039', bus: 'OS-ZT 626', start: '06:42', end: '13:05', departure: '07:15', stop: 'Bruchmühlen, Schule' },
    { name: 'N.Awdullahi', duty: '3040', bus: 'OS-EV 118', start: '07:20', end: '19:33', departure: '07:45', stop: 'Melle, ZOB' },
    { name: 'A.Hasan', duty: '3041', bus: 'OS-BU 816', start: '08:20', end: '19:41', departure: '08:45', stop: 'Melle, ZOB' },
    { name: 'K.Giotis', duty: '3042', bus: 'OS-KX 220', start: '11:20', end: '21:05', departure: '11:45', stop: 'Melle, ZOB' },
    { name: 'T.Wiemann', duty: '3043', bus: 'OS-UL 818', start: '12:03', end: '20:21', departure: '12:20', stop: 'Wellingholzhausen, Schule' },
    { name: 'A.Alrobaie', duty: '3044', bus: 'OS-PK 216', start: '12:20', end: '22:03', departure: '12:45', stop: 'Melle, ZOB' },
    { name: 'N.Murad', duty: '3045', bus: 'OS-HD 124', start: '13:03', end: '21:50', departure: '13:20', stop: 'Wellingholzhausen, Schule' },
    { name: 'M.Schweppe', duty: '3039', bus: 'OS-OP 622', start: '13:20', end: '19:21', departure: '13:45', stop: 'Melle, ZOB' },
    { name: 'M.Entrup', duty: '1941', bus: 'OS-RE 224', start: '14:49', end: '21:16', departure: '15:24', stop: 'Bissendorf, Werries' },
    { name: 'A.Morzsa / M.Al Dabbah', duty: '1341', bus: 'OS-CL 916', start: '05:13', end: '23:38', departure: '', stop: '' },
    { name: 'C.Strotmann', duty: '1941', bus: 'OS-MR 825', start: '05:35', end: '15:00', departure: '', stop: '' },
    { name: 'M.Eggern / S.Yasatemur', duty: '1743', bus: 'OS-AX 716', start: '06:05', end: '00:50', departure: '', stop: '' },
    { name: 'Einsatzwagen', duty: 'Einsatzwagen', bus: 'OS-QS 519', start: '', end: '', departure: '', stop: '' }
  ];

  let running = false;
  let timer = 0;

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function currentDate() {
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

  function dutyValue(row) {
    return String(row?.querySelector('input[data-field="duty"]')?.value || '').trim();
  }

  function readMarkers() {
    try {
      const value = JSON.parse(localStorage.getItem(MARKER_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function marked(date) {
    return Boolean(readMarkers()[date]);
  }

  function mark(date) {
    const markers = readMarkers();
    markers[date] = true;
    localStorage.setItem(MARKER_KEY, JSON.stringify(markers));
  }

  function expectedCounts() {
    const counts = new Map();
    PHOTO_ROWS.forEach((row) => counts.set(row.duty, (counts.get(row.duty) || 0) + 1));
    return counts;
  }

  function structureMatches() {
    const current = rows();
    if (current.length !== PHOTO_ROWS.length) return false;
    const counts = new Map();
    current.forEach((row) => {
      const duty = dutyValue(row);
      counts.set(duty, (counts.get(duty) || 0) + 1);
    });
    const expected = expectedCounts();
    if (counts.size !== expected.size) return false;
    for (const [duty, count] of expected) {
      if (counts.get(duty) !== count) return false;
    }
    return true;
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status' + (kind ? ` ${kind}` : '');
  }

  function dispatchValue(input) {
    if (!input) return;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function clearAllRows() {
    let guard = 0;
    while (rows().length && guard < 120) {
      const button = rows()[0]?.querySelector('[data-action="delete"]');
      if (!button || button.disabled) break;
      button.click();
      guard += 1;
      await wait(20);
    }
  }

  async function createPhotoRow(data) {
    const addButton = document.getElementById(ADD_ID);
    if (!addButton || addButton.disabled) return false;

    const before = new Set(rows());
    addButton.click();
    await wait(45);
    let row = rows().find((item) => !before.has(item)) || rows().at(-1);
    if (!row) return false;

    const rowId = String(row.dataset.rowId || '');
    const dutyInput = row.querySelector('input[data-field="duty"]');
    if (!dutyInput) return false;
    dutyInput.dataset.dpDutyCommit = '1';
    dutyInput.value = data.duty;
    dispatchValue(dutyInput);
    delete dutyInput.dataset.dpDutyCommit;
    await wait(70);

    if (rowId) {
      const escaped = window.CSS && typeof CSS.escape === 'function' ? CSS.escape(rowId) : rowId;
      row = document.querySelector(`#${TABLE_ID} tr[data-row-id="${escaped}"]`) || row;
    }

    for (const field of ['name', 'bus', 'start', 'end', 'departure', 'stop']) {
      const input = row.querySelector(`input[data-field="${field}"]`);
      if (!input) continue;
      input.value = data[field] || '';
      dispatchValue(input);
    }
    await wait(25);
    return true;
  }

  async function rebuild() {
    const date = currentDate();
    if (running || !sectionVisible() || !isHolidayWeekday(date) || marked(date)) return;
    if (!rows().length) return;

    if (structureMatches()) {
      mark(date);
      return;
    }

    running = true;
    setStatus(`Der Ferienplan wird auf die ${PHOTO_ROWS.length} benötigten Zeilen der Vorlage begrenzt …`);
    try {
      await clearAllRows();
      for (const data of PHOTO_ROWS) await createPhotoRow(data);
      mark(date);
      setStatus(`Der Ferienplan enthält jetzt genau ${PHOTO_ROWS.length} Zeilen wie auf der Vorlage. Bitte einmal speichern.`, 'ok');
      window.dispatchEvent(new Event('focus'));
    } finally {
      running = false;
    }
  }

  function schedule(delay = 1800) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void rebuild(), delay);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyInsertDefaults,#loginButton')) schedule(1800);
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) schedule(1800);
  });

  [1800, 3800, 6500].forEach((delay) => window.setTimeout(() => schedule(0), delay));
  window.addEventListener('pageshow', () => schedule(1800));
  window.addEventListener('focus', () => schedule(1800));
})();
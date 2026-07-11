(() => {
  'use strict';

  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const INSERT_ID = 'dpDailyInsertDefaults';
  const ADD_ID = 'dpDailyAddRow';
  const MARKER_KEY = 'dienstpilot_photo_bus_defaults_v2';
  let running = false;

  const WEEKDAY_ASSIGNMENTS = [
    { duty: '3001', name: 'I.Janzen', bus: 'OS-LK 621' },
    { duty: '3003', name: 'R.Runke', bus: 'OS-TG 324' },
    { duty: '3004', name: 'A.Muth', bus: 'OS-GZ 123' },
    { duty: '3005', name: 'A.Gerding', bus: 'OS-LF 223' },
    { duty: '3006', name: 'M.Entrup', bus: 'OS-RE 224' },
    { duty: '3007', name: 'Y.Yasar', bus: 'OS-NP 617' },
    { duty: '3008', name: 'S.Suleimani', bus: 'OS-JY 122' },
    { duty: '3009', name: 'J.Faber', bus: 'OS-SU 722' },
    { duty: '3010', name: 'A.Hergerdt', bus: 'OS-GO 717' },
    { duty: '3011', name: 'S.Kurta', bus: 'OS-KX 220' },
    { duty: '3012', name: 'M.Schweppe', bus: 'OS-OP 622' },
    { duty: '3013', name: 'A.Szczepanik', bus: 'OS-ZT 626' },
    { duty: '3014', name: 'M.Malko', bus: 'OS-KF 526' },
    { duty: '3015', name: 'N.Ghulami', bus: 'OS-YG 120' },
    { duty: '3016', name: 'P.Lhommel', bus: 'OS-XB 925' },
    { duty: '3017', name: 'A.Hasan', bus: 'OS-WP 918' },
    { duty: '3018', name: 'N.Awdullahi', bus: 'OS-EV 118' },
    { duty: '3019', name: 'K.Giotis', bus: 'OS-BU 816' },
    { duty: '3020', name: 'A.Alrobaie', bus: 'OS-PK 216' },
    { duty: '3021', name: 'W.Blaz', bus: 'OS-RS 725' },
    { duty: '3022', name: 'W.Wüllner', bus: 'OS-DZ 116' },
    { duty: '3023', name: 'T.Wiemann', bus: 'OS-UL 818' },
    { duty: '3024', name: 'D.Knigge', bus: 'OS-JF 215' },
    { duty: '3025', name: 'N.Murad', bus: 'OS-HD 124' },
    { duty: '1341', name: 'M.Al Dabbah / A.Al Arsan', bus: 'OS-FN 919' },
    { duty: '1941', name: 'S.Yasatemur / M.Eggern', bus: 'OS-AX 716' },
    { duty: '3002', name: 'B.Hasan / C.Strotmann', bus: 'OS-MR 825' },
    { duty: 'Einsatzwagen', name: 'Einsatzwagen', bus: 'OS-DZ 116' }
  ];

  const SATURDAY_ASSIGNMENTS = [
    { duty: '3050', name: 'F.Biermann', bus: 'OS-KX 220', start: '06:03', end: '14:21', departure: '06:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3051', name: 'S.Kelgorn', bus: 'OS-YG 120', start: '06:42', end: '15:21', departure: '07:15', stop: 'Bruchmühlen, Schule' },
    { duty: '3052', name: 'H.J.Husmann', bus: 'OS-LF 223', start: '06:43', end: '14:41', departure: '07:16', stop: 'Buer, Schulzentrum' },
    { duty: '3053', name: 'A.Kocdemir', bus: 'OS-VH 721', start: '06:47', end: '14:39', departure: '07:12', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '3054', name: 'W.Blaz', bus: 'OS-BS 725', start: '06:51', end: '19:21', departure: '07:18', stop: 'Westerhausen, Vinkenaue' },
    { duty: '3055', name: 'S.Wittwer', bus: 'OS-SU 722', start: '07:03', end: '17:04', departure: '07:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3056', name: 'N.Awdullahi', bus: 'OS-EV 118', start: '07:07', end: '16:04', departure: '07:31', stop: 'Gesmold, Schimmweg' },
    { duty: '3057', name: 'M.Entrup', bus: 'OS-RE 224', start: '09:20', end: '18:21', departure: '09:55', stop: 'Werther, ZOB' },
    { duty: '1340', name: 'M.Eggern', bus: 'OS-CL 916', start: '05:13', end: '19:44', departure: '', stop: '' },
    { duty: 'Einsatzwagen', name: 'Einsatzwagen', bus: 'OS-LQ 114', start: '', end: '', departure: '', stop: '' }
  ];

  const WEEKDAY_DUTIES = new Set(WEEKDAY_ASSIGNMENTS.map((item) => item.duty.toLowerCase()));
  const SATURDAY_DUTIES = new Set(SATURDAY_ASSIGNMENTS.map((item) => item.duty.toLowerCase()));

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function currentDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function dayOfWeek(date) {
    const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return -1;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0).getDay();
  }

  function isSaturday(date) {
    return dayOfWeek(date) === 6;
  }

  function assignmentsForDate(date) {
    return isSaturday(date) ? SATURDAY_ASSIGNMENTS : WEEKDAY_ASSIGNMENTS;
  }

  function readMarkers() {
    try {
      const value = JSON.parse(localStorage.getItem(MARKER_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function isApplied(date) {
    return Boolean(date && readMarkers()[date]);
  }

  function markApplied(date) {
    if (!date) return;
    const markers = readMarkers();
    markers[date] = true;
    localStorage.setItem(MARKER_KEY, JSON.stringify(markers));
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

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status' + (kind ? ' ' + kind : '');
  }

  function dispatchInput(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setField(row, field, value, overwrite) {
    if (!row || !Object.prototype.hasOwnProperty.call({ value }, 'value')) return;
    const input = row.querySelector(`input[data-field="${field}"]`);
    if (!input || input.disabled) return;
    if (!overwrite && String(input.value || '').trim()) return;
    input.value = String(value ?? '');
    dispatchInput(input);
  }

  async function createRow(duty) {
    const addButton = document.getElementById(ADD_ID);
    if (!addButton || addButton.disabled) return null;

    addButton.click();
    await wait(35);
    const blank = rows().find((row) => !rowDuty(row));
    if (!blank) return null;

    const dutyInput = blank.querySelector('input[data-field="duty"]');
    if (!dutyInput || dutyInput.disabled) return null;
    dutyInput.dataset.dpDutyCommit = '1';
    dutyInput.value = duty;
    dispatchInput(dutyInput);
    delete dutyInput.dataset.dpDutyCommit;
    await wait(45);
    return findRow(duty);
  }

  async function clearRows() {
    let guard = 0;
    while (rows().length && guard < 100) {
      const button = rows()[0]?.querySelector('[data-action="delete"]');
      if (!button || button.disabled) break;
      button.click();
      guard += 1;
      await wait(18);
    }
  }

  function looksLikeWeekdayTemplate() {
    const duties = rows().map(rowDuty).filter(Boolean);
    return duties.length >= 20 && duties.every((duty) => WEEKDAY_DUTIES.has(duty));
  }

  async function applyAssignments(createMissing) {
    if (running) return;
    const date = currentDate();
    if (!date) return;

    running = true;
    try {
      const saturday = isSaturday(date);
      const firstApplication = !isApplied(date);
      const assignments = assignmentsForDate(date);

      if (saturday && firstApplication && rows().length && !rows().some((row) => SATURDAY_DUTIES.has(rowDuty(row))) && looksLikeWeekdayTemplate()) {
        await clearRows();
      }

      for (const assignment of assignments) {
        let row = findRow(assignment.duty);
        let created = false;
        if (!row && createMissing) {
          row = await createRow(assignment.duty);
          created = Boolean(row);
        }
        if (!row) continue;

        const overwrite = saturday && (firstApplication || created);
        for (const field of ['name', 'bus', 'start', 'end', 'departure', 'stop']) {
          if (Object.prototype.hasOwnProperty.call(assignment, field)) {
            setField(row, field, assignment[field], overwrite);
          }
        }
      }

      markApplied(date);
      setStatus(
        saturday
          ? 'Der Samstagsdienstplan wurde nach der Vorlage eingefügt. Alle Angaben bleiben bearbeitbar und die Kennzeichen können verschoben werden.'
          : 'Alle Kennzeichen aus der Vorlage wurden eingefügt. Sie können weiterhin verschoben und bearbeitet werden.',
        'ok'
      );
    } finally {
      running = false;
    }
  }

  async function maybeAutoPopulate() {
    const date = currentDate();
    if (!date || isApplied(date) || running) return;

    const insertButton = document.getElementById(INSERT_ID);
    if (!insertButton || insertButton.disabled) return;

    if (isSaturday(date)) {
      await applyAssignments(true);
      return;
    }

    if (!rows().length) {
      insertButton.click();
      await wait(120);
    }
    if (rows().length) await applyAssignments(true);
  }

  function renameInsertButton() {
    const button = document.getElementById(INSERT_ID);
    if (!button) return;
    button.textContent = isSaturday(currentDate())
      ? 'Samstagsdienste und Kennzeichen einfügen'
      : 'Standarddienste und Kennzeichen einfügen';
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.(`#${INSERT_ID}`)) {
      window.setTimeout(() => applyAssignments(true), 140);
      return;
    }
    if (event.target.closest?.('#dpDailyDutyPlanTab')) {
      [250, 700, 1400].forEach((delay) => window.setTimeout(() => {
        renameInsertButton();
        maybeAutoPopulate();
      }, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) {
      [120, 450, 900].forEach((delay) => window.setTimeout(() => {
        renameInsertButton();
        maybeAutoPopulate();
      }, delay));
    }
  });

  function refresh() {
    renameInsertButton();
    if (!isApplied(currentDate())) maybeAutoPopulate();
  }

  [0, 250, 700, 1500, 3000].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
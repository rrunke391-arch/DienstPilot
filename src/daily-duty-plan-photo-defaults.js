(() => {
  'use strict';

  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const INSERT_ID = 'dpDailyInsertDefaults';
  const ADD_ID = 'dpDailyAddRow';
  const MARKER_KEY = 'dienstpilot_photo_bus_defaults_v1';
  let running = false;

  const ASSIGNMENTS = [
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

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function currentDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
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

  function fillField(row, field, value) {
    if (!row || !value) return;
    const input = row.querySelector(`input[data-field="${field}"]`);
    if (!input || input.disabled || String(input.value || '').trim()) return;
    input.value = value;
    dispatchInput(input);
  }

  async function createRow(duty) {
    const addButton = document.getElementById(ADD_ID);
    if (!addButton || addButton.disabled) return null;

    addButton.click();
    await wait(30);
    const blank = rows().find((row) => !rowDuty(row));
    if (!blank) return null;

    const dutyInput = blank.querySelector('input[data-field="duty"]');
    if (!dutyInput || dutyInput.disabled) return null;
    dutyInput.dataset.dpDutyCommit = '1';
    dutyInput.value = duty;
    dispatchInput(dutyInput);
    delete dutyInput.dataset.dpDutyCommit;
    await wait(35);
    return findRow(duty);
  }

  async function applyAssignments(createMissing) {
    if (running) return;
    running = true;
    try {
      for (const assignment of ASSIGNMENTS) {
        let row = findRow(assignment.duty);
        if (!row && createMissing) row = await createRow(assignment.duty);
        if (!row) continue;
        fillField(row, 'name', assignment.name);
        fillField(row, 'bus', assignment.bus);
      }
      const date = currentDate();
      markApplied(date);
      setStatus('Alle Kennzeichen aus der Vorlage wurden eingefügt. Sie können weiterhin verschoben und bearbeitet werden.', 'ok');
    } finally {
      running = false;
    }
  }

  async function maybeAutoPopulate() {
    const date = currentDate();
    if (!date || isApplied(date) || running) return;

    const insertButton = document.getElementById(INSERT_ID);
    if (!insertButton || insertButton.disabled) return;

    if (!rows().length) {
      insertButton.click();
      await wait(120);
    }
    if (rows().length) await applyAssignments(true);
  }

  function renameInsertButton() {
    const button = document.getElementById(INSERT_ID);
    if (button) button.textContent = 'Standarddienste und Kennzeichen einfügen';
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.(`#${INSERT_ID}`)) {
      window.setTimeout(() => applyAssignments(true), 120);
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
      [120, 450, 900].forEach((delay) => window.setTimeout(maybeAutoPopulate, delay));
    }
  });

  function refresh() {
    renameInsertButton();
    if (rows().length && !isApplied(currentDate())) applyAssignments(true);
  }

  [0, 250, 700, 1500, 3000].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
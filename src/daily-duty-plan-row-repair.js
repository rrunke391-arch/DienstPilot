(() => {
  'use strict';

  if (window.__dienstpilotDailyDutyRowRepair) return;
  window.__dienstpilotDailyDutyRowRepair = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const ADD_ID = 'dpDailyAddRow';
  const SECTION_ID = 'tab-daily-duty-plan';
  const STYLE_ID = 'dpDailyDutyRowRepairStyle';

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

  let running = false;
  let scheduleTimer = 0;

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function currentDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function isWeekday(date) {
    const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0).getDay();
    return day >= 1 && day <= 5;
  }

  function sectionVisible() {
    const section = document.getElementById(SECTION_ID);
    return Boolean(section && !section.classList.contains('hidden'));
  }

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  }

  function fieldValue(row, field) {
    return String(row?.querySelector(`input[data-field="${field}"]`)?.value || '').trim();
  }

  function assignmentBusCounts() {
    const counts = new Map();
    WEEKDAY_ASSIGNMENTS.forEach((assignment) => {
      const key = normalize(assignment.bus);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }

  function matchAssignments() {
    const available = new Set(rows());
    const matches = new Map();
    const busCounts = assignmentBusCounts();

    WEEKDAY_ASSIGNMENTS.forEach((assignment) => {
      const candidates = [...available];
      const name = normalize(assignment.name);
      const duty = normalize(assignment.duty);
      const bus = normalize(assignment.bus);

      let row = candidates.find((item) => normalize(fieldValue(item, 'name')) === name) || null;
      if (!row) row = candidates.find((item) => normalize(fieldValue(item, 'duty')) === duty) || null;
      if (!row && bus && busCounts.get(bus) === 1) {
        row = candidates.find((item) => normalize(fieldValue(item, 'bus')) === bus) || null;
      }

      if (row) {
        available.delete(row);
        matches.set(assignment, row);
      }
    });

    return {
      matches,
      missing: WEEKDAY_ASSIGNMENTS.filter((assignment) => !matches.has(assignment))
    };
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status' + (kind ? ` ${kind}` : '');
  }

  function dispatchValue(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setField(row, field, value) {
    const input = row?.querySelector(`input[data-field="${field}"]`);
    if (!input || input.disabled) return;
    if (String(input.value || '').trim()) return;

    input.value = String(value || '');
    if (field === 'name') {
      const select = row.querySelector('.dp-daily-driver-select');
      if (select) select.value = input.value;
    }
    dispatchValue(input);
  }

  async function createMissingRow(assignment) {
    const addButton = document.getElementById(ADD_ID);
    if (!addButton || addButton.disabled) return null;

    const before = new Set(rows());
    addButton.click();
    await wait(55);

    let row = rows().find((item) => !before.has(item)) || null;
    if (!row) row = rows().find((item) => !fieldValue(item, 'name') && !fieldValue(item, 'duty') && !fieldValue(item, 'bus')) || null;
    if (!row) return null;

    const rowId = String(row.dataset.rowId || '');
    const dutyInput = row.querySelector('input[data-field="duty"]');
    if (!dutyInput || dutyInput.disabled) return null;

    dutyInput.dataset.dpDutyCommit = '1';
    dutyInput.value = assignment.duty;
    dispatchValue(dutyInput);
    delete dutyInput.dataset.dpDutyCommit;
    await wait(80);

    row = rowId
      ? document.querySelector(`#${TABLE_ID} tr[data-row-id="${window.CSS?.escape ? CSS.escape(rowId) : rowId}"]`)
      : null;
    if (!row) {
      row = rows().find((item) => normalize(fieldValue(item, 'duty')) === normalize(assignment.duty)
        && !fieldValue(item, 'name')) || null;
    }
    if (!row) return null;

    setField(row, 'name', assignment.name);
    setField(row, 'bus', assignment.bus);
    return row;
  }

  function rowForAssignment(assignment, claimed = new Set()) {
    const candidates = rows().filter((row) => !claimed.has(row));
    const name = normalize(assignment.name);
    const duty = normalize(assignment.duty);
    const bus = normalize(assignment.bus);

    return candidates.find((row) => normalize(fieldValue(row, 'name')) === name)
      || candidates.find((row) => normalize(fieldValue(row, 'duty')) === duty)
      || candidates.find((row) => bus && normalize(fieldValue(row, 'bus')) === bus)
      || null;
  }

  async function restoreOrder() {
    const claimed = new Set();

    for (let targetIndex = 0; targetIndex < WEEKDAY_ASSIGNMENTS.length; targetIndex += 1) {
      const assignment = WEEKDAY_ASSIGNMENTS[targetIndex];
      let row = rowForAssignment(assignment, claimed);
      if (!row) continue;
      claimed.add(row);

      let currentIndex = rows().indexOf(row);
      let guard = 0;
      while (currentIndex > targetIndex && guard < 60) {
        const up = row.querySelector('[data-action="up"]');
        if (!up || up.disabled) break;
        up.click();
        await wait(18);
        row = rowForAssignment(assignment, new Set([...claimed].filter((item) => item !== row))) || row;
        currentIndex = rows().indexOf(row);
        guard += 1;
      }
    }
  }

  function addColumnStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #tab-daily-duty-plan .dp-daily-table{min-width:1510px;table-layout:fixed}
      #tab-daily-duty-plan .dp-daily-table th:nth-child(1),#tab-daily-duty-plan .dp-daily-table td:nth-child(1){width:225px;min-width:225px}
      #tab-daily-duty-plan .dp-daily-table th:nth-child(2),#tab-daily-duty-plan .dp-daily-table td:nth-child(2){width:455px;min-width:455px}
      #tab-daily-duty-plan .dp-daily-table th:nth-child(3),#tab-daily-duty-plan .dp-daily-table td:nth-child(3){width:215px;min-width:215px}
      #tab-daily-duty-plan .dp-daily-table th:nth-child(4),#tab-daily-duty-plan .dp-daily-table td:nth-child(4),
      #tab-daily-duty-plan .dp-daily-table th:nth-child(5),#tab-daily-duty-plan .dp-daily-table td:nth-child(5){width:100px;min-width:100px}
      #tab-daily-duty-plan .dp-daily-table th:nth-child(6),#tab-daily-duty-plan .dp-daily-table td:nth-child(6){width:125px;min-width:125px}
      #tab-daily-duty-plan .dp-daily-table th:nth-child(7),#tab-daily-duty-plan .dp-daily-table td:nth-child(7){width:210px;min-width:210px}
      #tab-daily-duty-plan .dp-daily-table th:nth-child(8),#tab-daily-duty-plan .dp-daily-table td:nth-child(8){width:80px;min-width:80px}
    `;
    document.head.appendChild(style);
  }

  async function repair() {
    addColumnStyle();
    if (running || !sectionVisible()) return;

    const date = currentDate();
    if (!isWeekday(date)) return;
    if (!rows().length) return;

    const result = matchAssignments();
    if (!result.missing.length) return;

    running = true;
    let created = 0;
    setStatus(`${result.missing.length} fehlende Fahrer- und Dienstzeilen werden wiederhergestellt …`);

    try {
      for (const assignment of result.missing) {
        const row = await createMissingRow(assignment);
        if (row) created += 1;
      }

      if (created) {
        await restoreOrder();
        setStatus(`${created} fehlende Fahrer- und Dienstzeilen wurden wiederhergestellt. Bitte den Dienstplan speichern.`, 'ok');
      }
    } finally {
      running = false;
    }
  }

  function scheduleRepair(delay = 180) {
    window.clearTimeout(scheduleTimer);
    scheduleTimer = window.setTimeout(() => void repair(), delay);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyInsertDefaults,#dpDailyAddRow,#loginButton')) {
      scheduleRepair(650);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) scheduleRepair(700);
  });

  [500, 1200, 2400, 4200].forEach((delay) => window.setTimeout(() => scheduleRepair(0), delay));
  window.addEventListener('pageshow', () => scheduleRepair(700));
  window.addEventListener('focus', () => scheduleRepair(700));
})();
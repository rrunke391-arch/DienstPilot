(() => {
  'use strict';

  if (window.__dienstpilotSplitShiftDutiesV5) return;
  window.__dienstpilotSplitShiftDutiesV5 = true;

  const SECTION_ID = 'tab-daily-duty-plan';
  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const PANEL_ID = 'dpStableSplitShiftPanel';
  const STYLE_ID = 'dpSplitShiftDutiesV5Style';
  const ASSIGNMENT_KEY = 'dienstpilot_split_shift_assignments_v4';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const API_BASE = 'https://api.dienstpilot-runke.de';
  const BASE_MONDAY = new Date(2026, 6, 13, 12, 0, 0);

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

  const DUTIES = {
    '1341': {
      defaultPair: ['A.Morzsa', 'M.Al Dabbah'],
      bus: 'OS-CL 916',
      early: { label: 'Frühschicht', start: '05:13', end: '14:21', departure: '', stop: '' },
      late: { label: 'Spätschicht', start: '14:04', end: '23:38', departure: '', stop: '' }
    },
    '1941': {
      defaultPair: ['M.Entrup', 'C.Strotmann'],
      early: { label: 'Frühschicht', start: '05:35', end: '15:00', bus: 'OS-MR 825', departure: '', stop: '' },
      late: { label: 'Spätschicht', start: '14:49', end: '21:16', bus: 'OS-RE 224', departure: '15:24', stop: 'Bissendorf, Werries' }
    },
    '1743': {
      defaultPair: ['M.Eggern', 'S.Yasatemur'],
      bus: 'OS-AX 716',
      early: { label: 'Frühschicht', start: '06:05', end: '15:17', departure: '', stop: '' },
      late: { label: 'Spätschicht', start: '14:57', end: '00:50', departure: '', stop: '' }
    }
  };

  const FALLBACK_DRIVERS = [
    'Y.Yasar', 'Bumhoffer', 'M.Entrup', 'M.Schweppe', 'I.Janzen', 'Alomar', 'H.Al Sayek',
    'A.Szczepanik', 'Kocdemir', 'W.Wüllner', 'S.Wittwer', 'Biermann', 'A.Gerding',
    'R.Runke', 'P.Lhommel', 'M.Malko', 'N.Murad', 'S.Kurta', 'T.Wiemann', 'A.Muth',
    'S.Suleimani', 'J.Faber', 'L.Hergerdt', 'A.Hergerdt', 'A.Hasan', 'D.Knigge',
    'N.Awdullahi', 'K.Giotis', 'K.Igelbrink', 'A.Alrobaie', 'A.Morzsa', 'M.Al Dabbah',
    'C.Strotmann', 'M.Eggern', 'S.Yasatemur', 'N.Ghulami', 'M.Alsaba'
  ];

  let timer = 0;
  let remoteRequested = false;
  let remoteDrivers = [];

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function canonicalName(value) {
    const name = String(value || '').trim();
    return normalize(name) === 'hergerdt' ? 'L.Hergerdt' : name;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  function readAssignments() {
    try {
      const value = JSON.parse(localStorage.getItem(ASSIGNMENT_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function writeAssignments(value) {
    localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(value));
  }

  function mondayFor(date) {
    const value = new Date(`${date}T12:00:00`);
    const day = value.getDay() || 7;
    value.setDate(value.getDate() - day + 1);
    return value;
  }

  function weeklyDefault(duty, date) {
    const pair = DUTIES[duty].defaultPair;
    const monday = mondayFor(date);
    const difference = Math.round((monday - BASE_MONDAY) / 604800000);
    const swapped = ((difference % 2) + 2) % 2 === 1;
    return swapped ? { early: pair[1], late: pair[0] } : { early: pair[0], late: pair[1] };
  }

  function assignmentKey(date, duty) {
    return `${date}|${duty}`;
  }

  function assignmentFor(duty, date) {
    const defaults = weeklyDefault(duty, date);
    const saved = readAssignments()[assignmentKey(date, duty)];
    if (!saved || typeof saved !== 'object') return defaults;
    const early = canonicalName(saved.early) || defaults.early;
    let late = canonicalName(saved.late) || defaults.late;
    if (normalize(early) === normalize(late)) late = defaults.late;
    return { early, late };
  }

  function assignDriver(duty, side, driver) {
    const date = selectedDate();
    const chosen = canonicalName(driver);
    if (!DUTIES[duty] || !chosen) return;

    const map = readAssignments();
    const current = assignmentFor(duty, date);
    const opposite = side === 'early' ? 'late' : 'early';
    const previous = current[side];
    if (normalize(chosen) === normalize(current[opposite])) current[opposite] = previous;
    current[side] = chosen;
    map[assignmentKey(date, duty)] = current;
    writeAssignments(map);
  }

  function addName(value, names) {
    const name = canonicalName(value);
    if (!name || name.includes('/')) return;
    if (!names.some((item) => normalize(item) === normalize(name))) names.push(name);
  }

  function availableDrivers() {
    const names = [];
    FALLBACK_DRIVERS.forEach((name) => addName(name, names));
    remoteDrivers.forEach((name) => addName(name, names));
    document.querySelectorAll('#kollegeSelect option,#dpDailyPlanRows .dp-daily-driver-select option').forEach((option) => {
      addName(option.value || option.textContent, names);
    });
    Object.values(readAssignments()).forEach((assignment) => {
      addName(assignment?.early, names);
      addName(assignment?.late, names);
    });
    return names.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  async function requestRemoteDrivers() {
    if (remoteRequested) return;
    remoteRequested = true;
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/users`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      const users = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
      remoteDrivers = users
        .filter((user) => normalize(user?.role) === 'fahrer' || user?.driverProfile)
        .map((user) => canonicalName(user.displayName || user.driverProfile || user.username || ''))
        .filter(Boolean);
      schedule(80);
    } catch {}
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:0 0 12px;padding:13px;border:2px solid #2563eb;border-radius:14px;background:#eff6ff;color:#172554}
      #${PANEL_ID} h3{margin:0 0 5px;font-size:16px}
      #${PANEL_ID} .dp-shift-help{margin:0 0 10px;font-size:13px;font-weight:750}
      #${PANEL_ID} .dp-shift-duty{margin-top:10px;padding:10px;border:1px solid #bfdbfe;border-radius:11px;background:#dbeafe}
      #${PANEL_ID} .dp-shift-duty-title{margin-bottom:7px;font-weight:950;color:#1e3a8a}
      #${PANEL_ID} .dp-shift-grid{display:grid;grid-template-columns:repeat(2,minmax(250px,1fr));gap:8px}
      #${PANEL_ID} .dp-shift-driver{display:grid;gap:5px;padding:9px;border:1px solid #93c5fd;border-radius:10px;background:#fff;font-weight:900}
      #${PANEL_ID} .dp-shift-label{font-size:13px;color:#0f172a}
      #${PANEL_ID} select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #2563eb;border-radius:9px;background:#fff;color:#0f172a;font:inherit;font-weight:900;cursor:pointer}
      .dp-split-virtual-preview{min-height:94px}
      .dp-split-preview-second{margin-top:8px}
      @media(max-width:850px){#${PANEL_ID} .dp-shift-grid{grid-template-columns:1fr}}
      @media print{#${PANEL_ID}{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function driverOptions(selected) {
    return availableDrivers().map((driver) => (
      `<option value="${escapeHtml(driver)}"${normalize(driver) === normalize(selected) ? ' selected' : ''}>${escapeHtml(driver)}</option>`
    )).join('');
  }

  function shouldShowPanel(date) {
    if (isHolidayWeekday(date)) return true;
    return [...document.querySelectorAll(`#${TABLE_ID} input[data-field="duty"]`)]
      .some((input) => Boolean(DUTIES[String(input.value || '').trim()]));
  }

  function renderPanel(date) {
    const section = document.getElementById(SECTION_ID);
    const tableWrap = section?.querySelector('.dp-daily-table-wrap');
    if (!section || !tableWrap || section.classList.contains('hidden')) return;

    let panel = document.getElementById(PANEL_ID);
    if (!shouldShowPanel(date)) {
      panel?.remove();
      return;
    }

    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      tableWrap.insertAdjacentElement('beforebegin', panel);
    }

    const blocks = Object.entries(DUTIES).map(([duty, config]) => {
      const assigned = assignmentFor(duty, date);
      return `
        <div class="dp-shift-duty">
          <div class="dp-shift-duty-title">Dienst ${duty} – Fahrer frei zuordnen</div>
          <div class="dp-shift-grid">
            <label class="dp-shift-driver">
              <span class="dp-shift-label">Frühschicht ${config.early.start}–${config.early.end}</span>
              <select class="dp-driver-assignment-select" data-duty="${duty}" data-side="early">${driverOptions(assigned.early)}</select>
            </label>
            <label class="dp-shift-driver">
              <span class="dp-shift-label">Spätschicht ${config.late.start}–${config.late.end}</span>
              <select class="dp-driver-assignment-select" data-duty="${duty}" data-side="late">${driverOptions(assigned.late)}</select>
            </label>
          </div>
        </div>`;
    }).join('');

    panel.innerHTML = `
      <h3>Fahrer für Früh- und Spätschicht auswählen</h3>
      <div class="dp-shift-help">Die Dienste 1341, 1941 und 1743 werden hier vollständig verwaltet und stehen deshalb nicht noch einmal als zusätzliche Bearbeitungszeilen unten im Plan.</div>
      ${blocks}`;
  }

  function splitPrintRows(date) {
    if (!isHolidayWeekday(date)) return [];
    const d1341 = assignmentFor('1341', date);
    const d1941 = assignmentFor('1941', date);
    const d1743 = assignmentFor('1743', date);

    return [
      {
        name: `${d1341.early} / ${d1341.late}`,
        duty: '1341', bus: DUTIES['1341'].bus, start: '05:13', end: '23:38', departure: '', stop: '',
        split: [
          { name: d1341.early, label: 'Frühschicht', start: '05:13', end: '14:21' },
          { name: d1341.late, label: 'Spätschicht', start: '14:04', end: '23:38' }
        ]
      },
      { name: d1941.early, duty: '1941', bus: 'OS-MR 825', start: '05:35', end: '15:00', departure: '', stop: '', shiftLabel: 'Frühschicht' },
      { name: d1941.late, duty: '1941', bus: 'OS-RE 224', start: '14:49', end: '21:16', departure: '15:24', stop: 'Bissendorf, Werries', shiftLabel: 'Spätschicht' },
      {
        name: `${d1743.early} / ${d1743.late}`,
        duty: '1743', bus: DUTIES['1743'].bus, start: '06:05', end: '00:50', departure: '', stop: '',
        split: [
          { name: d1743.early, label: 'Frühschicht', start: '06:05', end: '15:17' },
          { name: d1743.late, label: 'Spätschicht', start: '14:57', end: '00:50' }
        ]
      }
    ];
  }

  window.dienstpilotGetSplitShiftPrintRows = (date) => splitPrintRows(String(date || selectedDate()));

  function previewRowHtml(row) {
    if (Array.isArray(row.split)) {
      return `<div class="dp-preview-row dp-split-virtual-preview">
        <div class="dp-preview-left">
          <strong>${escapeHtml(row.split[0].name)}</strong><span>Dienst ${row.duty} · ${row.split[0].label}</span>
          <strong class="dp-split-preview-second">${escapeHtml(row.split[1].name)}</strong><span>Dienst ${row.duty} · ${row.split[1].label}</span>
        </div>
        <div class="dp-preview-middle">
          <strong>/ ${escapeHtml(row.bus)}</strong><span>/ ${row.split[0].start} - ${row.split[0].end} Uhr</span>
          <strong class="dp-split-preview-second">&nbsp;</strong><span>/ ${row.split[1].start} - ${row.split[1].end} Uhr</span>
        </div>
        <div class="dp-preview-right">&nbsp;</div>
      </div>`;
    }

    const departure = row.departure ? `${Number(row.departure.slice(0, 2))}.${row.departure.slice(3)} Uhr ` : '';
    return `<div class="dp-preview-row dp-split-virtual-preview">
      <div class="dp-preview-left"><strong>${escapeHtml(row.name)}</strong><span>Dienst ${row.duty} · ${row.shiftLabel || ''}</span></div>
      <div class="dp-preview-middle"><strong>/ ${escapeHtml(row.bus)}</strong><span>/ ${row.start} - ${row.end} Uhr</span></div>
      <div class="dp-preview-right">${departure}${escapeHtml(row.stop || '')}</div>
    </div>`;
  }

  function decoratePreview(date) {
    const preview = document.getElementById('dpDailyPlanPreview');
    if (!preview) return;
    preview.querySelectorAll('.dp-split-virtual-preview').forEach((row) => row.remove());
    const virtualRows = splitPrintRows(date);
    if (!virtualRows.length) return;

    const tableRows = [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
    const lastIsEinsatzwagen = tableRows.length
      && String(tableRows.at(-1)?.querySelector('input[data-field="duty"]')?.value || '').trim() === 'Einsatzwagen';
    const previewRows = [...preview.querySelectorAll('.dp-preview-row')];
    const before = lastIsEinsatzwagen ? previewRows.at(-1) : null;
    const holder = document.createElement('div');
    holder.innerHTML = virtualRows.map(previewRowHtml).join('');
    [...holder.children].forEach((row) => preview.insertBefore(row, before));
  }

  function refresh() {
    const date = selectedDate();
    addStyle();
    renderPanel(date);
    decoratePreview(date);
    void requestRemoteDrivers();
  }

  function schedule(delay = 250) {
    window.clearTimeout(timer);
    timer = window.setTimeout(refresh, delay);
  }

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.('.dp-driver-assignment-select');
    if (select) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const duty = String(select.dataset.duty || '');
      const side = select.dataset.side === 'late' ? 'late' : 'early';
      const driver = canonicalName(select.value);
      assignDriver(duty, side, driver);
      const status = document.getElementById('dpDailyPlanStatus');
      if (status) {
        status.textContent = `${driver} wurde bei Dienst ${duty} der ${side === 'early' ? 'Frühschicht' : 'Spätschicht'} zugeteilt.`;
        status.className = 'dp-daily-status ok';
      }
      schedule(50);
      return;
    }
    if (event.target?.id === DATE_ID) schedule(900);
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.matches?.(`#${TABLE_ID} input,#${TABLE_ID} select`)) schedule(350);
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyInsertDefaults,#dpDailyAddRow,#loginButton,#dpDailySave,#dpDailyPlanRows [data-action]')) {
      schedule(700);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => schedule(900), { once: true });
  else schedule(900);
  [1800, 4200, 7600].forEach((delay) => window.setTimeout(() => schedule(0), delay));
  window.addEventListener('pageshow', () => schedule(700));
  window.addEventListener('focus', () => schedule(700));
})();
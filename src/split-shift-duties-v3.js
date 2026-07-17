(() => {
  'use strict';

  if (window.__dienstpilotSplitShiftDutiesV3) return;
  window.__dienstpilotSplitShiftDutiesV3 = true;

  const SECTION_ID = 'tab-daily-duty-plan';
  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const ADD_ID = 'dpDailyAddRow';
  const PANEL_ID = 'dpStableSplitShiftPanel';
  const STYLE_ID = 'dpSplitShiftDutiesV3Style';
  const OVERRIDE_KEY = 'dienstpilot_split_shift_override_v3';
  const BASE_MONDAY = new Date(2026, 6, 13, 12, 0, 0);

  const DUTIES = {
    '1341': {
      pair: ['A.Morzsa', 'M.Al Dabbah'],
      bus: 'OS-CL 916',
      rows: 1,
      early: { label: 'Frühschicht', start: '05:13', end: '14:21', departure: '', stop: '' },
      late: { label: 'Spätschicht', start: '14:04', end: '23:38', departure: '', stop: '' }
    },
    '1941': {
      // In KW 30 (Foto vom 20./21.07.2026) fährt C.Strotmann früh und M.Entrup spät.
      pair: ['M.Entrup', 'C.Strotmann'],
      rows: 2,
      early: { label: 'Frühschicht', start: '05:35', end: '15:00', bus: 'OS-MR 825', departure: '', stop: '' },
      late: { label: 'Spätschicht', start: '14:49', end: '21:16', bus: 'OS-RE 224', departure: '15:24', stop: 'Bissendorf, Werries' }
    },
    '1743': {
      pair: ['M.Eggern', 'S.Yasatemur'],
      bus: 'OS-AX 716',
      rows: 1,
      early: { label: 'Frühschicht', start: '06:05', end: '15:17', departure: '', stop: '' },
      late: { label: 'Spätschicht', start: '14:57', end: '00:50', departure: '', stop: '' }
    }
  };

  let running = false;
  let timer = 0;
  let observer = null;
  let observedBody = null;

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function readMap() {
    try {
      const value = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function writeMap(value) {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(value));
  }

  function selectedDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function isWeekday(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    return day >= 1 && day <= 5;
  }

  function sectionVisible() {
    const section = document.getElementById(SECTION_ID);
    return Boolean(section && !section.classList.contains('hidden'));
  }

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  }

  function field(row, name) {
    return row?.querySelector(`input[data-field="${name}"]`) || null;
  }

  function fieldValue(row, name) {
    return String(field(row, name)?.value || '').trim();
  }

  function dutyRows(duty) {
    return rows().filter((row) => fieldValue(row, 'duty') === duty);
  }

  function setStatus(text, state = 'ok') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = `dp-daily-status ${state}`;
  }

  function ensureDriverOption(row, value) {
    const select = row?.querySelector('.dp-daily-driver-select');
    if (!select || !value) return;
    if (![...select.options].some((option) => option.value === value)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
    select.value = value;
  }

  function setField(row, name, value, onlyIfEmpty = false) {
    const input = field(row, name);
    if (!input || input.disabled) return false;
    const next = String(value || '');
    const current = String(input.value || '').trim();
    if (onlyIfEmpty && current && current !== 'OS-XX 123') return false;
    if (input.value === next) {
      if (name === 'name') ensureDriverOption(row, next);
      return false;
    }
    input.value = next;
    if (name === 'name') ensureDriverOption(row, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function mondayFor(date) {
    const value = new Date(`${date}T12:00:00`);
    const day = value.getDay() || 7;
    value.setDate(value.getDate() - day + 1);
    return value;
  }

  function baseDrivers(duty, date) {
    const pair = DUTIES[duty].pair;
    const monday = mondayFor(date);
    const difference = Math.round((monday - BASE_MONDAY) / 604800000);
    const swapped = ((difference % 2) + 2) % 2 === 1;
    return swapped ? [pair[1], pair[0]] : [...pair];
  }

  function assignedDrivers(duty, date) {
    const base = baseDrivers(duty, date);
    const manualSwap = Boolean(readMap()[`${date}|${duty}`]);
    return manualSwap ? [base[1], base[0]] : base;
  }

  function assignDriverToShift(duty, driver, shiftIndex) {
    const date = selectedDate();
    const config = DUTIES[duty];
    if (!config || !config.pair.includes(driver)) return;

    const other = config.pair.find((name) => name !== driver);
    const desired = shiftIndex === 0 ? [driver, other] : [other, driver];
    const base = baseDrivers(duty, date);
    const map = readMap();
    const key = `${date}|${duty}`;

    if (desired[0] === base[0]) delete map[key];
    else map[key] = true;
    writeMap(map);
  }

  function escapeSelector(value) {
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(String(value || ''));
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  function rowById(rowId) {
    if (!rowId) return null;
    return document.querySelector(`#${TABLE_ID} tr[data-row-id="${escapeSelector(rowId)}"]`);
  }

  async function changeDuty(row, duty) {
    const rowId = String(row?.dataset.rowId || '');
    const input = field(row, 'duty');
    if (!rowId || !input || input.disabled) return null;
    input.dataset.dpDutyCommit = '1';
    input.value = duty;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    delete input.dataset.dpDutyCommit;
    await wait(120);
    return rowById(rowId);
  }

  async function addDutyRow(duty) {
    const button = document.getElementById(ADD_ID);
    if (!button || button.disabled) return null;
    const before = new Set(rows().map((row) => String(row.dataset.rowId || '')));
    button.click();
    await wait(90);
    const row = rows().find((candidate) => !before.has(String(candidate.dataset.rowId || ''))) || rows().at(-1);
    return row ? changeDuty(row, duty) : null;
  }

  function looksLike1743(row) {
    const name = normalize(fieldValue(row, 'name'));
    const bus = normalize(fieldValue(row, 'bus'));
    return bus === normalize('OS-AX 716') || name.includes('yasatemur') || name.includes('eggern');
  }

  function looksLikeEarly1941(row) {
    const name = normalize(fieldValue(row, 'name'));
    const bus = normalize(fieldValue(row, 'bus'));
    return bus === normalize('OS-MR 825') || name.includes('strotmann');
  }

  async function ensureStructure() {
    if (!dutyRows('1743').length) {
      const legacy = dutyRows('1941').find(looksLike1743);
      if (legacy) await changeDuty(legacy, '1743');
    }

    if (dutyRows('1941').length < 2) {
      const old3002 = dutyRows('3002').find(looksLikeEarly1941) || dutyRows('3002')[0];
      if (old3002) await changeDuty(old3002, '1941');
    }

    if (!dutyRows('1341').length) await addDutyRow('1341');
    if (!dutyRows('1743').length) await addDutyRow('1743');
    while (dutyRows('1941').length < 2) {
      const row = await addDutyRow('1941');
      if (!row) break;
    }
  }

  function applyCombinedDuty(duty, date) {
    const row = dutyRows(duty)[0];
    if (!row) return;
    const config = DUTIES[duty];
    const [earlyDriver, lateDriver] = assignedDrivers(duty, date);

    // Eine Tabellenzeile bleibt erhalten, damit die Ferienvorlage weiterhin exakt 21 Zeilen hat.
    // Beginn und Ende zeigen den gesamten geteilten Dienst; die genaue Fahrerzuordnung steht sichtbar darunter und im Auswahlfeld.
    setField(row, 'name', `${earlyDriver} / ${lateDriver}`);
    setField(row, 'bus', config.bus, true);
    setField(row, 'start', config.early.start);
    setField(row, 'end', config.late.end);
    setField(row, 'departure', '');
    setField(row, 'stop', '');
    row.dataset.dpSplitDuty = duty;
    row.dataset.dpEarlyDriver = earlyDriver;
    row.dataset.dpLateDriver = lateDriver;
  }

  function identify1941Rows() {
    const pair = dutyRows('1941').slice(0, 2);
    if (!pair.length) return { early: null, late: null };

    const early = pair.find((row) => fieldValue(row, 'start') === DUTIES['1941'].early.start)
      || pair.find((row) => normalize(fieldValue(row, 'bus')) === normalize(DUTIES['1941'].early.bus))
      || pair[0];
    const late = pair.find((row) => row !== early && fieldValue(row, 'start') === DUTIES['1941'].late.start)
      || pair.find((row) => row !== early && normalize(fieldValue(row, 'bus')) === normalize(DUTIES['1941'].late.bus))
      || pair.find((row) => row !== early)
      || null;
    return { early, late };
  }

  function apply1941(date) {
    const config = DUTIES['1941'];
    const [earlyDriver, lateDriver] = assignedDrivers('1941', date);
    const pair = identify1941Rows();

    if (pair.early) {
      setField(pair.early, 'name', earlyDriver);
      setField(pair.early, 'bus', config.early.bus, true);
      setField(pair.early, 'start', config.early.start);
      setField(pair.early, 'end', config.early.end);
      setField(pair.early, 'departure', config.early.departure);
      setField(pair.early, 'stop', config.early.stop);
      pair.early.dataset.dpSplitDuty = '1941';
      pair.early.dataset.dpShift = 'early';
    }

    if (pair.late) {
      setField(pair.late, 'name', lateDriver);
      setField(pair.late, 'bus', config.late.bus, true);
      setField(pair.late, 'start', config.late.start);
      setField(pair.late, 'end', config.late.end);
      setField(pair.late, 'departure', config.late.departure);
      setField(pair.late, 'stop', config.late.stop);
      pair.late.dataset.dpSplitDuty = '1941';
      pair.late.dataset.dpShift = 'late';
    }
  }

  function addDutyOption(select, duty) {
    if ([...select.options].some((option) => option.value === duty)) return;
    const option = document.createElement('option');
    option.value = duty;
    option.textContent = `Dienst ${duty}`;
    select.appendChild(option);
  }

  function patchDutySelects() {
    rows().forEach((row) => {
      const input = field(row, 'duty');
      const select = row.querySelector('.dp-daily-duty-select');
      if (!input || !select) return;
      const current = fieldValue(row, 'duty');

      Object.keys(DUTIES).forEach((duty) => addDutyOption(select, duty));
      if (DUTIES[current]) {
        select.value = current;
        select.classList.remove('invalid', 'duplicate');
        select.title = 'Dieser geteilte Dienst ist gültig.';
      }
    });
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
      #${PANEL_ID} .dp-shift-grid{display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));gap:8px}
      #${PANEL_ID} .dp-shift-driver{display:grid;gap:5px;padding:9px;border:1px solid #93c5fd;border-radius:10px;background:#fff;font-weight:900}
      #${PANEL_ID} .dp-shift-driver-name{font-size:13px;color:#0f172a}
      #${PANEL_ID} select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #2563eb;border-radius:9px;background:#fff;color:#0f172a;font:inherit;font-weight:900;cursor:pointer}
      .dp-split-driver-note{margin-top:5px;padding:6px 7px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:11px;line-height:1.4;font-weight:850}
      @media(max-width:850px){#${PANEL_ID} .dp-shift-grid{grid-template-columns:1fr}}
      @media print{#${PANEL_ID},.dp-split-driver-note{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function shiftSelect(duty, driver, currentShift) {
    const config = DUTIES[duty];
    return `
      <label class="dp-shift-driver">
        <span class="dp-shift-driver-name">${driver}</span>
        <select class="dp-driver-shift-select" data-duty="${duty}" data-driver="${driver}">
          <option value="0"${currentShift === 0 ? ' selected' : ''}>Frühschicht ${config.early.start}–${config.early.end}</option>
          <option value="1"${currentShift === 1 ? ' selected' : ''}>Spätschicht ${config.late.start}–${config.late.end}</option>
        </select>
      </label>`;
  }

  function renderPanel(date) {
    const section = document.getElementById(SECTION_ID);
    const tableWrap = section?.querySelector('.dp-daily-table-wrap') || document.querySelector(`#${TABLE_ID}`)?.closest('.table-wrap');
    if (!section || !tableWrap || section.classList.contains('hidden')) return;

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      tableWrap.insertAdjacentElement('beforebegin', panel);
    }

    const blocks = Object.keys(DUTIES).map((duty) => {
      const config = DUTIES[duty];
      const assigned = assignedDrivers(duty, date);
      return `
        <div class="dp-shift-duty">
          <div class="dp-shift-duty-title">Dienst ${duty}</div>
          <div class="dp-shift-grid">
            ${shiftSelect(duty, config.pair[0], assigned[0] === config.pair[0] ? 0 : 1)}
            ${shiftSelect(duty, config.pair[1], assigned[0] === config.pair[1] ? 0 : 1)}
          </div>
        </div>`;
    }).join('');

    panel.innerHTML = `
      <h3>Welcher Fahrer fährt Früh- oder Spätschicht?</h3>
      <div class="dp-shift-help">Bei jedem geteilten Dienst ist immer genau ein Fahrer in der Frühschicht und der andere in der Spätschicht. Eine Änderung beim ersten Fahrer stellt den zweiten automatisch gegensätzlich ein.</div>
      ${blocks}`;
  }

  function decorateRows(date) {
    rows().forEach((row) => row.querySelectorAll('.dp-split-driver-note,.dp-split-shift-box,.dp-split-duty-note,.dp-split-swap').forEach((element) => element.remove()));

    ['1341', '1743'].forEach((duty) => {
      const row = dutyRows(duty)[0];
      const nameCell = row?.cells?.[0];
      if (!row || !nameCell) return;
      const config = DUTIES[duty];
      const [earlyDriver, lateDriver] = assignedDrivers(duty, date);
      const note = document.createElement('div');
      note.className = 'dp-split-driver-note';
      note.innerHTML = `<strong>Früh:</strong> ${earlyDriver} · ${config.early.start}–${config.early.end}<br><strong>Spät:</strong> ${lateDriver} · ${config.late.start}–${config.late.end}`;
      nameCell.appendChild(note);
    });

    const pair1941 = identify1941Rows();
    [[pair1941.early, 'Früh'], [pair1941.late, 'Spät']].forEach(([row, label]) => {
      const nameCell = row?.cells?.[0];
      if (!row || !nameCell) return;
      const note = document.createElement('div');
      note.className = 'dp-split-driver-note';
      note.textContent = `${label}schicht`;
      nameCell.appendChild(note);
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function decoratePreview(date) {
    const preview = document.getElementById('dpDailyPlanPreview');
    if (!preview) return;
    const tableRows = rows().filter((row) => normalize(fieldValue(row, 'duty')) !== 'frei');
    const previewRows = [...preview.querySelectorAll('.dp-preview-row:not(.dp-preview-free-summary)')];

    tableRows.forEach((row, index) => {
      const duty = fieldValue(row, 'duty');
      if (duty !== '1341' && duty !== '1743') return;
      const target = previewRows[index];
      if (!target) return;
      const config = DUTIES[duty];
      const [earlyDriver, lateDriver] = assignedDrivers(duty, date);
      const bus = fieldValue(row, 'bus') || config.bus;
      const left = target.querySelector('.dp-preview-left');
      const middle = target.querySelector('.dp-preview-middle');
      const right = target.querySelector('.dp-preview-right');
      if (!left || !middle) return;

      target.classList.add('dp-split-preview-row');
      left.innerHTML = `<strong>${escapeHtml(earlyDriver)}</strong><span>Dienst ${duty} · Früh</span><strong class="dp-split-preview-second">${escapeHtml(lateDriver)}</strong><span>Dienst ${duty} · Spät</span>`;
      middle.innerHTML = `<strong>/ ${escapeHtml(bus)}</strong><span>/ ${config.early.start} - ${config.early.end} Uhr</span><strong class="dp-split-preview-second">&nbsp;</strong><span>/ ${config.late.start} - ${config.late.end} Uhr</span>`;
      if (right) right.innerHTML = '&nbsp;';
    });
  }

  async function repair() {
    const date = selectedDate();
    if (running || !sectionVisible() || !isWeekday(date) || !rows().length) return;
    if (window.__dienstpilotHolidayPhotoRebuilding) {
      schedule(1600);
      return;
    }

    running = true;
    try {
      await ensureStructure();
      applyCombinedDuty('1341', date);
      apply1941(date);
      applyCombinedDuty('1743', date);
      patchDutySelects();
      addStyle();
      renderPanel(date);
      decorateRows(date);
      window.setTimeout(() => decoratePreview(date), 100);
    } finally {
      running = false;
    }
  }

  function schedule(delay = 350) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void repair(), delay);
  }

  function installObserver() {
    const body = document.getElementById(TABLE_ID);
    if (!body || body === observedBody) return;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => schedule(250));
    observer.observe(body, { childList: true, subtree: true });
  }

  document.addEventListener('change', (event) => {
    const shiftSelect = event.target.closest?.('.dp-driver-shift-select');
    if (shiftSelect) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const duty = String(shiftSelect.dataset.duty || '');
      const driver = String(shiftSelect.dataset.driver || '');
      const shiftIndex = Number(shiftSelect.value) === 1 ? 1 : 0;
      assignDriverToShift(duty, driver, shiftIndex);
      setStatus(`${driver} fährt bei Dienst ${duty} jetzt ${shiftIndex === 0 ? 'Frühschicht' : 'Spätschicht'}. Der zweite Fahrer wurde automatisch gegensätzlich eingestellt.`);
      schedule(80);
      return;
    }

    if (event.target?.id === DATE_ID) schedule(1800);
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyPrint,#dpDailyPrintA4,#dpDailyPrintWeekday')) decoratePreview(selectedDate());
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyInsertDefaults,#dpDailyAddRow,#loginButton,#dpDailyPlanRows [data-action]')) {
      [500, 1400, 2600].forEach((delay) => window.setTimeout(() => {
        installObserver();
        schedule(0);
      }, delay));
    }
  }, true);

  function start() {
    addStyle();
    installObserver();
    schedule(2600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  [2600, 5200, 9000].forEach((delay) => window.setTimeout(() => {
    installObserver();
    schedule(0);
  }, delay));
  window.addEventListener('pageshow', () => schedule(1800));
  window.addEventListener('focus', () => schedule(1800));
})();
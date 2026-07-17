(() => {
  'use strict';

  if (window.__dienstpilotSplitShiftSelectorFixV1) return;
  window.__dienstpilotSplitShiftSelectorFixV1 = true;

  const SECTION_ID = 'tab-daily-duty-plan';
  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const PANEL_ID = 'dpStableSplitShiftPanel';
  const STYLE_ID = 'dpStableSplitShiftPanelStyle';
  const VIEW_KEY = 'dienstpilot_split_shift_view_v2';
  const ROW_SHIFT_KEY = 'dienstpilot_split_shift_row_v2';
  const OVERRIDE_KEY = 'dienstpilot_split_shift_override_v2';
  const BASE_MONDAY = new Date(2026, 6, 13, 12, 0, 0);

  const DUTIES = {
    '1341': {
      bus: 'OS-CL 916',
      pair: ['A.Morzsa', 'M.Al Dabbah'],
      shifts: [
        { label: 'Frühschicht', start: '05:13', end: '14:21', departure: '', stop: '' },
        { label: 'Spätschicht', start: '14:04', end: '23:38', departure: '', stop: '' }
      ]
    },
    '1941': {
      pair: ['C.Strotmann', 'M.Entrup'],
      shifts: [
        { label: 'Frühschicht', start: '05:35', end: '15:00', bus: 'OS-MR 825', departure: '', stop: '' },
        { label: 'Spätschicht', start: '14:49', end: '21:16', bus: 'OS-RE 224', departure: '15:24', stop: 'Bissendorf, Werries' }
      ]
    },
    '1743': {
      bus: 'OS-AX 716',
      pair: ['M.Eggern', 'S.Yasatemur'],
      shifts: [
        { label: 'Frühschicht', start: '06:05', end: '15:17', departure: '', stop: '' },
        { label: 'Spätschicht', start: '14:57', end: '00:50', departure: '', stop: '' }
      ]
    }
  };

  let timer = 0;
  let observedBody = null;
  let observer = null;

  function readMap(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function writeMap(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function selectedDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
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

  function setField(row, name, value) {
    const input = field(row, name);
    if (!input || input.disabled) return;
    input.value = String(value || '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setStatus(text, state = 'ok') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = `dp-daily-status ${state}`;
  }

  function mondayFor(date) {
    const value = new Date(`${date}T12:00:00`);
    const day = value.getDay() || 7;
    value.setDate(value.getDate() - day + 1);
    return value;
  }

  function weeklySwap(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const monday = mondayFor(date);
    const difference = Math.round((monday - BASE_MONDAY) / 604800000);
    return ((difference % 2) + 2) % 2 === 1;
  }

  function assignedDrivers(duty, date) {
    const pair = DUTIES[duty].pair;
    const override = Boolean(readMap(OVERRIDE_KEY)[`${date}|${duty}`]);
    const swapped = weeklySwap(date) !== override;
    return swapped ? [pair[1], pair[0]] : [...pair];
  }

  function combinedShift(date, duty) {
    return Number(readMap(VIEW_KEY)[`${date}|${duty}`]) === 1 ? 1 : 0;
  }

  function setCombinedShift(date, duty, index) {
    const map = readMap(VIEW_KEY);
    map[`${date}|${duty}`] = Number(index) === 1 ? 1 : 0;
    writeMap(VIEW_KEY, map);
  }

  function rowShift(date, row, fallback) {
    const rowId = String(row?.dataset.rowId || '');
    const stored = readMap(ROW_SHIFT_KEY)[`${date}|${rowId}`];
    return stored === 1 || stored === '1' ? 1 : stored === 0 || stored === '0' ? 0 : fallback;
  }

  function setRowShift(date, row, index) {
    const rowId = String(row?.dataset.rowId || '');
    if (!rowId) return;
    const map = readMap(ROW_SHIFT_KEY);
    map[`${date}|${rowId}`] = Number(index) === 1 ? 1 : 0;
    writeMap(ROW_SHIFT_KEY, map);
  }

  function infer1941Shift(row, fallback) {
    const start = fieldValue(row, 'start');
    const bus = fieldValue(row, 'bus');
    if (start === DUTIES['1941'].shifts[1].start || bus === DUTIES['1941'].shifts[1].bus) return 1;
    if (start === DUTIES['1941'].shifts[0].start || bus === DUTIES['1941'].shifts[0].bus) return 0;
    return fallback;
  }

  function applyCombined(duty, index) {
    const date = selectedDate();
    const row = dutyRows(duty)[0];
    if (!row) return;
    const shift = DUTIES[duty].shifts[index];
    setCombinedShift(date, duty, index);
    setField(row, 'start', shift.start);
    setField(row, 'end', shift.end);
    setField(row, 'departure', shift.departure);
    setField(row, 'stop', shift.stop);
    if (!fieldValue(row, 'bus') || fieldValue(row, 'bus') === 'OS-XX 123') setField(row, 'bus', DUTIES[duty].bus);
    setStatus(`${shift.label} für Dienst ${duty} wurde übernommen.`);
  }

  function apply1941(row, index) {
    const date = selectedDate();
    const pair = dutyRows('1941').slice(0, 2);
    if (!row || !pair.length) return;
    const other = pair.find((candidate) => candidate !== row) || null;
    const drivers = assignedDrivers('1941', date);

    setRowShift(date, row, index);
    if (other) setRowShift(date, other, index === 0 ? 1 : 0);

    const applyRow = (target, shiftIndex) => {
      if (!target) return;
      const shift = DUTIES['1941'].shifts[shiftIndex];
      setField(target, 'name', drivers[shiftIndex]);
      setField(target, 'bus', shift.bus);
      setField(target, 'start', shift.start);
      setField(target, 'end', shift.end);
      setField(target, 'departure', shift.departure);
      setField(target, 'stop', shift.stop);
    };

    applyRow(row, index);
    applyRow(other, index === 0 ? 1 : 0);
    setStatus(`${DUTIES['1941'].shifts[index].label} wurde für diese Zeile übernommen; die zweite 1941-Zeile wurde automatisch gegensätzlich gesetzt.`);
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:0 0 12px;padding:13px;border:2px solid #2563eb;border-radius:14px;background:#eff6ff;color:#172554}
      #${PANEL_ID} h3{margin:0 0 5px;font-size:16px}
      #${PANEL_ID} .dp-stable-shift-help{margin:0 0 10px;font-size:13px;font-weight:750}
      #${PANEL_ID} .dp-stable-shift-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
      #${PANEL_ID} .dp-stable-shift-item{display:grid;gap:5px;padding:9px;border:1px solid #bfdbfe;border-radius:10px;background:#fff;font-weight:900}
      #${PANEL_ID} select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #2563eb;border-radius:9px;background:#fff;color:#0f172a;font:inherit;font-weight:900;cursor:pointer}
      #${PANEL_ID} .dp-stable-shift-empty{font-size:13px;color:#475569;font-weight:800}
      @media print{#${PANEL_ID}{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function selectHtml(duty, row, index, current) {
    const config = DUTIES[duty];
    const rowId = String(row?.dataset.rowId || '');
    const suffix = duty === '1941' ? ` · ${fieldValue(row, 'name') || `Zeile ${index + 1}`}` : '';
    return `
      <label class="dp-stable-shift-item">
        <span>Dienst ${duty}${suffix}</span>
        <select class="dp-stable-shift-select" data-duty="${duty}" data-row-id="${rowId}">
          <option value="0"${current === 0 ? ' selected' : ''}>Frühschicht ${config.shifts[0].start}–${config.shifts[0].end}</option>
          <option value="1"${current === 1 ? ' selected' : ''}>Spätschicht ${config.shifts[1].start}–${config.shifts[1].end}</option>
        </select>
      </label>`;
  }

  function renderPanel() {
    const section = document.getElementById(SECTION_ID);
    const tableWrap = section?.querySelector('.dp-daily-table-wrap');
    if (!section || !tableWrap || section.classList.contains('hidden')) return;

    addStyle();
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      tableWrap.insertAdjacentElement('beforebegin', panel);
    }

    const date = selectedDate();
    const entries = [];
    ['1341', '1743'].forEach((duty) => {
      const row = dutyRows(duty)[0];
      if (row) entries.push(selectHtml(duty, row, 0, combinedShift(date, duty)));
    });

    dutyRows('1941').slice(0, 2).forEach((row, index) => {
      entries.push(selectHtml('1941', row, index, rowShift(date, row, infer1941Shift(row, index))));
    });

    panel.innerHTML = `
      <h3>Früh- oder Spätschicht auswählen</h3>
      <div class="dp-stable-shift-help">Die Auswahl gilt für die Dienste 1341, 1941 und 1743. Bei Dienst 1941 wird die zweite Zeile automatisch auf die jeweils andere Schicht gesetzt.</div>
      ${entries.length ? `<div class="dp-stable-shift-grid">${entries.join('')}</div>` : '<div class="dp-stable-shift-empty">Die Schichtauswahl erscheint, sobald 1341, 1941 oder 1743 im Tagesplan vorhanden ist.</div>'}`;
  }

  function schedule(delay = 250) {
    window.clearTimeout(timer);
    timer = window.setTimeout(renderPanel, delay);
  }

  function installObserver() {
    const body = document.getElementById(TABLE_ID);
    if (!body || body === observedBody) return;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => schedule(120));
    observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
  }

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.('.dp-stable-shift-select');
    if (!select) {
      if (event.target?.id === DATE_ID) schedule(500);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const duty = String(select.dataset.duty || '');
    const index = Number(select.value) === 1 ? 1 : 0;
    const rowId = String(select.dataset.rowId || '');
    const row = rows().find((candidate) => String(candidate.dataset.rowId || '') === rowId) || null;

    if (duty === '1941') apply1941(row, index);
    else if (DUTIES[duty]) applyCombined(duty, index);

    schedule(250);
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyInsertDefaults,#dpDailyAddRow,#loginButton,#dpDailyPlanRows [data-action]')) {
      [300, 900, 1800].forEach((delay) => window.setTimeout(() => {
        installObserver();
        renderPanel();
      }, delay));
    }
  }, true);

  function start() {
    installObserver();
    schedule(1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  [1800, 4200, 8000].forEach((delay) => window.setTimeout(() => {
    installObserver();
    renderPanel();
  }, delay));
  window.addEventListener('pageshow', () => schedule(800));
  window.addEventListener('focus', () => schedule(800));
})();
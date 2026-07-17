(() => {
  'use strict';

  if (window.__dienstpilotSplitShiftDutiesV2) return;
  window.__dienstpilotSplitShiftDutiesV2 = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const ADD_ID = 'dpDailyAddRow';
  const SECTION_ID = 'tab-daily-duty-plan';
  const STYLE_ID = 'dpSplitShiftDutyStyleV2';
  const INITIAL_KEY = 'dienstpilot_split_shift_initial_v2';
  const OVERRIDE_KEY = 'dienstpilot_split_shift_override_v2';
  const VIEW_KEY = 'dienstpilot_split_shift_view_v2';
  const ROW_SHIFT_KEY = 'dienstpilot_split_shift_row_v2';
  const BASE_MONDAY = new Date(2026, 6, 13, 12, 0, 0);

  const SPECIALS = {
    '1341': {
      combined: true,
      bus: 'OS-CL 916',
      pair: ['A.Morzsa', 'M.Al Dabbah'],
      shifts: [
        { label: 'Frühschicht', start: '05:13', end: '14:21', departure: '', stop: '' },
        { label: 'Spätschicht', start: '14:04', end: '23:38', departure: '', stop: '' }
      ]
    },
    '1941': {
      combined: false,
      pair: ['C.Strotmann', 'M.Entrup'],
      shifts: [
        { label: 'Frühschicht', bus: 'OS-MR 825', start: '05:35', end: '15:00', departure: '', stop: '' },
        { label: 'Spätschicht', bus: 'OS-RE 224', start: '14:49', end: '21:16', departure: '15:24', stop: 'Bissendorf, Werries' }
      ]
    },
    '1743': {
      combined: true,
      bus: 'OS-AX 716',
      pair: ['M.Eggern', 'S.Yasatemur'],
      shifts: [
        { label: 'Frühschicht', start: '06:05', end: '15:17', departure: '', stop: '' },
        { label: 'Spätschicht', start: '14:57', end: '00:50', departure: '', stop: '' }
      ]
    }
  };

  const MAX_ASSIGNMENTS = { '1341': 1, '1941': 2, '1743': 1 };
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

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
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

  function fieldInput(row, field) {
    return row?.querySelector(`input[data-field="${field}"]`) || null;
  }

  function fieldValue(row, field) {
    return String(fieldInput(row, field)?.value || '').trim();
  }

  function dutyRows(duty) {
    return rows().filter((row) => fieldValue(row, 'duty') === duty);
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status' + (kind ? ` ${kind}` : '');
  }

  function dispatchInput(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
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

  function setField(row, field, value, overwrite = true) {
    const input = fieldInput(row, field);
    if (!input || input.disabled) return;
    const next = String(value || '');
    const current = String(input.value || '').trim();
    if (!overwrite && current && current !== 'OS-XX 123') return;
    if (input.value === next) {
      if (field === 'name') ensureDriverOption(row, next);
      return;
    }
    input.value = next;
    if (field === 'name') ensureDriverOption(row, next);
    dispatchInput(input);
  }

  function escapeSelector(value) {
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(String(value || ''));
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  function rowById(rowId) {
    if (!rowId) return null;
    return document.querySelector(`#${TABLE_ID} tr[data-row-id="${escapeSelector(rowId)}"]`);
  }

  function initialApplied(date) {
    return Boolean(readMap(INITIAL_KEY)[date]);
  }

  function markInitial(date) {
    const map = readMap(INITIAL_KEY);
    map[date] = true;
    writeMap(INITIAL_KEY, map);
  }

  function mondayFor(date) {
    const value = new Date(`${date}T12:00:00`);
    const day = value.getDay() || 7;
    value.setDate(value.getDate() - day + 1);
    return value;
  }

  function weeklySwap(date) {
    const monday = mondayFor(date);
    const difference = Math.round((monday - BASE_MONDAY) / 604800000);
    return ((difference % 2) + 2) % 2 === 1;
  }

  function overrideActive(date, duty) {
    return Boolean(readMap(OVERRIDE_KEY)[`${date}|${duty}`]);
  }

  function toggleOverride(date, duty) {
    const map = readMap(OVERRIDE_KEY);
    const key = `${date}|${duty}`;
    map[key] = !map[key];
    writeMap(OVERRIDE_KEY, map);
  }

  function assignedDrivers(duty, date) {
    const config = SPECIALS[duty];
    const swapped = weeklySwap(date) !== overrideActive(date, duty);
    return swapped ? [config.pair[1], config.pair[0]] : [...config.pair];
  }

  function combinedView(date, duty) {
    return Number(readMap(VIEW_KEY)[`${date}|${duty}`]) === 1 ? 1 : 0;
  }

  function setCombinedView(date, duty, index) {
    const map = readMap(VIEW_KEY);
    map[`${date}|${duty}`] = Number(index) === 1 ? 1 : 0;
    writeMap(VIEW_KEY, map);
  }

  function rowShift(date, row, fallback) {
    const rowId = String(row?.dataset.rowId || '');
    const value = readMap(ROW_SHIFT_KEY)[`${date}|${rowId}`];
    return value === 1 || value === '1' ? 1 : value === 0 || value === '0' ? 0 : fallback;
  }

  function setRowShift(date, row, index) {
    const rowId = String(row?.dataset.rowId || '');
    if (!rowId) return;
    const map = readMap(ROW_SHIFT_KEY);
    map[`${date}|${rowId}`] = Number(index) === 1 ? 1 : 0;
    writeMap(ROW_SHIFT_KEY, map);
  }

  async function changeDuty(row, duty) {
    const rowId = String(row?.dataset.rowId || '');
    const input = fieldInput(row, 'duty');
    if (!rowId || !input || input.disabled) return null;
    input.dataset.dpDutyCommit = '1';
    input.value = duty;
    dispatchInput(input);
    delete input.dataset.dpDutyCommit;
    await wait(120);
    return rowById(rowId);
  }

  async function addDutyRow(duty) {
    const button = document.getElementById(ADD_ID);
    if (!button || button.disabled) return null;
    const before = new Set(rows().map((row) => String(row.dataset.rowId || '')));
    button.click();
    await wait(80);
    let row = rows().find((item) => !before.has(String(item.dataset.rowId || ''))) || rows().at(-1);
    if (!row) return null;
    return changeDuty(row, duty);
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

  async function prepareStructure() {
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
      const created = await addDutyRow('1941');
      if (!created) break;
    }
  }

  function applyCombinedDuty(duty, row, date, forceBus) {
    if (!row) return;
    const config = SPECIALS[duty];
    const [earlyDriver, lateDriver] = assignedDrivers(duty, date);
    const shiftIndex = combinedView(date, duty);
    const shift = config.shifts[shiftIndex];

    setField(row, 'name', `${earlyDriver} / ${lateDriver}`);
    setField(row, 'bus', config.bus, forceBus);
    setField(row, 'start', shift.start);
    setField(row, 'end', shift.end);
    setField(row, 'departure', shift.departure);
    setField(row, 'stop', shift.stop);
    row.dataset.dpSplitDuty = duty;
    row.dataset.dpSplitShift = String(shiftIndex);
  }

  function infer1941Shift(row, index) {
    const start = fieldValue(row, 'start');
    const bus = normalize(fieldValue(row, 'bus'));
    if (start === SPECIALS['1941'].shifts[1].start || bus === normalize(SPECIALS['1941'].shifts[1].bus)) return 1;
    if (start === SPECIALS['1941'].shifts[0].start || bus === normalize(SPECIALS['1941'].shifts[0].bus)) return 0;
    return index === 1 ? 1 : 0;
  }

  function apply1941(date, forceBus) {
    const config = SPECIALS['1941'];
    const pair = dutyRows('1941').slice(0, 2);
    if (!pair.length) return;

    let firstShift = rowShift(date, pair[0], infer1941Shift(pair[0], 0));
    let secondShift = pair[1] ? rowShift(date, pair[1], infer1941Shift(pair[1], 1)) : 1;
    if (pair[1] && firstShift === secondShift) secondShift = firstShift === 0 ? 1 : 0;
    setRowShift(date, pair[0], firstShift);
    if (pair[1]) setRowShift(date, pair[1], secondShift);

    const drivers = assignedDrivers('1941', date);
    pair.forEach((row, index) => {
      const shiftIndex = index === 0 ? firstShift : secondShift;
      const shift = config.shifts[shiftIndex];
      setField(row, 'name', drivers[shiftIndex]);
      setField(row, 'bus', shift.bus, forceBus);
      setField(row, 'start', shift.start);
      setField(row, 'end', shift.end);
      setField(row, 'departure', shift.departure);
      setField(row, 'stop', shift.stop);
      row.dataset.dpSplitDuty = '1941';
      row.dataset.dpSplitShift = String(shiftIndex);
    });
  }

  function assignmentCount(duty, skipRow = null) {
    return dutyRows(duty).filter((row) => row !== skipRow).length;
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
      const input = fieldInput(row, 'duty');
      const select = row.querySelector('.dp-daily-duty-select');
      if (!input || !select) return;
      const current = String(input.value || '').trim();

      Object.keys(SPECIALS).forEach((duty) => {
        if (current === duty || assignmentCount(duty, row) < MAX_ASSIGNMENTS[duty]) addDutyOption(select, duty);
      });

      if (SPECIALS[current]) {
        addDutyOption(select, current);
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
      .dp-split-shift-box{margin-top:6px;padding:7px 8px;border:1px solid #93c5fd;border-radius:9px;background:#eff6ff;color:#1e3a8a;font-size:11px;font-weight:900;line-height:1.35}
      .dp-split-shift-box label{display:grid;gap:4px}
      .dp-split-shift-select{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #2563eb;border-radius:8px;background:#fff;color:#0f172a;font:inherit;font-weight:900;cursor:pointer}
      .dp-split-duty-note{margin-top:5px;padding:6px 7px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:11px;line-height:1.35;font-weight:800}
      .dp-split-swap{margin-top:5px;padding:4px 7px;border:1px solid #93c5fd;border-radius:7px;background:#fff;color:#1d4ed8;font-size:11px;font-weight:900;cursor:pointer}
      .dp-split-preview-row{min-height:94px}.dp-split-preview-second{margin-top:8px}
      @media print{.dp-split-shift-box,.dp-split-duty-note,.dp-split-swap{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function shiftSummary(duty, date) {
    const config = SPECIALS[duty];
    const drivers = assignedDrivers(duty, date);
    return `<div><strong>Früh:</strong> ${drivers[0]} · ${config.shifts[0].start}–${config.shifts[0].end}</div><div><strong>Spät:</strong> ${drivers[1]} · ${config.shifts[1].start}–${config.shifts[1].end}</div>`;
  }

  function installShiftSelector(row, duty, date) {
    const dutyCell = fieldInput(row, 'duty')?.closest('td');
    if (!dutyCell) return;
    dutyCell.querySelector('.dp-split-shift-box')?.remove();

    const config = SPECIALS[duty];
    const currentShift = duty === '1941'
      ? Number(row.dataset.dpSplitShift || 0)
      : combinedView(date, duty);

    const box = document.createElement('div');
    box.className = 'dp-split-shift-box';
    box.innerHTML = `<label>Schicht auswählen<select class="dp-split-shift-select" data-duty="${duty}"><option value="0">Frühschicht ${config.shifts[0].start}–${config.shifts[0].end}</option><option value="1">Spätschicht ${config.shifts[1].start}–${config.shifts[1].end}</option></select></label>`;
    const select = box.querySelector('.dp-split-shift-select');
    select.value = String(currentShift);
    dutyCell.appendChild(box);
  }

  function decorateRows(date) {
    rows().forEach((row) => {
      row.querySelectorAll('.dp-split-duty-note,.dp-split-swap').forEach((element) => element.remove());
      const duty = fieldValue(row, 'duty');
      if (!SPECIALS[duty]) {
        row.querySelector('.dp-split-shift-box')?.remove();
        return;
      }

      installShiftSelector(row, duty, date);
      const nameCell = row.cells?.[0];
      if (!nameCell) return;

      if (duty === '1341' || duty === '1743') {
        const note = document.createElement('div');
        note.className = 'dp-split-duty-note';
        note.innerHTML = shiftSummary(duty, date);
        nameCell.appendChild(note);
      }

      if ((duty === '1341' || duty === '1743') || (duty === '1941' && Number(row.dataset.dpSplitShift || 0) === 0)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dp-split-swap';
        button.dataset.duty = duty;
        button.textContent = 'Fahrer Früh/Spät tauschen';
        nameCell.appendChild(button);
      }
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
      const config = SPECIALS[duty];
      const drivers = assignedDrivers(duty, date);
      const bus = fieldValue(row, 'bus') || config.bus;
      const left = target.querySelector('.dp-preview-left');
      const middle = target.querySelector('.dp-preview-middle');
      const right = target.querySelector('.dp-preview-right');
      if (!left || !middle) return;

      target.classList.add('dp-split-preview-row');
      left.innerHTML = `<strong>${escapeHtml(drivers[0])}</strong><span>Dienst ${duty} · Früh</span><strong class="dp-split-preview-second">${escapeHtml(drivers[1])}</strong><span>Dienst ${duty} · Spät</span>`;
      middle.innerHTML = `<strong>/ ${escapeHtml(bus)}</strong><span>/ ${config.shifts[0].start} - ${config.shifts[0].end} Uhr</span><strong class="dp-split-preview-second">&nbsp;</strong><span>/ ${config.shifts[1].start} - ${config.shifts[1].end} Uhr</span>`;
      if (right) right.innerHTML = '&nbsp;';
    });
  }

  function updateBanner() {
    const banner = document.getElementById('dpNiHolidayDutyStatus');
    if (!banner) return;
    if (!banner.textContent.includes('Schicht auswählen')) {
      banner.textContent += ' Bei 1341, 1941 und 1743 kann direkt in der Zeile Früh- oder Spätschicht gewählt werden.';
    }
  }

  async function repair() {
    const date = selectedDate();
    if (running || !sectionVisible() || !isWeekday(date) || !rows().length) return;
    if (window.__dienstpilotHolidayPhotoRebuilding) {
      schedule(1800);
      return;
    }

    running = true;
    try {
      await prepareStructure();
      const forceBus = !initialApplied(date);
      applyCombinedDuty('1341', dutyRows('1341')[0], date, forceBus);
      applyCombinedDuty('1743', dutyRows('1743')[0], date, forceBus);
      apply1941(date, forceBus);
      if (forceBus) markInitial(date);
      patchDutySelects();
      decorateRows(date);
      window.setTimeout(() => decoratePreview(date), 80);
      updateBanner();
      setStatus('Schichtauswahl sichtbar: Bei 1341, 1941 und 1743 kann jetzt direkt Früh- oder Spätschicht gewählt werden.', 'ok');
    } finally {
      running = false;
    }
  }

  function schedule(delay = 450) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void repair(), delay);
  }

  function installObserver() {
    const body = document.getElementById(TABLE_ID);
    if (!body || (observer && observedBody === body)) return;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => schedule(300));
    observer.observe(body, { childList: true, subtree: true });
  }

  document.addEventListener('change', (event) => {
    const shiftSelect = event.target.closest?.('.dp-split-shift-select');
    if (shiftSelect) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const row = shiftSelect.closest('tr[data-row-id]');
      const duty = String(shiftSelect.dataset.duty || '');
      const shiftIndex = Number(shiftSelect.value) === 1 ? 1 : 0;
      const date = selectedDate();

      if (duty === '1941') {
        const pair = dutyRows('1941').slice(0, 2);
        const other = pair.find((item) => item !== row);
        setRowShift(date, row, shiftIndex);
        if (other) setRowShift(date, other, shiftIndex === 0 ? 1 : 0);
      } else if (SPECIALS[duty]) {
        setCombinedView(date, duty, shiftIndex);
      }

      setStatus(`${SPECIALS[duty].shifts[shiftIndex].label} für Dienst ${duty} wurde ausgewählt.`, 'ok');
      schedule(80);
      return;
    }

    const dutySelect = event.target.closest?.('#dpDailyPlanRows .dp-daily-duty-select');
    if (dutySelect && SPECIALS[dutySelect.value]) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const row = dutySelect.closest('tr[data-row-id]');
      const duty = dutySelect.value;
      if (assignmentCount(duty, row) >= MAX_ASSIGNMENTS[duty]) {
        setStatus(`Dienst ${duty} ist bereits in der zulässigen Anzahl eingetragen.`, 'error');
        schedule(100);
        return;
      }
      const input = fieldInput(row, 'duty');
      if (input) {
        input.dataset.dpDutyCommit = '1';
        input.value = duty;
        dispatchInput(input);
        delete input.dataset.dpDutyCommit;
      }
      setStatus(`Dienst ${duty} wurde übernommen. Die Schichtauswahl erscheint direkt darunter.`, 'ok');
      schedule(250);
      return;
    }

    if (event.target?.id === DATE_ID) schedule(3200);
  }, true);

  document.addEventListener('click', (event) => {
    const swap = event.target.closest?.('.dp-split-swap');
    if (swap) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const duty = String(swap.dataset.duty || '');
      if (!SPECIALS[duty]) return;
      toggleOverride(selectedDate(), duty);
      setStatus(`Die Fahrer von Dienst ${duty} wurden zwischen Früh- und Spätschicht getauscht.`, 'ok');
      schedule(80);
      return;
    }

    if (event.target.closest?.('#dpDailyPrint,#dpDailyPrintA4,#dpDailyPrintWeekday')) {
      patchDutySelects();
      decoratePreview(selectedDate());
    }

    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyInsertDefaults,#dpDailyAddRow,#loginButton,#dpDailyPlanRows [data-action]')) {
      schedule(3200);
    }
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.matches?.('#dpDailyPlanRows input[data-field="duty"],#dpDailyPlanRows input[data-field="name"]')) schedule(500);
  }, true);

  function start() {
    addStyle();
    installObserver();
    schedule(5200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  [5200, 8500, 12000].forEach((delay) => window.setTimeout(() => {
    installObserver();
    schedule(0);
  }, delay));
  window.addEventListener('pageshow', () => schedule(4200));
  window.addEventListener('focus', () => schedule(4200));
})();
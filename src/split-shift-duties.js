(() => {
  'use strict';

  if (window.__dienstpilotSplitShiftDutiesV1) return;
  window.__dienstpilotSplitShiftDutiesV1 = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const ADD_ID = 'dpDailyAddRow';
  const SECTION_ID = 'tab-daily-duty-plan';
  const STYLE_ID = 'dpSplitShiftDutyStyle';
  const INITIAL_KEY = 'dienstpilot_split_shift_initial_v1';
  const OVERRIDE_KEY = 'dienstpilot_split_shift_override_v1';
  const BASE_MONDAY = new Date(2026, 6, 13, 12, 0, 0);

  const SPECIALS = {
    '1341': {
      combined: true,
      bus: 'OS-CL 916',
      pair: ['A.Morzsa', 'M.Al Dabbah'],
      early: { start: '05:13', end: '14:21', departure: '', stop: '' },
      late: { start: '14:04', end: '23:38', departure: '', stop: '' }
    },
    '1941': {
      combined: false,
      pair: ['C.Strotmann', 'M.Entrup'],
      early: { bus: 'OS-MR 825', start: '05:35', end: '15:00', departure: '', stop: '' },
      late: { bus: 'OS-RE 224', start: '14:49', end: '21:16', departure: '15:24', stop: 'Bissendorf, Werries' }
    },
    '1743': {
      combined: true,
      bus: 'OS-AX 716',
      pair: ['M.Eggern', 'S.Yasatemur'],
      early: { start: '06:05', end: '15:17', departure: '', stop: '' },
      late: { start: '14:57', end: '00:50', departure: '', stop: '' }
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

  function initialApplied(date) {
    return Boolean(readMap(INITIAL_KEY)[date]);
  }

  function markInitial(date) {
    const map = readMap(INITIAL_KEY);
    map[date] = true;
    writeMap(INITIAL_KEY, map);
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

  function assignedDrivers(duty, date) {
    const config = SPECIALS[duty];
    const swapped = weeklySwap(date) !== overrideActive(date, duty);
    return swapped ? [config.pair[1], config.pair[0]] : [...config.pair];
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

  function setField(row, field, value, force = true) {
    const input = fieldInput(row, field);
    if (!input || input.disabled) return false;
    const next = String(value || '');
    if (!force && String(input.value || '').trim() && String(input.value || '').trim() !== 'OS-XX 123') return false;
    if (input.value === next) {
      if (field === 'name') ensureDriverOption(row, next);
      return false;
    }
    input.value = next;
    if (field === 'name') ensureDriverOption(row, next);
    dispatchInput(input);
    return true;
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
    if (!row) return null;
    const rowId = String(row.dataset.rowId || '');
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
    row = await changeDuty(row, duty);
    return row;
  }

  function looksLikeLegacy1743(row) {
    const name = normalize(fieldValue(row, 'name'));
    const bus = normalize(fieldValue(row, 'bus'));
    return bus === normalize('OS-AX 716') || name.includes('yasatemur') || name.includes('eggern');
  }

  function looksLikeLegacyEarly1941(row) {
    const name = normalize(fieldValue(row, 'name'));
    const bus = normalize(fieldValue(row, 'bus'));
    return bus === normalize('OS-MR 825') || name.includes('strotmann');
  }

  async function prepareStructure() {
    if (!dutyRows('1743').length) {
      const legacy = dutyRows('1941').find(looksLikeLegacy1743);
      if (legacy) await changeDuty(legacy, '1743');
    }

    if (dutyRows('1941').length < 2) {
      const old3002 = dutyRows('3002').find(looksLikeLegacyEarly1941) || dutyRows('3002')[0];
      if (old3002) await changeDuty(old3002, '1941');
    }

    if (!dutyRows('1341').length) await addDutyRow('1341');
    if (!dutyRows('1743').length) await addDutyRow('1743');
    while (dutyRows('1941').length < 2) {
      const created = await addDutyRow('1941');
      if (!created) break;
    }
  }

  function identify1941Rows() {
    const candidates = dutyRows('1941');
    if (candidates.length < 2) return { early: candidates[0] || null, late: candidates[1] || null };

    let early = candidates.find((row) => fieldValue(row, 'start') === SPECIALS['1941'].early.start)
      || candidates.find((row) => normalize(fieldValue(row, 'bus')) === normalize(SPECIALS['1941'].early.bus))
      || candidates[0];
    let late = candidates.find((row) => row !== early && fieldValue(row, 'start') === SPECIALS['1941'].late.start)
      || candidates.find((row) => row !== early && normalize(fieldValue(row, 'bus')) === normalize(SPECIALS['1941'].late.bus))
      || candidates.find((row) => row !== early)
      || null;
    return { early, late };
  }

  function applyCombinedDuty(duty, row, date, forceBus) {
    if (!row) return;
    const config = SPECIALS[duty];
    const [earlyDriver, lateDriver] = assignedDrivers(duty, date);
    setField(row, 'name', `${earlyDriver} / ${lateDriver}`);
    setField(row, 'bus', config.bus, forceBus);
    setField(row, 'start', config.early.start);
    setField(row, 'end', config.late.end);
    setField(row, 'departure', '');
    setField(row, 'stop', '');
    row.dataset.dpSplitDuty = duty;
  }

  function apply1941(date, forceBus) {
    const config = SPECIALS['1941'];
    const [earlyDriver, lateDriver] = assignedDrivers('1941', date);
    const pair = identify1941Rows();

    if (pair.early) {
      setField(pair.early, 'name', earlyDriver);
      setField(pair.early, 'bus', config.early.bus, forceBus);
      setField(pair.early, 'start', config.early.start);
      setField(pair.early, 'end', config.early.end);
      setField(pair.early, 'departure', config.early.departure);
      setField(pair.early, 'stop', config.early.stop);
      pair.early.dataset.dpSplitDuty = '1941-early';
    }

    if (pair.late) {
      setField(pair.late, 'name', lateDriver);
      setField(pair.late, 'bus', config.late.bus, forceBus);
      setField(pair.late, 'start', config.late.start);
      setField(pair.late, 'end', config.late.end);
      setField(pair.late, 'departure', config.late.departure);
      setField(pair.late, 'stop', config.late.stop);
      pair.late.dataset.dpSplitDuty = '1941-late';
    }
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
      .dp-split-duty-note{margin-top:5px;padding:6px 7px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:11px;line-height:1.35;font-weight:800}
      .dp-split-duty-note button{margin-top:5px;padding:4px 7px;border:1px solid #93c5fd;border-radius:7px;background:#fff;color:#1d4ed8;font:inherit;font-weight:900;cursor:pointer}
      .dp-split-shift-badge{display:inline-block;margin-top:5px;padding:4px 7px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:900}
      .dp-split-preview-row{min-height:94px}
      .dp-split-preview-second{margin-top:8px}
      @media print{.dp-split-duty-note,.dp-split-shift-badge{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function noteHtml(duty, date) {
    const config = SPECIALS[duty];
    const [earlyDriver, lateDriver] = assignedDrivers(duty, date);
    return `<div><strong>Früh:</strong> ${earlyDriver} · ${config.early.start}–${config.early.end}</div><div><strong>Spät:</strong> ${lateDriver} · ${config.late.start}–${config.late.end}</div><button type="button" class="dp-split-swap" data-duty="${duty}">Früh-/Spätschicht tauschen</button>`;
  }

  function decorateRows(date) {
    rows().forEach((row) => {
      row.querySelectorAll('.dp-split-duty-note,.dp-split-shift-badge').forEach((element) => element.remove());
      const duty = fieldValue(row, 'duty');
      const nameCell = row.cells?.[0];
      if (!nameCell) return;

      if (duty === '1341' || duty === '1743') {
        const note = document.createElement('div');
        note.className = 'dp-split-duty-note';
        note.innerHTML = noteHtml(duty, date);
        nameCell.appendChild(note);
        return;
      }

      if (duty === '1941') {
        const isLate = fieldValue(row, 'start') === SPECIALS['1941'].late.start;
        const badge = document.createElement('div');
        badge.className = 'dp-split-shift-badge';
        badge.textContent = isLate ? 'Spätschicht 14:49–21:16' : 'Frühschicht 05:35–15:00';
        nameCell.appendChild(badge);

        if (!isLate) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'dp-split-swap';
          button.dataset.duty = '1941';
          button.textContent = 'Früh-/Spätschicht tauschen';
          button.style.cssText = 'display:block;margin-top:5px;padding:4px 7px;border:1px solid #93c5fd;border-radius:7px;background:#fff;color:#1d4ed8;font-size:11px;font-weight:900;cursor:pointer';
          nameCell.appendChild(button);
        }
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

  function updateBanner() {
    const banner = document.getElementById('dpNiHolidayDutyStatus');
    if (!banner) return;
    if (!banner.textContent.includes('1341, 1941 und 1743')) {
      banner.textContent += ' Die geteilten Dienste 1341, 1941 und 1743 sind ebenfalls gültig.';
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
      setStatus('Die Dienste 1341, 1941 und 1743 sind gültig. Früh- und Spätschichten werden wochenweise zwischen den Fahrern gewechselt.', 'ok');
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
    if (!body) return;
    if (observer && observedBody === body) return;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => schedule(300));
    observer.observe(body, { childList: true, subtree: true });
  }

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.('#dpDailyPlanRows .dp-daily-duty-select');
    if (select && SPECIALS[select.value]) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const row = select.closest('tr[data-row-id]');
      const duty = select.value;
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
      setStatus(`Dienst ${duty} wurde als gültiger geteilter Dienst übernommen.`, 'ok');
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
      setStatus(`Die Früh- und Spätschicht von Dienst ${duty} wurde für dieses Datum getauscht.`, 'ok');
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
    if (event.target.matches?.('#dpDailyPlanRows input[data-field="duty"],#dpDailyPlanRows input[data-field="name"]')) {
      schedule(500);
    }
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
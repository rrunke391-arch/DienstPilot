(() => {
  'use strict';

  if (window.__dienstpilotDailyDutyDutySelect) return;
  window.__dienstpilotDailyDutyDutySelect = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const STYLE_ID = 'dpDailyDutyDutySelectStyle';
  const FREE_VALUE = 'Frei';

  const HOLIDAY_PERIODS = [
    ['2025-10-13', '2025-10-25'],
    ['2025-12-22', '2026-01-05'],
    ['2026-02-02', '2026-02-03'],
    ['2026-03-23', '2026-04-07'],
    ['2026-05-15', '2026-05-15'],
    ['2026-05-26', '2026-05-26'],
    ['2026-07-02', '2026-08-12'],
    ['2026-10-12', '2026-10-24'],
    ['2026-12-23', '2027-01-09'],
    ['2027-02-01', '2027-02-02'],
    ['2027-03-22', '2027-04-03'],
    ['2027-05-07', '2027-05-07'],
    ['2027-05-18', '2027-05-18'],
    ['2027-07-08', '2027-08-18'],
    ['2027-10-16', '2027-10-30'],
    ['2027-12-23', '2028-01-08']
  ];

  const SCHOOL_DUTIES = [
    '3001', '3003', '3004', '3005', '3006', '3007', '3008', '3009', '3010',
    '3011', '3012', '3013', '3014', '3015', '3016', '3017', '3018', '3019',
    '3020', '3021', '3022', '3023', '3024', '3025', '3041', '3042', '3095'
  ];

  const HOLIDAY_DUTIES = [
    { duty: '3031', start: '05:03', end: '13:21', departure: '05:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3032', start: '04:45', end: '11:39', departure: '05:26', stop: 'Osnabrück, HBF' },
    { duty: '3033', start: '05:43', end: '12:21', departure: '06:16', stop: 'Buer, Schulzentrum' },
    { duty: '3034', start: '05:47', end: '15:39', departure: '06:12', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '3035', start: '05:51', end: '17:21', departure: '06:18', stop: 'Westerhausen, Vinkenaue' },
    { duty: '3036', start: '06:03', end: '18:04', departure: '06:27', stop: 'Gesmold, Schimmweg' },
    { duty: '3037', start: '06:03', end: '16:05', departure: '06:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3038', start: '06:03', end: '12:06', departure: '06:28', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '3039', start: '06:42', end: '19:21', departure: '07:15', stop: 'Bruchmühlen, Schule' },
    { duty: '3040', start: '07:20', end: '19:33', departure: '07:45', stop: 'Melle, ZOB' },
    { duty: '3041', start: '08:20', end: '19:41', departure: '08:45', stop: 'Melle, ZOB' },
    { duty: '3042', start: '11:20', end: '21:05', departure: '11:45', stop: 'Melle, ZOB' },
    { duty: '3043', start: '12:03', end: '20:21', departure: '12:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3044', start: '12:20', end: '22:03', departure: '12:45', stop: 'Melle, ZOB' },
    { duty: '3045', start: '13:03', end: '21:50', departure: '13:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3095', start: '20:20', end: '04:05', departure: '20:45', stop: 'Melle, ZOB' }
  ];

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isFree(value) {
    return normalize(value) === 'frei';
  }

  function currentRole() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
      return normalize(user?.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalize(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function permitted() {
    return [
      'geschaftsleitung', 'geschaeftsleitung',
      'disposition', 'disponent', 'disponentin'
    ].includes(currentRole());
  }

  function selectedDate() {
    return String(document.getElementById('dpDailyPlanDate')?.value || '');
  }

  function dayMode(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'school';
    const weekday = new Date(`${iso}T12:00:00`).getDay();
    if (weekday === 0 || weekday === 6) return 'weekend';
    return HOLIDAY_PERIODS.some(([start, end]) => iso >= start && iso <= end)
      ? 'holiday'
      : 'school';
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dpDailyPlanRows .dp-daily-duty-select{
        width:100%;box-sizing:border-box;padding:8px 30px 8px 9px;
        border:1px solid #2563eb;border-radius:9px;background:#fff;
        color:#0f172a;font:inherit;font-weight:800;cursor:pointer;
      }
      #dpDailyPlanRows .dp-daily-duty-select:focus{
        outline:2px solid #2563eb;outline-offset:1px;
      }
      #dpDailyPlanRows .dp-daily-duty-select.invalid,
      #dpDailyPlanRows .dp-daily-duty-select.duplicate{
        border-color:#dc2626;background:#fff7f7;color:#991b1b;
      }
      #dpDailyPlanRows .dp-daily-duty-source{display:none!important}
      #dpDailyPlanPreview .dp-preview-free-summary{
        border-top:2px solid #111;margin-top:10px;padding-top:10px;min-height:46px;
      }
    `;
    document.head.appendChild(style);
  }

  function optionsForMode(mode) {
    if (mode === 'holiday') return [FREE_VALUE, ...HOLIDAY_DUTIES.map((entry) => entry.duty)];
    if (mode === 'school') return [FREE_VALUE, ...SCHOOL_DUTIES];

    const values = new Set([FREE_VALUE]);
    document.querySelectorAll('#dpDailyDutyList option').forEach((option) => {
      const value = String(option.value || '').trim();
      if (value) values.add(value);
    });
    SCHOOL_DUTIES.forEach((value) => values.add(value));
    HOLIDAY_DUTIES.forEach((entry) => values.add(entry.duty));
    return [...values].sort((a, b) => {
      if (isFree(a)) return -1;
      if (isFree(b)) return 1;
      return a.localeCompare(b, 'de', { numeric: true });
    });
  }

  function dutyInputs() {
    return [...document.querySelectorAll('#dpDailyPlanRows input[data-field="duty"]')];
  }

  function dutyCounts() {
    const counts = new Map();
    dutyInputs().forEach((input) => {
      const duty = String(input.value || '').trim();
      if (!duty || isFree(duty)) return;
      counts.set(duty, (counts.get(duty) || 0) + 1);
    });
    return counts;
  }

  function duplicateDuties() {
    return [...dutyCounts()].filter(([, count]) => count > 1).map(([duty]) => duty);
  }

  function usedByOtherRows(input) {
    const used = new Set();
    dutyInputs().forEach((other) => {
      if (other === input) return;
      const duty = String(other.value || '').trim();
      if (duty && !isFree(duty)) used.add(duty);
    });
    return used;
  }

  function setField(row, field, value) {
    const input = row?.querySelector(`input[data-field="${field}"]`);
    if (!input) return;
    input.value = value || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function clearFreeFields(rowId) {
    window.setTimeout(() => {
      const row = document.querySelector(`#dpDailyPlanRows tr[data-row-id="${CSS.escape(rowId)}"]`);
      if (!row) return;
      ['bus', 'start', 'end', 'departure', 'stop'].forEach((field) => setField(row, field, ''));
      scheduleFreeSummary();
    }, 80);
  }

  function fillHolidayTimes(rowId, dutyNumber) {
    const entry = HOLIDAY_DUTIES.find((item) => item.duty === dutyNumber);
    if (!entry) return;

    window.setTimeout(() => {
      const row = document.querySelector(`#dpDailyPlanRows tr[data-row-id="${CSS.escape(rowId)}"]`);
      if (!row) return;
      setField(row, 'start', entry.start);
      setField(row, 'end', entry.end);
      setField(row, 'departure', entry.departure);
      setField(row, 'stop', entry.stop);
    }, 60);
  }

  function status(text, error = false) {
    const node = document.getElementById('dpDailyPlanStatus');
    if (!node) return;
    node.textContent = text;
    node.className = `dp-daily-status ${error ? 'error' : 'ok'}`;
  }

  function freeDriverNames() {
    return dutyInputs()
      .filter((input) => isFree(input.value))
      .map((input) => input.closest('tr[data-row-id]')?.querySelector('input[data-field="name"]')?.value.trim() || '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  function renderFreeSummary() {
    const preview = document.getElementById('dpDailyPlanPreview');
    if (!preview) return false;

    preview.querySelector('.dp-preview-free-summary')?.remove();
    const previewRows = [...preview.querySelectorAll('.dp-preview-row:not(.dp-preview-free-summary)')];
    const inputs = dutyInputs();

    inputs.forEach((input, index) => {
      if (isFree(input.value)) previewRows[index]?.remove();
    });

    const names = freeDriverNames();
    if (!names.length) return true;

    const summary = document.createElement('div');
    summary.className = 'dp-preview-row dp-preview-free-summary';
    summary.style.borderTop = '2px solid #111';
    summary.style.marginTop = '3mm';
    summary.style.paddingTop = '3mm';
    summary.style.minHeight = '10mm';
    summary.innerHTML = `
      <div class="dp-preview-left"><strong>Frei</strong><span>Diese Fahrer haben frei:</span></div>
      <div class="dp-preview-middle" style="grid-column:2 / 4"><strong>${names.map(escapeHtml).join(', ')}</strong></div>
      <div class="dp-preview-right" style="display:none"></div>
    `;
    preview.appendChild(summary);
    return true;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function scheduleFreeSummary() {
    [0, 60, 180].forEach((delay) => window.setTimeout(renderFreeSummary, delay));
  }

  function markDuplicates() {
    const duplicates = new Set(duplicateDuties());
    dutyInputs().forEach((input) => {
      const duty = String(input.value || '').trim();
      const select = input.closest('td')?.querySelector('.dp-daily-duty-select');
      if (!select) return;
      const duplicated = Boolean(duty && !isFree(duty) && duplicates.has(duty));
      select.classList.toggle('duplicate', duplicated);
      if (duplicated) {
        select.title = `Dienst ${duty} ist mehrfach vergeben und muss geändert werden.`;
      } else {
        select.removeAttribute('title');
      }
    });
    return [...duplicates];
  }

  function createSelect(input, mode) {
    const cell = input.closest('td');
    const row = input.closest('tr[data-row-id]');
    if (!cell || !row) return;

    const current = String(input.value || '').trim();
    const allowed = optionsForMode(mode);
    const currentValue = isFree(current) ? FREE_VALUE : current;
    const isAllowed = !current || isFree(current) || allowed.includes(current);
    const usedElsewhere = usedByOtherRows(input);
    const available = allowed.filter((duty) => isFree(duty) || duty === currentValue || !usedElsewhere.has(duty));

    const existing = cell.querySelector('.dp-daily-duty-select');
    if (existing) existing.remove();

    const select = document.createElement('select');
    select.className = `dp-daily-duty-select${isAllowed ? '' : ' invalid'}`;
    select.dataset.mode = mode;
    select.setAttribute('aria-label', 'Dienst oder Frei auswählen');

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = mode === 'holiday'
      ? (current && !isAllowed ? `Schultagsdienst ${current} ungültig – Feriendienst oder Frei wählen` : 'Feriendienst oder Frei auswählen')
      : mode === 'school'
        ? (current && !isAllowed ? `Feriendienst ${current} ungültig – Schultagsdienst oder Frei wählen` : 'Schultagsdienst oder Frei auswählen')
        : 'Dienst oder Frei auswählen';
    select.appendChild(placeholder);

    available.forEach((duty) => {
      const option = document.createElement('option');
      option.value = duty;
      option.textContent = isFree(duty) ? 'Frei' : `Dienst ${duty}`;
      select.appendChild(option);
    });

    select.value = isAllowed ? currentValue : '';

    input.classList.add('dp-daily-duty-source');
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;

    select.addEventListener('change', () => {
      const selected = select.value;
      if (!selected) return;

      if (!isFree(selected)) {
        const duplicateInput = dutyInputs().find((other) =>
          other !== input && !isFree(other.value) && String(other.value || '').trim() === selected
        );
        if (duplicateInput) {
          const otherRow = duplicateInput.closest('tr[data-row-id]');
          const otherName = otherRow?.querySelector('input[data-field="name"]')?.value.trim();
          select.value = isAllowed ? currentValue : '';
          status(`Dienst ${selected} ist bereits${otherName ? ` an ${otherName}` : ''} vergeben. Ein Dienst darf pro Tag nur einmal vergeben werden.`, true);
          markDuplicates();
          return;
        }
      }

      const rowId = row.dataset.rowId || '';
      input.value = isFree(selected) ? FREE_VALUE : selected;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      if (isFree(selected)) {
        clearFreeFields(rowId);
        status('Frei wurde eingetragen. Der Fahrer erscheint im gedruckten Dienstplan unten in der Freiliste.');
      } else if (mode === 'holiday') {
        fillHolidayTimes(rowId, selected);
        status(`Ferien-Dienst ${selected} wurde übernommen. Zeiten und Haltestelle wurden angepasst.`);
      } else {
        status(`Dienst ${selected} wurde übernommen.`);
      }

      [0, 80, 250].forEach((delay) => window.setTimeout(install, delay));
      scheduleFreeSummary();
    });

    cell.insertBefore(select, input);
  }

  function install() {
    if (!permitted()) return false;
    addStyle();
    const mode = dayMode(selectedDate());
    const inputs = dutyInputs();
    if (!inputs.length) return false;
    inputs.forEach((input) => createSelect(input, mode));
    const duplicates = markDuplicates();
    if (duplicates.length) {
      status(`Doppelvergabe erkannt: Dienst ${duplicates.join(', ')}. Bitte vor dem Speichern korrigieren.`, true);
    }
    renderFreeSummary();
    return true;
  }

  function scheduleInstall() {
    [0, 100, 300, 800, 1600].forEach((delay) => window.setTimeout(install, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailySave')) {
      const duplicates = duplicateDuties();
      if (duplicates.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        status(`Speichern nicht möglich: Dienst ${duplicates.join(', ')} ist mehrfach vergeben.`, true);
        markDuplicates();
        return;
      }
    }

    if (event.target.closest?.('#dpDailyPrint,#dpDailyPrintA4')) renderFreeSummary();

    if (event.target.closest?.(
      '#loginButton,#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailyPlanRows [data-action]'
    )) scheduleInstall();
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.matches?.('#dpDailyPlanRows input[data-field="name"],#dpDailyPlanRows input[data-field="duty"]')) {
      scheduleFreeSummary();
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target.id === 'dpDailyPlanDate') scheduleInstall();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInstall, { once: true });
  } else {
    scheduleInstall();
  }

  window.addEventListener('pageshow', scheduleInstall);
  window.addEventListener('focus', scheduleInstall);
})();
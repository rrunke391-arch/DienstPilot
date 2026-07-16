(() => {
  'use strict';

  if (window.__dienstpilotDailyDutyDutySelect) return;
  window.__dienstpilotDailyDutyDutySelect = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const STYLE_ID = 'dpDailyDutyDutySelectStyle';

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
      #dpDailyPlanRows .dp-daily-duty-select.invalid{
        border-color:#dc2626;background:#fff7f7;color:#991b1b;
      }
      #dpDailyPlanRows .dp-daily-duty-source{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function optionsForMode(mode) {
    if (mode === 'holiday') return HOLIDAY_DUTIES.map((entry) => entry.duty);
    if (mode === 'school') return [...SCHOOL_DUTIES];

    const values = new Set();
    document.querySelectorAll('#dpDailyDutyList option').forEach((option) => {
      const value = String(option.value || '').trim();
      if (value) values.add(value);
    });
    SCHOOL_DUTIES.forEach((value) => values.add(value));
    HOLIDAY_DUTIES.forEach((entry) => values.add(entry.duty));
    return [...values].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  }

  function setField(row, field, value) {
    const input = row?.querySelector(`input[data-field="${field}"]`);
    if (!input) return;
    input.value = value || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
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

  function createSelect(input, mode) {
    const cell = input.closest('td');
    const row = input.closest('tr[data-row-id]');
    if (!cell || !row) return;

    const current = String(input.value || '').trim();
    const allowed = optionsForMode(mode);
    const isAllowed = !current || allowed.includes(current);

    const existing = cell.querySelector('.dp-daily-duty-select');
    if (existing) existing.remove();

    const select = document.createElement('select');
    select.className = `dp-daily-duty-select${isAllowed ? '' : ' invalid'}`;
    select.dataset.mode = mode;
    select.setAttribute('aria-label', 'Dienst auswählen');

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = mode === 'holiday'
      ? (current && !isAllowed ? `Schultagsdienst ${current} ungültig – Feriendienst wählen` : 'Feriendienst auswählen')
      : mode === 'school'
        ? (current && !isAllowed ? `Feriendienst ${current} ungültig – Schultagsdienst wählen` : 'Schultagsdienst auswählen')
        : 'Dienst auswählen';
    select.appendChild(placeholder);

    allowed.forEach((duty) => {
      const option = document.createElement('option');
      option.value = duty;
      option.textContent = `Dienst ${duty}`;
      select.appendChild(option);
    });

    select.value = isAllowed ? current : '';

    input.classList.add('dp-daily-duty-source');
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;

    select.addEventListener('change', () => {
      const selected = select.value;
      if (!selected) return;
      const rowId = row.dataset.rowId || '';
      input.value = selected;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      if (mode === 'holiday') {
        fillHolidayTimes(rowId, selected);
        status(`Ferien-Dienst ${selected} wurde übernommen. Zeiten und Haltestelle wurden angepasst.`);
      } else {
        status(`Dienst ${selected} wurde übernommen.`);
      }

      [0, 80, 250].forEach((delay) => window.setTimeout(install, delay));
    });

    cell.insertBefore(select, input);
  }

  function install() {
    if (!permitted()) return false;
    addStyle();
    const mode = dayMode(selectedDate());
    const inputs = [...document.querySelectorAll('#dpDailyPlanRows input[data-field="duty"]')];
    if (!inputs.length) return false;
    inputs.forEach((input) => createSelect(input, mode));
    return true;
  }

  function scheduleInstall() {
    [0, 100, 300, 800, 1600].forEach((delay) => window.setTimeout(install, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.(
      '#loginButton,#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailyPlanRows [data-action]'
    )) scheduleInstall();
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
(() => {
  'use strict';

  if (window.__dienstpilotNiedersachsenHolidayDutyPlan) return;
  window.__dienstpilotNiedersachsenHolidayDutyPlan = true;

  const HOLIDAY_PERIODS = [
    ['2025-10-13', '2025-10-25', 'Herbstferien'],
    ['2025-12-22', '2026-01-05', 'Weihnachtsferien'],
    ['2026-02-02', '2026-02-03', 'Winterferien'],
    ['2026-03-23', '2026-04-07', 'Osterferien'],
    ['2026-05-15', '2026-05-15', 'Ferientag'],
    ['2026-05-26', '2026-05-26', 'Ferientag'],
    ['2026-07-02', '2026-08-12', 'Sommerferien'],
    ['2026-10-12', '2026-10-24', 'Herbstferien'],
    ['2026-12-23', '2027-01-09', 'Weihnachtsferien'],
    ['2027-02-01', '2027-02-02', 'Winterferien'],
    ['2027-03-22', '2027-04-03', 'Osterferien'],
    ['2027-05-07', '2027-05-07', 'Ferientag'],
    ['2027-05-18', '2027-05-18', 'Ferientag'],
    ['2027-07-08', '2027-08-18', 'Sommerferien'],
    ['2027-10-16', '2027-10-30', 'Herbstferien'],
    ['2027-12-23', '2028-01-08', 'Weihnachtsferien']
  ];

  const SCHOOL_DUTIES = new Set([
    '3001', '3003', '3004', '3005', '3006', '3007', '3008', '3009', '3010',
    '3011', '3012', '3013', '3014', '3015', '3016', '3017', '3018', '3019',
    '3020', '3021', '3022', '3023', '3024', '3025'
  ]);

  const HOLIDAY_DUTIES = [
    { duty: '3031', start: '05:03', end: '13:21', departure: '05:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3032', start: '04:45', end: '11:39', departure: '05:26', stop: 'Osnabrück, HBF' },
    { duty: '3033', start: '05:43', end: '11:04', departure: '06:16', stop: 'Buer, Schulzentrum' },
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

  const HOLIDAY_EXCLUSIVE = new Set([
    '3031', '3032', '3033', '3034', '3035', '3036', '3037', '3038', '3039',
    '3040', '3043', '3044', '3045'
  ]);

  let forwardingSchoolInsert = false;
  let applyingTemplate = false;

  function normalizeDuty(value) {
    return String(value || '').trim();
  }

  function holidayInfo(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
    const match = HOLIDAY_PERIODS.find(([start, end]) => iso >= start && iso <= end);
    return match ? { start: match[0], end: match[1], name: match[2] } : null;
  }

  function selectedDailyDate() {
    return String(document.getElementById('dpDailyPlanDate')?.value || '');
  }

  function selectedAssignmentDate() {
    return String(document.getElementById('dpAssignDateV2')?.value || '');
  }

  function dailyStatus(text, error = false) {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = `dp-daily-status ${error ? 'error' : 'ok'}`;
  }

  function ensureStyle() {
    if (document.getElementById('dpNiHolidayDutyStyle')) return;
    const style = document.createElement('style');
    style.id = 'dpNiHolidayDutyStyle';
    style.textContent = `
      #dpNiHolidayDutyStatus{padding:10px 12px;border-radius:12px;font-weight:900;line-height:1.35}
      #dpNiHolidayDutyStatus.school{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}
      #dpNiHolidayDutyStatus.holiday{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}
      #dpDutyAssignmentV2 .dp-ni-assignment-note{margin-top:10px;padding:9px 11px;border-radius:11px;font-size:12px;font-weight:900}
      #dpDutyAssignmentV2 .dp-ni-assignment-note.school{background:#eff6ff;color:#1d4ed8}
      #dpDutyAssignmentV2 .dp-ni-assignment-note.holiday{background:#f0fdf4;color:#166534}
    `;
    document.head.appendChild(style);
  }

  function updateDailyMode() {
    ensureStyle();
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return false;

    let banner = document.getElementById('dpNiHolidayDutyStatus');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dpNiHolidayDutyStatus';
      status.insertAdjacentElement('afterend', banner);
    }

    const date = selectedDailyDate();
    const holiday = holidayInfo(date);
    const insertButton = document.getElementById('dpDailyInsertDefaults');
    if (holiday) {
      banner.className = 'holiday';
      banner.textContent = `Niedersachsen ${holiday.name}: Ferien-Dienste 3031 bis 3045 verwenden. Schultagsdienste 3001 bis 3025 sind an diesem Tag nicht gültig.`;
      if (insertButton) insertButton.textContent = 'Ferien-Dienste einfügen';
    } else {
      banner.className = 'school';
      banner.textContent = 'Schultag in Niedersachsen: Schultagsdienste 3001 bis 3025 verwenden. Reine Ferien-Dienste sind nicht gültig.';
      if (insertButton) insertButton.textContent = 'Schultagsdienste einfügen';
    }
    updateDutyLists();
    return true;
  }

  function updateAssignmentMode() {
    ensureStyle();
    const panel = document.getElementById('dpDutyAssignmentV2');
    if (!panel) return false;

    let note = panel.querySelector('.dp-ni-assignment-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'dp-ni-assignment-note';
      panel.querySelector('.dp-a-grid')?.insertAdjacentElement('afterend', note);
    }

    const holiday = holidayInfo(selectedAssignmentDate());
    note.className = `dp-ni-assignment-note ${holiday ? 'holiday' : 'school'}`;
    note.textContent = holiday
      ? `Niedersachsen ${holiday.name}: Bitte einen Ferien-Dienst 3031 bis 3045 auswählen.`
      : 'Schultag in Niedersachsen: Bitte einen Schultagsdienst auswählen.';
    updateDutyLists();
    return true;
  }

  function replaceOptions(list, allowedValues, additions) {
    if (!list) return;
    [...list.querySelectorAll('option')].forEach((option) => {
      const duty = normalizeDuty(option.value);
      if (duty && !allowedValues(duty)) option.remove();
    });
    const existing = new Set([...list.querySelectorAll('option')].map((option) => normalizeDuty(option.value)));
    additions.forEach((duty) => {
      if (existing.has(duty.duty)) return;
      const option = document.createElement('option');
      option.value = duty.duty;
      list.appendChild(option);
    });
  }

  function updateDutyLists() {
    const dailyHoliday = Boolean(holidayInfo(selectedDailyDate()));
    const assignmentHoliday = Boolean(holidayInfo(selectedAssignmentDate()));

    replaceOptions(
      document.getElementById('dpDailyDutyList'),
      (duty) => dailyHoliday ? !SCHOOL_DUTIES.has(duty) : !HOLIDAY_EXCLUSIVE.has(duty),
      dailyHoliday ? HOLIDAY_DUTIES : []
    );

    replaceOptions(
      document.getElementById('dpAssignDutiesV2'),
      (duty) => assignmentHoliday ? !SCHOOL_DUTIES.has(duty) : !HOLIDAY_EXCLUSIVE.has(duty),
      assignmentHoliday ? HOLIDAY_DUTIES : []
    );
  }

  function rowDuty(row) {
    return normalizeDuty(row?.querySelector('input[data-field="duty"]')?.value);
  }

  function removeRows(predicate) {
    let safety = 0;
    while (safety < 100) {
      safety += 1;
      const row = [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')]
        .find((candidate) => predicate(rowDuty(candidate)));
      if (!row) break;
      const deleteButton = row.querySelector('[data-action="delete"]');
      if (!deleteButton) break;
      deleteButton.click();
    }
  }

  function dispatchInput(input, value) {
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function addHolidayRow(duty) {
    document.getElementById('dpDailyAddRow')?.click();
    let row = [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')].at(-1);
    if (!row) return;

    dispatchInput(row.querySelector('input[data-field="duty"]'), duty.duty);
    row = [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')].at(-1);
    if (!row) return;

    dispatchInput(row.querySelector('input[data-field="start"]'), duty.start);
    dispatchInput(row.querySelector('input[data-field="end"]'), duty.end);
    dispatchInput(row.querySelector('input[data-field="departure"]'), duty.departure);
    dispatchInput(row.querySelector('input[data-field="stop"]'), duty.stop);
  }

  function applyHolidayTemplate() {
    if (applyingTemplate) return;
    applyingTemplate = true;
    try {
      removeRows((duty) => SCHOOL_DUTIES.has(duty));
      const existing = new Set(
        [...document.querySelectorAll('#dpDailyPlanRows input[data-field="duty"]')]
          .map((input) => normalizeDuty(input.value))
      );
      HOLIDAY_DUTIES.forEach((duty) => {
        if (!existing.has(duty.duty)) {
          addHolidayRow(duty);
          existing.add(duty.duty);
        }
      });
      dailyStatus('Niedersachsen-Ferienvorlage wurde eingefügt. Schultagsdienste wurden entfernt. Bitte Fahrer und Kennzeichen zuordnen und anschließend speichern.');
      window.dispatchEvent(new Event('focus'));
    } finally {
      applyingTemplate = false;
    }
  }

  function applySchoolTemplate(button) {
    removeRows((duty) => HOLIDAY_EXCLUSIVE.has(duty));
    forwardingSchoolInsert = true;
    try {
      button.click();
    } finally {
      forwardingSchoolInsert = false;
    }
    dailyStatus('Schultagsvorlage wurde eingefügt. Reine Ferien-Dienste wurden entfernt.');
  }

  function holidayDuty(number) {
    return HOLIDAY_DUTIES.find((entry) => entry.duty === normalizeDuty(number));
  }

  function fillAssignmentHolidayTimes() {
    const date = selectedAssignmentDate();
    if (!holidayInfo(date)) return;
    const entry = holidayDuty(document.getElementById('dpAssignDutyV2')?.value);
    if (!entry) return;
    const start = document.getElementById('dpAssignStartV2');
    const end = document.getElementById('dpAssignEndV2');
    if (start) start.value = entry.start;
    if (end) end.value = entry.end;
  }

  function validateDutyInput(input, date, context) {
    const duty = normalizeDuty(input.value);
    if (!duty) return true;
    const holiday = Boolean(holidayInfo(date));
    const invalid = holiday ? SCHOOL_DUTIES.has(duty) : HOLIDAY_EXCLUSIVE.has(duty);
    if (!invalid) return true;

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const text = holiday
      ? `Dienst ${duty} ist in den niedersächsischen Ferien nicht gültig. Bitte einen Ferien-Dienst 3031 bis 3045 wählen.`
      : `Dienst ${duty} ist nur in den niedersächsischen Ferien gültig.`;
    if (context === 'daily') dailyStatus(text, true);
    else window.alert(text);
    return false;
  }

  window.addEventListener('click', (event) => {
    const insertButton = event.target.closest?.('#dpDailyInsertDefaults');
    if (insertButton && !forwardingSchoolInsert) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (holidayInfo(selectedDailyDate())) applyHolidayTemplate();
      else applySchoolTemplate(insertButton);
      return;
    }

    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDutyAssignmentV2,#loginButton')) {
      [0, 100, 350, 900].forEach((delay) => window.setTimeout(() => {
        updateDailyMode();
        updateAssignmentMode();
      }, delay));
    }
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.id === 'dpAssignDutyV2') fillAssignmentHolidayTimes();
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'dpDailyPlanDate') {
      updateDailyMode();
      return;
    }
    if (event.target.id === 'dpAssignDateV2') {
      updateAssignmentMode();
      fillAssignmentHolidayTimes();
      return;
    }
    if (event.target.matches?.('#dpDailyPlanRows input[data-field="duty"]')) {
      validateDutyInput(event.target, selectedDailyDate(), 'daily');
      return;
    }
    if (event.target.id === 'dpAssignDutyV2') {
      if (validateDutyInput(event.target, selectedAssignmentDate(), 'assignment')) fillAssignmentHolidayTimes();
    }
  }, true);

  function install() {
    updateDailyMode();
    updateAssignmentMode();
  }

  [0, 150, 500, 1200, 2600].forEach((delay) => window.setTimeout(install, delay));
  window.addEventListener('pageshow', install);
  window.addEventListener('focus', install);
})();
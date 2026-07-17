(() => {
  'use strict';

  if (window.__dienstpilotHolidayExtraDutiesV3) return;
  window.__dienstpilotHolidayExtraDutiesV3 = true;

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

  const EXTRA_DUTIES = [
    {
      duty: '1341', legacyName: 'A.Morzsa / M.Al Dabbah', bus: 'OS-CL 916',
      start: '05:13', end: '23:38', departure: '', stop: '',
      splitShifts: [
        { label: 'Früh', start: '05:13', end: '14:21' },
        { label: 'Spät', start: '14:04', end: '23:38' }
      ]
    },
    {
      duty: '1743', legacyName: 'M.Eggern / S.Yasatemur', bus: 'OS-AX 716',
      start: '06:05', end: '00:50', departure: '', stop: '',
      splitShifts: [
        { label: 'Früh', start: '06:05', end: '15:17' },
        { label: 'Spät', start: '14:57', end: '00:50' }
      ]
    },
    {
      duty: '1941', legacyName: 'C.Strotmann / M.Entrup', bus: 'OS-MR 825 / OS-RE 224',
      start: '05:35', end: '21:49', departure: '15:24', stop: 'Bissendorf, Werries',
      splitShifts: [
        { label: 'Früh', start: '05:35', end: '14:29', bus: 'OS-MR 825' },
        { label: 'Spät', start: '14:09', end: '21:49', bus: 'OS-RE 224', departure: '15:24', stop: 'Bissendorf, Werries' }
      ]
    },
    {
      duty: 'Einsatzwagen', fixedName: 'Einsatzwagen',
      bus: 'OS-QS 519', start: '', end: '', departure: '', stop: ''
    }
  ];

  const EXTRA_VALUES = new Set(EXTRA_DUTIES.map((entry) => entry.duty));
  const SPLIT_VALUES = new Set(['1341', '1743', '1941']);
  const autoReconciledDates = new Set();

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function selectedDate(id) {
    return String(document.getElementById(id)?.value || '');
  }

  function isHoliday(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const day = new Date(`${iso}T12:00:00`).getDay();
    if (day === 0 || day === 6) return false;
    return HOLIDAY_PERIODS.some(([start, end]) => iso >= start && iso <= end);
  }

  function setInput(row, field, value) {
    const input = row?.querySelector(`input[data-field="${field}"]`);
    if (!input) return;
    input.value = value || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function findRow(rowId) {
    const escaped = window.CSS && typeof CSS.escape === 'function' ? CSS.escape(rowId) : String(rowId || '');
    return document.querySelector(`#dpDailyPlanRows tr[data-row-id="${escaped}"]`);
  }

  function rowDuty(row) {
    return String(row?.querySelector('input[data-field="duty"]')?.value || '').trim();
  }

  function currentDuties() {
    return [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')]
      .map(rowDuty)
      .filter(Boolean);
  }

  function addOption(list, value) {
    if (!list || [...list.options].some((option) => option.value === value)) return;
    const option = document.createElement('option');
    option.value = value;
    list.appendChild(option);
  }

  function updateNotices(dailyHoliday, assignmentHoliday) {
    if (dailyHoliday) {
      const banner = document.getElementById('dpNiHolidayDutyStatus');
      if (banner) {
        banner.textContent = 'Niedersachsen-Ferien: Dienste 3031 bis 3045, 3095, 1341, 1743, 1941 und Einsatzwagen verwenden. Die Fahrer werden frei zugeteilt.';
      }
    }
    if (assignmentHoliday) {
      const note = document.querySelector('#dpDutyAssignmentV2 .dp-ni-assignment-note');
      if (note) note.textContent = 'Niedersachsen-Ferien: Ferien-Dienst auswählen und einem beliebigen Fahrer zuweisen.';
    }
  }

  function updateLists() {
    const dailyHoliday = isHoliday(selectedDate('dpDailyPlanDate'));
    const assignmentHoliday = isHoliday(selectedDate('dpAssignDateV2'));
    const dailyList = document.getElementById('dpDailyDutyList');
    const assignmentList = document.getElementById('dpAssignDutiesV2');

    [dailyList, assignmentList].forEach((list, index) => {
      if (!list) return;
      const allowAllExtras = index === 0 ? dailyHoliday : assignmentHoliday;
      [...list.options].forEach((option) => {
        if (!allowAllExtras && EXTRA_VALUES.has(option.value) && !SPLIT_VALUES.has(option.value)) option.remove();
      });
      EXTRA_DUTIES.forEach((entry) => {
        if (allowAllExtras || SPLIT_VALUES.has(entry.duty)) addOption(list, entry.duty);
      });
    });
    updateNotices(dailyHoliday, assignmentHoliday);
  }

  function updateDriverField(row, entry) {
    const input = row?.querySelector('input[data-field="name"]');
    if (!input) return;

    const current = String(input.value || '').trim();
    if (entry.legacyName && normalize(current) === normalize(entry.legacyName)) {
      setInput(row, 'name', '');
      return;
    }
    if (entry.fixedName && !current) setInput(row, 'name', entry.fixedName);
  }

  function writeEntryFields(rowId, entry) {
    const row = findRow(rowId);
    if (!row) return;
    updateDriverField(row, entry);
    setInput(row, 'bus', entry.bus);
    setInput(row, 'start', entry.start);
    setInput(row, 'end', entry.end);
    setInput(row, 'departure', entry.departure);
    setInput(row, 'stop', entry.stop);
  }

  function applyEntry(row, entry) {
    if (!row) return;
    const rowId = row.dataset.rowId || '';
    if (!rowId) return;

    if (rowDuty(row) !== entry.duty) {
      setInput(row, 'duty', entry.duty);
      [80, 220, 450].forEach((delay) => window.setTimeout(() => writeEntryFields(rowId, entry), delay));
    } else {
      writeEntryFields(rowId, entry);
      window.setTimeout(() => writeEntryFields(rowId, entry), 160);
    }
  }

  function createRow(entry) {
    document.getElementById('dpDailyAddRow')?.click();
    const row = [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')].at(-1);
    applyEntry(row, entry);
  }

  function reconcileHolidayRows() {
    const date = selectedDate('dpDailyPlanDate');
    if (!isHoliday(date)) return;

    const Einsatzwagen = EXTRA_DUTIES.find((entry) => entry.duty === 'Einsatzwagen');
    const row = [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')]
      .find((candidate) => rowDuty(candidate) === 'Einsatzwagen');
    if (row) applyEntry(row, Einsatzwagen);
    else createRow(Einsatzwagen);

    autoReconciledDates.add(date);
    const status = document.getElementById('dpDailyPlanStatus');
    if (status) {
      status.textContent = 'Ferien-Sonderdienste sind hinterlegt. 1341, 1743 und 1941 enthalten jeweils Früh- und Spätschicht.';
      status.className = 'dp-daily-status ok';
    }
    window.dispatchEvent(new Event('focus'));
  }

  function maybeReconcileExistingPlan() {
    const date = selectedDate('dpDailyPlanDate');
    if (!isHoliday(date) || autoReconciledDates.has(date)) return;
    const duties = currentDuties();
    const hasHolidayPlan = duties.some((duty) => /^30(?:3[1-9]|4[0-5])$/.test(duty) || duty === '3095');
    if (hasHolidayPlan) reconcileHolidayRows();
  }

  function fillAssignmentTimes() {
    const duty = String(document.getElementById('dpAssignDutyV2')?.value || '').trim();
    const entry = EXTRA_DUTIES.find((item) => item.duty === duty);
    if (!entry) return;
    const firstShift = entry.splitShifts?.[0];
    const start = document.getElementById('dpAssignStartV2');
    const end = document.getElementById('dpAssignEndV2');
    if (start) start.value = firstShift?.start || entry.start;
    if (end) end.value = firstShift?.end || entry.end;
  }

  function scheduleLists() {
    [0, 120, 350, 900].forEach((delay) => window.setTimeout(updateLists, delay));
    window.setTimeout(maybeReconcileExistingPlan, 1100);
  }

  window.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyInsertDefaults') && isHoliday(selectedDate('dpDailyPlanDate'))) {
      [100, 350, 900].forEach((delay) => window.setTimeout(reconcileHolidayRows, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target.id === 'dpDailyPlanDate' || event.target.id === 'dpAssignDateV2') scheduleLists();
    if (event.target.id === 'dpAssignDutyV2') fillAssignmentTimes();
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.id === 'dpAssignDutyV2') fillAssignmentTimes();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDutyAssignmentV2,#loginButton')) scheduleLists();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleLists, { once: true });
  else scheduleLists();
  window.addEventListener('pageshow', scheduleLists);
  window.addEventListener('focus', scheduleLists);
})();
(() => {
  'use strict';

  if (window.__dienstpilotHolidayExtraDuties) return;
  window.__dienstpilotHolidayExtraDuties = true;

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
      duty: '1341',
      name: 'A.Morzsa / M.Al Dabbah',
      bus: 'OS-CL 916',
      start: '05:13',
      end: '23:38',
      departure: '',
      stop: ''
    },
    {
      duty: '1743',
      name: 'M.Eggern / S.Yasatemur',
      bus: 'OS-AX 716',
      start: '06:05',
      end: '00:50',
      departure: '',
      stop: ''
    },
    {
      duty: '1941',
      name: 'C.Strotmann / M.Entrup',
      bus: 'OS-MR 825 / OS-RE 224',
      start: '05:35',
      end: '21:16',
      departure: '15:24',
      stop: 'Bissendorf, Werries'
    },
    {
      duty: 'Einsatzwagen',
      name: 'Einsatzwagen',
      bus: 'OS-QS 519',
      start: '',
      end: '',
      departure: '',
      stop: ''
    }
  ];

  const EXTRA_VALUES = new Set(EXTRA_DUTIES.map((entry) => entry.duty));

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

  function rowDuty(row) {
    return String(row?.querySelector('input[data-field="duty"]')?.value || '').trim();
  }

  function addOption(list, value) {
    if (!list || [...list.options].some((option) => option.value === value)) return;
    const option = document.createElement('option');
    option.value = value;
    list.appendChild(option);
  }

  function updateLists() {
    const dailyHoliday = isHoliday(selectedDate('dpDailyPlanDate'));
    const assignmentHoliday = isHoliday(selectedDate('dpAssignDateV2'));

    const dailyList = document.getElementById('dpDailyDutyList');
    const assignmentList = document.getElementById('dpAssignDutiesV2');

    [dailyList, assignmentList].forEach((list, index) => {
      if (!list) return;
      const allowExtras = index === 0 ? dailyHoliday : assignmentHoliday;
      [...list.options].forEach((option) => {
        if (!allowExtras && EXTRA_VALUES.has(option.value)) option.remove();
      });
      if (allowExtras) EXTRA_DUTIES.forEach((entry) => addOption(list, entry.duty));
    });
  }

  function createRow(entry) {
    document.getElementById('dpDailyAddRow')?.click();
    const row = [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')].at(-1);
    if (!row) return;
    setInput(row, 'name', entry.name);
    setInput(row, 'duty', entry.duty);
    setInput(row, 'bus', entry.bus);
    setInput(row, 'start', entry.start);
    setInput(row, 'end', entry.end);
    setInput(row, 'departure', entry.departure);
    setInput(row, 'stop', entry.stop);
  }

  function updateRow(row, entry) {
    setInput(row, 'name', entry.name);
    setInput(row, 'duty', entry.duty);
    setInput(row, 'bus', entry.bus);
    setInput(row, 'start', entry.start);
    setInput(row, 'end', entry.end);
    setInput(row, 'departure', entry.departure);
    setInput(row, 'stop', entry.stop);
  }

  function removeObsoleteHolidayRows() {
    [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')].forEach((row) => {
      if (rowDuty(row) !== '3002') return;
      row.querySelector('[data-action="delete"]')?.click();
    });
  }

  function reconcileHolidayRows() {
    if (!isHoliday(selectedDate('dpDailyPlanDate'))) return;

    removeObsoleteHolidayRows();
    EXTRA_DUTIES.forEach((entry) => {
      const row = [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')]
        .find((candidate) => rowDuty(candidate) === entry.duty);
      if (row) updateRow(row, entry);
      else createRow(entry);
    });

    const status = document.getElementById('dpDailyPlanStatus');
    if (status) {
      status.textContent = 'Ferien-Sonderdienste 1341, 1743, 1941 und Einsatzwagen wurden ergänzt.';
      status.className = 'dp-daily-status ok';
    }
    window.dispatchEvent(new Event('focus'));
  }

  function fillAssignmentTimes() {
    if (!isHoliday(selectedDate('dpAssignDateV2'))) return;
    const duty = String(document.getElementById('dpAssignDutyV2')?.value || '').trim();
    const entry = EXTRA_DUTIES.find((item) => item.duty === duty);
    if (!entry) return;
    const start = document.getElementById('dpAssignStartV2');
    const end = document.getElementById('dpAssignEndV2');
    if (start) start.value = entry.start;
    if (end) end.value = entry.end;
  }

  function scheduleLists() {
    [0, 120, 350, 900].forEach((delay) => window.setTimeout(updateLists, delay));
  }

  window.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyInsertDefaults') && isHoliday(selectedDate('dpDailyPlanDate'))) {
      [80, 250, 700].forEach((delay) => window.setTimeout(reconcileHolidayRows, delay));
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleLists, { once: true });
  } else {
    scheduleLists();
  }
  window.addEventListener('pageshow', scheduleLists);
  window.addEventListener('focus', scheduleLists);
})();
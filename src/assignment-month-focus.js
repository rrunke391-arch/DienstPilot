(() => {
  'use strict';

  if (window.__dienstpilotAssignmentMonthFocusV1) return;
  window.__dienstpilotAssignmentMonthFocusV1 = true;

  const STORAGE_KEY = 'dienstpilot_selected_overview_month_v3';

  function validDate(value) {
    return /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(String(value || ''));
  }

  function focusMonth(date) {
    if (!validDate(date)) return;
    const month = String(date).slice(0, 7);

    try { sessionStorage.setItem(STORAGE_KEY, month); } catch {}

    const picker = document.getElementById('monthPicker');
    if (picker) {
      picker.value = month;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      picker.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const clickMonthButton = () => {
      const button = document.querySelector(`#dpDirectMonthSelector .dp-direct-month-button[data-month="${month}"]`);
      if (button) button.click();
    };

    [50, 180, 450, 900].forEach((delay) => window.setTimeout(clickMonthButton, delay));
  }

  window.addEventListener('dienstpilot:assigned-plan-saved', (event) => {
    const duties = Array.isArray(event.detail?.plan?.duties) ? event.detail.plan.duties : [];
    const assigned = [...duties]
      .filter((row) => validDate(row?.date))
      .sort((a, b) => String(b.assignedAt || '').localeCompare(String(a.assignedAt || '')))[0];
    if (assigned?.date) focusMonth(assigned.date);
  });
})();

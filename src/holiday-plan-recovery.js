(() => {
  'use strict';

  if (window.__dienstpilotHolidayPlanRecoveryV1) return;
  window.__dienstpilotHolidayPlanRecoveryV1 = true;

  const DATE_ID = 'dpDailyPlanDate';
  const TABLE_ID = 'dpDailyPlanRows';
  const SECTION_ID = 'tab-daily-duty-plan';
  const HOLIDAY_BUTTON_ID = 'dpHolidayInsert18';
  const DEFAULT_BUTTON_ID = 'dpDailyInsertDefaults';

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

  const EXPECTED = [
    '3031', '3032', '3033', '3034', '3035', '3036', '3037', '3038',
    '3039', '3040', '3041', '3042', '3043', '3044', '3045', 'Einsatzwagen'
  ];
  const EXPECTED_SET = new Set(EXPECTED);

  let repairing = false;
  let timer = 0;
  const attempts = new Map();

  function selectedDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function isHolidayWeekday(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    return day >= 1 && day <= 5 && HOLIDAY_PERIODS.some(([start, end]) => date >= start && date <= end);
  }

  function sectionVisible() {
    const section = document.getElementById(SECTION_ID);
    return Boolean(section && !section.classList.contains('hidden'));
  }

  function duties() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id] input[data-field="duty"]`)]
      .map((input) => String(input.value || '').trim())
      .filter(Boolean);
  }

  function isCorrectHolidayPlan() {
    const services = duties().filter((duty) => duty !== 'Frei');
    if (services.length !== EXPECTED.length) return false;
    return EXPECTED.every((duty, index) => services[index] === duty)
      && services.every((duty) => EXPECTED_SET.has(duty));
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    const className = 'dp-daily-status' + (kind ? ` ${kind}` : '');
    if (status.textContent !== text) status.textContent = text;
    if (status.className !== className) status.className = className;
  }

  async function repair() {
    const date = selectedDate();
    if (repairing || !isHolidayWeekday(date) || !sectionVisible() || isCorrectHolidayPlan()) return;
    if (window.__dienstpilotHolidayPhotoRebuilding) return;

    const count = attempts.get(date) || 0;
    if (count >= 3) return;

    const button = document.getElementById(HOLIDAY_BUTTON_ID) || document.getElementById(DEFAULT_BUTTON_ID);
    if (!button || button.disabled) return;

    repairing = true;
    attempts.set(date, count + 1);
    setStatus('Der vermischte Ferienplan wird jetzt wieder korrekt aufgebaut …');

    try {
      button.click();
      await new Promise((resolve) => window.setTimeout(resolve, 2600));
      if (isCorrectHolidayPlan()) {
        setStatus('Der Ferienplan ist wieder korrekt: Dienste 3031 bis 3045 und Einsatzwagen.', 'ok');
        attempts.delete(date);
      } else if ((attempts.get(date) || 0) < 3) {
        schedule(1200);
      }
    } finally {
      repairing = false;
    }
  }

  function schedule(delay = 250) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void repair(), delay);
  }

  function start() {
    [200, 700, 1600, 3200, 6000].forEach((delay) => window.setTimeout(() => void repair(), delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton,.tab[data-tab="eingabe"]')) start();
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) {
      attempts.delete(selectedDate());
      start();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', () => schedule(350));
  window.addEventListener('focus', () => schedule(500));
  window.dienstpilotRepairHolidayPlan = repair;
})();
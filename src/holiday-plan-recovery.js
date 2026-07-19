(() => {
  'use strict';

  if (window.__dienstpilotHolidayPlanRecoveryV2) return;
  window.__dienstpilotHolidayPlanRecoveryV2 = true;
  window.__dienstpilotHolidayPlanRecoveryV1 = true;

  const DATE_ID = 'dpDailyPlanDate';
  const TABLE_ID = 'dpDailyPlanRows';
  const SECTION_ID = 'tab-daily-duty-plan';
  const HOLIDAY_BUTTON_ID = 'dpHolidayInsert18';
  const DEFAULT_BUTTON_ID = 'dpDailyInsertDefaults';
  const NOTICE_ID = 'dpHolidayRecoveryNotice';
  const STYLE_ID = 'dpHolidayRecoveryNoticeStyle';

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

  let running = false;
  let timer = 0;
  let activeDate = '';
  let attempts = 0;

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
    if (!section || section.hidden || section.classList.contains('hidden')) return false;
    return getComputedStyle(section).display !== 'none';
  }

  function duties() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id] input[data-field="duty"]`)]
      .map((input) => String(input.value || '').trim())
      .filter(Boolean);
  }

  function isCorrectHolidayPlan() {
    const all = duties();
    const services = all.filter((duty) => duty !== 'Frei');
    if (services.length !== EXPECTED.length) return false;
    if (!EXPECTED.every((duty, index) => services[index] === duty)) return false;
    return all.every((duty) => duty === 'Frei' || EXPECTED_SET.has(duty));
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${NOTICE_ID}{margin:10px 0;padding:11px 13px;border:1px solid #f59e0b;border-radius:11px;background:#fffbeb;color:#92400e;font-weight:950;line-height:1.4}
      #${NOTICE_ID}.ok{border-color:#22c55e;background:#f0fdf4;color:#166534}
      #${NOTICE_ID}.error{border-color:#ef4444;background:#fef2f2;color:#b91c1c}
      @media print{#${NOTICE_ID}{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function notice(text, kind = '') {
    addStyle();
    let node = document.getElementById(NOTICE_ID);
    if (!node) {
      node = document.createElement('div');
      node.id = NOTICE_ID;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'assertive');
      const status = document.getElementById('dpDailyPlanStatus');
      if (status) status.insertAdjacentElement('afterend', node);
      else document.getElementById(SECTION_ID)?.prepend(node);
    }
    if (node.textContent !== text) node.textContent = text;
    node.className = kind;
  }

  function clearNotice() {
    document.getElementById(NOTICE_ID)?.remove();
  }

  function schedule(delay = 250) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void checkAndRepair(), delay);
  }

  async function waitForResult(date, timeoutMs = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (selectedDate() !== date || !isHolidayWeekday(date)) return false;
      if (isCorrectHolidayPlan()) return true;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    return false;
  }

  async function startAuthoritativeRebuild() {
    const button = document.getElementById(HOLIDAY_BUTTON_ID) || document.getElementById(DEFAULT_BUTTON_ID);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }

  async function checkAndRepair() {
    const date = selectedDate();

    if (!isHolidayWeekday(date)) {
      activeDate = '';
      attempts = 0;
      clearNotice();
      return;
    }
    if (!sectionVisible()) return;

    if (date !== activeDate) {
      activeDate = date;
      attempts = 0;
    }

    if (isCorrectHolidayPlan()) {
      if (document.getElementById(NOTICE_ID)) {
        notice('Der Ferienplan ist wieder korrekt: Dienste 3031 bis 3045 und Einsatzwagen.', 'ok');
      }
      return;
    }

    notice('Der vermischte Ferienplan wird jetzt wieder korrekt aufgebaut …');

    if (running || window.__dienstpilotHolidayPhotoRebuilding) {
      schedule(500);
      return;
    }

    if (attempts >= 3) {
      notice('Der Ferienplan konnte nicht automatisch vollständig aufgebaut werden. Bitte „18 Ferien-Dienste einfügen“ einmal anklicken.', 'error');
      return;
    }

    running = true;
    attempts += 1;
    try {
      const started = await startAuthoritativeRebuild();
      if (!started) {
        notice('Der Ferienplan wartet noch auf die Dienstplansteuerung. Der Aufbau wird erneut versucht.', 'error');
        schedule(700);
        return;
      }

      const correct = await waitForResult(date);
      if (correct) {
        notice('Der Ferienplan ist wieder korrekt: Dienste 3031 bis 3045 und Einsatzwagen.', 'ok');
        attempts = 0;
      } else {
        schedule(900);
      }
    } finally {
      running = false;
    }
  }

  function start() {
    [100, 350, 900, 1800, 3600].forEach((delay) => window.setTimeout(() => void checkAndRepair(), delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton,.tab[data-tab="eingabe"]')) start();
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) {
      activeDate = '';
      attempts = 0;
      start();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', () => schedule(250));
  window.addEventListener('focus', () => schedule(350));
  window.dienstpilotRepairHolidayPlan = checkAndRepair;
})();
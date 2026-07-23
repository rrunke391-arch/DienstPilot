(() => {
  'use strict';

  if (window.__dienstpilotSplitShiftStartupTriggerV1) return;
  window.__dienstpilotSplitShiftStartupTriggerV1 = true;

  const SECTION_ID = 'tab-daily-duty-plan';
  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const PANEL_ID = 'dpStableSplitShiftPanel';
  const PERIODS = [
    ['2025-10-13','2025-10-25'],['2025-12-22','2026-01-05'],
    ['2026-02-02','2026-02-03'],['2026-03-23','2026-04-07'],
    ['2026-05-15','2026-05-15'],['2026-05-26','2026-05-26'],
    ['2026-07-02','2026-08-12'],['2026-10-12','2026-10-24'],
    ['2026-12-23','2027-01-09'],['2027-02-01','2027-02-02'],
    ['2027-03-22','2027-04-03'],['2027-05-07','2027-05-07'],
    ['2027-05-18','2027-05-18'],['2027-07-08','2027-08-18'],
    ['2027-10-16','2027-10-30'],['2027-12-23','2028-01-08']
  ];

  let timer = 0;
  let lastDate = '';
  let attempts = 0;

  function selectedDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function isHolidayWeekday(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    return day > 0 && day < 6 && PERIODS.some(([start, end]) => date >= start && date <= end);
  }

  function sectionVisible() {
    const section = document.getElementById(SECTION_ID);
    return Boolean(section && !section.classList.contains('hidden'));
  }

  function trigger() {
    const date = selectedDate();
    if (!sectionVisible() || !isHolidayWeekday(date)) return false;
    if (document.getElementById(PANEL_ID)) return true;

    const dutyInput = document.querySelector(`#${TABLE_ID} input[data-field="duty"]`);
    if (!dutyInput) return false;

    // Wert bleibt unverändert. Das vorhandene Schichtmodul erhält lediglich
    // sein eigenes, bereits vorgesehenes Aktualisierungssignal.
    dutyInput.dispatchEvent(new Event('input', { bubbles: true }));
    return Boolean(document.getElementById(PANEL_ID));
  }

  function runBurst() {
    clearTimeout(timer);
    attempts = 0;
    const date = selectedDate();
    if (date !== lastDate) lastDate = date;

    const step = () => {
      attempts += 1;
      if (trigger() || attempts >= 12) return;
      timer = window.setTimeout(step, attempts < 5 ? 180 : 500);
    };
    step();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,.tab[data-tab="eingabe"],#loginButton')) {
      window.setTimeout(runBurst, 80);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) window.setTimeout(runBurst, 80);
  }, true);

  window.addEventListener('dienstpilot:authenticated', () => window.setTimeout(runBurst, 120));
  window.addEventListener('pageshow', () => window.setTimeout(runBurst, 120));

  const observer = new MutationObserver(() => {
    if (sectionVisible() && isHolidayWeekday(selectedDate()) && !document.getElementById(PANEL_ID)) {
      window.setTimeout(runBurst, 80);
    }
  });

  function start() {
    const section = document.getElementById(SECTION_ID);
    if (section) observer.observe(section, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    runBurst();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

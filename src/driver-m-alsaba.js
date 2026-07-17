(() => {
  'use strict';

  if (window.__dienstpilotDriverMAlsabaV1) return;
  window.__dienstpilotDriverMAlsabaV1 = true;

  const DISPLAY_NAME = 'M.Alsaba';
  const PROFILE_VALUE = 'm_alsaba';
  let timer = 0;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function hasOption(select, values) {
    return [...select.options].some((option) => {
      const candidates = [option.value, option.label, option.textContent].map(normalize);
      return values.some((value) => candidates.includes(normalize(value)));
    });
  }

  function addOption(select, value, label = DISPLAY_NAME) {
    if (!select || hasOption(select, [DISPLAY_NAME, PROFILE_VALUE])) return;
    const option = document.createElement('option');
    option.value = value;
    option.label = label;
    option.textContent = label;
    select.appendChild(option);
  }

  function install() {
    addOption(document.getElementById('dpAssignDriversV2'), PROFILE_VALUE);
    addOption(document.getElementById('kollegeSelect'), DISPLAY_NAME);

    document.querySelectorAll('#dpDailyPlanRows .dp-daily-driver-select').forEach((select) => {
      addOption(select, DISPLAY_NAME);
    });

    document.querySelectorAll('#dpStableSplitShiftPanel .dp-driver-assignment-select').forEach((select) => {
      addOption(select, DISPLAY_NAME);
    });
  }

  function schedule(delay = 60) {
    window.clearTimeout(timer);
    timer = window.setTimeout(install, delay);
  }

  const observer = new MutationObserver(() => schedule());

  function start() {
    install();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    [200, 700, 1600, 3200, 6000].forEach((delay) => window.setTimeout(install, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#dpDailyDutyPlanTab,#dpDutyAssignmentV2,#dpDailyAddRow,#dpDailyInsertDefaults,.tab[data-tab="eingabe"]')) {
      [0, 150, 500, 1200].forEach((delay) => window.setTimeout(install, delay));
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', () => schedule(100));
  window.addEventListener('focus', () => schedule(100));
})();
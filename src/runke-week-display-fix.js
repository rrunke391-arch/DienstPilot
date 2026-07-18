(() => {
  'use strict';

  if (window.__dienstpilotRunkeWeekDisplayFixV1) return;
  window.__dienstpilotRunkeWeekDisplayFixV1 = true;

  const CONTAINER_ID = 'dutiesContainer';
  const TARGET_MONTHS = new Set(['2026-08', '2026-09', '2026-10']);
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  let applying = false;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function activeProfile() {
    try {
      const state = JSON.parse(localStorage.getItem(MAIN_KEY) || '{}') || {};
      const fromState = state?.appSettings?.activeProfile;
      if (fromState) return normalize(fromState);
    } catch {}

    const stored = localStorage.getItem(ACTIVE_DRIVER_KEY);
    if (stored) return normalize(stored);

    const badge = document.getElementById('syncStatus')?.textContent || '';
    return normalize(badge).includes('runke') ? 'runke' : '';
  }

  function parseIso(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return { year: match[1], month: match[2], day: match[3] };
  }

  function rangeLabel(firstIso, lastIso) {
    const first = parseIso(firstIso);
    const last = parseIso(lastIso);
    if (!first || !last) return '';
    if (firstIso === lastIso) return `${first.day}.${first.month}.${first.year}`;
    if (first.year === last.year && first.month === last.month) {
      return `${first.day}.–${last.day}.${last.month}.${last.year}`;
    }
    if (first.year === last.year) {
      return `${first.day}.${first.month}.–${last.day}.${last.month}.${last.year}`;
    }
    return `${first.day}.${first.month}.${first.year}–${last.day}.${last.month}.${last.year}`;
  }

  function setHidden(element, hidden) {
    if (!element) return;
    if (hidden) {
      if (element.dataset.dpRunkeWeekHidden !== '1') {
        element.dataset.dpRunkeWeekHidden = '1';
        element.style.setProperty('display', 'none', 'important');
      }
    } else if (element.dataset.dpRunkeWeekHidden === '1') {
      delete element.dataset.dpRunkeWeekHidden;
      element.style.removeProperty('display');
    }
  }

  function restore(container) {
    container.querySelectorAll('[data-dp-runke-week-hidden="1"]').forEach((element) => setHidden(element, false));
  }

  function applyFix() {
    if (applying) return;
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    applying = true;
    try {
      if (activeProfile() !== 'runke') {
        restore(container);
        return;
      }

      container.querySelectorAll('details.month-group[data-month]').forEach((monthGroup) => {
        const month = monthGroup.dataset.month || '';
        if (!TARGET_MONTHS.has(month)) return;

        monthGroup.querySelectorAll(':scope > details.week-group').forEach((weekGroup) => {
          const dayGroups = [...weekGroup.querySelectorAll(':scope > details.day-group[data-day]')];
          const plannedDays = dayGroups
            .filter((dayGroup) => !dayGroup.classList.contains('empty-day'))
            .map((dayGroup) => dayGroup.dataset.day || '')
            .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
            .sort();

          setHidden(weekGroup, plannedDays.length === 0);
          if (!plannedDays.length) return;

          const plannedSet = new Set(plannedDays);
          dayGroups.forEach((dayGroup) => setHidden(dayGroup, !plannedSet.has(dayGroup.dataset.day || '')));

          const range = weekGroup.querySelector(':scope > summary .week-range');
          const corrected = rangeLabel(plannedDays[0], plannedDays[plannedDays.length - 1]);
          if (range && range.textContent !== corrected) range.textContent = corrected;
        });
      });
    } finally {
      applying = false;
    }
  }

  function schedule() {
    [0, 80, 220, 600, 1200].forEach((delay) => window.setTimeout(applyFix, delay));
  }

  function start() {
    schedule();
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
      const observer = new MutationObserver(schedule);
      observer.observe(container, { childList: true, subtree: true });
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#loadRunke,#loadKollege,#loadSelectedProfile,.tab[data-tab="eingabe"],#monthPicker,.month-selector-button')) {
      schedule();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', schedule);
  window.addEventListener('focus', schedule);
})();
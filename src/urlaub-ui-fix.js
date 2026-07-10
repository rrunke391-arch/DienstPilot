(() => {
  'use strict';

  const BUTTON_ID = 'openJahresurlaubFix';
  const WEEK_FIX_MARK = '__dienstpilotCrossMonthWeekFix';
  const OBSERVER_MARK = '__dienstpilotOverviewCleanupObserver';
  const STYLE_ID = 'dienstpilotOverviewCleanupStyles';
  const REMOVED_TABS = new Set(['auswertung', 'tests']);

  let cleanupRunning = false;
  let cleanupTimer = 0;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function disableUnusedRenderers() {
    window.renderMessages = () => {};
    window.renderOverview = () => {};
    window.renderTests = () => {};
  }

  function ensureOverviewActive() {
    const overviewButton = document.querySelector('.tab[data-tab="eingabe"]');
    const overviewSection = document.getElementById('tab-eingabe');
    if (!overviewButton || !overviewSection) return;

    const activeButton = document.querySelector('.tab.active');
    if (activeButton && !REMOVED_TABS.has(activeButton.dataset.tab)) return;

    document.querySelectorAll('.tab').forEach((button) => button.classList.remove('active'));
    overviewButton.classList.add('active');
    document.querySelectorAll('main > section[id^="tab-"]').forEach((section) => {
      section.classList.toggle('hidden', section !== overviewSection);
    });
    try {
      localStorage.setItem('lrz-active-tab', 'eingabe');
    } catch {
      // Private Browsermodi dürfen die Speicherung blockieren.
    }
  }

  function removeUnusedAreas() {
    const removedWasActive = Boolean(document.querySelector(
      '.tab.active[data-tab="auswertung"], .tab.active[data-tab="tests"]'
    ));

    document.querySelectorAll(
      '.tab[data-tab="auswertung"], #tab-auswertung, ' +
      '.tab[data-tab="tests"], #tab-tests'
    ).forEach((element) => element.remove());

    document.querySelectorAll(
      '#catalogReviewStats .crs-errors, #catalogReviewStats .crs-open, ' +
      '.catalog-card .badge.problem, .catalog-card-review, .cat-review-note, .cat-review-note-edit'
    ).forEach((element) => element.remove());

    document.querySelectorAll('.catalog-card.cat-has-problem, .catalog-card.cat-review-errors').forEach((element) => {
      element.classList.remove('cat-has-problem', 'cat-review-errors');
    });

    if (removedWasActive || !document.querySelector('.tab.active')) ensureOverviewActive();
  }

  function ensureVacationButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) return;

    const printButton = document.getElementById('printDutyPlan');
    const clearButton = document.getElementById('clearDuties');
    const group = printButton?.closest('.toolbar-group') || clearButton?.closest('.toolbar-group');
    if (!group) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'btn-secondary';
    button.textContent = '🌴 Jahresurlaub';

    if (printButton) group.insertBefore(button, printButton);
    else group.appendChild(button);
  }

  function openVacationSettings() {
    const settingsTab = document.querySelector('.tab[data-tab="einstellungen"]');
    if (settingsTab) settingsTab.click();

    window.setTimeout(() => {
      const section = document.querySelector('#tab-einstellungen .vacation-section');
      if (!section) return;
      section.hidden = false;
      section.style.removeProperty('display');
      section.removeAttribute('aria-hidden');
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function installStatusStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dutiesContainer .summary-status,
      #dutiesContainer .summary-counts,
      #dutiesContainer summary [data-status],
      #dutiesContainer summary [class*="status-"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ownerMonthForIsoWeek(weekKey) {
    const match = String(weekKey || '').match(/^(\d{4})-KW(\d{1,2})$/);
    if (!match) return '';

    const year = Number(match[1]);
    const week = Number(match[2]);
    const jan4 = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
    const jan4Day = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);

    const thursday = new Date(monday);
    thursday.setUTCDate(monday.getUTCDate() + 3);
    return thursday.getUTCFullYear() + '-' + String(thursday.getUTCMonth() + 1).padStart(2, '0');
  }

  function parseCount(element) {
    const match = String(element?.textContent || '').match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function parseMinutes(element) {
    const text = String(element?.textContent || '');
    const hours = text.match(/(\d+)\s*Std\./i);
    const minutes = text.match(/(\d+)\s*Min\./i);
    return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  }

  function formatMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `Σ ${hours} Std. ${String(minutes).padStart(2, '0')} Min.`;
  }

  function normalizeStatusText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[✓✔✕×!⊘]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isStatusOnlyText(value) {
    const text = normalizeStatusText(value);
    if (!text) return false;

    const label = '(?:Arbeit(?:stage)?|frei(?:e\\s*Tage)?|Fehler|OK|Prüfen|Verstoß(?:e)?|Hinweis(?:e)?)';
    const single = new RegExp('^(?:\\d+\\s*)?' + label + '$', 'i');
    if (single.test(text)) return true;

    const token = new RegExp('\\d+\\s*' + label, 'gi');
    const matches = text.match(token);
    if (!matches || matches.length === 0) return false;

    const rest = text
      .replace(token, ' ')
      .replace(/[·|,;:/-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return rest === '';
  }

  function shouldKeepSummaryElement(element) {
    return element.matches(
      '.month-count, .week-count, .summary-total, .summary-duty, .summary-date, ' +
      '.summary-dow, .week-num, .week-range, .holiday-badge, .ferien-badge, ' +
      '.vacation-badge, .summary-ai'
    );
  }

  function removeOverviewStatusBadges() {
    const container = document.getElementById('dutiesContainer');
    if (!container) return;

    container.querySelectorAll(
      '.summary-status, .summary-counts, .status-badge, .badge.ok, .badge.warn, .badge.fail, ' +
      '.status-ok, .status-warn, .status-fail, [data-status]'
    ).forEach((element) => element.remove());

    container.querySelectorAll(
      'details.month-group > summary, ' +
      'details.week-group > summary, ' +
      'details.day-group > summary'
    ).forEach((summary) => {
      const descendants = [...summary.querySelectorAll('*')];
      descendants.forEach((element) => {
        if (!element.isConnected || shouldKeepSummaryElement(element)) return;
        if (isStatusOnlyText(element.textContent)) element.remove();
      });

      // Leere Hüllen entfernen, die nach dem Löschen der einzelnen Plaketten übrig bleiben.
      [...summary.querySelectorAll('*')].forEach((element) => {
        if (!element.isConnected || shouldKeepSummaryElement(element)) return;
        if (element.children.length === 0 && !normalizeStatusText(element.textContent)) element.remove();
      });
    });
  }

  function normalizeCalendarWeeks() {
    const container = document.getElementById('dutiesContainer');
    if (!container) return;

    const byWeek = new Map();
    container.querySelectorAll('details.month-group > details.week-group[data-week]').forEach((week) => {
      const key = week.dataset.week || '';
      if (!key) return;
      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key).push(week);
    });

    for (const [weekKey, groups] of byWeek) {
      if (groups.length < 2) continue;

      const ownerMonth = ownerMonthForIsoWeek(weekKey);
      const owner = groups.find((group) => group.closest('details.month-group')?.dataset.month === ownerMonth)
        || groups.slice().sort((a, b) => b.querySelectorAll(':scope > details.day-group').length - a.querySelectorAll(':scope > details.day-group').length)[0];
      if (!owner) continue;

      let dutyDays = 0;
      let totalMinutes = 0;
      const daysByDate = new Map();

      groups.forEach((group) => {
        const summary = group.querySelector(':scope > summary');
        dutyDays += parseCount(summary?.querySelector('.week-count'));
        totalMinutes += parseMinutes(summary?.querySelector('.summary-total'));

        group.querySelectorAll(':scope > details.day-group[data-day]').forEach((day) => {
          const date = day.dataset.day || '';
          if (date && !daysByDate.has(date)) daysByDate.set(date, day);
        });
      });

      groups.forEach((group) => {
        if (group !== owner) group.remove();
      });

      [...daysByDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([, day]) => owner.appendChild(day));

      const ownerSummary = owner.querySelector(':scope > summary');
      const countElement = ownerSummary?.querySelector('.week-count');
      if (countElement) countElement.textContent = `${dutyDays} ${dutyDays === 1 ? 'Diensttag' : 'Diensttage'}`;

      const totalElement = ownerSummary?.querySelector('.summary-total');
      if (totalElement) totalElement.textContent = formatMinutes(totalMinutes);
    }
  }

  function runOverviewCleanup() {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      normalizeCalendarWeeks();
      removeOverviewStatusBadges();
    } finally {
      cleanupRunning = false;
    }
  }

  function scheduleCleanup(delay = 0) {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(runOverviewCleanup, delay);
  }

  function installRenderHook(functionName) {
    const original = window[functionName];
    if (typeof original !== 'function' || original[WEEK_FIX_MARK]) return;

    const wrapped = function (...args) {
      const result = original.apply(this, args);
      scheduleCleanup(0);
      return result;
    };
    wrapped[WEEK_FIX_MARK] = true;
    window[functionName] = wrapped;
  }

  function installOverviewObserver() {
    const container = document.getElementById('dutiesContainer');
    if (!container || container[OBSERVER_MARK]) return;

    const observer = new MutationObserver(() => scheduleCleanup(20));
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    container[OBSERVER_MARK] = observer;
  }

  function start() {
    installStatusStyles();
    disableUnusedRenderers();
    removeUnusedAreas();
    ensureOverviewActive();
    ensureVacationButton();
    installRenderHook('renderDuties');
    installRenderHook('renderAll');
    installOverviewObserver();
    scheduleCleanup(0);

    document.addEventListener('click', (event) => {
      const button = event.target.closest?.('#' + BUTTON_ID);
      if (button) {
        event.preventDefault();
        openVacationSettings();
      }
      scheduleCleanup(80);
    }, true);

    document.addEventListener('change', () => scheduleCleanup(80), true);
    window.addEventListener('focus', () => scheduleCleanup(0));

    [300, 1000, 2500].forEach((delay) => {
      window.setTimeout(() => {
        installStatusStyles();
        disableUnusedRenderers();
        removeUnusedAreas();
        ensureOverviewActive();
        ensureVacationButton();
        installRenderHook('renderDuties');
        installRenderHook('renderAll');
        installOverviewObserver();
        runOverviewCleanup();
      }, delay);
    });
  }

  ready(start);
})();
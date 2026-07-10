(() => {
  'use strict';

  const BUTTON_ID = 'openJahresurlaubFix';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function removeUnusedAreas() {
    document.querySelectorAll('.tab[data-tab="tests"], #tab-tests').forEach((element) => element.remove());

    document.querySelectorAll(
      '#catalogReviewStats .crs-errors, #catalogReviewStats .crs-open, ' +
      '.catalog-card .badge.problem, .catalog-card-review, .cat-review-note, .cat-review-note-edit'
    ).forEach((element) => element.remove());

    document.querySelectorAll('.catalog-card.cat-has-problem, .catalog-card.cat-review-errors').forEach((element) => {
      element.classList.remove('cat-has-problem', 'cat-review-errors');
    });
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

  function start() {
    removeUnusedAreas();
    ensureVacationButton();

    document.addEventListener('click', (event) => {
      const button = event.target.closest?.('#' + BUTTON_ID);
      if (!button) return;
      event.preventDefault();
      openVacationSettings();
    }, true);

    // Ein einziger später Durchlauf reicht für Elemente, die app.js erst beim Start erzeugt.
    window.setTimeout(() => {
      removeUnusedAreas();
      ensureVacationButton();
    }, 1000);
  }

  ready(start);
})();

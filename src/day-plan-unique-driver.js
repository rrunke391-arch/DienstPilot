(() => {
  'use strict';

  if (window.__dienstpilotDayPlanUniqueDriverV1) return;
  window.__dienstpilotDayPlanUniqueDriverV1 = true;

  let updating = false;
  let timer = null;

  const normalize = (value) => String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  function isTargetTable(table) {
    const headers = [...table.querySelectorAll('thead th, tr:first-child th')]
      .map((node) => String(node.textContent || '').trim().toLowerCase());
    return headers.includes('name') && headers.includes('dienst')
      && headers.includes('kennzeichen') && headers.includes('beginn')
      && headers.includes('ende');
  }

  function targetTables() {
    return [...document.querySelectorAll('table')].filter(isTargetTable);
  }

  function driverSelects(table) {
    return [...table.querySelectorAll('tbody tr')]
      .map((row) => row.cells?.[0]?.querySelector('select'))
      .filter(Boolean);
  }

  function refreshTable(table) {
    if (updating) return;
    updating = true;
    try {
      const selects = driverSelects(table);
      const used = new Map();

      selects.forEach((select) => {
        const key = normalize(select.value);
        if (!key) return;
        if (!used.has(key)) used.set(key, select);
      });

      selects.forEach((select) => {
        const ownKey = normalize(select.value);
        [...select.options].forEach((option) => {
          const key = normalize(option.value || option.textContent);
          if (!key) {
            option.disabled = false;
            option.hidden = false;
            return;
          }
          const occupiedElsewhere = used.has(key) && used.get(key) !== select;
          option.disabled = occupiedElsewhere;
          option.hidden = occupiedElsewhere;
        });
        select.dataset.dpPreviousDriver = select.value || '';
      });
    } finally {
      updating = false;
    }
  }

  function refreshAll() {
    targetTables().forEach(refreshTable);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refreshAll, 60);
  }

  document.addEventListener('focusin', (event) => {
    const select = event.target.closest?.('tbody tr td:first-child select');
    if (!select || !isTargetTable(select.closest('table'))) return;
    select.dataset.dpPreviousDriver = select.value || '';
    refreshTable(select.closest('table'));
  }, true);

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.('tbody tr td:first-child select');
    if (!select) return;
    const table = select.closest('table');
    if (!table || !isTargetTable(table) || updating) return;

    const key = normalize(select.value);
    if (key) {
      const duplicate = driverSelects(table).find((other) => other !== select && normalize(other.value) === key);
      if (duplicate) {
        updating = true;
        const previous = select.dataset.dpPreviousDriver || '';
        select.value = [...select.options].some((option) => option.value === previous) ? previous : '';
        updating = false;
        window.alert('Dieser Fahrer steht bereits im Tagesplan und kann nicht ein zweites Mal ausgewählt werden.');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    schedule();
  }, true);

  const observer = new MutationObserver(schedule);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    [0, 200, 700, 1500].forEach((delay) => setTimeout(refreshAll, delay));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
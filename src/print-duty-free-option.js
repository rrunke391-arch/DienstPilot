(() => {
  'use strict';

  if (window.__dienstpilotPrintDutyFreeOptionV1) return;
  window.__dienstpilotPrintDutyFreeOptionV1 = true;

  const FREE_VALUE = 'Frei';
  let listCounter = 0;

  function text(node) {
    return String(node?.textContent || '').trim().toLowerCase();
  }

  function isTargetTable(table) {
    const headers = [...table.querySelectorAll('thead th, tr:first-child th')].map(text);
    return headers.includes('name') && headers.includes('dienst') && headers.includes('kennzeichen')
      && headers.includes('beginn') && headers.includes('ende');
  }

  function ensureFreeOption(input) {
    if (!input) return;
    let listId = input.getAttribute('list');
    let list = listId ? document.getElementById(listId) : null;

    if (!list) {
      listId = `dpPrintDutyList${++listCounter}`;
      list = document.createElement('datalist');
      list.id = listId;
      document.body.appendChild(list);
      input.setAttribute('list', listId);
    }

    if (![...list.options].some((option) => String(option.value).toLowerCase() === 'frei')) {
      const option = document.createElement('option');
      option.value = FREE_VALUE;
      option.label = FREE_VALUE;
      list.insertBefore(option, list.firstChild);
    }
  }

  function setValue(element, value) {
    if (!element || String(element.value || '') === value) return;
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyFree(row, dutyInput) {
    const isFree = String(dutyInput.value || '').trim().toLowerCase() === 'frei';
    row.classList.toggle('dp-print-free-row', isFree);

    const cells = [...row.cells];
    const fieldsToClear = [2, 3, 4, 5, 6];
    fieldsToClear.forEach((index) => {
      cells[index]?.querySelectorAll('input, select, textarea').forEach((field) => {
        if (isFree) setValue(field, '');
        field.disabled = isFree;
        field.toggleAttribute('aria-disabled', isFree);
      });
    });

    dutyInput.disabled = false;
    dutyInput.removeAttribute('aria-disabled');
  }

  function enhanceTable(table) {
    if (!isTargetTable(table)) return;

    table.querySelectorAll('tbody tr').forEach((row) => {
      const dutyInput = row.cells?.[1]?.querySelector('input, select');
      if (!dutyInput) return;

      ensureFreeOption(dutyInput);
      if (!dutyInput.dataset.dpFreeBound) {
        dutyInput.dataset.dpFreeBound = '1';
        dutyInput.addEventListener('input', () => applyFree(row, dutyInput));
        dutyInput.addEventListener('change', () => applyFree(row, dutyInput));
      }
      applyFree(row, dutyInput);
    });
  }

  function install() {
    document.querySelectorAll('table').forEach(enhanceTable);
  }

  const observer = new MutationObserver(() => install());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      install();
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  } else {
    install();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('click', () => setTimeout(install, 50), true);
})();
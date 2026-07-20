(() => {
  'use strict';

  if (window.__dienstpilotPrintDutyFreeOptionV2) return;
  window.__dienstpilotPrintDutyFreeOptionV2 = true;

  const FREE_VALUE = 'Frei';
  let listCounter = 0;
  let resolving = false;

  function text(node) {
    return String(node?.textContent || '').trim().toLowerCase();
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function valueOf(cell) {
    const field = cell?.querySelector('input, select, textarea');
    return String(field?.value ?? cell?.textContent ?? '').trim();
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

  function removeDuplicateDutyRows(table, freeRow) {
    if (resolving) return;
    const freeName = normalizeName(valueOf(freeRow.cells?.[0]));
    if (!freeName) return;

    const duplicates = [...table.querySelectorAll('tbody tr')].filter((row) => {
      if (row === freeRow) return false;
      const sameDriver = normalizeName(valueOf(row.cells?.[0])) === freeName;
      const duty = valueOf(row.cells?.[1]).toLowerCase();
      return sameDriver && duty && duty !== 'frei';
    });

    if (!duplicates.length) return;
    resolving = true;
    duplicates.forEach((row) => {
      const buttons = [...row.querySelectorAll('button')];
      const deleteButton = row.querySelector('[data-delete], .delete-row, .remove-row, .btn-delete')
        || buttons.find((button) => /löschen|entfernen|^×$|^x$/i.test(String(button.textContent || '').trim()))
        || buttons.at(-1);

      if (deleteButton && !deleteButton.disabled) {
        deleteButton.click();
      } else {
        row.remove();
      }
    });
    window.setTimeout(() => {
      duplicates.forEach((row) => {
        if (row.isConnected) row.remove();
      });
      resolving = false;
      document.dispatchEvent(new Event('change', { bubbles: true }));
    }, 80);
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

    if (isFree) removeDuplicateDutyRows(row.closest('table'), row);
  }

  function enhanceTable(table) {
    if (!isTargetTable(table)) return;

    table.querySelectorAll('tbody tr').forEach((row) => {
      const dutyInput = row.cells?.[1]?.querySelector('input, select');
      if (!dutyInput) return;

      ensureFreeOption(dutyInput);
      if (!dutyInput.dataset.dpFreeBoundV2) {
        dutyInput.dataset.dpFreeBoundV2 = '1';
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
(() => {
  'use strict';

  if (window.__dienstpilotPrintDutyFreeOptionV3) return;
  window.__dienstpilotPrintDutyFreeOptionV3 = true;

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

  function fieldOf(cell) {
    return cell?.querySelector('input, select, textarea') || null;
  }

  function valueOf(cell) {
    const field = fieldOf(cell);
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

  function clearDriverFromAssignedDuty(table, freeRow) {
    if (resolving) return;
    const freeName = normalizeName(valueOf(freeRow.cells?.[0]));
    if (!freeName) return;

    const assignedRows = [...table.querySelectorAll('tbody tr')].filter((row) => {
      if (row === freeRow) return false;
      const sameDriver = normalizeName(valueOf(row.cells?.[0])) === freeName;
      const duty = valueOf(row.cells?.[1]).toLowerCase();
      return sameDriver && duty && duty !== 'frei';
    });

    if (!assignedRows.length) return;
    resolving = true;

    assignedRows.forEach((row) => {
      const driverField = fieldOf(row.cells?.[0]);
      if (!driverField) return;

      if (driverField.tagName === 'SELECT' && ![...driverField.options].some((option) => option.value === '')) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Fahrer auswählen';
        driverField.insertBefore(placeholder, driverField.firstChild);
      }

      setValue(driverField, '');
      driverField.disabled = false;
      driverField.removeAttribute('aria-disabled');
    });

    window.setTimeout(() => {
      resolving = false;
      document.dispatchEvent(new Event('change', { bubbles: true }));
    }, 80);
  }

  function applyFree(row, dutyInput) {
    const isFree = String(dutyInput.value || '').trim().toLowerCase() === 'frei';
    row.classList.toggle('dp-print-free-row', isFree);

    const cells = [...row.cells];
    [2, 3, 4, 5, 6].forEach((index) => {
      cells[index]?.querySelectorAll('input, select, textarea').forEach((field) => {
        if (isFree) setValue(field, '');
        field.disabled = isFree;
        field.toggleAttribute('aria-disabled', isFree);
      });
    });

    dutyInput.disabled = false;
    dutyInput.removeAttribute('aria-disabled');

    if (isFree) clearDriverFromAssignedDuty(row.closest('table'), row);
  }

  function enhanceTable(table) {
    if (!isTargetTable(table)) return;

    table.querySelectorAll('tbody tr').forEach((row) => {
      const dutyInput = fieldOf(row.cells?.[1]);
      if (!dutyInput) return;

      ensureFreeOption(dutyInput);
      if (!dutyInput.dataset.dpFreeBoundV3) {
        dutyInput.dataset.dpFreeBoundV3 = '1';
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
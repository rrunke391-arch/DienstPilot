(() => {
  'use strict';

  if (window.__dienstpilotPrintDutyFreeOptionV4) return;
  window.__dienstpilotPrintDutyFreeOptionV4 = true;

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
    return headers.includes('name') && headers.includes('dienst')
      && headers.includes('kennzeichen') && headers.includes('beginn')
      && headers.includes('ende');
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

    if (![...list.options].some((option) =>
      String(option.value).toLowerCase() === 'frei'
    )) {
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

      if (driverField.tagName === 'SELECT'
          && ![...driverField.options].some((option) => option.value === '')) {
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

  function freeEditableFields(row) {
    return [fieldOf(row.cells?.[0]), fieldOf(row.cells?.[1])].filter(Boolean);
  }

  function persistDailyPlan(delay = 120) {
    window.setTimeout(() => {
      const saveButton = document.getElementById('dpDailySave');
      if (saveButton && !saveButton.disabled) saveButton.click();
    }, delay);
  }

  function setFreeEditing(row, editing) {
    row.dataset.dpFreeEditing = editing ? '1' : '0';

    freeEditableFields(row).forEach((field) => {
      field.disabled = !editing;
      field.toggleAttribute('aria-disabled', !editing);
    });

    const editButton = row.querySelector('.dp-free-edit');
    const saveButton = row.querySelector('.dp-free-save');
    if (editButton) editButton.hidden = editing;
    if (saveButton) saveButton.hidden = !editing;
  }

  function findOriginalDelete(row) {
    const buttons = [...row.querySelectorAll('button')]
      .filter((button) => !button.closest('.dp-free-row-actions'));

    return buttons.find((button) => {
      const label = String(button.textContent || '').trim().toLowerCase();
      return label === 'x' || label === '×'
        || label.includes('löschen') || label.includes('entfernen');
    }) || buttons.at(-1) || null;
  }

  function ensureFreeActions(row) {
    const actionCell = row.cells?.[row.cells.length - 1];
    if (!actionCell) return;

    if (!row.querySelector('.dp-free-row-actions')) {
      const actions = document.createElement('div');
      actions.className = 'dp-free-row-actions';
      actions.innerHTML = `
        <button type="button" class="dp-free-edit">Bearbeiten</button>
        <button type="button" class="dp-free-save" hidden>Speichern</button>
        <button type="button" class="dp-free-delete">Löschen</button>`;
      actionCell.prepend(actions);
    }

    if (!row.dataset.dpFreeEditing) {
      const driverPresent = Boolean(normalizeName(valueOf(row.cells?.[0])));
      row.dataset.dpFreeEditing = driverPresent ? '0' : '1';
    }

    setFreeEditing(row, row.dataset.dpFreeEditing === '1');
  }

  function removeFreeActions(row) {
    row.querySelector('.dp-free-row-actions')?.remove();
    delete row.dataset.dpFreeEditing;
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

    if (isFree) {
      ensureFreeActions(row);
      clearDriverFromAssignedDuty(row.closest('table'), row);
    } else {
      removeFreeActions(row);
      dutyInput.disabled = false;
      dutyInput.removeAttribute('aria-disabled');
    }
  }

  function enhanceTable(table) {
    if (!isTargetTable(table)) return;

    table.querySelectorAll('tbody tr').forEach((row) => {
      const dutyInput = fieldOf(row.cells?.[1]);
      if (!dutyInput) return;

      ensureFreeOption(dutyInput);

      if (!dutyInput.dataset.dpFreeBoundV4) {
        dutyInput.dataset.dpFreeBoundV4 = '1';
        dutyInput.addEventListener('input', () => applyFree(row, dutyInput));
        dutyInput.addEventListener('change', () => applyFree(row, dutyInput));
      }

      applyFree(row, dutyInput);
    });
  }

  function install() {
    document.querySelectorAll('table').forEach(enhanceTable);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.(
      '.dp-free-edit, .dp-free-save, .dp-free-delete'
    );
    if (!button) return;

    const row = button.closest('tr.dp-print-free-row');
    if (!row) return;

    event.preventDefault();
    event.stopPropagation();

    if (button.classList.contains('dp-free-edit')) {
      setFreeEditing(row, true);
      return;
    }

    if (button.classList.contains('dp-free-save')) {
      freeEditableFields(row).forEach((field) => {
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      });

      setFreeEditing(row, false);
      window.setTimeout(install, 50);
      persistDailyPlan(120);
      return;
    }

    if (!window.confirm('Diesen Frei-Eintrag wirklich löschen?')) return;

    const originalDelete = findOriginalDelete(row);
    if (originalDelete && !originalDelete.disabled) {
      originalDelete.click();
    } else {
      row.remove();
    }

    window.dispatchEvent(new CustomEvent('dienstpilot:free-row-deleted'));
    [50, 180, 450, 900].forEach((delay) => {
      window.setTimeout(() => {
        install();
        window.dispatchEvent(new CustomEvent('dienstpilot:free-row-deleted'));
      }, delay);
    });
    persistDailyPlan(650);
  }, true);

  const style = document.createElement('style');
  style.id = 'dpPrintDutyFreeActionsV4Style';
  style.textContent = `
    .dp-free-row-actions{
      display:flex!important;
      gap:5px;
      flex-wrap:wrap;
      align-items:center;
      margin-right:5px;
    }
    .dp-free-row-actions button{
      display:inline-flex!important;
      width:auto!important;
      padding:5px 7px;
      border:1px solid #cbd5e1;
      border-radius:7px;
      background:#fff;
      color:#111827;
      font-size:11px;
      font-weight:800;
      cursor:pointer;
      white-space:nowrap;
    }
    .dp-free-row-actions button[hidden]{display:none!important}
    .dp-free-row-actions .dp-free-save{
      background:#0f172a;
      color:#fff;
      border-color:#0f172a;
    }
    .dp-free-row-actions .dp-free-delete{
      background:#fff1f2;
      color:#b91c1c;
      border-color:#fecdd3;
    }
    @media print{
      .dp-free-row-actions{display:none!important}
    }
  `;
  document.head.appendChild(style);

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



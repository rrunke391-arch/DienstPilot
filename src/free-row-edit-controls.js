(() => {
  'use strict';

  if (window.__dienstpilotFreeRowEditControlsV5) return;
  window.__dienstpilotFreeRowEditControlsV5 = true;

  let installTimer = null;
  const normalize = (value) => String(value || '').trim().toLowerCase();

  function isTargetTable(table) {
    const headers = [...table.querySelectorAll('thead th, tr:first-child th')]
      .map((node) => normalize(node.textContent));
    return headers.includes('name') && headers.includes('dienst')
      && headers.includes('kennzeichen') && headers.includes('beginn')
      && headers.includes('ende');
  }

  function isFreeRow(row) {
    if (!row || row.classList.contains('dp-free-action-row')) return false;
    const cell = row.cells?.[1];
    if (!cell) return false;
    const values = [...cell.querySelectorAll('input, select, textarea')]
      .map((field) => normalize(field.value));
    const text = normalize(cell.textContent);
    return values.includes('frei') || values.includes('dienst frei')
      || text === 'frei' || text.includes('dienst frei');
  }

  function editableFields(row) {
    return [row.cells?.[0], row.cells?.[1]]
      .flatMap((cell) => [...(cell?.querySelectorAll('input, select, textarea') || [])]);
  }

  function setEditing(row, editing) {
    editableFields(row).forEach((field) => {
      field.disabled = !editing;
      if ('readOnly' in field) field.readOnly = !editing;
      field.toggleAttribute('aria-disabled', !editing);
    });
    row.dataset.dpFreeEditing = editing ? '1' : '0';
    const actionRow = row.nextElementSibling;
    actionRow?.querySelector('.dp-free-edit')?.toggleAttribute('hidden', editing);
    actionRow?.querySelector('.dp-free-save')?.toggleAttribute('hidden', !editing);
  }

  function findOriginalDelete(row) {
    const buttons = [...row.querySelectorAll('button')];
    return row.querySelector('[data-delete], .delete-row, .remove-row, .btn-delete')
      || buttons.find((button) => /löschen|entfernen|^×$|^x$/i.test(String(button.textContent || '').trim()))
      || buttons.at(-1)
      || null;
  }

  function createActionRow(row) {
    const actionRow = document.createElement('tr');
    actionRow.className = 'dp-free-action-row';
    const cell = document.createElement('td');
    cell.colSpan = Math.max(1, row.cells.length);
    cell.innerHTML = `
      <div class="dp-free-row-actions">
        <button type="button" class="dp-free-edit">Bearbeiten</button>
        <button type="button" class="dp-free-save" hidden>Speichern</button>
        <button type="button" class="dp-free-delete">Löschen</button>
      </div>`;
    actionRow.appendChild(cell);
    row.insertAdjacentElement('afterend', actionRow);
    return actionRow;
  }

  function enhanceRow(row) {
    if (!isFreeRow(row)) return;
    let actionRow = row.nextElementSibling;
    if (!actionRow?.classList.contains('dp-free-action-row')) {
      actionRow = createActionRow(row);
      row.dataset.dpFreeEditing = '';
    }
    if (row.dataset.dpFreeEditing !== '1') setEditing(row, false);
  }

  function install() {
    document.querySelectorAll('table').forEach((table) => {
      if (!isTargetTable(table)) return;

      table.querySelectorAll('tbody tr.dp-free-action-row').forEach((actionRow) => {
        if (!isFreeRow(actionRow.previousElementSibling)) actionRow.remove();
      });

      table.querySelectorAll('tbody tr').forEach(enhanceRow);
    });
  }

  function scheduleInstall() {
    clearTimeout(installTimer);
    installTimer = setTimeout(install, 50);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.dp-free-edit, .dp-free-save, .dp-free-delete');
    if (!button) return;
    const actionRow = button.closest('tr.dp-free-action-row');
    const row = actionRow?.previousElementSibling;
    if (!row || !isFreeRow(row)) return;

    event.preventDefault();
    event.stopPropagation();

    if (button.classList.contains('dp-free-edit')) {
      setEditing(row, true);
      return;
    }

    if (button.classList.contains('dp-free-save')) {
      editableFields(row).forEach((field) => {
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      });
      setEditing(row, false);
      scheduleInstall();
      return;
    }

    if (!window.confirm('Diesen Frei-Eintrag wirklich löschen?')) return;
    const originalDelete = findOriginalDelete(row);
    if (originalDelete && !originalDelete.disabled) originalDelete.click();
    else {
      actionRow.remove();
      row.remove();
    }
    scheduleInstall();
  }, true);

  const style = document.createElement('style');
  style.id = 'dpFreeRowEditControlsStyleV5';
  style.textContent = `
    .dp-free-action-row td{padding:4px 8px 9px!important;border-top:0!important;background:#f8fafc!important}
    .dp-free-row-actions{display:flex!important;gap:7px;align-items:center;flex-wrap:wrap}
    .dp-free-row-actions button{display:inline-flex;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;background:#fff;font-weight:800;cursor:pointer}
    .dp-free-row-actions button[hidden]{display:none!important}
    .dp-free-row-actions .dp-free-save{background:#0f172a;color:#fff;border-color:#0f172a}
    .dp-free-row-actions .dp-free-delete{background:#fff1f2;color:#b91c1c;border-color:#fecdd3}
    @media print{.dp-free-action-row{display:none!important}}
  `;
  document.getElementById(style.id)?.remove();
  document.head.appendChild(style);

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length)) scheduleInstall();
  });

  const start = () => {
    install();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
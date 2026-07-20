(() => {
  'use strict';

  if (window.__dienstpilotFreeRowEditControlsV4) return;
  window.__dienstpilotFreeRowEditControlsV4 = true;

  let installTimer = null;

  const normalize = (value) => String(value || '').trim().toLowerCase();
  const text = (node) => normalize(node?.textContent);

  function isTargetTable(table) {
    const headers = [...table.querySelectorAll('thead th, tr:first-child th')].map(text);
    return headers.includes('name') && headers.includes('dienst')
      && headers.includes('kennzeichen') && headers.includes('beginn')
      && headers.includes('ende');
  }

  function fieldValues(cell) {
    return [...(cell?.querySelectorAll('input, select, textarea') || [])]
      .map((field) => normalize(field.value));
  }

  function isFreeRow(row) {
    const dutyCell = row.cells?.[1];
    if (!dutyCell) return false;
    const values = fieldValues(dutyCell);
    if (values.some((value) => value === 'frei' || value === 'dienst frei')) return true;
    const dutyText = text(dutyCell);
    return dutyText === 'frei' || dutyText.includes('dienst frei');
  }

  function editableFields(row) {
    return [row.cells?.[0], row.cells?.[1]]
      .flatMap((cell) => [...(cell?.querySelectorAll('input, select, textarea') || [])]);
  }

  function setEditing(row, editing) {
    if (!row?.isConnected) return;
    const nextState = editing ? '1' : '0';
    if (row.dataset.dpFreeEditing === nextState) return;

    editableFields(row).forEach((field) => {
      if (field.disabled === editing) field.disabled = !editing;
      if ('readOnly' in field && field.readOnly === editing) field.readOnly = !editing;
      field.toggleAttribute('aria-disabled', !editing);
    });

    row.dataset.dpFreeEditing = nextState;
    const edit = row.querySelector('.dp-free-edit');
    const save = row.querySelector('.dp-free-save');
    if (edit) edit.hidden = editing;
    if (save) save.hidden = !editing;
  }

  function findOriginalDelete(row) {
    const buttons = [...row.querySelectorAll('button')]
      .filter((button) => !button.closest('.dp-free-row-actions'));
    return row.querySelector('[data-delete], .delete-row, .remove-row, .btn-delete')
      || buttons.find((button) => /löschen|entfernen|^×$|^x$/i.test(String(button.textContent || '').trim()))
      || buttons.at(-1)
      || null;
  }

  function createActions() {
    const actions = document.createElement('div');
    actions.className = 'dp-free-row-actions';
    actions.innerHTML = `
      <button type="button" class="dp-free-edit">Bearbeiten</button>
      <button type="button" class="dp-free-save" hidden>Speichern</button>
      <button type="button" class="dp-free-delete">Löschen</button>`;
    return actions;
  }

  function enhanceRow(row) {
    if (!isFreeRow(row)) return;
    const actionCell = row.cells?.[row.cells.length - 1];
    if (!actionCell) return;

    if (!row.querySelector('.dp-free-row-actions')) {
      actionCell.prepend(createActions());
      row.dataset.dpFreeEditing = '';
    }
    if (row.dataset.dpFreeEditing !== '1') setEditing(row, false);
  }

  function install() {
    document.querySelectorAll('table').forEach((table) => {
      if (!isTargetTable(table)) return;
      table.querySelectorAll('tbody tr').forEach(enhanceRow);
    });
  }

  function scheduleInstall() {
    clearTimeout(installTimer);
    installTimer = setTimeout(install, 60);
  }

  function handleClick(event) {
    const button = event.target.closest?.('.dp-free-edit, .dp-free-save, .dp-free-delete');
    if (!button) return;
    const row = button.closest('tr');
    if (!row) return;

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
    else row.remove();
    scheduleInstall();
  }

  function addStyle() {
    if (document.getElementById('dpFreeRowEditControlsStyle')) return;
    const style = document.createElement('style');
    style.id = 'dpFreeRowEditControlsStyle';
    style.textContent = `
      .dp-free-row-actions{display:flex!important;gap:6px;align-items:center;flex-wrap:wrap;margin-right:6px}
      .dp-free-row-actions button{display:inline-flex;border:1px solid #cbd5e1;border-radius:8px;padding:6px 9px;background:#fff;font-weight:800;cursor:pointer}
      .dp-free-row-actions button[hidden]{display:none!important}
      .dp-free-row-actions .dp-free-save{background:#0f172a;color:#fff;border-color:#0f172a}
      .dp-free-row-actions .dp-free-delete{background:#fff1f2;color:#b91c1c;border-color:#fecdd3}
      @media(max-width:760px){.dp-free-row-actions{width:100%;margin-top:6px}}
    `;
    document.head.appendChild(style);
  }

  addStyle();
  document.addEventListener('click', handleClick, true);
  document.addEventListener('change', (event) => {
    if (event.target.closest?.('table')) scheduleInstall();
  }, true);

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length)) {
      scheduleInstall();
    }
  });

  const start = () => {
    install();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
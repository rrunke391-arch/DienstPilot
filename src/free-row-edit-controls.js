(() => {
  'use strict';

  if (window.__dienstpilotFreeRowEditControlsV1) return;
  window.__dienstpilotFreeRowEditControlsV1 = true;

  const text = (node) => String(node?.textContent || '').trim().toLowerCase();
  const valueOf = (cell) => {
    const field = cell?.querySelector('input, select, textarea');
    return String(field?.value ?? cell?.textContent ?? '').trim();
  };

  function isTargetTable(table) {
    const headers = [...table.querySelectorAll('thead th, tr:first-child th')].map(text);
    return headers.includes('name') && headers.includes('dienst')
      && headers.includes('kennzeichen') && headers.includes('beginn')
      && headers.includes('ende');
  }

  function isFreeRow(row) {
    return valueOf(row.cells?.[1]).toLowerCase() === 'frei';
  }

  function editableFields(row) {
    return [row.cells?.[0], row.cells?.[1]]
      .flatMap((cell) => [...(cell?.querySelectorAll('input, select, textarea') || [])]);
  }

  function setEditing(row, editing) {
    editableFields(row).forEach((field) => {
      field.disabled = !editing;
      field.readOnly = !editing;
      field.toggleAttribute('aria-disabled', !editing);
    });
    row.dataset.dpFreeEditing = editing ? '1' : '0';
    row.querySelector('.dp-free-edit')?.toggleAttribute('hidden', editing);
    row.querySelector('.dp-free-save')?.toggleAttribute('hidden', !editing);
  }

  function findOriginalDelete(row) {
    const buttons = [...row.querySelectorAll('button')]
      .filter((button) => !button.closest('.dp-free-row-actions'));
    return row.querySelector('[data-delete], .delete-row, .remove-row, .btn-delete')
      || buttons.find((button) => /löschen|entfernen|^×$|^x$/i.test(String(button.textContent || '').trim()))
      || buttons.at(-1)
      || null;
  }

  function enhanceRow(row) {
    if (!isFreeRow(row)) return;
    if (row.querySelector('.dp-free-row-actions')) return;

    const actionCell = row.cells?.[row.cells.length - 1];
    if (!actionCell) return;

    const actions = document.createElement('div');
    actions.className = 'dp-free-row-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'dp-free-edit';
    edit.textContent = 'Bearbeiten';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'dp-free-save';
    save.textContent = 'Speichern';
    save.hidden = true;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'dp-free-delete';
    remove.textContent = 'Löschen';

    edit.addEventListener('click', () => setEditing(row, true));

    save.addEventListener('click', () => {
      editableFields(row).forEach((field) => {
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      });
      setEditing(row, false);
    });

    remove.addEventListener('click', () => {
      if (!window.confirm('Diesen Frei-Eintrag wirklich löschen?')) return;
      const originalDelete = findOriginalDelete(row);
      if (originalDelete && !originalDelete.disabled) originalDelete.click();
      else row.remove();
    });

    actions.append(edit, save, remove);
    actionCell.prepend(actions);
    setEditing(row, false);
  }

  function install() {
    document.querySelectorAll('table').forEach((table) => {
      if (!isTargetTable(table)) return;
      table.querySelectorAll('tbody tr').forEach(enhanceRow);
    });
  }

  function addStyle() {
    if (document.getElementById('dpFreeRowEditControlsStyle')) return;
    const style = document.createElement('style');
    style.id = 'dpFreeRowEditControlsStyle';
    style.textContent = `
      .dp-free-row-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-right:6px}
      .dp-free-row-actions button{border:1px solid #cbd5e1;border-radius:8px;padding:6px 9px;background:#fff;font-weight:800;cursor:pointer}
      .dp-free-row-actions .dp-free-save{background:#0f172a;color:#fff;border-color:#0f172a}
      .dp-free-row-actions .dp-free-delete{background:#fff1f2;color:#b91c1c;border-color:#fecdd3}
      @media(max-width:760px){.dp-free-row-actions{width:100%;margin-top:6px}}
    `;
    document.head.appendChild(style);
  }

  addStyle();
  const observer = new MutationObserver(() => install());
  const start = () => {
    install();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

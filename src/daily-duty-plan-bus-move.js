(() => {
  'use strict';

  const TABLE_ID = 'dpDailyPlanRows';
  const HELP_ID = 'dpDailyBusMoveHelp';
  const STYLE_ID = 'dpDailyBusMoveStyle';
  let selectedRowId = '';
  let draggedRowId = '';
  let dragEndedAt = 0;

  function escapeSelector(value) {
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(String(value || ''));
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  function rowById(rowId) {
    return document.querySelector(`#${TABLE_ID} tr[data-row-id="${escapeSelector(rowId)}"]`);
  }

  function busInput(row) {
    return row?.querySelector('input[data-field="bus"]') || null;
  }

  function driverName(row) {
    return String(row?.querySelector('input[data-field="name"]')?.value || 'den gewählten Fahrer').trim() || 'den gewählten Fahrer';
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status' + (kind ? ' ' + kind : '');
  }

  function dispatchInput(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function clearDropMarks() {
    document.querySelectorAll(`#${TABLE_ID} .dp-bus-drop-target`).forEach((cell) => cell.classList.remove('dp-bus-drop-target'));
  }

  function showSelectedRow() {
    document.querySelectorAll(`#${TABLE_ID} tr.dp-bus-selected`).forEach((row) => row.classList.remove('dp-bus-selected'));
    if (!selectedRowId) return;
    rowById(selectedRowId)?.classList.add('dp-bus-selected');
  }

  function clearSelection() {
    selectedRowId = '';
    showSelectedRow();
    clearDropMarks();
  }

  function moveBus(sourceRowId, targetRowId) {
    if (!sourceRowId || !targetRowId || sourceRowId === targetRowId) {
      clearSelection();
      return false;
    }

    const sourceRow = rowById(sourceRowId);
    const targetRow = rowById(targetRowId);
    const sourceInput = busInput(sourceRow);
    const targetInput = busInput(targetRow);
    if (!sourceInput || !targetInput || sourceInput.disabled || targetInput.disabled) {
      setStatus('Das Buskennzeichen kann in diesem Dienstplan nicht verschoben werden.', 'error');
      clearSelection();
      return false;
    }

    const sourceBus = String(sourceInput.value || '').trim();
    const targetBus = String(targetInput.value || '').trim();
    if (!sourceBus) {
      setStatus('In der ausgewählten Zeile ist kein Buskennzeichen eingetragen.', 'error');
      clearSelection();
      return false;
    }

    sourceInput.value = targetBus;
    targetInput.value = sourceBus;
    dispatchInput(sourceInput);
    dispatchInput(targetInput);

    const sourceName = driverName(sourceRow);
    const targetName = driverName(targetRow);
    if (targetBus) {
      setStatus(`${sourceBus} wurde zu ${targetName} verschoben. ${targetBus} wurde gleichzeitig zu ${sourceName} getauscht.`, 'ok');
    } else {
      setStatus(`${sourceBus} wurde zu ${targetName} verschoben.`, 'ok');
    }
    clearSelection();
    return true;
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dp-bus-move-help{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-weight:800}
      .dp-bus-move-help strong{white-space:nowrap}.dp-bus-assign{display:grid;grid-template-columns:38px minmax(0,1fr);gap:6px;align-items:center}
      .dp-bus-drag-handle{width:38px;height:38px;border:1px solid #93c5fd;border-radius:9px;background:#dbeafe;color:#1d4ed8;font-size:21px;font-weight:900;cursor:grab;touch-action:manipulation}
      .dp-bus-drag-handle:active{cursor:grabbing}.dp-bus-drag-handle:disabled{display:none}
      #${TABLE_ID} td.dp-bus-cell{transition:background-color .15s,box-shadow .15s}
      #${TABLE_ID} td.dp-bus-drop-target{background:#dcfce7;box-shadow:inset 0 0 0 2px #16a34a}
      #${TABLE_ID} tr.dp-bus-selected td.dp-bus-cell{background:#fef3c7;box-shadow:inset 0 0 0 2px #f59e0b}
      body.dp-daily-readonly .dp-bus-drag-handle,body.dp-daily-readonly .dp-bus-move-help{display:none!important}
      @media(max-width:760px){.dp-bus-move-help{align-items:flex-start;flex-direction:column}.dp-bus-drag-handle{width:42px;height:42px}}
    `;
    document.head.appendChild(style);
  }

  function installHelp() {
    if (document.getElementById(HELP_ID)) return;
    const tableWrap = document.querySelector('#tab-daily-duty-plan .dp-daily-table-wrap');
    if (!tableWrap) return;
    const help = document.createElement('div');
    help.id = HELP_ID;
    help.className = 'dp-bus-move-help dp-daily-edit-only';
    help.innerHTML = '<strong>Bus verschieben:</strong><span>Das ⇄-Symbol am Kennzeichen zum gewünschten Fahrer ziehen. Auf Handy oder Tablet zuerst ⇄ am Bus antippen und danach die Kennzeichen-Spalte des gewünschten Fahrers antippen. Ein vorhandenes Kennzeichen wird automatisch getauscht.</span>';
    tableWrap.insertAdjacentElement('beforebegin', help);
  }

  function enhanceRows() {
    const rows = document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`);
    rows.forEach((row) => {
      const input = busInput(row);
      if (!input) return;
      const cell = input.closest('td');
      if (!cell) return;
      cell.classList.add('dp-bus-cell');

      let wrapper = input.closest('.dp-bus-assign');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'dp-bus-assign';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
      }

      let handle = wrapper.querySelector('.dp-bus-drag-handle');
      if (!handle) {
        handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'dp-bus-drag-handle dp-daily-edit-only';
        handle.textContent = '⇄';
        handle.title = 'Buskennzeichen zu einem anderen Fahrer verschieben';
        handle.setAttribute('aria-label', 'Buskennzeichen zu einem anderen Fahrer verschieben');
        wrapper.insertBefore(handle, input);
      }
      handle.dataset.rowId = row.dataset.rowId || '';
      handle.draggable = !input.disabled;
      handle.disabled = input.disabled;
    });
    showSelectedRow();
  }

  function refresh() {
    addStyle();
    installHelp();
    enhanceRows();
  }

  document.addEventListener('dragstart', (event) => {
    const handle = event.target.closest?.('.dp-bus-drag-handle');
    if (!handle) return;
    const row = handle.closest('tr[data-row-id]');
    const input = busInput(row);
    if (!row || !input || input.disabled || !String(input.value || '').trim()) {
      event.preventDefault();
      setStatus('Bitte zuerst ein Buskennzeichen in dieser Zeile eintragen.', 'error');
      return;
    }
    draggedRowId = row.dataset.rowId || '';
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedRowId);
    event.dataTransfer.setData('application/x-dienstpilot-bus-row', draggedRowId);
    row.classList.add('dp-bus-selected');
  }, true);

  document.addEventListener('dragover', (event) => {
    if (!draggedRowId) return;
    const cell = event.target.closest?.(`#${TABLE_ID} td.dp-bus-cell`);
    if (!cell) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearDropMarks();
    cell.classList.add('dp-bus-drop-target');
  });

  document.addEventListener('dragleave', (event) => {
    const cell = event.target.closest?.(`#${TABLE_ID} td.dp-bus-cell`);
    if (cell && !cell.contains(event.relatedTarget)) cell.classList.remove('dp-bus-drop-target');
  });

  document.addEventListener('drop', (event) => {
    const cell = event.target.closest?.(`#${TABLE_ID} td.dp-bus-cell`);
    if (!cell) return;
    event.preventDefault();
    const targetRow = cell.closest('tr[data-row-id]');
    const sourceId = event.dataTransfer.getData('application/x-dienstpilot-bus-row') || event.dataTransfer.getData('text/plain') || draggedRowId;
    moveBus(sourceId, targetRow?.dataset.rowId || '');
    draggedRowId = '';
    dragEndedAt = Date.now();
  });

  document.addEventListener('dragend', () => {
    draggedRowId = '';
    dragEndedAt = Date.now();
    clearDropMarks();
    document.querySelectorAll(`#${TABLE_ID} tr.dp-bus-selected`).forEach((row) => row.classList.remove('dp-bus-selected'));
  });

  document.addEventListener('click', (event) => {
    const handle = event.target.closest?.('.dp-bus-drag-handle');
    const targetCell = event.target.closest?.(`#${TABLE_ID} td.dp-bus-cell`);

    if (handle) {
      if (Date.now() - dragEndedAt < 300) return;
      const row = handle.closest('tr[data-row-id]');
      const input = busInput(row);
      if (!row || !input || input.disabled) return;
      const rowId = row.dataset.rowId || '';
      if (!String(input.value || '').trim()) {
        setStatus('Bitte zuerst ein Buskennzeichen in dieser Zeile eintragen.', 'error');
        return;
      }
      if (selectedRowId === rowId) {
        clearSelection();
        setStatus('Busverschiebung abgebrochen.');
        return;
      }
      if (selectedRowId) {
        moveBus(selectedRowId, rowId);
        return;
      }
      selectedRowId = rowId;
      showSelectedRow();
      setStatus(`${input.value.trim()} ist ausgewählt. Jetzt beim gewünschten Fahrer in die Kennzeichen-Spalte tippen.`);
      return;
    }

    if (selectedRowId && targetCell) {
      const targetRow = targetCell.closest('tr[data-row-id]');
      moveBus(selectedRowId, targetRow?.dataset.rowId || '');
      return;
    }

    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults')) {
      [0, 80, 250].forEach((delay) => window.setTimeout(refresh, delay));
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && selectedRowId) {
      clearSelection();
      setStatus('Busverschiebung abgebrochen.');
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.closest?.(`#${TABLE_ID} input[data-field="bus"]`)) window.setTimeout(refresh, 0);
  });

  [0, 200, 600, 1200, 2500].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  window.setInterval(refresh, 1500);
})();

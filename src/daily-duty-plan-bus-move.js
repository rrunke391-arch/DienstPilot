(() => {
  'use strict';

  const TABLE_ID = 'dpDailyPlanRows';
  const HELP_ID = 'dpDailyBusMoveHelp';
  const STYLE_ID = 'dpDailyBusMoveStyle';
  let selectedRef = null;
  let draggedRef = null;
  let dragEndedAt = 0;
  let observer = null;
  let refreshTimer = 0;

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  }

  function makeRowRef(row) {
    if (!row) return null;
    const allRows = rows();
    const index = allRows.indexOf(row);
    const rowId = String(row.dataset.rowId || '');
    const sameId = rowId ? allRows.filter((item) => String(item.dataset.rowId || '') === rowId) : [];
    return {
      element: row,
      index,
      rowId,
      occurrence: rowId ? sameId.indexOf(row) : -1
    };
  }

  function resolveRow(ref) {
    if (!ref) return null;
    if (ref.element?.isConnected) return ref.element;

    const allRows = rows();
    if (ref.rowId) {
      const sameId = allRows.filter((row) => String(row.dataset.rowId || '') === ref.rowId);
      if (ref.occurrence >= 0 && sameId[ref.occurrence]) return sameId[ref.occurrence];
    }

    return ref.index >= 0 ? allRows[ref.index] || null : null;
  }

  function busInput(row) {
    return row?.querySelector('input[data-field="bus"]') || null;
  }

  function driverName(row) {
    const select = row?.querySelector('.dp-daily-driver-select');
    const input = row?.querySelector('input[data-field="name"]');
    return String(select?.value || input?.value || 'den gewählten Fahrer').trim() || 'den gewählten Fahrer';
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
    document.querySelectorAll(`#${TABLE_ID} .dp-bus-drop-target`).forEach((element) => {
      element.classList.remove('dp-bus-drop-target');
    });
  }

  function markDropRow(row) {
    clearDropMarks();
    row?.querySelector('td.dp-bus-cell')?.classList.add('dp-bus-drop-target');
  }

  function showSelectedRow() {
    document.querySelectorAll(`#${TABLE_ID} tr.dp-bus-selected`).forEach((row) => {
      row.classList.remove('dp-bus-selected');
    });

    const row = resolveRow(selectedRef);
    if (!row) {
      selectedRef = null;
      return;
    }
    selectedRef = makeRowRef(row);
    row.classList.add('dp-bus-selected');
  }

  function clearSelection() {
    selectedRef = null;
    showSelectedRow();
    clearDropMarks();
  }

  function moveBus(source, target) {
    const sourceRow = source?.nodeType === 1 ? source : resolveRow(source);
    const targetRow = target?.nodeType === 1 ? target : resolveRow(target);

    if (!sourceRow || !targetRow || sourceRow === targetRow) {
      clearSelection();
      return false;
    }

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
      .dp-bus-drag-handle{width:38px;height:38px;border:1px solid #93c5fd;border-radius:9px;background:#dbeafe;color:#1d4ed8;font-size:21px;font-weight:900;cursor:grab;touch-action:manipulation;user-select:none}
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
    help.innerHTML = '<strong>Bus verschieben:</strong><span>Das ⇄-Symbol am Kennzeichen zum gewünschten Fahrer ziehen. Die gesamte Zielzeile kann verwendet werden. Auf Handy oder Tablet zuerst ⇄ am Bus antippen und danach die Zeile des gewünschten Fahrers antippen. Ein vorhandenes Kennzeichen wird automatisch getauscht.</span>';
    tableWrap.insertAdjacentElement('beforebegin', help);
  }

  function enhanceRows() {
    rows().forEach((row) => {
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
      handle.draggable = !input.disabled;
      handle.disabled = input.disabled;
    });
    showSelectedRow();
  }

  function installObserver() {
    const body = document.getElementById(TABLE_ID);
    if (!body || observer) return;
    observer = new MutationObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, 0);
    });
    observer.observe(body, { childList: true, subtree: true });
  }

  function refresh() {
    addStyle();
    installHelp();
    enhanceRows();
    installObserver();
  }

  function eventRow(event) {
    return event.target.closest?.(`#${TABLE_ID} tr[data-row-id]`) || null;
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

    draggedRef = makeRowRef(row);
    selectedRef = null;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(row.dataset.rowId || 'dienstpilot-bus'));
    row.classList.add('dp-bus-selected');
  }, true);

  document.addEventListener('dragover', (event) => {
    if (!draggedRef) return;
    const targetRow = eventRow(event);
    const sourceRow = resolveRow(draggedRef);
    const targetInput = busInput(targetRow);
    if (!targetRow || targetRow === sourceRow || !targetInput || targetInput.disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    markDropRow(targetRow);
  });

  document.addEventListener('dragleave', (event) => {
    const targetRow = eventRow(event);
    if (targetRow && !targetRow.contains(event.relatedTarget)) clearDropMarks();
  });

  document.addEventListener('drop', (event) => {
    if (!draggedRef) return;
    const targetRow = eventRow(event);
    if (!targetRow) return;
    event.preventDefault();
    moveBus(draggedRef, targetRow);
    draggedRef = null;
    dragEndedAt = Date.now();
  });

  document.addEventListener('dragend', () => {
    draggedRef = null;
    dragEndedAt = Date.now();
    clearDropMarks();
    document.querySelectorAll(`#${TABLE_ID} tr.dp-bus-selected`).forEach((row) => row.classList.remove('dp-bus-selected'));
  });

  document.addEventListener('click', (event) => {
    const handle = event.target.closest?.('.dp-bus-drag-handle');
    const targetRow = eventRow(event);

    if (handle) {
      if (Date.now() - dragEndedAt < 350) return;
      const row = handle.closest('tr[data-row-id]');
      const input = busInput(row);
      if (!row || !input || input.disabled) return;
      if (!String(input.value || '').trim()) {
        setStatus('Bitte zuerst ein Buskennzeichen in dieser Zeile eintragen.', 'error');
        return;
      }

      const selectedRow = resolveRow(selectedRef);
      if (selectedRow === row) {
        clearSelection();
        setStatus('Busverschiebung abgebrochen.');
        return;
      }
      if (selectedRow) {
        event.preventDefault();
        event.stopImmediatePropagation();
        moveBus(selectedRef, row);
        return;
      }

      selectedRef = makeRowRef(row);
      showSelectedRow();
      setStatus(`${input.value.trim()} ist ausgewählt. Jetzt die Zeile des gewünschten Fahrers antippen.`);
      return;
    }

    const sourceRow = resolveRow(selectedRef);
    if (sourceRow && targetRow && targetRow !== sourceRow) {
      event.preventDefault();
      event.stopImmediatePropagation();
      moveBus(selectedRef, targetRow);
      return;
    }

    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailyPlanRows [data-action]')) {
      [0, 80, 250].forEach((delay) => window.setTimeout(refresh, delay));
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && selectedRef) {
      clearSelection();
      setStatus('Busverschiebung abgebrochen.');
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.closest?.(`#${TABLE_ID} input[data-field="bus"]`)) window.setTimeout(refresh, 0);
  });

  [0, 150, 400, 900, 1800].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  window.setInterval(refresh, 1500);
})();
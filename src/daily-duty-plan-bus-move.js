(() => {
  'use strict';

  if (window.__dienstpilotBusMoveCleanV3) return;
  window.__dienstpilotBusMoveCleanV3 = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const HELP_ID = 'dpDailyBusMoveHelp';
  const STYLE_ID = 'dpDailyBusMoveStyle';

  let selectedRef = null;
  let draggedRef = null;
  let dragEndedAt = 0;
  let observer = null;
  let observedBody = null;
  let refreshTimer = 0;

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  }

  function makeRowRef(row) {
    if (!row) return null;
    const all = rows();
    const rowId = String(row.dataset.rowId || '');
    const sameId = rowId ? all.filter((item) => String(item.dataset.rowId || '') === rowId) : [];
    return {
      element: row,
      index: all.indexOf(row),
      rowId,
      occurrence: rowId ? sameId.indexOf(row) : -1
    };
  }

  function resolveRow(ref) {
    if (!ref) return null;
    if (ref.element?.isConnected) return ref.element;

    const all = rows();
    if (ref.rowId) {
      const sameId = all.filter((row) => String(row.dataset.rowId || '') === ref.rowId);
      if (ref.occurrence >= 0 && sameId[ref.occurrence]) return sameId[ref.occurrence];
    }
    return ref.index >= 0 ? all[ref.index] || null : null;
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
    status.className = 'dp-daily-status' + (kind ? ` ${kind}` : '');
  }

  function dispatchValue(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function resetVisualState() {
    rows().forEach((row) => {
      row.classList.remove('dp-bus-selected', 'dp-bus-drop-row');
      const handle = row.querySelector('.dp-bus-drag-handle');
      if (!handle) return;
      handle.classList.remove('dp-bus-source-button', 'dp-bus-target-button');
      handle.textContent = '⇄';
      handle.title = 'Buskennzeichen auswählen oder zu einem anderen Fahrer ziehen';
      handle.setAttribute('aria-label', handle.title);
    });
  }

  function renderSelection() {
    resetVisualState();
    const sourceRow = resolveRow(selectedRef);
    if (!sourceRow) {
      selectedRef = null;
      return;
    }

    selectedRef = makeRowRef(sourceRow);
    sourceRow.classList.add('dp-bus-selected');

    rows().forEach((row) => {
      const handle = row.querySelector('.dp-bus-drag-handle');
      const input = busInput(row);
      if (!handle || !input || input.disabled) return;

      if (row === sourceRow) {
        handle.classList.add('dp-bus-source-button');
        handle.textContent = '×';
        handle.title = 'Verschieben abbrechen';
      } else {
        handle.classList.add('dp-bus-target-button');
        handle.textContent = '→';
        handle.title = `Kennzeichen zu ${driverName(row)} verschieben`;
      }
      handle.setAttribute('aria-label', handle.title);
    });
  }

  function clearSelection() {
    selectedRef = null;
    draggedRef = null;
    resetVisualState();
  }

  function moveBus(source, target) {
    const sourceRow = source?.nodeType === 1 ? source : resolveRow(source);
    const targetRow = target?.nodeType === 1 ? target : resolveRow(target);

    if (!sourceRow || !targetRow) {
      setStatus('Die ausgewählte Zeile ist nicht mehr vorhanden. Bitte erneut auswählen.', 'error');
      clearSelection();
      return false;
    }
    if (sourceRow === targetRow) {
      clearSelection();
      setStatus('Busverschiebung abgebrochen.');
      return false;
    }

    const sourceInput = busInput(sourceRow);
    const targetInput = busInput(targetRow);
    if (!sourceInput || !targetInput || sourceInput.disabled || targetInput.disabled) {
      setStatus('Das Buskennzeichen kann in dieser Zeile nicht verschoben werden.', 'error');
      clearSelection();
      return false;
    }

    const sourceBus = String(sourceInput.value || '').trim();
    const targetBus = String(targetInput.value || '').trim();
    if (!sourceBus) {
      setStatus('In der ausgewählten Ausgangszeile ist kein Buskennzeichen eingetragen.', 'error');
      clearSelection();
      return false;
    }

    sourceInput.value = targetBus;
    targetInput.value = sourceBus;
    dispatchValue(sourceInput);
    dispatchValue(targetInput);

    const sourceName = driverName(sourceRow);
    const targetName = driverName(targetRow);
    if (targetBus) {
      setStatus(`${sourceBus} wurde zu ${targetName} verschoben. ${targetBus} wurde zu ${sourceName} getauscht.`, 'ok');
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
      .dp-bus-move-help strong{white-space:nowrap}
      .dp-bus-assign{display:grid;grid-template-columns:38px minmax(0,1fr);gap:6px;align-items:center}
      .dp-bus-drag-handle{width:38px;height:38px;border:1px solid #93c5fd;border-radius:9px;background:#dbeafe;color:#1d4ed8;font-size:21px;font-weight:900;cursor:grab;touch-action:manipulation;user-select:none}
      .dp-bus-drag-handle:active{cursor:grabbing}
      .dp-bus-drag-handle:disabled{display:none}
      .dp-bus-drag-handle.dp-bus-source-button{background:#fef3c7;border-color:#f59e0b;color:#92400e;cursor:pointer}
      .dp-bus-drag-handle.dp-bus-target-button{background:#dcfce7;border-color:#16a34a;color:#166534;cursor:pointer}
      #${TABLE_ID} td.dp-bus-cell{transition:background-color .15s,box-shadow .15s}
      #${TABLE_ID} tr.dp-bus-selected td.dp-bus-cell{background:#fef3c7;box-shadow:inset 0 0 0 2px #f59e0b}
      #${TABLE_ID} tr.dp-bus-drop-row td.dp-bus-cell{background:#dcfce7;box-shadow:inset 0 0 0 2px #16a34a}
      body.dp-daily-readonly .dp-bus-drag-handle,body.dp-daily-readonly .dp-bus-move-help{display:none!important}
      @media(max-width:760px){.dp-bus-move-help{align-items:flex-start;flex-direction:column}.dp-bus-drag-handle{width:42px;height:42px}}
    `;
    document.head.appendChild(style);
  }

  function installHelp() {
    const tableWrap = document.querySelector('#tab-daily-duty-plan .dp-daily-table-wrap');
    if (!tableWrap) return;

    let help = document.getElementById(HELP_ID);
    if (!help) {
      help = document.createElement('div');
      help.id = HELP_ID;
      help.className = 'dp-bus-move-help dp-daily-edit-only';
      tableWrap.insertAdjacentElement('beforebegin', help);
    }
    help.innerHTML = '<strong>Bus verschieben:</strong><span>Beim gewünschten Kennzeichen auf ⇄ klicken. Danach beim Zielfahrer den grünen →-Knopf anklicken. Auch leere Kennzeichenfelder sind als Ziel möglich. Am PC kann das ⇄-Symbol zusätzlich gezogen werden.</span>';
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
        wrapper.insertBefore(handle, input);
      }
      handle.disabled = input.disabled;
      handle.draggable = !input.disabled;
    });
    renderSelection();
  }

  function installObserver() {
    const body = document.getElementById(TABLE_ID);
    if (!body) return;
    if (observer && observedBody === body) return;
    observer?.disconnect();
    observedBody = body;
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

  function rowFromEvent(event) {
    return event.target.closest?.(`#${TABLE_ID} tr[data-row-id]`) || null;
  }

  window.addEventListener('click', (event) => {
    const handle = event.target.closest?.('.dp-bus-drag-handle');
    if (!handle) return;

    event.preventDefault();
    event.stopPropagation();
    if (Date.now() - dragEndedAt < 350) return;

    const row = handle.closest('tr[data-row-id]');
    const input = busInput(row);
    if (!row || !input || input.disabled) return;

    const sourceRow = resolveRow(selectedRef);
    if (sourceRow) {
      if (sourceRow === row) {
        clearSelection();
        setStatus('Busverschiebung abgebrochen.');
      } else {
        moveBus(selectedRef, row);
      }
      return;
    }

    if (!String(input.value || '').trim()) {
      setStatus('In dieser Zeile ist kein Buskennzeichen eingetragen. Bitte beim zu verschiebenden Kennzeichen auf ⇄ klicken.', 'error');
      return;
    }

    selectedRef = makeRowRef(row);
    renderSelection();
    setStatus(`${input.value.trim()} ist ausgewählt. Jetzt beim Zielfahrer den grünen →-Knopf anklicken.`);
  }, true);

  window.addEventListener('dragstart', (event) => {
    const handle = event.target.closest?.('.dp-bus-drag-handle');
    if (!handle) return;

    const row = handle.closest('tr[data-row-id]');
    const input = busInput(row);
    if (!row || !input || input.disabled || !String(input.value || '').trim()) {
      event.preventDefault();
      event.stopPropagation();
      setStatus('Dieses Kennzeichenfeld ist leer und kann nicht als Ausgangspunkt verwendet werden.', 'error');
      return;
    }

    event.stopPropagation();
    selectedRef = null;
    draggedRef = makeRowRef(row);
    resetVisualState();
    row.classList.add('dp-bus-selected');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(row.dataset.rowId || 'dienstpilot-bus'));
  }, true);

  window.addEventListener('dragover', (event) => {
    if (!draggedRef) return;
    const targetRow = rowFromEvent(event);
    const sourceRow = resolveRow(draggedRef);
    const targetInput = busInput(targetRow);
    if (!targetRow || targetRow === sourceRow || !targetInput || targetInput.disabled) return;

    event.preventDefault();
    event.stopPropagation();
    rows().forEach((row) => row.classList.remove('dp-bus-drop-row'));
    targetRow.classList.add('dp-bus-drop-row');
    event.dataTransfer.dropEffect = 'move';
  }, true);

  window.addEventListener('drop', (event) => {
    if (!draggedRef) return;
    const targetRow = rowFromEvent(event);
    if (!targetRow) return;

    event.preventDefault();
    event.stopPropagation();
    moveBus(draggedRef, targetRow);
    draggedRef = null;
    dragEndedAt = Date.now();
  }, true);

  window.addEventListener('dragend', (event) => {
    if (!event.target.closest?.('.dp-bus-drag-handle') && !draggedRef) return;
    event.stopPropagation();
    draggedRef = null;
    dragEndedAt = Date.now();
    resetVisualState();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || (!selectedRef && !draggedRef)) return;
    event.stopPropagation();
    clearSelection();
    setStatus('Busverschiebung abgebrochen.');
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.matches?.(`#${TABLE_ID} input[data-field="bus"]`)) window.setTimeout(refresh, 0);
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailyPlanRows [data-action]')) {
      [0, 80, 250].forEach((delay) => window.setTimeout(refresh, delay));
    }
  }, true);

  [0, 150, 400, 900, 1800].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  window.setInterval(refresh, 1500);
})();
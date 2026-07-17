(() => {
  'use strict';

  if (window.__dienstpilotWorkshopVehiclesV1) return;
  window.__dienstpilotWorkshopVehiclesV1 = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const API_URL = `${API_BASE}/api/data/workshop_vehicles`;
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const LOCAL_KEY = 'dienstpilot_workshop_vehicles_v1';
  const SETTINGS_ID = 'tab-einstellungen';
  const TABLE_ID = 'dpDailyPlanRows';
  const CARD_ID = 'dpWorkshopCard';
  const PANEL_ID = 'dpWorkshopPanel';
  const WARNING_ID = 'dpWorkshopDailyWarning';
  const STYLE_ID = 'dpWorkshopStyle';
  const MANUAL_VALUE = '__manual__';

  const KNOWN_PLATES = [
    'OS-LK 621', 'OS-TG 324', 'OS-GZ 123', 'OS-LF 223', 'OS-RE 224',
    'OS-NP 617', 'OS-JY 122', 'OS-SU 722', 'OS-GO 717', 'OS-KX 220',
    'OS-OP 622', 'OS-ZT 626', 'OS-KF 526', 'OS-YG 120', 'OS-XB 925',
    'OS-WP 918', 'OS-EV 118', 'OS-BU 816', 'OS-PK 216', 'OS-RS 725',
    'OS-DZ 116', 'OS-UL 818', 'OS-JF 215', 'OS-HD 124', 'OS-FN 919',
    'OS-AX 716', 'OS-MR 825', 'OS-CL 916', 'OS-QS 519', 'OS-VH 721'
  ];

  let state = readLocal();
  let remoteLoaded = false;
  let remoteLoading = false;
  let saveTimer = 0;
  let enforceTimer = 0;
  let observer = null;
  let observedBody = null;
  let previewObserver = null;
  let observedPreview = null;
  let enforcing = false;
  let lastClearedSignature = '';

  function normalizePlate(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeState(value) {
    const source = value && typeof value === 'object' ? value : {};
    const active = [];
    const seen = new Set();

    (Array.isArray(source.active) ? source.active : []).forEach((entry) => {
      const plate = normalizePlate(typeof entry === 'string' ? entry : entry?.plate);
      if (!plate || plate === 'OS-XX 123' || seen.has(plate)) return;
      seen.add(plate);
      active.push({
        plate,
        note: String(entry?.note || '').trim(),
        startedAt: String(entry?.startedAt || new Date().toISOString()),
        startedBy: String(entry?.startedBy || '').trim()
      });
    });

    const history = (Array.isArray(source.history) ? source.history : [])
      .map((entry) => ({
        plate: normalizePlate(entry?.plate),
        note: String(entry?.note || '').trim(),
        startedAt: String(entry?.startedAt || ''),
        startedBy: String(entry?.startedBy || '').trim(),
        completedAt: String(entry?.completedAt || ''),
        completedBy: String(entry?.completedBy || '').trim()
      }))
      .filter((entry) => entry.plate)
      .slice(-100);

    return {
      active,
      history,
      updatedAt: String(source.updatedAt || '')
    };
  }

  function readLocal() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'));
    } catch {
      return normalizeState({});
    }
  }

  function writeLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  }

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {};
    } catch {
      return {};
    }
  }

  function currentUserName() {
    const user = currentUser();
    return String(user.displayName || user.username || '').trim();
  }

  function currentRole() {
    const user = currentUser();
    return normalizeText(user.role || sessionStorage.getItem(ROLE_KEY));
  }

  function canManage() {
    const role = currentRole();
    return role === 'geschaftsleitung' || role === 'geschaeftsleitung' || role === 'disposition';
  }

  function activeSet() {
    return new Set(state.active.map((entry) => entry.plate));
  }

  function isBlocked(plate) {
    return activeSet().has(normalizePlate(plate));
  }

  window.dienstpilotIsVehicleInWorkshop = isBlocked;
  window.dienstpilotGetWorkshopVehicles = () => state.active.map((entry) => ({ ...entry }));

  function tokenHeaders(extra = {}) {
    const headers = new Headers(extra);
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  async function loadRemote(force = false) {
    if (remoteLoading || (remoteLoaded && !force)) return;
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;

    remoteLoading = true;
    try {
      const response = await fetch(API_URL, {
        cache: 'no-store',
        headers: tokenHeaders()
      });
      if (!response.ok) return;
      const wrapper = await response.json().catch(() => ({}));
      const remote = wrapper?.data && typeof wrapper.data === 'object' ? wrapper.data : wrapper;
      const hasRemoteData = remote && typeof remote === 'object'
        && (Array.isArray(remote.active) || Array.isArray(remote.history));

      if (hasRemoteData) {
        state = normalizeState(remote);
        writeLocal();
        notifyChanged();
      } else if (state.active.length || state.history.length) {
        scheduleSave(20);
      }
      remoteLoaded = true;
    } catch (error) {
      console.warn('Werkstattdaten konnten nicht geladen werden:', error);
    } finally {
      remoteLoading = false;
    }
  }

  async function saveRemote() {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;
    try {
      const response = await fetch(API_URL, {
        method: 'PUT',
        headers: tokenHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(state)
      });
      if (!response.ok) throw new Error(`Serverstatus ${response.status}`);
      setWorkshopStatus('Werkstattdaten wurden gespeichert.', 'ok');
    } catch (error) {
      console.warn('Werkstattdaten konnten nicht gespeichert werden:', error);
      setWorkshopStatus('Werkstattdaten sind nur auf diesem Gerät gespeichert.', 'error');
    }
  }

  function scheduleSave(delay = 120) {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void saveRemote(), delay);
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CARD_ID}{border:2px solid #f59e0b;background:#fffbeb}
      #${CARD_ID} .dp-workshop-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
      #${CARD_ID} .dp-workshop-title{display:flex;align-items:center;gap:10px;margin:0}
      #${CARD_ID} .dp-workshop-count{display:inline-flex;align-items:center;min-height:28px;padding:4px 9px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:950}
      #${CARD_ID} .dp-workshop-toggle{display:inline-flex;align-items:center;gap:9px;padding:9px 13px;border:1px solid #d97706;border-radius:999px;background:#fff;color:#92400e;font-weight:950;cursor:pointer}
      #${CARD_ID} .dp-workshop-toggle input{width:19px;height:19px;accent-color:#d97706;cursor:pointer}
      #${PANEL_ID}{margin-top:14px}
      #${PANEL_ID}[hidden]{display:none!important}
      #${PANEL_ID} .dp-workshop-add{display:grid;grid-template-columns:minmax(220px,1fr) minmax(220px,1.4fr) auto;gap:10px;align-items:end;padding:12px;border:1px solid #fcd34d;border-radius:12px;background:#fff}
      #${PANEL_ID} label{display:grid;gap:5px;font-size:12px;font-weight:900;color:#78350f}
      #${PANEL_ID} select,#${PANEL_ID} input{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #d97706;border-radius:9px;background:#fff;color:#111827;font:inherit;font-weight:800}
      #${PANEL_ID} .dp-workshop-add-button{padding:10px 15px;border:1px solid #b45309;border-radius:9px;background:#d97706;color:#fff;font:inherit;font-weight:950;cursor:pointer;white-space:nowrap}
      #${PANEL_ID} .dp-workshop-active{display:grid;gap:8px;margin-top:12px}
      #${PANEL_ID} .dp-workshop-item{display:grid;grid-template-columns:minmax(150px,.7fr) minmax(200px,1.3fr) auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid #f59e0b;border-radius:11px;background:#fff}
      #${PANEL_ID} .dp-workshop-plate{font-size:16px;font-weight:950;color:#991b1b}
      #${PANEL_ID} .dp-workshop-meta{font-size:12px;line-height:1.4;color:#475569;font-weight:750}
      #${PANEL_ID} .dp-workshop-complete{padding:8px 11px;border:1px solid #16a34a;border-radius:9px;background:#f0fdf4;color:#166534;font:inherit;font-weight:950;cursor:pointer}
      #${PANEL_ID} .dp-workshop-empty{padding:13px;border:1px dashed #d97706;border-radius:10px;background:#fff;color:#92400e;font-weight:850;text-align:center}
      #${PANEL_ID} .dp-workshop-status{min-height:20px;margin-top:8px;font-size:12px;font-weight:900}
      #${PANEL_ID} .dp-workshop-status.ok{color:#166534}#${PANEL_ID} .dp-workshop-status.error{color:#b91c1c}
      #${WARNING_ID}{margin:8px 0 10px;padding:10px 12px;border:1px solid #f59e0b;border-radius:11px;background:#fffbeb;color:#92400e;font-weight:950;line-height:1.35}
      #${TABLE_ID} .dp-vehicle-select option.dp-workshop-blocked{color:#991b1b}
      @media(max-width:900px){#${PANEL_ID} .dp-workshop-add,#${PANEL_ID} .dp-workshop-item{grid-template-columns:1fr}}
      @media print{#${CARD_ID},#${WARNING_ID}{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function collectPlates() {
    const set = new Set(KNOWN_PLATES.map(normalizePlate));
    state.active.forEach((entry) => set.add(entry.plate));
    document.querySelectorAll(`#${TABLE_ID} input[data-field="bus"],#${TABLE_ID} .dp-vehicle-select option`).forEach((node) => {
      const plate = normalizePlate(node.value || node.textContent);
      if (plate && plate !== 'OS-XX 123' && plate !== normalizePlate(MANUAL_VALUE)) set.add(plate);
    });
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' }));
  }

  function availablePlateOptions(selected = '') {
    const blocked = activeSet();
    const values = collectPlates().filter((plate) => !blocked.has(plate));
    const current = normalizePlate(selected);
    if (current && !blocked.has(current) && !values.includes(current)) values.unshift(current);
    return values.map((plate) => `<option value="${escapeHtml(plate)}">${escapeHtml(plate)}</option>`).join('');
  }

  function renderCard() {
    const settings = document.getElementById(SETTINGS_ID);
    if (!settings) return;

    if (!canManage()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }

    addStyle();
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'card';
      const firstCard = settings.querySelector(':scope > .card');
      settings.insertBefore(card, firstCard || settings.firstChild);
    }

    const wasOpen = Boolean(card.querySelector('#dpWorkshopToggle')?.checked);
    const count = state.active.length;
    card.innerHTML = `
      <div class="dp-workshop-header">
        <div>
          <h2 class="dp-workshop-title">🔧 Werkstatt <span class="dp-workshop-count">${count ? `${count} ${count === 1 ? 'Fahrzeug' : 'Fahrzeuge'} gesperrt` : 'keine Fahrzeuge gesperrt'}</span></h2>
          <p class="muted">Fahrzeuge zur Überprüfung sperren. Gesperrte Fahrzeuge können im Dienstplan nicht ausgewählt oder vergeben werden.</p>
        </div>
        <label class="dp-workshop-toggle"><input type="checkbox" id="dpWorkshopToggle"${wasOpen || count ? ' checked' : ''}><span>Werkstatt</span></label>
      </div>
      <div id="${PANEL_ID}"${wasOpen || count ? '' : ' hidden'}>
        <div class="dp-workshop-add">
          <label>Fahrzeug
            <select id="dpWorkshopPlate"><option value="">Kennzeichen auswählen</option>${availablePlateOptions()}<option value="${MANUAL_VALUE}">Anderes Kennzeichen eingeben …</option></select>
            <input id="dpWorkshopManualPlate" type="text" maxlength="20" placeholder="Kennzeichen eingeben" hidden>
          </label>
          <label>Prüfung oder Hinweis
            <input id="dpWorkshopNote" type="text" maxlength="100" placeholder="z. B. Bremsen prüfen">
          </label>
          <button type="button" class="dp-workshop-add-button" id="dpWorkshopAdd">Zur Überprüfung eintragen</button>
        </div>
        <div class="dp-workshop-active" id="dpWorkshopActive">${activeListHtml()}</div>
        <div class="dp-workshop-status" id="dpWorkshopStatus" role="status" aria-live="polite"></div>
      </div>`;

    bindCard();
  }

  function activeListHtml() {
    if (!state.active.length) {
      return '<div class="dp-workshop-empty">Zurzeit befindet sich kein Fahrzeug in der Werkstatt.</div>';
    }
    return [...state.active]
      .sort((a, b) => a.plate.localeCompare(b.plate, 'de', { numeric: true }))
      .map((entry) => `<div class="dp-workshop-item">
        <div class="dp-workshop-plate">${escapeHtml(entry.plate)}</div>
        <div class="dp-workshop-meta">Seit ${escapeHtml(formatDate(entry.startedAt))}${entry.startedBy ? ` · eingetragen von ${escapeHtml(entry.startedBy)}` : ''}${entry.note ? `<br>${escapeHtml(entry.note)}` : ''}</div>
        <button type="button" class="dp-workshop-complete" data-workshop-complete="${escapeHtml(entry.plate)}">Überprüfung abgeschlossen</button>
      </div>`).join('');
  }

  function bindCard() {
    const toggle = document.getElementById('dpWorkshopToggle');
    const panel = document.getElementById(PANEL_ID);
    toggle?.addEventListener('change', () => {
      if (panel) panel.hidden = !toggle.checked;
    });

    const plateSelect = document.getElementById('dpWorkshopPlate');
    const manualInput = document.getElementById('dpWorkshopManualPlate');
    plateSelect?.addEventListener('change', () => {
      const manual = plateSelect.value === MANUAL_VALUE;
      if (manualInput) {
        manualInput.hidden = !manual;
        if (manual) manualInput.focus({ preventScroll: true });
      }
    });

    document.getElementById('dpWorkshopAdd')?.addEventListener('click', addVehicle);
    document.querySelectorAll('[data-workshop-complete]').forEach((button) => {
      button.addEventListener('click', () => completeVehicle(button.dataset.workshopComplete));
    });
  }

  function selectedWorkshopPlate() {
    const select = document.getElementById('dpWorkshopPlate');
    if (!select) return '';
    if (select.value === MANUAL_VALUE) return normalizePlate(document.getElementById('dpWorkshopManualPlate')?.value);
    return normalizePlate(select.value);
  }

  function setWorkshopStatus(text, kind = '') {
    const node = document.getElementById('dpWorkshopStatus');
    if (!node) return;
    node.textContent = text;
    node.className = `dp-workshop-status${kind ? ` ${kind}` : ''}`;
  }

  function addVehicle() {
    if (!canManage()) return;
    const plate = selectedWorkshopPlate();
    if (!plate || plate === 'OS-XX 123') {
      setWorkshopStatus('Bitte ein gültiges Kennzeichen auswählen oder eingeben.', 'error');
      return;
    }
    if (isBlocked(plate)) {
      setWorkshopStatus(`${plate} befindet sich bereits in der Werkstatt.`, 'error');
      return;
    }

    state.active.push({
      plate,
      note: String(document.getElementById('dpWorkshopNote')?.value || '').trim(),
      startedAt: new Date().toISOString(),
      startedBy: currentUserName()
    });
    state.updatedAt = new Date().toISOString();
    state = normalizeState(state);
    writeLocal();
    notifyChanged();
    renderCard();
    setWorkshopStatus(`${plate} wurde gesperrt und aus dem Dienstplan entfernt.`, 'ok');
    scheduleSave();
  }

  function completeVehicle(rawPlate) {
    if (!canManage()) return;
    const plate = normalizePlate(rawPlate);
    const index = state.active.findIndex((entry) => entry.plate === plate);
    if (index < 0) return;

    const [entry] = state.active.splice(index, 1);
    state.history.push({
      ...entry,
      completedAt: new Date().toISOString(),
      completedBy: currentUserName()
    });
    state.updatedAt = new Date().toISOString();
    state = normalizeState(state);
    writeLocal();
    notifyChanged();
    renderCard();
    setWorkshopStatus(`${plate} ist wieder für den Dienstplan freigegeben.`, 'ok');
    scheduleSave();
  }

  function setDailyStatus(text, kind = 'error') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = `dp-daily-status ${kind}`;
  }

  function updateDailyWarning() {
    const section = document.getElementById('tab-daily-duty-plan');
    const tableWrap = section?.querySelector('.dp-daily-table-wrap');
    if (!section || !tableWrap) return;

    let warning = document.getElementById(WARNING_ID);
    if (!state.active.length) {
      warning?.remove();
      return;
    }
    if (!warning) {
      warning = document.createElement('div');
      warning.id = WARNING_ID;
      tableWrap.insertAdjacentElement('beforebegin', warning);
    }
    const plates = state.active.map((entry) => entry.plate).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
    warning.textContent = `Werkstatt – nicht verfügbar: ${plates.join(', ')}. Diese Fahrzeuge können erst nach abgeschlossener Überprüfung wieder vergeben werden.`;
  }

  function clearBlockedInput(input, cleared) {
    const plate = normalizePlate(input?.value);
    if (!plate || !isBlocked(plate)) return;
    cleared.add(plate);
    input.value = '';
    input.hidden = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function filterVehicleEditor(editor, blocked, cleared) {
    const input = editor.querySelector('input[data-field="bus"]');
    const select = editor.querySelector('.dp-vehicle-select');
    if (input) clearBlockedInput(input, cleared);
    if (!select) return;

    [...select.options].forEach((option) => {
      const plate = normalizePlate(option.value);
      if (plate && blocked.has(plate)) option.remove();
    });
    if (blocked.has(normalizePlate(select.value))) select.value = '';
  }

  function filterDatalist(blocked) {
    const list = document.getElementById('dpDailyVehiclePlateList');
    if (!list) return;
    [...list.options].forEach((option) => {
      if (blocked.has(normalizePlate(option.value))) option.remove();
    });
  }

  function patchSplitPrintRows() {
    const getter = window.dienstpilotGetSplitShiftPrintRows;
    if (typeof getter !== 'function' || getter.__dpWorkshopPatched) return;
    const wrapped = (date) => {
      const result = getter(date);
      if (!Array.isArray(result)) return result;
      return result.map((row) => isBlocked(row?.bus) ? { ...row, bus: '' } : row);
    };
    wrapped.__dpWorkshopPatched = true;
    window.dienstpilotGetSplitShiftPrintRows = wrapped;
  }

  function filterSplitPreview() {
    document.querySelectorAll('#dpDailyPlanPreview .dp-split-virtual-preview .dp-preview-middle strong').forEach((strong) => {
      const text = String(strong.textContent || '').replace(/^\s*\/\s*/, '').trim();
      if (isBlocked(text)) strong.textContent = '/ kein Fahrzeug – Werkstatt';
    });
  }

  function enforceDailyPlan() {
    if (enforcing) return;
    enforcing = true;
    try {
      addStyle();
      const blocked = activeSet();
      const cleared = new Set();
      document.querySelectorAll(`#${TABLE_ID} .dp-vehicle-editor`).forEach((editor) => filterVehicleEditor(editor, blocked, cleared));
      document.querySelectorAll(`#${TABLE_ID} input[data-field="bus"]`).forEach((input) => clearBlockedInput(input, cleared));
      filterDatalist(blocked);
      patchSplitPrintRows();
      filterSplitPreview();
      updateDailyWarning();

      if (cleared.size) {
        const signature = [...cleared].sort().join('|');
        if (signature !== lastClearedSignature) {
          lastClearedSignature = signature;
          setDailyStatus(`Werkstattfahrzeug entfernt: ${[...cleared].join(', ')}. Bitte ein verfügbares Kennzeichen auswählen.`, 'error');
        }
      } else {
        lastClearedSignature = '';
      }
    } finally {
      enforcing = false;
    }
  }

  function scheduleEnforce(delay = 60) {
    window.clearTimeout(enforceTimer);
    enforceTimer = window.setTimeout(enforceDailyPlan, delay);
  }

  function observeDailyPlan() {
    const body = document.getElementById(TABLE_ID);
    if (body && body !== observedBody) {
      observer?.disconnect();
      observedBody = body;
      observer = new MutationObserver(() => scheduleEnforce(40));
      observer.observe(body, { childList: true, subtree: true });
    }

    const preview = document.getElementById('dpDailyPlanPreview');
    if (preview && preview !== observedPreview) {
      previewObserver?.disconnect();
      observedPreview = preview;
      previewObserver = new MutationObserver(() => scheduleEnforce(40));
      previewObserver.observe(preview, { childList: true, subtree: true });
    }
  }

  function notifyChanged() {
    window.dispatchEvent(new CustomEvent('dienstpilot-workshop-changed', {
      detail: { active: state.active.map((entry) => ({ ...entry })) }
    }));
    renderCard();
    observeDailyPlan();
    [0, 80, 250, 700].forEach((delay) => window.setTimeout(enforceDailyPlan, delay));
  }

  document.addEventListener('change', (event) => {
    const busInput = event.target.closest?.(`#${TABLE_ID} input[data-field="bus"]`);
    if (!busInput) return;
    const plate = normalizePlate(busInput.value);
    if (!isBlocked(plate)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    busInput.value = '';
    busInput.dispatchEvent(new Event('input', { bubbles: true }));
    setDailyStatus(`${plate} befindet sich in der Werkstatt und kann nicht vergeben werden.`, 'error');
    scheduleEnforce(20);
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.tab[data-tab="einstellungen"],#loginButton')) {
      [100, 350, 900].forEach((delay) => window.setTimeout(() => {
        renderCard();
        void loadRemote(delay > 500);
      }, delay));
    }
    if (event.target.closest?.('#dpDailyDutyPlanTab,.tab[data-tab="eingabe"],#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailyPlanRows [data-action]')) {
      [80, 300, 900].forEach((delay) => window.setTimeout(() => {
        observeDailyPlan();
        enforceDailyPlan();
      }, delay));
    }
  }, true);

  window.addEventListener('dienstpilot-workshop-changed', () => scheduleEnforce(20));
  window.addEventListener('pageshow', () => {
    renderCard();
    observeDailyPlan();
    scheduleEnforce(200);
    void loadRemote();
  });
  window.addEventListener('focus', () => {
    renderCard();
    observeDailyPlan();
    scheduleEnforce(200);
  });

  function start() {
    addStyle();
    renderCard();
    observeDailyPlan();
    scheduleEnforce(300);
    void loadRemote();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  [700, 1800, 4200].forEach((delay) => window.setTimeout(start, delay));
})();
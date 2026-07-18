(() => {
  'use strict';

  if (window.__dienstpilotSplitShiftTimeEditorV1) return;
  window.__dienstpilotSplitShiftTimeEditorV1 = true;

  const PANEL_ID = 'dpStableSplitShiftPanel';
  const DATE_ID = 'dpDailyPlanDate';
  const STYLE_ID = 'dpSplitShiftTimeEditorStyle';
  const LOCAL_KEY = 'dienstpilot_split_shift_time_overrides_v1';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const API_URL = 'https://api.dienstpilot-runke.de/api/data/split_shift_time_overrides';

  const DEFAULTS = {
    '1341': {
      early: { start: '05:13', end: '14:21' },
      late: { start: '14:04', end: '23:38' }
    },
    '1941': {
      early: { start: '05:35', end: '14:29' },
      late: { start: '14:09', end: '21:49' }
    },
    '1743': {
      early: { start: '06:05', end: '15:17' },
      late: { start: '14:57', end: '00:50' }
    }
  };

  let state = readLocal();
  let remoteLoaded = false;
  let remoteLoading = false;
  let saveTimer = 0;
  let refreshTimer = 0;
  let observer = null;
  let observedSection = null;

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function currentRole() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {};
      return normalizeText(user.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalizeText(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function canManage() {
    const role = currentRole();
    return role === 'geschaftsleitung' || role === 'geschaeftsleitung' || role === 'disposition';
  }

  function selectedDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  }

  function validTime(value) {
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
  }

  function normalizeTimes(value, fallback) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      start: validTime(source.start) ? source.start : fallback.start,
      end: validTime(source.end) ? source.end : fallback.end
    };
  }

  function normalizeState(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawDates = source.dates && typeof source.dates === 'object' ? source.dates : source;
    const dates = {};

    Object.entries(rawDates || {}).forEach(([date, duties]) => {
      if (!validDate(date) || !duties || typeof duties !== 'object') return;
      const normalizedDuties = {};
      Object.keys(DEFAULTS).forEach((duty) => {
        const entry = duties[duty];
        if (!entry || typeof entry !== 'object') return;
        normalizedDuties[duty] = {
          early: normalizeTimes(entry.early, DEFAULTS[duty].early),
          late: normalizeTimes(entry.late, DEFAULTS[duty].late)
        };
      });
      if (Object.keys(normalizedDuties).length) dates[date] = normalizedDuties;
    });

    return {
      dates,
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

  function mergeStates(localState, remoteState) {
    const local = normalizeState(localState);
    const remote = normalizeState(remoteState);
    const dates = { ...local.dates };
    Object.entries(remote.dates).forEach(([date, duties]) => {
      dates[date] = { ...(dates[date] || {}), ...duties };
    });
    return {
      dates,
      updatedAt: remote.updatedAt || local.updatedAt
    };
  }

  function timesFor(date, duty) {
    const defaults = DEFAULTS[duty];
    if (!defaults) return null;
    const saved = state.dates?.[date]?.[duty] || {};
    return {
      early: normalizeTimes(saved.early, defaults.early),
      late: normalizeTimes(saved.late, defaults.late)
    };
  }

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
      const normalizedRemote = normalizeState(remote);
      const hasRemoteData = Object.keys(normalizedRemote.dates).length > 0;

      if (hasRemoteData) {
        state = mergeStates(state, normalizedRemote);
        writeLocal();
        scheduleRefresh(0);
      } else if (Object.keys(state.dates).length) {
        scheduleRemoteSave(50);
      }
      remoteLoaded = true;
    } catch (error) {
      console.warn('Geteilte Dienstzeiten konnten nicht geladen werden:', error);
    } finally {
      remoteLoading = false;
    }
  }

  async function saveRemote(duty) {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      setEditorStatus(duty, 'Zeiten wurden auf diesem Gerät gespeichert.', 'ok');
      return;
    }
    try {
      const response = await fetch(API_URL, {
        method: 'PUT',
        headers: tokenHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(state)
      });
      if (!response.ok) throw new Error(`Serverstatus ${response.status}`);
      setEditorStatus(duty, 'Früh- und Spätschicht wurden gespeichert.', 'ok');
    } catch (error) {
      console.warn('Geteilte Dienstzeiten konnten nicht gespeichert werden:', error);
      setEditorStatus(duty, 'Zeiten wurden nur auf diesem Gerät gespeichert.', 'error');
    }
  }

  function scheduleRemoteSave(delay = 120, duty = '') {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void saveRemote(duty), delay);
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} .dp-split-time-editor{margin-top:9px;padding:10px;border:1px solid #60a5fa;border-radius:10px;background:#f8fbff}
      #${PANEL_ID} .dp-split-time-title{margin:0 0 8px;font-size:13px;font-weight:950;color:#1e3a8a}
      #${PANEL_ID} .dp-split-time-grid{display:grid;grid-template-columns:repeat(2,minmax(250px,1fr));gap:8px}
      #${PANEL_ID} .dp-split-time-side{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:8px;border:1px solid #bfdbfe;border-radius:9px;background:#fff}
      #${PANEL_ID} .dp-split-time-side strong{grid-column:1/-1;font-size:12px;color:#0f172a}
      #${PANEL_ID} .dp-split-time-side label{display:grid;gap:4px;font-size:11px;font-weight:850;color:#475569}
      #${PANEL_ID} .dp-split-time-side input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #2563eb;border-radius:8px;background:#fff;color:#0f172a;font:inherit;font-weight:900}
      #${PANEL_ID} .dp-split-time-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}
      #${PANEL_ID} .dp-split-time-save{padding:8px 12px;border:1px solid #1d4ed8;border-radius:9px;background:#2563eb;color:#fff;font:inherit;font-weight:950;cursor:pointer}
      #${PANEL_ID} .dp-split-time-status{min-height:18px;font-size:12px;font-weight:850;color:#475569}
      #${PANEL_ID} .dp-split-time-status.ok{color:#166534}
      #${PANEL_ID} .dp-split-time-status.error{color:#b91c1c}
      @media(max-width:850px){#${PANEL_ID} .dp-split-time-grid{grid-template-columns:1fr}}
      @media(max-width:520px){#${PANEL_ID} .dp-split-time-side{grid-template-columns:1fr}}
      @media print{#${PANEL_ID} .dp-split-time-editor{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function dutyFromBlock(block) {
    const title = String(block.querySelector('.dp-shift-duty-title')?.textContent || '');
    const match = title.match(/Dienst\s+(1341|1941|1743)/);
    return match ? match[1] : '';
  }

  function editorHtml(duty, times) {
    return `
      <div class="dp-split-time-editor" data-time-editor-duty="${duty}">
        <div class="dp-split-time-title">Dienstzeiten für Dienst ${duty} ändern</div>
        <div class="dp-split-time-grid">
          <div class="dp-split-time-side">
            <strong>Frühschicht</strong>
            <label>Beginn<input type="time" data-time-side="early" data-time-field="start" value="${times.early.start}"></label>
            <label>Ende<input type="time" data-time-side="early" data-time-field="end" value="${times.early.end}"></label>
          </div>
          <div class="dp-split-time-side">
            <strong>Spätschicht</strong>
            <label>Beginn<input type="time" data-time-side="late" data-time-field="start" value="${times.late.start}"></label>
            <label>Ende<input type="time" data-time-side="late" data-time-field="end" value="${times.late.end}"></label>
          </div>
        </div>
        <div class="dp-split-time-actions">
          <button type="button" class="dp-split-time-save" data-save-split-times="${duty}">Dienstzeiten speichern</button>
          <span class="dp-split-time-status" data-time-status="${duty}" role="status" aria-live="polite"></span>
        </div>
      </div>`;
  }

  function updateDriverLabels(block, times) {
    const earlySelect = block.querySelector('.dp-driver-assignment-select[data-side="early"]');
    const lateSelect = block.querySelector('.dp-driver-assignment-select[data-side="late"]');
    const earlyLabel = earlySelect?.closest('.dp-shift-driver')?.querySelector('.dp-shift-label');
    const lateLabel = lateSelect?.closest('.dp-shift-driver')?.querySelector('.dp-shift-label');
    const earlyText = `Frühschicht ${times.early.start}–${times.early.end}`;
    const lateText = `Spätschicht ${times.late.start}–${times.late.end}`;
    if (earlyLabel && earlyLabel.textContent !== earlyText) earlyLabel.textContent = earlyText;
    if (lateLabel && lateLabel.textContent !== lateText) lateLabel.textContent = lateText;
  }

  function installEditors() {
    addStyle();
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    if (!canManage()) {
      panel.querySelectorAll('.dp-split-time-editor').forEach((editor) => editor.remove());
      return;
    }

    const date = selectedDate();
    if (!validDate(date)) return;

    panel.querySelectorAll('.dp-shift-duty').forEach((block) => {
      const duty = dutyFromBlock(block);
      if (!duty) return;
      const times = timesFor(date, duty);
      updateDriverLabels(block, times);
      if (!block.querySelector(`.dp-split-time-editor[data-time-editor-duty="${duty}"]`)) {
        block.insertAdjacentHTML('beforeend', editorHtml(duty, times));
      }
    });
  }

  function readEditorTimes(duty) {
    const editor = document.querySelector(`.dp-split-time-editor[data-time-editor-duty="${duty}"]`);
    if (!editor) return null;
    const read = (side, field) => String(editor.querySelector(`[data-time-side="${side}"][data-time-field="${field}"]`)?.value || '');
    const result = {
      early: { start: read('early', 'start'), end: read('early', 'end') },
      late: { start: read('late', 'start'), end: read('late', 'end') }
    };
    return Object.values(result).every((side) => validTime(side.start) && validTime(side.end)) ? result : null;
  }

  function setEditorStatus(duty, text, kind = '') {
    const status = document.querySelector(`[data-time-status="${duty}"]`);
    if (!status) return;
    status.textContent = text;
    status.className = `dp-split-time-status${kind ? ` ${kind}` : ''}`;
  }

  function saveDutyTimes(duty) {
    if (!canManage() || !DEFAULTS[duty]) return;
    const date = selectedDate();
    if (!validDate(date)) {
      setEditorStatus(duty, 'Bitte zuerst ein gültiges Datum auswählen.', 'error');
      return;
    }
    const values = readEditorTimes(duty);
    if (!values) {
      setEditorStatus(duty, 'Bitte alle vier Dienstzeiten vollständig eingeben.', 'error');
      return;
    }

    state.dates[date] = state.dates[date] || {};
    state.dates[date][duty] = values;
    state.updatedAt = new Date().toISOString();
    writeLocal();
    setEditorStatus(duty, 'Dienstzeiten werden gespeichert …');
    installPrintPatch();
    updatePreviewTimes();
    scheduleRemoteSave(80, duty);

    const dailyStatus = document.getElementById('dpDailyPlanStatus');
    if (dailyStatus) {
      dailyStatus.textContent = `Dienst ${duty}: Frühschicht ${values.early.start}–${values.early.end}, Spätschicht ${values.late.start}–${values.late.end}.`;
      dailyStatus.className = 'dp-daily-status ok';
    }
  }

  function applyTimesToPrintRows(rows, rawDate) {
    if (!Array.isArray(rows)) return rows;
    const date = validDate(rawDate) ? rawDate : selectedDate();
    return rows.map((row) => {
      const duty = String(row?.duty || '');
      const times = timesFor(date, duty);
      if (!times) return row;

      if (Array.isArray(row.split)) {
        const split = row.split.map((part) => {
          const side = normalizeText(part?.label).startsWith('spat') ? 'late' : 'early';
          return { ...part, start: times[side].start, end: times[side].end };
        });
        return { ...row, start: times.early.start, end: times.late.end, split };
      }

      const side = normalizeText(row?.shiftLabel).startsWith('spat') ? 'late' : 'early';
      return { ...row, start: times[side].start, end: times[side].end };
    });
  }

  function installPrintPatch() {
    if (window.__dienstpilotSplitShiftTimePrintPatchV1) return;
    const getter = window.dienstpilotGetSplitShiftPrintRows;
    if (typeof getter !== 'function') return;
    const wrapped = (date) => applyTimesToPrintRows(getter(date), String(date || selectedDate()));
    wrapped.__dpSplitShiftTimeEditorV1 = true;
    window.dienstpilotGetSplitShiftPrintRows = wrapped;
    window.__dienstpilotSplitShiftTimePrintPatchV1 = true;
  }

  function updatePreviewTimes() {
    const date = selectedDate();
    if (!validDate(date)) return;
    document.querySelectorAll('#dpDailyPlanPreview .dp-split-virtual-preview').forEach((row) => {
      const leftSpans = [...row.querySelectorAll('.dp-preview-left span')];
      const middleSpans = [...row.querySelectorAll('.dp-preview-middle span')];
      leftSpans.forEach((leftSpan, index) => {
        const match = String(leftSpan.textContent || '').match(/Dienst\s+(1341|1941|1743)\s+·\s+(Frühschicht|Spätschicht)/i);
        if (!match || !middleSpans[index]) return;
        const duty = match[1];
        const side = normalizeText(match[2]).startsWith('spat') ? 'late' : 'early';
        const times = timesFor(date, duty);
        const desired = `/ ${times[side].start} - ${times[side].end} Uhr`;
        if (middleSpans[index].textContent !== desired) middleSpans[index].textContent = desired;
      });
    });
  }

  function observePanel() {
    const section = document.getElementById('tab-daily-duty-plan');
    if (!section || section === observedSection) return;
    observer?.disconnect();
    observedSection = section;
    observer = new MutationObserver(() => scheduleRefresh(40));
    observer.observe(section, { childList: true, subtree: true });
  }

  function refresh() {
    observePanel();
    installEditors();
    installPrintPatch();
    updatePreviewTimes();
    void loadRemote();
  }

  function scheduleRefresh(delay = 120) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, delay);
  }

  document.addEventListener('click', (event) => {
    const saveButton = event.target.closest?.('[data-save-split-times]');
    if (saveButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveDutyTimes(String(saveButton.dataset.saveSplitTimes || ''));
      return;
    }
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton,#dpDailySave,.tab[data-tab="eingabe"]')) {
      [80, 350, 900].forEach((delay) => window.setTimeout(refresh, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) {
      [100, 450, 1000].forEach((delay) => window.setTimeout(refresh, delay));
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scheduleRefresh(700), { once: true });
  else scheduleRefresh(700);

  [1600, 3500, 7000].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('pageshow', () => scheduleRefresh(300));
  window.addEventListener('focus', () => scheduleRefresh(300));
})();
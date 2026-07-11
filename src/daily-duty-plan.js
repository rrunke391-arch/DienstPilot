(() => {
  'use strict';

  const API = 'https://api.dienstpilot-runke.de/api/data/daily_duty_plans';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const LOCAL_KEY = 'dienstpilot_daily_duty_plans_v1';
  const LAST_DATE_KEY = 'dienstpilot_daily_duty_plan_date';
  const TAB_ID = 'dpDailyDutyPlanTab';
  const SECTION_ID = 'tab-daily-duty-plan';
  const STYLE_ID = 'dpDailyDutyPlanStyle';

  const DUTY_DEFAULTS = {
    '3001': { start: '05:03', end: '12:12', departure: '05:20', stop: 'Wellingholzhausen, Schule' },
    '3003': { start: '05:47', end: '14:10', departure: '06:12', stop: 'Neuenkirchen, Schulzentrum' },
    '3004': { start: '05:50', end: '15:40', departure: '06:15', stop: 'Melle, ZOB' },
    '3005': { start: '05:51', end: '15:49', departure: '06:18', stop: 'Westerhausen, Vinkenaue' },
    '3006': { start: '06:00', end: '16:20', departure: '06:33', stop: 'Buer, Kampingring' },
    '3007': { start: '06:03', end: '14:19', departure: '06:28', stop: 'Neuenkirchen, Schulzentrum' },
    '3008': { start: '06:03', end: '17:21', departure: '06:20', stop: 'Wellingholzhausen, Schule' },
    '3009': { start: '06:04', end: '16:25', departure: '06:35', stop: 'Ellerbeck, Ellerbecker Str.' },
    '3010': { start: '06:20', end: '16:56', departure: '06:45', stop: 'Melle, ZOB' },
    '3011': { start: '06:23', end: '17:00', departure: '06:40', stop: 'Wellingholzhausen, Schule' },
    '3012': { start: '06:31', end: '16:50', departure: '06:48', stop: 'Wellingholzhausen, Surbrock' },
    '3013': { start: '06:35', end: '17:05', departure: '07:00', stop: 'Neuenkirchen, Schulzentrum' },
    '3014': { start: '06:35', end: '15:39', departure: '07:00', stop: 'Melle, ZOB' },
    '3015': { start: '06:36', end: '16:57', departure: '07:00', stop: 'Wennigsen, Alt Wiewen' },
    '3016': { start: '06:43', end: '18:06', departure: '07:18', stop: 'Bissendorf, Friedensweg' },
    '3017': { start: '06:44', end: '17:35', departure: '07:05', stop: 'Laer, Dornkampsweg' },
    '3018': { start: '06:44', end: '19:41', departure: '07:02', stop: 'Kerssenbrock, Brandhorstweg' },
    '3019': { start: '06:49', end: '17:28', departure: '07:07', stop: 'Nüven, Obernüven' },
    '3020': { start: '06:49', end: '18:04', departure: '07:09', stop: 'Peingdorf, Königsbach' },
    '3021': { start: '06:50', end: '19:33', departure: '07:15', stop: 'Melle, ZOB' },
    '3022': { start: '12:03', end: '19:21', departure: '12:20', stop: 'Wellingholzhausen, Schule' },
    '3023': { start: '12:03', end: '20:21', departure: '12:20', stop: 'Wellingholzhausen, Schule' },
    '3024': { start: '12:20', end: '21:05', departure: '12:45', stop: 'Melle, ZOB' },
    '3025': { start: '13:10', end: '21:50', departure: '13:35', stop: 'Melle, ZOB' }
  };
  const DEFAULT_ORDER = Object.keys(DUTY_DEFAULTS);

  let store = { plans: {} };
  let selectedDate = '';
  let activeRows = [];
  let loadPromise = null;
  let saveRunning = false;

  function readJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function currentUser() {
    return readJson(sessionStorage, USER_KEY, {}) || {};
  }

  function role() {
    const user = currentUser();
    return normalize(user.role || sessionStorage.getItem(ROLE_KEY));
  }

  function canEdit() {
    const user = currentUser();
    const username = normalize(user.username || user.displayName);
    const value = role();
    return username === 'runke'
      || value === 'administrator'
      || value === 'admin'
      || value === 'geschäftsleitung'
      || value === 'geschaeftsleitung'
      || value === 'disposition';
  }

  function uid() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayIso() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }

  function safeDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : todayIso();
  }

  function dateObject(iso) {
    const [year, month, day] = safeDate(iso).split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function weekdayName(iso) {
    return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(dateObject(iso));
  }

  function germanDate(iso) {
    const [year, month, day] = safeDate(iso).split('-');
    return `${day}.${month}.${year}`;
  }

  function isoWeek(iso) {
    const date = dateObject(iso);
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeRow(row) {
    const value = row && typeof row === 'object' ? row : {};
    return {
      id: String(value.id || uid()),
      name: String(value.name || ''),
      duty: String(value.duty || ''),
      bus: String(value.bus || ''),
      start: String(value.start || ''),
      end: String(value.end || ''),
      departure: String(value.departure || ''),
      stop: String(value.stop || '')
    };
  }

  function normalizeStore(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawPlans = source.plans && typeof source.plans === 'object' ? source.plans : source;
    const plans = {};
    Object.entries(rawPlans || {}).forEach(([date, plan]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !plan || typeof plan !== 'object') return;
      plans[date] = {
        date,
        rows: Array.isArray(plan.rows) ? plan.rows.map(normalizeRow) : [],
        savedAt: String(plan.savedAt || '')
      };
    });
    return { plans };
  }

  function saveLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
  }

  async function loadStore() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const local = normalizeStore(readJson(localStorage, LOCAL_KEY, { plans: {} }));
      const token = sessionStorage.getItem(TOKEN_KEY) || '';
      if (!token) {
        store = local;
        return;
      }
      try {
        const response = await fetch(API, {
          method: 'GET',
          cache: 'no-store',
          headers: { Authorization: 'Bearer ' + token }
        });
        if (!response.ok) {
          store = local;
          return;
        }
        const wrapper = await response.json().catch(() => ({}));
        const remote = normalizeStore(wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data') ? wrapper.data : wrapper);
        store = { plans: { ...local.plans, ...remote.plans } };
        saveLocal();
      } catch {
        store = local;
      }
    })();
    return loadPromise;
  }

  async function saveStore() {
    if (saveRunning) return false;
    saveRunning = true;
    saveLocal();
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    try {
      if (!token) return true;
      const response = await fetch(API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(store)
      });
      if (!response.ok) throw new Error('Server hat die Speicherung abgelehnt.');
      return true;
    } finally {
      saveRunning = false;
    }
  }

  function catalog() {
    try {
      return typeof getCatalog === 'function' ? getCatalog() : {};
    } catch {
      return {};
    }
  }

  function dutyTemplate(number, date) {
    const key = String(number || '').trim();
    const fallback = DUTY_DEFAULTS[key] || {};
    const entry = catalog()[key] || {};
    const friday = dateObject(date).getDay() === 5;
    return {
      start: String(entry.start || fallback.start || ''),
      end: String((friday && entry.fridayEnd) || entry.end || fallback.end || ''),
      departure: String(entry.firstStopDeparture || entry.departure || fallback.departure || ''),
      stop: String(entry.firstStop || entry.firstStopName || fallback.stop || '')
    };
  }

  function blankRow(duty = '') {
    const template = dutyTemplate(duty, selectedDate);
    return normalizeRow({ duty, ...template });
  }

  function planForDate(date) {
    const plan = store.plans[date];
    return plan && Array.isArray(plan.rows) ? plan.rows.map(normalizeRow) : [];
  }

  function setPlanStatus(text, kind = '') {
    const element = document.getElementById('dpDailyPlanStatus');
    if (!element) return;
    element.textContent = text;
    element.className = 'dp-daily-status' + (kind ? ' ' + kind : '');
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TAB_ID}{white-space:normal;line-height:1.15;max-width:230px}
      .dp-daily-card{display:grid;gap:16px}.dp-daily-top{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap}
      .dp-daily-title h2{margin:0 0 5px}.dp-daily-date{display:grid;gap:6px;font-weight:900}.dp-daily-date input{padding:10px 12px;border:1px solid #cbd5e1;border-radius:12px;font:inherit}
      .dp-daily-actions{display:flex;gap:8px;flex-wrap:wrap}.dp-daily-actions button{padding:10px 13px;border-radius:11px;font-weight:900;cursor:pointer}
      .dp-daily-primary{border:1px solid #020617;background:#020617;color:#fff}.dp-daily-secondary{border:1px solid #cbd5e1;background:#fff;color:#0f172a}.dp-daily-danger{border:1px solid #fecaca;background:#fff1f2;color:#be123c}
      .dp-daily-status{min-height:22px;font-weight:800;color:#475569}.dp-daily-status.ok{color:#047857}.dp-daily-status.error{color:#b91c1c}
      .dp-daily-table-wrap{overflow:auto;border:1px solid #dbe3ed;border-radius:15px}.dp-daily-table{width:100%;border-collapse:collapse;min-width:1080px}.dp-daily-table th{position:sticky;top:0;z-index:1;background:#eef2f7;text-align:left;padding:9px;font-size:12px}.dp-daily-table td{padding:7px;border-top:1px solid #e2e8f0;vertical-align:top}.dp-daily-table input{width:100%;box-sizing:border-box;padding:8px 9px;border:1px solid #cbd5e1;border-radius:9px;font:inherit;background:#fff}.dp-daily-table input:disabled{background:#f8fafc;color:#475569}.dp-row-tools{display:flex;gap:4px}.dp-row-tools button{width:32px;height:32px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer}.dp-row-tools button:last-child{color:#be123c}
      .dp-daily-preview{border:1px solid #dbe3ed;border-radius:18px;background:#fff;padding:18px;overflow:auto}.dp-daily-preview-paper{min-width:760px;max-width:920px;margin:0 auto;color:#111;font-family:Arial,sans-serif}.dp-preview-head{display:grid;grid-template-columns:1.35fr .8fr 1fr;gap:18px;align-items:start;font-weight:800;font-size:17px;margin-bottom:14px}.dp-preview-head .right{text-align:right}.dp-preview-stop-title{grid-column:3;font-size:15px;text-align:left;margin-top:4px}.dp-preview-row{display:grid;grid-template-columns:24% 30% 46%;gap:10px;min-height:64px;align-items:start}.dp-preview-left,.dp-preview-middle{display:grid;align-content:start}.dp-preview-row strong{font-size:15px}.dp-preview-row span,.dp-preview-right{font-size:14px;line-height:1.4}.dp-preview-right{padding-top:25px}.dp-preview-empty{padding:28px;text-align:center;color:#64748b}
      body.dp-daily-readonly .dp-daily-edit-only{display:none!important}
      @media(max-width:760px){#${TAB_ID}{max-width:150px;font-size:12px}.dp-daily-actions{display:grid;width:100%;grid-template-columns:1fr 1fr}.dp-daily-actions button{width:100%}.dp-daily-preview{padding:10px}}
    `;
    document.head.appendChild(style);
  }

  function installUi() {
    addStyle();
    const tabs = document.querySelector('.tabs');
    const overview = tabs?.querySelector('.tab[data-tab="eingabe"]');
    if (!tabs || !overview) return false;

    let tab = document.getElementById(TAB_ID);
    if (!tab) {
      tab = document.createElement('button');
      tab.id = TAB_ID;
      tab.type = 'button';
      tab.className = 'tab';
      tab.dataset.tab = 'daily-duty-plan';
      tab.textContent = 'Dienstplan bearbeiten und Drucken';
      overview.insertAdjacentElement('afterend', tab);
    }

    let section = document.getElementById(SECTION_ID);
    if (!section) {
      section = document.createElement('section');
      section.id = SECTION_ID;
      section.className = 'hidden';
      section.innerHTML = `
        <div class="card dp-daily-card">
          <div class="dp-daily-top">
            <div class="dp-daily-title"><h2>Dienstplan bearbeiten und Drucken</h2><div class="muted">Tagesdienstplan nach dem Muster mit Fahrer, Dienst, Kennzeichen, Dienstzeit und Abfahrt ab der ersten Haltestelle.</div></div>
            <label class="dp-daily-date">Datum<input id="dpDailyPlanDate" type="date"></label>
          </div>
          <div class="dp-daily-actions">
            <button type="button" id="dpDailyInsertDefaults" class="dp-daily-secondary dp-daily-edit-only">Standarddienste einfügen</button>
            <button type="button" id="dpDailyAddRow" class="dp-daily-secondary dp-daily-edit-only">＋ Zeile hinzufügen</button>
            <button type="button" id="dpDailySave" class="dp-daily-primary dp-daily-edit-only">Speichern</button>
            <button type="button" id="dpDailyPrint" class="dp-daily-primary">Drucken</button>
            <button type="button" id="dpDailyClear" class="dp-daily-danger dp-daily-edit-only">Plan leeren</button>
          </div>
          <div id="dpDailyPlanStatus" class="dp-daily-status" role="status" aria-live="polite"></div>
          <datalist id="dpDailyDutyList"></datalist>
          <div class="dp-daily-table-wrap">
            <table class="dp-daily-table">
              <thead><tr><th>Name</th><th>Dienst</th><th>Kennzeichen</th><th>Beginn</th><th>Ende</th><th>Abfahrt 1. Haltestelle</th><th>1. Haltestelle</th><th class="dp-daily-edit-only">Reihenfolge</th></tr></thead>
              <tbody id="dpDailyPlanRows"></tbody>
            </table>
          </div>
          <div class="dp-daily-preview"><div id="dpDailyPlanPreview" class="dp-daily-preview-paper"></div></div>
        </div>`;
      document.querySelector('main')?.appendChild(section);
    }

    selectedDate = safeDate(localStorage.getItem(LAST_DATE_KEY) || todayIso());
    const dateInput = document.getElementById('dpDailyPlanDate');
    if (dateInput) dateInput.value = selectedDate;
    applyPermissions();
    bindEvents();
    return true;
  }

  function applyPermissions() {
    document.body.classList.toggle('dp-daily-readonly', !canEdit());
  }

  function openDailyTab() {
    document.querySelectorAll('.tabs .tab').forEach((button) => button.classList.remove('active'));
    document.querySelectorAll('main > section').forEach((section) => section.classList.add('hidden'));
    document.getElementById(TAB_ID)?.classList.add('active');
    document.getElementById(SECTION_ID)?.classList.remove('hidden');
    applyPermissions();
    rebuildDutyList();
    loadSelectedDate();
  }

  function closeDailyTab() {
    document.getElementById(TAB_ID)?.classList.remove('active');
    document.getElementById(SECTION_ID)?.classList.add('hidden');
  }

  function rebuildDutyList() {
    const list = document.getElementById('dpDailyDutyList');
    if (!list) return;
    const keys = new Set([...DEFAULT_ORDER, ...Object.keys(catalog())]);
    list.innerHTML = [...keys]
      .sort((a, b) => String(a).localeCompare(String(b), 'de', { numeric: true }))
      .map((key) => `<option value="${escapeHtml(key)}"></option>`)
      .join('');
  }

  function loadSelectedDate() {
    activeRows = planForDate(selectedDate);
    renderAll();
    setPlanStatus(activeRows.length ? `${activeRows.length} Einträge geladen.` : 'Für dieses Datum ist noch kein Tagesdienstplan gespeichert.');
  }

  function renderAll() {
    renderRows();
    renderPreview();
  }

  function renderRows() {
    const body = document.getElementById('dpDailyPlanRows');
    if (!body) return;
    if (!activeRows.length) {
      body.innerHTML = `<tr><td colspan="8"><div class="dp-preview-empty">Noch keine Einträge. Mit „Standarddienste einfügen“ werden die Dienste 3001 bis 3025 aus dem Muster automatisch ergänzt.</div></td></tr>`;
      return;
    }
    const disabled = canEdit() ? '' : ' disabled';
    body.innerHTML = activeRows.map((row, index) => `
      <tr data-row-id="${escapeHtml(row.id)}">
        <td><input data-field="name" value="${escapeHtml(row.name)}" placeholder="Fahrername"${disabled}></td>
        <td><input data-field="duty" value="${escapeHtml(row.duty)}" list="dpDailyDutyList" placeholder="3001"${disabled}></td>
        <td><input data-field="bus" value="${escapeHtml(row.bus)}" placeholder="OS-XX 123"${disabled}></td>
        <td><input data-field="start" type="time" value="${escapeHtml(row.start)}"${disabled}></td>
        <td><input data-field="end" type="time" value="${escapeHtml(row.end)}"${disabled}></td>
        <td><input data-field="departure" type="time" value="${escapeHtml(row.departure)}"${disabled}></td>
        <td><input data-field="stop" value="${escapeHtml(row.stop)}" placeholder="Melle, ZOB"${disabled}></td>
        <td class="dp-daily-edit-only"><div class="dp-row-tools"><button type="button" data-action="up" title="Nach oben"${index === 0 ? ' disabled' : ''}>↑</button><button type="button" data-action="down" title="Nach unten"${index === activeRows.length - 1 ? ' disabled' : ''}>↓</button><button type="button" data-action="delete" title="Löschen">×</button></div></td>
      </tr>`).join('');
  }

  function printDeparture(value) {
    if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return '';
    const [hours, minutes] = value.split(':');
    return `${Number(hours)}.${minutes}`;
  }

  function previewHeader() {
    return `
      <div class="dp-preview-head">
        <div>Dienstplan für ${escapeHtml(weekdayName(selectedDate))}, den</div>
        <div>${escapeHtml(germanDate(selectedDate))}</div>
        <div class="right">Kalenderwoche&nbsp;&nbsp; ${isoWeek(selectedDate)}</div>
        <div class="dp-preview-stop-title">Abfahrzeit ab 1. Haltestelle</div>
      </div>`;
  }

  function previewRow(row) {
    const dutyLine = row.duty ? `Dienst ${escapeHtml(row.duty)}` : '';
    const busLine = row.bus ? `/ ${escapeHtml(row.bus)}` : '';
    const timeLine = row.start || row.end ? `/ ${escapeHtml(row.start || '--:--')} - ${escapeHtml(row.end || '--:--')} Uhr` : '';
    const departure = row.departure ? `${escapeHtml(printDeparture(row.departure))} Uhr` : '';
    const right = [departure, escapeHtml(row.stop)].filter(Boolean).join(' ');
    return `
      <div class="dp-preview-row">
        <div class="dp-preview-left"><strong>${escapeHtml(row.name) || '&nbsp;'}</strong><span>${dutyLine || '&nbsp;'}</span></div>
        <div class="dp-preview-middle"><strong>${busLine || '&nbsp;'}</strong><span>${timeLine || '&nbsp;'}</span></div>
        <div class="dp-preview-right">${right || '&nbsp;'}</div>
      </div>`;
  }

  function renderPreview() {
    const preview = document.getElementById('dpDailyPlanPreview');
    if (!preview) return;
    preview.innerHTML = previewHeader() + (activeRows.length ? activeRows.map(previewRow).join('') : '<div class="dp-preview-empty">Der Druckplan erscheint hier.</div>');
  }

  function updateRowFromInput(input) {
    const tr = input.closest('tr[data-row-id]');
    const row = activeRows.find((item) => item.id === tr?.dataset.rowId);
    const field = input.dataset.field;
    if (!row || !field) return;
    row[field] = input.value;
    if (field === 'duty') {
      const template = dutyTemplate(row.duty, selectedDate);
      row.start = template.start;
      row.end = template.end;
      row.departure = template.departure;
      row.stop = template.stop;
      renderRows();
    }
    renderPreview();
  }

  function insertDefaults() {
    const existing = new Set(activeRows.map((row) => normalize(row.duty)));
    let count = 0;
    DEFAULT_ORDER.forEach((duty) => {
      if (existing.has(normalize(duty))) return;
      activeRows.push(blankRow(duty));
      count += 1;
    });
    renderAll();
    setPlanStatus(count ? `${count} Standarddienste wurden eingefügt. Namen und Kennzeichen können jetzt eingetragen werden.` : 'Alle Standarddienste sind bereits vorhanden.', 'ok');
  }

  async function saveCurrentPlan() {
    if (!canEdit()) return;
    store.plans[selectedDate] = {
      date: selectedDate,
      rows: activeRows.map(normalizeRow),
      savedAt: new Date().toISOString()
    };
    setPlanStatus('Dienstplan wird gespeichert …');
    try {
      const ok = await saveStore();
      setPlanStatus(ok ? 'Dienstplan wurde gespeichert.' : 'Dienstplan wurde lokal gespeichert.', 'ok');
    } catch (error) {
      saveLocal();
      setPlanStatus(`Lokal gespeichert. Serverfehler: ${error.message}`, 'error');
    }
  }

  function clearPlan() {
    if (!canEdit()) return;
    if (activeRows.length && !window.confirm('Diesen Tagesdienstplan wirklich leeren?')) return;
    activeRows = [];
    renderAll();
    setPlanStatus('Der Plan wurde geleert. Zum dauerhaften Übernehmen bitte speichern.');
  }

  function printableRows() {
    return activeRows.filter((row) => Object.values(row).some((value) => String(value || '').trim()));
  }

  function printPlan() {
    const rows = printableRows();
    if (!rows.length) {
      setPlanStatus('Es sind keine Einträge zum Drucken vorhanden.', 'error');
      return;
    }
    const chunks = [];
    for (let index = 0; index < rows.length; index += 17) chunks.push(rows.slice(index, index + 17));
    const pages = chunks.map((chunk, index) => `
      <section class="page${index === chunks.length - 1 ? ' last' : ''}">
        ${index === 0 ? `
          <header><div>Dienstplan für ${escapeHtml(weekdayName(selectedDate))}, den</div><div>${escapeHtml(germanDate(selectedDate))}</div><div class="right">Kalenderwoche&nbsp;&nbsp; ${isoWeek(selectedDate)}</div><div class="stop-title">Abfahrzeit ab 1. Haltestelle</div></header>` : ''}
        <div class="rows">${chunk.map((row) => {
          const duty = row.duty ? `Dienst ${escapeHtml(row.duty)}` : '';
          const bus = row.bus ? `/ ${escapeHtml(row.bus)}` : '';
          const times = row.start || row.end ? `/ ${escapeHtml(row.start || '--:--')} - ${escapeHtml(row.end || '--:--')} Uhr` : '';
          const departure = row.departure ? `${escapeHtml(printDeparture(row.departure))} Uhr` : '';
          const stop = [departure, escapeHtml(row.stop)].filter(Boolean).join(' ');
          return `<div class="row"><div class="left"><strong>${escapeHtml(row.name) || '&nbsp;'}</strong><span>${duty || '&nbsp;'}</span></div><div class="middle"><strong>${bus || '&nbsp;'}</strong><span>${times || '&nbsp;'}</span></div><div class="rightcol">${stop || '&nbsp;'}</div></div>`;
        }).join('')}</div>
      </section>`).join('');

    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Dienstplan ${escapeHtml(germanDate(selectedDate))}</title><style>
      @page{size:A4 portrait;margin:13mm 14mm}*{box-sizing:border-box}body{margin:0;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:11pt}.page{min-height:270mm;page-break-after:always}.page.last{page-break-after:auto}header{display:grid;grid-template-columns:1.4fr .85fr 1fr;gap:15px;font-size:13pt;font-weight:800;margin-bottom:8mm}header .right{text-align:right}.stop-title{grid-column:3;font-size:11.5pt;text-align:left;margin-top:1mm}.row{display:grid;grid-template-columns:23% 31% 46%;gap:4mm;min-height:15mm;break-inside:avoid;page-break-inside:avoid}.left,.middle{display:flex;flex-direction:column;line-height:1.3}.row strong{font-size:11.5pt}.rightcol{padding-top:6mm;line-height:1.3}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>${pages}</body></html>`);
    doc.close();
    window.setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } finally {
        window.setTimeout(() => frame.remove(), 1500);
      }
    }, 250);
  }

  let eventsBound = false;
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    document.addEventListener('click', (event) => {
      const tab = event.target.closest?.('.tabs .tab');
      if (tab?.id === TAB_ID) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openDailyTab();
        return;
      }
      if (tab && tab.id !== TAB_ID) closeDailyTab();

      if (event.target.closest?.('#dpDailyInsertDefaults')) insertDefaults();
      if (event.target.closest?.('#dpDailyAddRow')) {
        activeRows.push(blankRow());
        renderAll();
      }
      if (event.target.closest?.('#dpDailySave')) saveCurrentPlan();
      if (event.target.closest?.('#dpDailyPrint')) printPlan();
      if (event.target.closest?.('#dpDailyClear')) clearPlan();

      const actionButton = event.target.closest?.('#dpDailyPlanRows [data-action]');
      if (actionButton) {
        const tr = actionButton.closest('tr[data-row-id]');
        const index = activeRows.findIndex((row) => row.id === tr?.dataset.rowId);
        if (index < 0) return;
        const action = actionButton.dataset.action;
        if (action === 'delete') activeRows.splice(index, 1);
        if (action === 'up' && index > 0) [activeRows[index - 1], activeRows[index]] = [activeRows[index], activeRows[index - 1]];
        if (action === 'down' && index < activeRows.length - 1) [activeRows[index], activeRows[index + 1]] = [activeRows[index + 1], activeRows[index]];
        renderAll();
      }
    }, true);

    document.addEventListener('input', (event) => {
      if (event.target.closest?.('#dpDailyPlanRows input')) updateRowFromInput(event.target);
    });

    document.addEventListener('change', (event) => {
      if (event.target.id === 'dpDailyPlanDate') {
        selectedDate = safeDate(event.target.value);
        localStorage.setItem(LAST_DATE_KEY, selectedDate);
        loadSelectedDate();
      }
    });
  }

  async function start() {
    if (!installUi()) return false;
    await loadStore();
    rebuildDutyList();
    loadSelectedDate();
    return true;
  }

  [0, 150, 500, 1200, 2500].forEach((delay) => window.setTimeout(start, delay));
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton')) {
      [200, 600, 1400, 3000].forEach((delay) => window.setTimeout(start, delay));
    }
  }, true);
  window.addEventListener('pageshow', start);
  window.addEventListener('focus', () => {
    installUi();
    applyPermissions();
  });
})();

(() => {
  'use strict';

  if (window.__dienstpilotWeekendCombinedEditorV1) return;
  window.__dienstpilotWeekendCombinedEditorV1 = true;

  const API_URL = 'https://api.dienstpilot-runke.de/api/data/daily_duty_plans';
  const LOCAL_KEY = 'dienstpilot_daily_duty_plans_v1';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const DATE_ID = 'dpDailyPlanDate';
  const PANEL_ID = 'dpWeekendCombinedEditor';
  const STATUS_ID = 'dpWeekendCombinedStatus';
  const STYLE_ID = 'dpWeekendCombinedEditorStyle';

  const DRIVERS = [
    'Y.Yasar', 'Bumhoffer', 'M.Entrup', 'M.Schweppe', 'I.Janzen', 'K.Alomar', 'H.AI Sayek',
    'A.Szczepanik', 'A.Kocdemir', 'W.Wüllner', 'S.Wittwer', 'F.Biermann', 'A.Gerding',
    'R.Runke', 'P.Lommel', 'M.Malko', 'N.Murad', 'S.Kurta', 'T.Wiemann', 'A.Muth',
    'S.Suleimani', 'J.Faber', 'L.Hergerdt', 'A.Hergerdt', 'A.Hasan', 'D.Knigge',
    'N.Awdullahi', 'K.Giotis', 'K.Igelbrink', 'A.Alrobaie', 'A.Morzsa', 'M.Al Dabbah',
    'C.Strotmann', 'M.Eggern', 'S.Yasatemur', 'N.Ghulami', 'M.Alsaba', 'H.J.Husmann',
    'S.Kelgorn', 'W.Blaz'
  ];

  const PLATES = [
    'OS-LK 621', 'OS-TG 324', 'OS-GZ 123', 'OS-LF 223', 'OS-RE 224', 'OS-NP 617',
    'OS-JY 122', 'OS-SU 722', 'OS-GO 717', 'OS-KX 220', 'OS-OP 622', 'OS-ZT 626',
    'OS-KF 526', 'OS-YG 120', 'OS-XB 925', 'OS-WP 918', 'OS-EV 118', 'OS-BU 816',
    'OS-PK 216', 'OS-RS 725', 'OS-DZ 116', 'OS-UL 818', 'OS-IF 215', 'OS-HD 124',
    'OS-FN 919', 'OS-AX 716', 'OS-MR 825', 'OS-CL 916', 'OS-QS 519', 'OS-VH 721',
    'OS-BS 725'
  ];

  const SATURDAY_DUTIES = ['3050', '3051', '3052', '3053', '3054', '3055', '3056', '3057', '1340', '11541', 'Einsatzwagen'];
  const SUNDAY_DUTIES = ['3061', '3062', '1943'];

  const SATURDAY_DEFAULTS = [
    { duty: '3050', name: 'F.Biermann', bus: 'OS-SU 722', start: '06:03', end: '14:21', departure: '06:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3051', name: 'S.Kelgorn', bus: 'OS-YG 120', start: '06:42', end: '15:21', departure: '07:15', stop: 'Bruchmühlen, Schule' },
    { duty: '3052', name: 'H.J.Husmann', bus: 'OS-LF 223', start: '06:43', end: '14:41', departure: '07:16', stop: 'Buer, Schulzentrum' },
    { duty: '3053', name: 'P.Lommel', bus: 'OS-XB 925', start: '06:47', end: '14:39', departure: '07:12', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '3054', name: 'W.Blaz', bus: 'OS-BS 725', start: '06:51', end: '19:21', departure: '07:18', stop: 'Westerhausen, Vinkenaue' },
    { duty: '3055', name: 'M.Alsaba', bus: 'OS-DZ 116', start: '07:03', end: '17:04', departure: '07:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3056', name: 'N.Awdullahi', bus: 'OS-EV 118', start: '07:07', end: '16:04', departure: '07:31', stop: 'Gesmold, Schimmweg' },
    { duty: '3057', name: 'K.Alomar', bus: 'OS-ZT 626', start: '09:20', end: '18:21', departure: '09:55', stop: 'Werther, ZOB' },
    { duty: '1340', name: 'F.Biermann', bus: 'OS-MR 825', start: '05:13', end: '14:14', departure: '', stop: 'Melle, ZOB' },
    { duty: '11541', name: 'C.Strotmann', bus: 'OS-MR 825', start: '14:22', end: '00:20', departure: '', stop: 'Melle, ZOB' },
    { duty: 'Einsatzwagen', name: 'Einsatzwagen', bus: 'OS-IF 215', start: '', end: '', departure: '', stop: 'Melle, ZOB' }
  ];

  const SUNDAY_DEFAULTS = [
    { duty: '3061', name: 'Y.Yasar', bus: 'OS-QS 519', start: '12:03', end: '19:46', departure: '12:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3062', name: 'N.Murad', bus: 'OS-HD 124', start: '11:47', end: '19:38', departure: '12:12', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '1943', name: 'A.Al Arsan', bus: '', start: '06:56', end: '14:04', departure: '', stop: '' },
    { duty: '1943', name: 'N.Ghulami', bus: 'OS-FN 919', start: '13:44', end: '21:47', departure: '', stop: '' }
  ];

  let activeDates = null;
  let saturdayRows = [];
  let sundayRows = [];
  let opening = false;
  let saving = false;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {};
    } catch {
      return {};
    }
  }

  function currentRole() {
    const user = currentUser();
    return normalize(user.role || sessionStorage.getItem(ROLE_KEY));
  }

  function canEdit() {
    return ['administrator', 'admin', 'geschaftsleitung', 'geschaeftsleitung', 'disposition', 'disponent', 'disponentin'].includes(currentRole());
  }

  function canEditTimes() {
    return ['administrator', 'admin', 'geschaftsleitung', 'geschaeftsleitung'].includes(currentRole());
  }

  function parseDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date();
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }

  function isoDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function addDays(date, days) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    result.setDate(result.getDate() + days);
    return result;
  }

  function mondayOfWeek(date) {
    const day = date.getDay() || 7;
    return addDays(date, 1 - day);
  }

  function weekendDates() {
    const input = String(document.getElementById(DATE_ID)?.value || '').trim();
    const monday = mondayOfWeek(parseDate(input));
    return { saturday: isoDate(addDays(monday, 5)), sunday: isoDate(addDays(monday, 6)) };
  }

  function germanDate(iso) {
    const [year, month, day] = String(iso || '').split('-');
    return `${day}.${month}.${year}`;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeRow(row, prefix = 'weekend') {
    const value = row && typeof row === 'object' ? row : {};
    return {
      id: String(value.id || uid(prefix)),
      name: String(value.name || ''),
      duty: String(value.duty || ''),
      bus: String(value.bus || '').replace(/^OS-JF 215$/i, 'OS-IF 215'),
      start: String(value.start || ''),
      end: String(value.end || ''),
      departure: String(value.departure || ''),
      stop: String(value.stop || '')
    };
  }

  function cloneDefaults(rows, prefix) {
    return rows.map((row, index) => normalizeRow({ ...row, id: `${prefix}-${row.duty}-${index}` }, prefix));
  }

  function normalizeStore(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawPlans = source.plans && typeof source.plans === 'object' ? source.plans : source;
    const plans = {};
    Object.entries(rawPlans || {}).forEach(([date, plan]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !plan || typeof plan !== 'object') return;
      plans[date] = {
        date,
        rows: Array.isArray(plan.rows) ? plan.rows.map((row) => normalizeRow(row, date)) : [],
        savedAt: String(plan.savedAt || '')
      };
    });
    return { plans };
  }

  function readLocalStore() {
    try {
      return normalizeStore(JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'));
    } catch {
      return { plans: {} };
    }
  }

  function authHeaders(extra = {}) {
    const headers = new Headers(extra);
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  function unwrap(value) {
    return value && Object.prototype.hasOwnProperty.call(value, 'data') ? (value.data || {}) : (value || {});
  }

  async function loadStore() {
    const local = readLocalStore();
    if (!sessionStorage.getItem(TOKEN_KEY)) return local;
    try {
      const response = await fetch(API_URL, { cache: 'no-store', headers: authHeaders() });
      if (!response.ok) return local;
      const remote = normalizeStore(unwrap(await response.json().catch(() => ({}))));
      const merged = { plans: { ...local.plans, ...remote.plans } };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
      return merged;
    } catch {
      return local;
    }
  }

  function orderRows(rows, type) {
    const order = type === 'saturday' ? SATURDAY_DUTIES : SUNDAY_DUTIES;
    const occurrence = new Map();
    return rows
      .map((row, index) => ({ row: normalizeRow(row, type), index }))
      .sort((a, b) => {
        const ad = String(a.row.duty || '');
        const bd = String(b.row.duty || '');
        const ai = order.indexOf(ad);
        const bi = order.indexOf(bd);
        if (ai !== bi) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
        return a.index - b.index;
      })
      .map(({ row }) => {
        const key = row.duty;
        occurrence.set(key, (occurrence.get(key) || 0) + 1);
        return row;
      });
  }

  function rowsForDate(store, date, type) {
    const saved = store.plans[date]?.rows || [];
    const allowed = new Set(type === 'saturday' ? SATURDAY_DUTIES : SUNDAY_DUTIES);
    const filtered = saved.filter((row) => allowed.has(String(row.duty || '').trim()));
    if (filtered.length) return orderRows(filtered, type);
    return cloneDefaults(type === 'saturday' ? SATURDAY_DEFAULTS : SUNDAY_DEFAULTS, type);
  }

  function availableDrivers(rows) {
    const names = [...DRIVERS];
    document.querySelectorAll('#kollegeSelect option,.dp-daily-driver-select option').forEach((option) => {
      const name = String(option.textContent || option.value || '').trim();
      if (name && !names.some((entry) => normalize(entry) === normalize(name))) names.push(name);
    });
    rows.forEach((row) => {
      const name = String(row.name || '').trim();
      if (name && normalize(name) !== 'einsatzwagen' && !names.some((entry) => normalize(entry) === normalize(name))) names.push(name);
    });
    return names.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  function availablePlates(rows) {
    const values = [...PLATES];
    rows.forEach((row) => {
      const plate = String(row.bus || '').trim().replace(/^OS-JF 215$/i, 'OS-IF 215');
      if (plate && !values.includes(plate)) values.push(plate);
    });
    return values.sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  }

  function optionHtml(values, selected, blankText) {
    const current = String(selected || '');
    return `<option value="">${escapeHtml(blankText)}</option>${values.map((value) => `<option value="${escapeHtml(value)}"${value === current ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}`;
  }

  function dutyOptions(type, selected) {
    const values = type === 'saturday' ? SATURDAY_DUTIES : SUNDAY_DUTIES;
    return values.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${normalize(value) === 'einsatzwagen' ? 'Einsatzwagen' : `Dienst ${escapeHtml(value)}`}</option>`).join('');
  }

  function rowHtml(row, index, type, drivers, plates) {
    const duty = String(row.duty || '');
    const fixedDuty = duty === '1340' || duty === '11541' || duty === '1943' || normalize(duty) === 'einsatzwagen';
    const isWagon = normalize(duty) === 'einsatzwagen';
    const timeDisabled = !canEditTimes() || isWagon;
    const driverDisabled = isWagon;
    const shift = duty === '1340' ? 'Frühschicht' : duty === '11541' ? 'Spätschicht' : duty === '1943' ? (index === 2 ? 'Frühschicht' : 'Spätschicht') : '';
    return `<tr data-index="${index}" data-row-id="${escapeHtml(row.id)}">
      <td>${shift ? `<span class="dp-weekend-shift">${escapeHtml(shift)}</span>` : ''}<select data-field="name"${driverDisabled ? ' disabled' : ''}>${optionHtml(drivers, row.name, 'Fahrer auswählen')}</select>${driverDisabled ? '<input type="hidden" data-field="name" value="Einsatzwagen">' : ''}</td>
      <td><select data-field="duty"${fixedDuty ? ' disabled' : ''}>${dutyOptions(type, duty)}</select>${fixedDuty ? `<input type="hidden" data-field="duty" value="${escapeHtml(duty)}">` : ''}</td>
      <td><select data-field="bus">${optionHtml(plates, row.bus, 'Kennzeichen auswählen')}</select></td>
      <td><input data-field="start" type="time" value="${escapeHtml(row.start)}"${timeDisabled ? ' disabled' : ''}></td>
      <td><input data-field="end" type="time" value="${escapeHtml(row.end)}"${timeDisabled ? ' disabled' : ''}></td>
      <td><input data-field="departure" type="time" value="${escapeHtml(row.departure)}"${timeDisabled ? ' disabled' : ''}></td>
      <td><input data-field="stop" value="${escapeHtml(row.stop)}"${isWagon ? ' disabled' : ''}></td>
    </tr>`;
  }

  function tableHtml(date, rows, type) {
    const drivers = availableDrivers([...saturdayRows, ...sundayRows]);
    const plates = availablePlates([...saturdayRows, ...sundayRows]);
    const dayName = type === 'saturday' ? 'Samstag' : 'Sonntag';
    return `<section class="dp-weekend-day" data-day="${type}">
      <div class="dp-weekend-day-head"><h3>Dienstplan für ${dayName}, den ${escapeHtml(germanDate(date))}</h3><strong>Kalenderwoche ${isoWeek(date)}</strong></div>
      <div class="dp-weekend-table-wrap"><table class="dp-weekend-table"><thead><tr><th>Name</th><th>Dienst</th><th>Kennzeichen</th><th>Beginn</th><th>Ende</th><th>Abfahrt 1. Haltestelle</th><th>1. Haltestelle</th></tr></thead><tbody>${rows.map((row, index) => rowHtml(row, index, type, drivers, plates)).join('')}</tbody></table></div>
    </section>`;
  }

  function isoWeek(iso) {
    const date = parseDate(iso);
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{display:grid;gap:18px;margin:12px 0;padding:15px;border:2px solid #0f172a;border-radius:16px;background:#f8fafc}
      #${PANEL_ID}[hidden]{display:none!important}
      #${PANEL_ID} .dp-weekend-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
      #${PANEL_ID} .dp-weekend-editor-head h2{margin:0 0 4px}.dp-weekend-editor-note{color:#475569;font-weight:750}
      #${PANEL_ID} .dp-weekend-day{display:grid;gap:9px;padding:12px;border:1px solid #cbd5e1;border-radius:13px;background:#fff}
      #${PANEL_ID} .dp-weekend-day-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
      #${PANEL_ID} .dp-weekend-day-head h3{margin:0}
      #${PANEL_ID} .dp-weekend-table-wrap{overflow:auto;border:1px solid #dbe3ed;border-radius:11px}
      #${PANEL_ID} .dp-weekend-table{width:100%;min-width:1080px;border-collapse:collapse}
      #${PANEL_ID} th{padding:8px;background:#eef2f7;text-align:left;font-size:12px}
      #${PANEL_ID} td{padding:6px;border-top:1px solid #e2e8f0;vertical-align:top}
      #${PANEL_ID} input,#${PANEL_ID} select{width:100%;box-sizing:border-box;padding:8px 9px;border:1px solid #2563eb;border-radius:9px;background:#fff;color:#0f172a;font:inherit;font-weight:800}
      #${PANEL_ID} input:disabled,#${PANEL_ID} select:disabled{border-color:#cbd5e1;background:#f1f5f9;color:#475569;cursor:not-allowed}
      #${PANEL_ID} .dp-weekend-shift{display:inline-flex;margin:0 0 5px;padding:3px 7px;border:1px solid #93c5fd;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:950}
      #${PANEL_ID} .dp-weekend-actions{display:flex;gap:9px;flex-wrap:wrap}
      #${PANEL_ID} .dp-weekend-actions button{padding:10px 14px;border-radius:11px;font-weight:900;cursor:pointer}
      #${PANEL_ID} .primary{border:1px solid #020617;background:#020617;color:#fff}.secondary{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${STATUS_ID}{min-height:22px;font-weight:850;color:#475569}#${STATUS_ID}.ok{color:#047857}#${STATUS_ID}.error{color:#b91c1c}
      body.dp-weekend-combined-open #tab-daily-duty-plan .dp-daily-actions,body.dp-weekend-combined-open #tab-daily-duty-plan .dp-daily-table-wrap,body.dp-weekend-combined-open #tab-daily-duty-plan .dp-daily-preview{display:none!important}
      @media(max-width:760px){#${PANEL_ID}{padding:10px}.dp-weekend-actions{display:grid!important}.dp-weekend-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    addStyle();
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    const card = document.querySelector('#tab-daily-duty-plan .dp-daily-card');
    if (!card) return null;
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.hidden = true;
    const anchor = document.querySelector('.dp-weekend-edit-buttons') || document.getElementById('dpDailyPlanModeLabel');
    if (anchor) anchor.insertAdjacentElement('afterend', panel);
    else card.prepend(panel);
    return panel;
  }

  function renderPanel() {
    const panel = ensurePanel();
    if (!panel || !activeDates) return;
    panel.innerHTML = `<div class="dp-weekend-editor-head"><div><h2>Samstag und Sonntag gemeinsam bearbeiten</h2><div class="dp-weekend-editor-note">Beide Tagespläne werden zusammen geöffnet, zusammen gespeichert und anschließend gemeinsam gedruckt. Beginn, Ende und Abfahrt können nur Administrator und Geschäftsleitung ändern.</div></div></div>
      ${tableHtml(activeDates.saturday, saturdayRows, 'saturday')}
      ${tableHtml(activeDates.sunday, sundayRows, 'sunday')}
      <div id="${STATUS_ID}" role="status" aria-live="polite"></div>
      <div class="dp-weekend-actions"><button type="button" id="dpWeekendCombinedSave" class="primary">Samstag und Sonntag speichern</button><button type="button" id="dpWeekendCombinedSavePrint" class="primary">Speichern und gemeinsam drucken</button><button type="button" id="dpWeekendCombinedClose" class="secondary">Schließen</button></div>`;
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;
    status.textContent = text;
    status.className = kind;
  }

  function collectRows(type) {
    const section = document.querySelector(`#${PANEL_ID} [data-day="${type}"]`);
    if (!section) return [];
    return [...section.querySelectorAll('tbody tr')].map((tr) => {
      const value = (field) => {
        const controls = [...tr.querySelectorAll(`[data-field="${field}"]`)];
        const active = controls.find((control) => control.type !== 'hidden' && !control.disabled) || controls.find((control) => control.type === 'hidden') || controls[0];
        return String(active?.value || '');
      };
      return normalizeRow({
        id: tr.dataset.rowId,
        name: value('name'), duty: value('duty'), bus: value('bus'), start: value('start'), end: value('end'), departure: value('departure'), stop: value('stop')
      }, type);
    });
  }

  function validateRows(rows, type) {
    const duties = rows.map((row) => String(row.duty || '').trim());
    const required = type === 'saturday' ? ['1340', '11541', 'Einsatzwagen'] : ['1943', '1943'];
    for (const duty of new Set(required)) {
      const requiredCount = required.filter((entry) => entry === duty).length;
      const actualCount = duties.filter((entry) => entry === duty).length;
      if (actualCount !== requiredCount) return `${type === 'saturday' ? 'Samstag' : 'Sonntag'}: Dienst ${duty} muss ${requiredCount === 1 ? 'einmal' : `${requiredCount}-mal`} vorhanden sein.`;
    }

    const blocked = rows.find((row) => row.bus && typeof window.dienstpilotIsVehicleInWorkshop === 'function' && window.dienstpilotIsVehicleInWorkshop(row.bus));
    if (blocked) return `Das Fahrzeug ${blocked.bus} befindet sich in der Werkstatt und darf nicht vergeben werden.`;
    return '';
  }

  function updateGlobalRows() {
    if (!activeDates) return;
    window.dienstpilotWeekendCombinedRows = {
      ...(window.dienstpilotWeekendCombinedRows || {}),
      [activeDates.saturday]: saturdayRows.map((row) => ({ ...row })),
      [activeDates.sunday]: sundayRows.map((row) => ({ ...row }))
    };
  }

  async function saveBoth(printAfter = false) {
    if (saving || !canEdit() || !activeDates) return false;
    saturdayRows = orderRows(collectRows('saturday'), 'saturday');
    sundayRows = orderRows(collectRows('sunday'), 'sunday');

    const error = validateRows(saturdayRows, 'saturday') || validateRows(sundayRows, 'sunday');
    if (error) {
      setStatus(error, 'error');
      return false;
    }

    saving = true;
    setStatus('Samstags- und Sonntagsplan werden gemeinsam gespeichert …');
    try {
      const store = await loadStore();
      const now = new Date().toISOString();
      store.plans[activeDates.saturday] = { date: activeDates.saturday, rows: saturdayRows.map((row) => normalizeRow(row, 'saturday')), savedAt: now };
      store.plans[activeDates.sunday] = { date: activeDates.sunday, rows: sundayRows.map((row) => normalizeRow(row, 'sunday')), savedAt: now };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(store));

      const token = sessionStorage.getItem(TOKEN_KEY) || '';
      if (token) {
        const response = await fetch(API_URL, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(store)
        });
        if (!response.ok) throw new Error(`Serverstatus ${response.status}`);
      }

      updateGlobalRows();
      setStatus(`Samstag ${germanDate(activeDates.saturday)} und Sonntag ${germanDate(activeDates.sunday)} wurden gemeinsam gespeichert.`, 'ok');
      window.dispatchEvent(new CustomEvent('dienstpilot-weekend-combined-saved', { detail: { ...activeDates } }));
      if (printAfter) window.setTimeout(() => document.getElementById('dpDailyPrintWeekend')?.click(), 120);
      return true;
    } catch (errorValue) {
      setStatus(`Lokal gespeichert, Serverfehler: ${errorValue.message}`, 'error');
      updateGlobalRows();
      return false;
    } finally {
      saving = false;
    }
  }

  async function openEditor() {
    if (opening || !canEdit()) return;
    opening = true;
    try {
      activeDates = weekendDates();
      const store = await loadStore();
      saturdayRows = rowsForDate(store, activeDates.saturday, 'saturday');
      sundayRows = rowsForDate(store, activeDates.sunday, 'sunday');
      updateGlobalRows();
      renderPanel();
      const panel = ensurePanel();
      if (panel) panel.hidden = false;
      document.body.classList.add('dp-weekend-combined-open');
      setStatus(`Samstag ${germanDate(activeDates.saturday)} und Sonntag ${germanDate(activeDates.sunday)} sind gemeinsam geöffnet.`, 'ok');
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      opening = false;
    }
  }

  function closeEditor() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.hidden = true;
    document.body.classList.remove('dp-weekend-combined-open');
  }

  window.dienstpilotOpenWeekendCombinedEditor = openEditor;

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpWeekendCombinedSave')) void saveBoth(false);
    if (event.target.closest?.('#dpWeekendCombinedSavePrint')) void saveBoth(true);
    if (event.target.closest?.('#dpWeekendCombinedClose')) closeEditor();
    if (event.target.closest?.('#dpDailyEditWeekend')) void openEditor();
    if (event.target.closest?.('#loginButton,#dpDailyDutyPlanTab')) window.setTimeout(ensurePanel, 250);
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID && !document.getElementById(PANEL_ID)?.hidden) void openEditor();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensurePanel, { once: true });
  else ensurePanel();
  window.addEventListener('pageshow', ensurePanel);
  window.addEventListener('focus', ensurePanel);
})();
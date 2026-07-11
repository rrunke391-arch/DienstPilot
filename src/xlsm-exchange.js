(() => {
  'use strict';

  const CATALOG_API = 'https://api.dienstpilot-runke.de/api/data/catalog_custom';
  const PLANS_API = 'https://api.dienstpilot-runke.de/api/data/daily_duty_plans';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const PLANS_KEY = 'dienstpilot_daily_duty_plans_v1';
  const INPUT_ID = 'dpXlsmImportInput';
  const BUTTON_IDS = ['dpXlsmExportCatalog', 'dpXlsmImportCatalog', 'dpXlsmExportPlan', 'dpXlsmImportPlan'];
  let busy = false;

  function readJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch { return fallback; }
  }

  function normRole(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function rights() {
    const user = readJson(sessionStorage, USER_KEY, {}) || {};
    const role = normRole(user.role || sessionStorage.getItem(ROLE_KEY));
    const name = String(user.username || user.displayName || '').trim().toLowerCase();
    const lead = name === 'runke' || ['administrator', 'admin', 'geschaftsleitung', 'geschaeftsleitung'].includes(role);
    return { catalog: lead, plans: lead || role === 'disposition' };
  }

  function feedback(text, error = false) {
    const daily = document.getElementById('dpDailyPlanStatus');
    if (daily) {
      daily.textContent = text;
      daily.className = `dp-daily-status ${error ? 'error' : 'ok'}`;
    }
    const catalog = document.getElementById('dpCatalogEditorInfo');
    if (catalog && !document.getElementById('tab-katalog')?.classList.contains('hidden')) {
      catalog.textContent = text;
      catalog.className = error ? 'error' : 'ok';
    }
  }

  function setBusy(value, text = '') {
    busy = value;
    BUTTON_IDS.forEach((id) => { const b = document.getElementById(id); if (b) b.disabled = value; });
    if (text) feedback(text);
  }

  function style() {
    if (document.getElementById('dpXlsmExchangeStyle')) return;
    const el = document.createElement('style');
    el.id = 'dpXlsmExchangeStyle';
    el.textContent = '.dp-xlsm-buttons{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.dp-xlsm-button{padding:10px 13px;border:1px solid #16a34a;border-radius:11px;background:#f0fdf4;color:#166534;font-weight:900;cursor:pointer}.dp-xlsm-import{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.dp-xlsm-button:disabled{opacity:.55;cursor:wait}.dp-xlsm-note{font-size:12px;color:#475569;font-weight:700}@media(max-width:760px){.dp-xlsm-buttons{display:grid;grid-template-columns:1fr}.dp-xlsm-button{width:100%}}';
    document.head.appendChild(el);
  }

  function button(id, text, cls, action) {
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.className = `dp-xlsm-button ${cls || ''}`;
    b.textContent = text;
    b.addEventListener('click', action);
    return b;
  }

  function fileInput() {
    let input = document.getElementById(INPUT_ID);
    if (input) return input;
    input = document.createElement('input');
    input.id = INPUT_ID;
    input.type = 'file';
    input.accept = '.xlsm,.xlsx';
    input.hidden = true;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) await importFile(file);
    });
    document.body.appendChild(input);
    return input;
  }

  function install() {
    style();
    fileInput();
    const access = rights();
    const catalogGroup = document.querySelector('#tab-katalog .toolbar .toolbar-group');
    if (catalogGroup && !document.getElementById('dpXlsmExportCatalog')) {
      const wrap = document.createElement('div');
      wrap.className = 'dp-xlsm-buttons';
      wrap.append(button('dpXlsmExportCatalog', 'XLSM exportieren', '', exportFile), button('dpXlsmImportCatalog', 'XLSM importieren', 'dp-xlsm-import', () => fileInput().click()));
      catalogGroup.appendChild(wrap);
    }
    const actions = document.querySelector('#tab-daily-duty-plan .dp-daily-actions');
    if (actions && !document.getElementById('dpXlsmExportPlan')) {
      const wrap = document.createElement('div');
      wrap.className = 'dp-xlsm-buttons dp-daily-edit-only';
      wrap.append(button('dpXlsmExportPlan', 'XLSM exportieren', '', exportFile), button('dpXlsmImportPlan', 'XLSM importieren', 'dp-xlsm-import', () => fileInput().click()));
      actions.insertAdjacentElement('afterend', wrap);
      const note = document.createElement('div');
      note.className = 'dp-xlsm-note';
      note.textContent = 'XLSM enthält Dienstkatalog und alle gespeicherten Dienstpläne.';
      wrap.insertAdjacentElement('afterend', note);
    }
    const ci = document.getElementById('dpXlsmImportCatalog');
    if (ci) ci.hidden = !access.catalog;
    const pi = document.getElementById('dpXlsmImportPlan');
    if (pi) pi.hidden = !(access.catalog || access.plans);
  }

  async function apiGet(url) {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return null;
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) return null;
      const value = await response.json().catch(() => null);
      return value && Object.prototype.hasOwnProperty.call(value, 'data') ? value.data : value;
    } catch { return null; }
  }

  async function apiPut(url, data) {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) throw new Error('Keine aktive Serveranmeldung.');
    const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
    if (!response.ok) {
      const value = await response.json().catch(() => ({}));
      throw new Error(value.error || `Serverfehler ${response.status}`);
    }
  }

  function visiblePlan() {
    const date = String(document.getElementById('dpDailyPlanDate')?.value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const rows = [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')].map((tr, index) => {
      const get = (f) => String(tr.querySelector(`[data-field="${f}"]`)?.value || '').trim();
      return { id: tr.dataset.rowId || `xlsm-${Date.now()}-${index}`, name: get('name'), duty: get('duty'), bus: get('bus'), start: get('start'), end: get('end'), departure: get('departure'), stop: get('stop') };
    }).filter((r) => [r.name, r.duty, r.bus, r.start, r.end, r.departure, r.stop].some(Boolean));
    return rows.length ? { date, rows, savedAt: new Date().toISOString() } : null;
  }

  async function collect() {
    const main = readJson(localStorage, MAIN_KEY, {});
    const localCatalog = main.customCatalog && typeof main.customCatalog === 'object' ? main.customCatalog : {};
    let catalog = {};
    try { if (typeof getCatalog === 'function') catalog = getCatalog() || {}; } catch {}
    catalog = { ...catalog, ...localCatalog, ...((await apiGet(CATALOG_API)) || {}) };

    const local = readJson(localStorage, PLANS_KEY, { plans: {} });
    const localPlans = local.plans && typeof local.plans === 'object' ? local.plans : local;
    const remote = (await apiGet(PLANS_API)) || {};
    const remotePlans = remote.plans && typeof remote.plans === 'object' ? remote.plans : remote;
    const plans = { ...localPlans, ...remotePlans };
    const current = visiblePlan();
    if (current) plans[current.date] = current;
    return { catalog, plans };
  }

  const natural = (a, b) => String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });

  function catalogRows(catalog) {
    return [['Dienstnummer', 'Beginn', 'Ende', 'Freitag Ende', 'Gültige Tage', 'Abfahrt 1. Haltestelle', '1. Haltestelle', 'Verkehrsart', 'Haltestellenabstand', 'Pausenregel', 'Tarifregel ab 8 Minuten'], ...Object.entries(catalog).sort(([a], [b]) => natural(a, b)).map(([d, e]) => [d, e?.start || '', e?.end || '', e?.fridayEnd || '', e?.days || '', e?.firstStopDeparture || e?.departure || '', e?.firstStop || e?.firstStopName || '', e?.lineMode || '', e?.stopDistance || '', e?.pauseRule || '', e?.tariffEight ? 'Ja' : 'Nein'])];
  }

  function planRows(plans) {
    const rows = [['Datum', 'Reihenfolge', 'Fahrer', 'Dienst', 'Kennzeichen', 'Beginn', 'Ende', 'Abfahrt 1. Haltestelle', '1. Haltestelle']];
    Object.keys(plans).sort().forEach((date) => {
      const plan = plans[date];
      if (!Array.isArray(plan?.rows)) return;
      plan.rows.forEach((r, i) => rows.push([date, i + 1, r?.name || '', r?.duty || '', r?.bus || '', r?.start || '', r?.end || '', r?.departure || '', r?.stop || '']));
    });
    return rows;
  }

  function noteRows() {
    return [['DienstPilot – XLSM-Bearbeitung'], [''], ['1.', 'Blätter „Dienstkatalog“ und „Dienstplaene“ bearbeiten.'], ['2.', 'Überschriften und Blattnamen nicht verändern.'], ['3.', 'Uhrzeiten als HH:MM, Datum als JJJJ-MM-TT.'], ['4.', 'Als XLSM speichern und in DienstPilot importieren.'], ['5.', 'Die Datei ist makrofähig, enthält aber keine vorgegebenen VBA-Makros.']];
  }

  async function exportFile() {
    if (busy) return;
    setBusy(true, 'XLSM-Datei wird erstellt …');
    try {
      if (!window.DienstPilotXlsmCore) throw new Error('XLSM-Modul ist noch nicht geladen.');
      const data = await collect();
      const bytes = window.DienstPilotXlsmCore.create([
        { name: 'Dienstkatalog', rows: catalogRows(data.catalog), widths: [16, 12, 12, 14, 16, 22, 34, 18, 22, 18, 22] },
        { name: 'Dienstplaene', rows: planRows(data.plans), widths: [13, 12, 24, 15, 17, 12, 12, 22, 36] },
        { name: 'Hinweise', rows: noteRows(), widths: [8, 95] }
      ]);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `DienstPilot_Dienste_Dienstplaene_${new Date().toISOString().slice(0, 10)}.xlsm`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      feedback('XLSM-Datei mit Dienstkatalog und Dienstplänen wurde erstellt.');
    } catch (error) { feedback(`XLSM-Export fehlgeschlagen: ${error.message}`, true); }
    finally { setBusy(false); }
  }

  function headers(row) {
    const map = new Map();
    (row || []).forEach((v, i) => map.set(String(v || '').trim().toLowerCase(), i));
    return map;
  }

  function cell(row, head, names) {
    for (const name of names) {
      const i = head.get(name.toLowerCase());
      if (i !== undefined) return String(row[i] ?? '').trim();
    }
    return '';
  }

  function time(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const direct = raw.match(/^(\d{1,2}):([0-5]\d)$/);
    if (direct && Number(direct[1]) <= 23) return `${direct[1].padStart(2, '0')}:${direct[2]}`;
    const dot = raw.match(/^(\d{1,2})[.,]([0-5]\d)$/);
    if (dot && Number(dot[1]) <= 23) return `${dot[1].padStart(2, '0')}:${dot[2]}`;
    const compact = raw.match(/^(\d{1,2})(\d{2})$/);
    if (compact && Number(compact[1]) <= 23 && Number(compact[2]) <= 59) return `${compact[1].padStart(2, '0')}:${compact[2]}`;
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0 && n <= 1) {
      const minutes = Math.round(n * 1440) % 1440;
      return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    }
    return raw;
  }

  function date(value) {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (de) return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n) && n > 20000 && n < 100000) return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
    return '';
  }

  const yes = (v) => ['ja', 'true', 'wahr', '1', 'x'].includes(String(v || '').trim().toLowerCase());

  function parseCatalog(rows) {
    if (!rows?.length) return {};
    const head = headers(rows[0]);
    if (!head.has('dienstnummer')) throw new Error('Im Blatt „Dienstkatalog“ fehlt „Dienstnummer“.');
    const out = {};
    rows.slice(1).forEach((row) => {
      const duty = cell(row, head, ['Dienstnummer', 'Dienst']).slice(0, 30);
      if (!duty) return;
      out[duty] = { start: time(cell(row, head, ['Beginn'])), end: time(cell(row, head, ['Ende'])), fridayEnd: time(cell(row, head, ['Freitag Ende'])), days: cell(row, head, ['Gültige Tage', 'Gueltige Tage']), firstStopDeparture: time(cell(row, head, ['Abfahrt 1. Haltestelle'])), firstStop: cell(row, head, ['1. Haltestelle']), lineMode: cell(row, head, ['Verkehrsart']), stopDistance: cell(row, head, ['Haltestellenabstand']), pauseRule: cell(row, head, ['Pausenregel']), tariffEight: yes(cell(row, head, ['Tarifregel ab 8 Minuten'])) };
    });
    return out;
  }

  function parsePlans(rows) {
    if (!rows?.length) return {};
    const head = headers(rows[0]);
    if (!head.has('datum')) throw new Error('Im Blatt „Dienstplaene“ fehlt „Datum“.');
    const grouped = {};
    rows.slice(1).forEach((row, index) => {
      const day = date(cell(row, head, ['Datum']));
      if (!day) return;
      const item = { order: Number(cell(row, head, ['Reihenfolge'])) || index + 1, row: { id: `xlsm-${Date.now().toString(36)}-${index}`, name: cell(row, head, ['Fahrer', 'Name']), duty: cell(row, head, ['Dienst']), bus: cell(row, head, ['Kennzeichen']), start: time(cell(row, head, ['Beginn'])), end: time(cell(row, head, ['Ende'])), departure: time(cell(row, head, ['Abfahrt 1. Haltestelle'])), stop: cell(row, head, ['1. Haltestelle']) } };
      if (![item.row.name, item.row.duty, item.row.bus, item.row.start, item.row.end, item.row.departure, item.row.stop].some(Boolean)) return;
      (grouped[day] ||= []).push(item);
    });
    const out = {};
    Object.entries(grouped).forEach(([day, items]) => { out[day] = { date: day, rows: items.sort((a, b) => a.order - b.order).map((i) => i.row), savedAt: new Date().toISOString() }; });
    return out;
  }

  async function importFile(file) {
    if (busy) return;
    const access = rights();
    if (!access.catalog && !access.plans) return feedback('Keine Berechtigung für den XLSM-Import.', true);
    setBusy(true, 'XLSM-Datei wird geprüft …');
    try {
      if (!window.DienstPilotXlsmCore) throw new Error('XLSM-Modul ist noch nicht geladen.');
      const sheets = await window.DienstPilotXlsmCore.read(file);
      const importedCatalog = sheets.Dienstkatalog ? parseCatalog(sheets.Dienstkatalog) : {};
      const importedPlans = (sheets.Dienstplaene || sheets.Dienstpläne) ? parsePlans(sheets.Dienstplaene || sheets.Dienstpläne) : {};
      const catalogCount = Object.keys(importedCatalog).length;
      const planCount = Object.values(importedPlans).reduce((n, p) => n + p.rows.length, 0);
      if (!catalogCount && !planCount) throw new Error('Keine gültigen Dienste oder Dienstpläne gefunden.');
      const text = [access.catalog && catalogCount ? `${catalogCount} Katalogdienste` : '', access.plans && planCount ? `${planCount} Dienstplanzeilen` : ''].filter(Boolean).join(' und ');
      if (!confirm(`${text} aus der XLSM-Datei übernehmen?`)) return;
      const errors = [];

      if (access.catalog && catalogCount) {
        const main = readJson(localStorage, MAIN_KEY, {});
        const oldCustom = main.customCatalog && typeof main.customCatalog === 'object' ? main.customCatalog : {};
        let full = {};
        try { if (typeof getCatalog === 'function') full = getCatalog() || {}; } catch {}
        const merged = { ...oldCustom };
        Object.entries(importedCatalog).forEach(([duty, values]) => { merged[duty] = { ...(full[duty] || {}), ...(oldCustom[duty] || {}), ...values }; });
        localStorage.setItem(MAIN_KEY, JSON.stringify({ ...main, customCatalog: merged }));
        try { customCatalog = merged; } catch {}
        try { await apiPut(CATALOG_API, merged); } catch (error) { errors.push(`Dienstkatalog: ${error.message}`); }
      }

      if (access.plans && planCount) {
        const local = readJson(localStorage, PLANS_KEY, { plans: {} });
        const oldPlans = local.plans && typeof local.plans === 'object' ? local.plans : local;
        const merged = { plans: { ...oldPlans, ...importedPlans } };
        localStorage.setItem(PLANS_KEY, JSON.stringify(merged));
        try { await apiPut(PLANS_API, merged); } catch (error) { errors.push(`Dienstpläne: ${error.message}`); }
      }

      alert(errors.length ? `Lokal übernommen. Serverfehler:\n\n${errors.join('\n')}` : 'XLSM-Daten wurden erfolgreich in DienstPilot übernommen.');
      location.reload();
    } catch (error) { feedback(`XLSM-Import fehlgeschlagen: ${error.message}`, true); }
    finally { setBusy(false); }
  }

  function start() {
    if (window.DienstPilotXlsmCore) install();
    else setTimeout(start, 150);
  }

  [0, 250, 700, 1500, 3000].forEach((delay) => setTimeout(start, delay));
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#dpDailyDutyPlanTab,.tab[data-tab="katalog"]')) [100, 350, 900].forEach((d) => setTimeout(start, d));
  }, true);
  addEventListener('focus', start);
  addEventListener('pageshow', start);
  setInterval(start, 2500);
})();
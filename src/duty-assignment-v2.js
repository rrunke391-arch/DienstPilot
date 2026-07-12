(() => {
  'use strict';

  if (window.__dienstpilotDutyAssignmentV2) return;
  window.__dienstpilotDutyAssignmentV2 = true;

  const API = 'https://api.dienstpilot-runke.de';
  const PANEL = 'dpDutyAssignmentV2';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const DAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

  let profile = '';
  let plan = { duties: [] };
  let editId = '';
  let catalog = {};

  const normProfile = (value) => String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/g, '_');
  const normRole = (value) => String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function user() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function permitted() {
    return ['administrator','geschaftsleitung','geschaeftsleitung','disposition']
      .includes(normRole(user()?.role || sessionStorage.getItem(ROLE_KEY)));
  }

  function headers(extra) {
    const result = new Headers(extra || {});
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  function esc(value) {
    return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function dayName(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '—';
    return DAYS[new Date(iso + 'T12:00:00').getDay()] || '—';
  }

  function germanDate(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || '');
  }

  function status(text, ok = true) {
    const node = document.querySelector(`#${PANEL} .dp-a-status`);
    if (!node) return;
    node.textContent = text;
    node.className = `dp-a-status ${ok ? 'ok' : 'error'}`;
  }

  function addStyle() {
    if (document.getElementById('dpDutyAssignmentV2Style')) return;
    const style = document.createElement('style');
    style.id = 'dpDutyAssignmentV2Style';
    style.textContent = `
      #${PANEL}{margin:0 0 16px;padding:18px;border:1px solid #dbe4ee;border-radius:20px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.06)}
      #${PANEL} *{box-sizing:border-box}#${PANEL} h2{margin:0;color:#0f172a}
      #${PANEL} .dp-a-sub{margin-top:6px;color:#64748b;font-size:13px;font-weight:750}
      #${PANEL} .dp-a-grid{display:grid;grid-template-columns:1.2fr 1fr .8fr .8fr .8fr;gap:10px;margin-top:15px}
      #${PANEL} label{display:grid;gap:6px;color:#334155;font-size:12px;font-weight:900}
      #${PANEL} input{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:11px;padding:10px 11px;background:#fff;font:inherit}
      #${PANEL} .dp-a-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:13px}
      #${PANEL} button{min-height:40px;border-radius:11px;padding:9px 13px;font:inherit;font-weight:900;cursor:pointer}
      #${PANEL} .primary{border:1px solid #0f172a;background:#0f172a;color:#fff}
      #${PANEL} .secondary{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${PANEL} .danger{border:1px solid #fecaca;background:#fff1f2;color:#b91c1c}
      #${PANEL} .dp-a-status{min-height:20px;margin-top:11px;font-size:13px;font-weight:850}
      #${PANEL} .dp-a-status.ok{color:#166534}#${PANEL} .dp-a-status.error{color:#b91c1c}
      #${PANEL} .dp-a-table{overflow:auto;margin-top:14px;border:1px solid #e2e8f0;border-radius:14px}
      #${PANEL} table{width:100%;min-width:760px;border-collapse:collapse}
      #${PANEL} th,#${PANEL} td{padding:10px 9px;border-bottom:1px solid #e2e8f0;text-align:left}
      #${PANEL} th{background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase}
      #${PANEL} .weekend{color:#7c3aed;font-weight:950}
      #${PANEL} .row-actions{display:flex;gap:7px}
      @media(max-width:900px){#${PANEL} .dp-a-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:620px){#${PANEL}{padding:14px}#${PANEL} .dp-a-grid{grid-template-columns:1fr}#${PANEL} .dp-a-actions{display:grid}#${PANEL} .dp-a-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function loadDrivers() {
    const found = new Map();
    document.querySelectorAll('#kollegeSelect option').forEach((option) => {
      const key = normProfile(option.value || option.textContent);
      if (key) found.set(key, String(option.textContent || option.value).trim());
    });
    try {
      const response = await fetch(API + '/api/users', { cache: 'no-store', headers: headers() });
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.users)) data.users.forEach((entry) => {
        if (normRole(entry.role) !== 'fahrer') return;
        const key = normProfile(entry.username || entry.driverProfile || entry.displayName);
        if (key) found.set(key, entry.displayName || entry.username || key);
      });
    } catch {}
    const list = document.getElementById('dpAssignDriversV2');
    if (!list) return;
    list.replaceChildren();
    [...found].sort((a,b) => a[1].localeCompare(b[1], 'de')).forEach(([value,label]) => {
      const option = document.createElement('option'); option.value = value; option.label = label; list.appendChild(option);
    });
  }

  async function loadCatalog() {
    let base = {};
    try { if (typeof window.getCatalog === 'function') base = window.getCatalog() || {}; } catch {}
    if (!Object.keys(base).length) {
      for (const url of ['data/dienstkatalog-erweitert.json','data/dienstkatalog.json']) {
        try { const r = await fetch(url, { cache:'no-store' }); if (r.ok) { base = await r.json(); break; } } catch {}
      }
    }
    let custom = {};
    try {
      const r = await fetch(API + '/api/data/catalog_custom', { cache:'no-store', headers:headers() });
      const w = await r.json().catch(() => ({}));
      if (r.ok && w.data && typeof w.data === 'object') custom = w.data;
    } catch {}
    catalog = { ...base };
    Object.keys(custom).forEach((key) => { catalog[key] = { ...(catalog[key] || {}), ...custom[key] }; });
    const list = document.getElementById('dpAssignDutiesV2');
    if (list) {
      list.replaceChildren();
      Object.keys(catalog).sort((a,b) => a.localeCompare(b,'de',{numeric:true})).forEach((value) => {
        const option = document.createElement('option'); option.value = value; list.appendChild(option);
      });
    }
  }

  function fillTimes() {
    const number = document.getElementById('dpAssignDutyV2')?.value.trim();
    const iso = document.getElementById('dpAssignDateV2')?.value;
    const entry = catalog[number] || {};
    const day = iso ? new Date(iso + 'T12:00:00').getDay() : -1;
    const start = day === 6 ? (entry.saturdayStart || entry.start) : day === 0 ? (entry.sundayStart || entry.start) : entry.start;
    const end = day === 5 ? (entry.fridayEnd || entry.end) : day === 6 ? (entry.saturdayEnd || entry.end) : day === 0 ? (entry.sundayEnd || entry.end) : entry.end;
    if (start) document.getElementById('dpAssignStartV2').value = start;
    if (end) document.getElementById('dpAssignEndV2').value = end;
  }

  async function loadPlan(target) {
    const clean = normProfile(target);
    if (!clean) throw new Error('Bitte einen Fahrer auswählen.');
    const response = await fetch(API + '/api/data/' + encodeURIComponent('plan_' + clean), { cache:'no-store', headers:headers() });
    const wrapper = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 404) throw new Error(wrapper.error || 'Fahrerplan konnte nicht geladen werden.');
    profile = clean;
    plan = response.status === 404 ? { duties:[] } : (Object.prototype.hasOwnProperty.call(wrapper,'data') ? (wrapper.data || {}) : wrapper);
    if (!Array.isArray(plan.duties)) plan.duties = [];
    renderRows();
  }

  async function savePlan() {
    if (!permitted()) throw new Error('Keine Berechtigung für die Dienstvergabe.');
    const response = await fetch(API + '/api/data/' + encodeURIComponent('plan_' + profile), {
      method:'PUT', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(plan)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Fahrerplan konnte nicht gespeichert werden.');
    localStorage.setItem('lrz-plan-' + profile, JSON.stringify(plan));
  }

  function rows() {
    return [...(plan.duties || [])].filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || '')))
      .sort((a,b) => String(a.date).localeCompare(String(b.date)) || String(a.start || '').localeCompare(String(b.start || '')));
  }

  function renderRows() {
    const body = document.getElementById('dpAssignRowsV2');
    if (!body) return;
    const values = rows();
    if (!values.length) { body.innerHTML = '<tr><td colspan="7">Für diesen Fahrer sind noch keine Dienste gespeichert.</td></tr>'; return; }
    body.innerHTML = values.map((row) => {
      const day = dayName(row.date); const weekend = day === 'Samstag' || day === 'Sonntag';
      return `<tr><td>${esc(germanDate(row.date))}</td><td class="${weekend?'weekend':''}">${esc(day)}</td><td><strong>${esc(row.number || '—')}</strong></td><td>${esc(row.start || '--:--')}</td><td>${esc(row.end || '--:--')}</td><td>${esc(row.assignedBy || '—')}</td><td><div class="row-actions"><button class="secondary" data-edit="${esc(row.id || '')}">Bearbeiten</button><button class="danger" data-delete="${esc(row.id || '')}">Löschen</button></div></td></tr>`;
    }).join('');
    body.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => edit(button.dataset.edit)));
    body.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => remove(button.dataset.delete)));
  }

  function edit(id) {
    const row = (plan.duties || []).find((item) => String(item.id || '') === String(id || ''));
    if (!row) return;
    editId = String(row.id || '');
    document.getElementById('dpAssignDateV2').value = row.date || '';
    document.getElementById('dpAssignDutyV2').value = row.number || '';
    document.getElementById('dpAssignStartV2').value = row.start || '';
    document.getElementById('dpAssignEndV2').value = row.end || '';
    document.getElementById('dpAssignSaveV2').textContent = 'Änderung speichern';
    status(`Dienst ${row.number || ''} am ${germanDate(row.date)} wird bearbeitet.`);
  }

  async function remove(id) {
    const row = (plan.duties || []).find((item) => String(item.id || '') === String(id || ''));
    if (!row || !confirm(`Dienst ${row.number || ''} am ${germanDate(row.date)} wirklich löschen?`)) return;
    plan = { ...plan, duties:(plan.duties || []).filter((item) => String(item.id || '') !== String(id || '')), savedAt:new Date().toISOString() };
    try { await savePlan(); renderRows(); clearForm(); status('Dienst wurde gelöscht und der Fahrerplan aktualisiert.'); }
    catch (error) { status(error.message, false); }
  }

  function clearForm() {
    editId = '';
    document.getElementById('dpAssignDutyV2').value = '';
    document.getElementById('dpAssignStartV2').value = '';
    document.getElementById('dpAssignEndV2').value = '';
    document.getElementById('dpAssignSaveV2').textContent = 'Dienst zuweisen';
  }

  async function assign() {
    try {
      const target = normProfile(document.getElementById('dpAssignDriverV2').value);
      const date = document.getElementById('dpAssignDateV2').value;
      const number = document.getElementById('dpAssignDutyV2').value.trim();
      const start = document.getElementById('dpAssignStartV2').value;
      const end = document.getElementById('dpAssignEndV2').value;
      if (!target || !date || !number || !start || !end) throw new Error('Fahrer, Datum, Dienst, Beginn und Ende müssen ausgefüllt sein.');
      if (profile !== target) await loadPlan(target);
      const existing = (plan.duties || []).find((row) => row.date === date && String(row.id || '') !== editId);
      if (existing && !confirm(`Am ${germanDate(date)} ist bereits Dienst ${existing.number || ''} gespeichert. Soll er ersetzt werden?`)) return;
      const now = new Date().toISOString(); const by = user()?.displayName || user()?.username || 'DienstPilot';
      const id = editId || `assign-${target}-${date}-${Date.now()}`;
      const row = { id,date,number,start,end,type:'dienst',assignedBy:by,assignedAt:now,assignment:{assignedBy:by,assignedAt:now} };
      const duties = (plan.duties || []).filter((item) => String(item.id || '') !== id && item.date !== date);
      duties.push(row); plan = { ...plan,duties,savedAt:now,assignedBy:by };
      await savePlan(); renderRows(); clearForm();
      status(`Dienst ${number} wurde ${target} für ${dayName(date)}, den ${germanDate(date)}, zugewiesen.`);
    } catch (error) { status(error.message || 'Dienst konnte nicht gespeichert werden.', false); }
  }

  function build() {
    const panel = document.createElement('section'); panel.id = PANEL;
    panel.innerHTML = `<h2>Dienste an Fahrer vergeben</h2><div class="dp-a-sub">Administrator, Geschäftsleitung und Disposition können Dienste von Montag bis Sonntag zuweisen, ändern und löschen.</div>
      <datalist id="dpAssignDriversV2"></datalist><datalist id="dpAssignDutiesV2"></datalist>
      <div class="dp-a-grid"><label>Fahrer<input id="dpAssignDriverV2" list="dpAssignDriversV2" placeholder="Fahrer auswählen"></label><label>Datum<input id="dpAssignDateV2" type="date"></label><label>Dienst<input id="dpAssignDutyV2" list="dpAssignDutiesV2" placeholder="z. B. 3011 oder 3050"></label><label>Beginn<input id="dpAssignStartV2" type="time"></label><label>Ende<input id="dpAssignEndV2" type="time"></label></div>
      <div class="dp-a-actions"><button class="secondary" id="dpAssignLoadV2">Fahrerplan laden</button><button class="primary" id="dpAssignSaveV2">Dienst zuweisen</button><button class="secondary" id="dpAssignClearV2">Eingabe leeren</button></div><div class="dp-a-status"></div>
      <div class="dp-a-table"><table><thead><tr><th>Datum</th><th>Wochentag</th><th>Dienst</th><th>Beginn</th><th>Ende</th><th>Zugewiesen von</th><th>Aktion</th></tr></thead><tbody id="dpAssignRowsV2"><tr><td colspan="7">Bitte einen Fahrerplan laden.</td></tr></tbody></table></div>`;
    panel.querySelector('#dpAssignLoadV2').addEventListener('click', async () => { try { await loadPlan(panel.querySelector('#dpAssignDriverV2').value); status(`Fahrerplan ${profile} wurde geladen.`); } catch (e) { status(e.message,false); } });
    panel.querySelector('#dpAssignSaveV2').addEventListener('click', assign);
    panel.querySelector('#dpAssignClearV2').addEventListener('click', clearForm);
    panel.querySelector('#dpAssignDutyV2').addEventListener('change', fillTimes);
    panel.querySelector('#dpAssignDateV2').addEventListener('change', fillTimes);
    return panel;
  }

  function install() {
    document.getElementById('dpDutyAssignment')?.remove();
    if (!permitted()) { document.getElementById(PANEL)?.remove(); return; }
    addStyle(); const section = document.getElementById('tab-eingabe'); if (!section) return;
    let panel = document.getElementById(PANEL); if (!panel) { panel = build(); section.insertBefore(panel,section.firstChild); }
    const date = panel.querySelector('#dpAssignDateV2'); if (!date.value) date.value = new Date().toISOString().slice(0,10);
    loadDrivers(); loadCatalog();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
  document.addEventListener('click', (event) => { if (event.target.closest?.('#loginButton,.tab[data-tab="eingabe"],#loadKollege,#loadRunke')) [0,250,750,1500,3000,5000].forEach((d) => setTimeout(install,d)); }, true);
  window.addEventListener('pageshow', install); window.addEventListener('focus', install);
})();
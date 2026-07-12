(() => {
  'use strict';

  if (window.__dienstpilotDutyAssignment) return;
  window.__dienstpilotDutyAssignment = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const PANEL_ID = 'dpDutyAssignment';
  const STYLE_ID = 'dpDutyAssignmentStyle';

  let currentProfile = '';
  let currentPlan = { duties: [] };
  let editId = '';

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function allowed() {
    const role = normalize(currentUser()?.role || sessionStorage.getItem('dienstpilot_role'));
    return ['administrator', 'geschaftsleitung', 'disposition'].includes(role);
  }

  function tokenHeaders(extra) {
    const headers = new Headers(extra || {});
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) headers.set('Authorization', 'Bearer ' + token);
    return headers;
  }

  function planKey(profile) {
    return 'plan_' + normalize(profile);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function readMain() {
    try {
      const value = JSON.parse(localStorage.getItem(MAIN_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:0 0 16px;padding:18px;border:1px solid #dbe4ee;border-radius:20px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.06)}
      #${PANEL_ID} .dp-assign-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
      #${PANEL_ID} h2{margin:0;font-size:22px;color:#0f172a}
      #${PANEL_ID} .dp-assign-sub{margin-top:5px;color:#64748b;font-size:13px;font-weight:700}
      #${PANEL_ID} .dp-assign-grid{display:grid;grid-template-columns:1.2fr 1fr .8fr .8fr .8fr;gap:10px;margin-top:15px}
      #${PANEL_ID} label{display:grid;gap:6px;color:#334155;font-size:12px;font-weight:900}
      #${PANEL_ID} input,#${PANEL_ID} select{width:100%;min-width:0;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:11px;padding:10px 11px;background:#fff;color:#0f172a;font:inherit}
      #${PANEL_ID} .dp-assign-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:13px}
      #${PANEL_ID} button{min-height:40px;border-radius:11px;padding:9px 13px;font-weight:900;cursor:pointer}
      #${PANEL_ID} .dp-assign-primary{border:1px solid #0f172a;background:#0f172a;color:#fff}
      #${PANEL_ID} .dp-assign-secondary{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${PANEL_ID} .dp-assign-danger{border:1px solid #fecaca;background:#fff1f2;color:#b91c1c}
      #${PANEL_ID} .dp-assign-status{margin-top:11px;min-height:20px;font-size:13px;font-weight:850}
      #${PANEL_ID} .dp-assign-status.ok{color:#166534}#${PANEL_ID} .dp-assign-status.error{color:#b91c1c}
      #${PANEL_ID} .dp-assign-table-wrap{overflow:auto;margin-top:15px;border:1px solid #e2e8f0;border-radius:14px}
      #${PANEL_ID} table{width:100%;border-collapse:collapse;min-width:690px}
      #${PANEL_ID} th,#${PANEL_ID} td{padding:10px 9px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:middle}
      #${PANEL_ID} th{background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
      #${PANEL_ID} tr:last-child td{border-bottom:0}
      #${PANEL_ID} .dp-assign-row-actions{display:flex;gap:7px;flex-wrap:wrap}
      @media(max-width:900px){#${PANEL_ID} .dp-assign-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:620px){#${PANEL_ID}{padding:14px}#${PANEL_ID} .dp-assign-grid{grid-template-columns:1fr}#${PANEL_ID} .dp-assign-actions{display:grid;grid-template-columns:1fr}#${PANEL_ID} .dp-assign-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function setStatus(text, ok = true) {
    const element = document.querySelector(`#${PANEL_ID} .dp-assign-status`);
    if (!element) return;
    element.textContent = text;
    element.className = 'dp-assign-status ' + (ok ? 'ok' : 'error');
  }

  function catalogEntry(number) {
    try {
      const catalog = typeof window.getCatalog === 'function' ? window.getCatalog() : null;
      if (catalog && catalog[number]) return catalog[number];
    } catch {}
    return null;
  }

  function fillTimesFromCatalog() {
    const numberInput = document.getElementById('dpAssignDuty');
    const dateInput = document.getElementById('dpAssignDate');
    const startInput = document.getElementById('dpAssignStart');
    const endInput = document.getElementById('dpAssignEnd');
    if (!numberInput || !dateInput || !startInput || !endInput) return;

    const entry = catalogEntry(String(numberInput.value || '').trim());
    if (!entry) return;
    const date = dateInput.value ? new Date(dateInput.value + 'T12:00:00') : null;
    const isFriday = date && date.getDay() === 5;
    const start = entry.start || entry.begin || entry.beginn || '';
    const end = isFriday
      ? (entry.fridayEnd || entry.endFriday || entry.freitagEnde || entry.end || '')
      : (entry.end || entry.ende || '');
    if (start) startInput.value = start;
    if (end) endInput.value = end;
  }

  async function fetchUsers() {
    const result = new Map();
    document.querySelectorAll('#kollegeSelect option').forEach((option) => {
      const value = normalize(option.value || option.textContent);
      if (value) result.set(value, String(option.textContent || option.value).trim());
    });

    try {
      const response = await fetch(API_BASE + '/api/users', { headers: tokenHeaders(), cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.users)) {
        data.users.forEach((user) => {
          if (normalize(user.role) !== 'fahrer') return;
          const value = normalize(user.username || user.driverProfile || user.displayName);
          if (value) result.set(value, String(user.displayName || user.username || value));
        });
      }
    } catch {}

    const list = document.getElementById('dpAssignDrivers');
    if (list) {
      list.replaceChildren();
      [...result.entries()].sort((a, b) => a[1].localeCompare(b[1], 'de')).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.label = label;
        list.appendChild(option);
      });
    }
  }

  function populateCatalogList() {
    const list = document.getElementById('dpAssignDuties');
    if (!list) return;
    const values = new Set();
    try {
      const catalog = typeof window.getCatalog === 'function' ? window.getCatalog() : {};
      Object.keys(catalog || {}).forEach((value) => values.add(value));
    } catch {}
    document.querySelectorAll('#catalogGrid [data-cat-number]').forEach((node) => values.add(node.dataset.catNumber));
    list.replaceChildren();
    [...values].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de', { numeric: true })).forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      list.appendChild(option);
    });
  }

  async function loadPlan(profile) {
    const clean = normalize(profile);
    if (!clean) throw new Error('Bitte zuerst einen Fahrer auswählen.');
    const response = await fetch(API_BASE + '/api/data/' + encodeURIComponent(planKey(clean)), {
      method: 'GET',
      cache: 'no-store',
      headers: tokenHeaders()
    });
    const wrapper = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(wrapper.error || 'Fahrerplan konnte nicht geladen werden.');
    currentProfile = clean;
    currentPlan = wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data') && wrapper.data
      ? wrapper.data
      : {};
    if (!Array.isArray(currentPlan.duties)) currentPlan.duties = [];
    renderRows();
    return currentPlan;
  }

  async function savePlan() {
    const response = await fetch(API_BASE + '/api/data/' + encodeURIComponent(planKey(currentProfile)), {
      method: 'PUT',
      headers: tokenHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(currentPlan)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Fahrerplan konnte nicht gespeichert werden.');
    mirrorLocally();
  }

  function mirrorLocally() {
    const namedKey = 'lrz-plan-' + currentProfile;
    localStorage.setItem(namedKey, JSON.stringify(currentPlan));

    const main = readMain();
    const active = normalize(main?.appSettings?.activeProfile || localStorage.getItem('dienstpilot_aktiver_kollege'));
    if (active === currentProfile) {
      localStorage.setItem(MAIN_KEY, JSON.stringify({
        ...main,
        duties: currentPlan.duties,
        appSettings: { ...(main.appSettings || {}), activeProfile: currentProfile }
      }));
      try {
        if (typeof duties !== 'undefined') duties = currentPlan.duties;
        if (typeof renderAll === 'function') renderAll();
      } catch {}
    }
  }

  function assignmentRows() {
    return [...(currentPlan.duties || [])]
      .filter((row) => row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start || '').localeCompare(String(b.start || '')));
  }

  function renderRows() {
    const body = document.getElementById('dpAssignRows');
    if (!body) return;
    const rows = assignmentRows();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6">Für diesen Fahrer sind noch keine Dienste gespeichert.</td></tr>';
      return;
    }

    body.innerHTML = rows.map((row) => `
      <tr data-id="${escapeHtml(row.id || '')}">
        <td>${escapeHtml(row.date || '')}</td>
        <td><strong>${escapeHtml(row.number || '—')}</strong></td>
        <td>${escapeHtml(row.start || '--:--')}</td>
        <td>${escapeHtml(row.end || '--:--')}</td>
        <td>${escapeHtml(row.assignedBy || row.assignment?.assignedBy || '—')}</td>
        <td><div class="dp-assign-row-actions"><button type="button" class="dp-assign-secondary" data-edit="${escapeHtml(row.id || '')}">Bearbeiten</button><button type="button" class="dp-assign-danger" data-delete="${escapeHtml(row.id || '')}">Löschen</button></div></td>
      </tr>`).join('');

    body.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => editRow(button.dataset.edit)));
    body.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteRow(button.dataset.delete)));
  }

  function editRow(id) {
    const row = (currentPlan.duties || []).find((item) => String(item.id || '') === String(id || ''));
    if (!row) return;
    editId = String(row.id || '');
    document.getElementById('dpAssignDate').value = row.date || '';
    document.getElementById('dpAssignDuty').value = row.number || '';
    document.getElementById('dpAssignStart').value = row.start || '';
    document.getElementById('dpAssignEnd').value = row.end || '';
    document.getElementById('dpAssignSave').textContent = 'Änderung speichern';
    setStatus('Dienst wird bearbeitet.');
  }

  async function deleteRow(id) {
    const row = (currentPlan.duties || []).find((item) => String(item.id || '') === String(id || ''));
    if (!row || !confirm(`Dienst ${row.number || ''} am ${row.date || ''} wirklich löschen?`)) return;
    currentPlan.duties = (currentPlan.duties || []).filter((item) => String(item.id || '') !== String(id || ''));
    currentPlan.savedAt = new Date().toISOString();
    await savePlan();
    renderRows();
    setStatus('Dienst wurde gelöscht und der Fahrerplan aktualisiert.');
  }

  function resetForm() {
    editId = '';
    document.getElementById('dpAssignDuty').value = '';
    document.getElementById('dpAssignStart').value = '';
    document.getElementById('dpAssignEnd').value = '';
    document.getElementById('dpAssignSave').textContent = 'Dienst zuweisen';
  }

  async function assignDuty() {
    try {
      const profileInput = document.getElementById('dpAssignDriver');
      const profile = normalize(profileInput.value);
      const date = document.getElementById('dpAssignDate').value;
      const number = String(document.getElementById('dpAssignDuty').value || '').trim();
      const start = document.getElementById('dpAssignStart').value;
      const end = document.getElementById('dpAssignEnd').value;
      if (!profile) throw new Error('Bitte einen Fahrer auswählen.');
      if (!date || !number || !start || !end) throw new Error('Datum, Dienstnummer, Beginn und Ende müssen ausgefüllt sein.');
      if (profile !== currentProfile) await loadPlan(profile);

      const user = currentUser();
      const now = new Date().toISOString();
      let dutiesList = [...(currentPlan.duties || [])];
      const existingSameDay = dutiesList.find((row) => row && row.date === date && String(row.id || '') !== editId && normalize(row.type) !== 'frei');
      if (existingSameDay && !confirm(`Für ${date} ist bereits Dienst ${existingSameDay.number || ''} eingetragen. Soll dieser ersetzt werden?`)) return;
      if (existingSameDay) dutiesList = dutiesList.filter((row) => row !== existingSameDay);

      const id = editId || `assign-${profile}-${date}-${Date.now()}`;
      const previous = dutiesList.find((row) => String(row.id || '') === id) || {};
      const assignedBy = user?.displayName || user?.username || 'DienstPilot';
      const row = {
        ...previous,
        id,
        date,
        number,
        start,
        end,
        type: 'dienst',
        assignedBy,
        assignedAt: now,
        assignment: { assignedBy, assignedAt: now }
      };
      dutiesList = dutiesList.filter((item) => String(item.id || '') !== id && !(item.date === date && normalize(item.type) === 'frei'));
      dutiesList.push(row);
      currentPlan = { ...currentPlan, duties: dutiesList, savedAt: now, assignedAt: now, assignedBy };
      await savePlan();
      renderRows();
      resetForm();
      setStatus(`Dienst ${number} wurde ${profile} zugewiesen und auf dem Server gespeichert.`);
    } catch (error) {
      setStatus(error.message || 'Dienst konnte nicht zugewiesen werden.', false);
    }
  }

  function buildPanel() {
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="dp-assign-head"><div><h2>Dienste an Fahrer vergeben</h2><div class="dp-assign-sub">Zugewiesene Dienste werden im persönlichen Fahrerplan auf PC und Handy angezeigt.</div></div></div>
      <datalist id="dpAssignDrivers"></datalist><datalist id="dpAssignDuties"></datalist>
      <div class="dp-assign-grid">
        <label>Fahrer<input id="dpAssignDriver" list="dpAssignDrivers" placeholder="Benutzername des Fahrers"></label>
        <label>Datum<input id="dpAssignDate" type="date"></label>
        <label>Dienst<input id="dpAssignDuty" list="dpAssignDuties" placeholder="z. B. 3011"></label>
        <label>Beginn<input id="dpAssignStart" type="time"></label>
        <label>Ende<input id="dpAssignEnd" type="time"></label>
      </div>
      <div class="dp-assign-actions">
        <button type="button" class="dp-assign-secondary" id="dpAssignLoad">Fahrerplan laden</button>
        <button type="button" class="dp-assign-primary" id="dpAssignSave">Dienst zuweisen</button>
        <button type="button" class="dp-assign-secondary" id="dpAssignCancel">Eingabe leeren</button>
      </div>
      <div class="dp-assign-status" aria-live="polite"></div>
      <div class="dp-assign-table-wrap"><table><thead><tr><th>Datum</th><th>Dienst</th><th>Beginn</th><th>Ende</th><th>Zugewiesen von</th><th>Aktion</th></tr></thead><tbody id="dpAssignRows"><tr><td colspan="6">Bitte einen Fahrerplan laden.</td></tr></tbody></table></div>`;
    return panel;
  }

  function bindPanel(panel) {
    panel.querySelector('#dpAssignLoad').addEventListener('click', async () => {
      try {
        const profile = normalize(panel.querySelector('#dpAssignDriver').value);
        await loadPlan(profile);
        setStatus(`Fahrerplan ${profile} wurde geladen.`);
      } catch (error) {
        setStatus(error.message, false);
      }
    });
    panel.querySelector('#dpAssignSave').addEventListener('click', assignDuty);
    panel.querySelector('#dpAssignCancel').addEventListener('click', resetForm);
    panel.querySelector('#dpAssignDuty').addEventListener('change', fillTimesFromCatalog);
    panel.querySelector('#dpAssignDate').addEventListener('change', fillTimesFromCatalog);
  }

  function install() {
    if (!allowed()) {
      document.getElementById(PANEL_ID)?.remove();
      return;
    }
    addStyle();
    const section = document.getElementById('tab-eingabe');
    if (!section) return;
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = buildPanel();
      section.insertBefore(panel, section.firstChild);
      bindPanel(panel);
    }
    if (!document.getElementById('dpAssignDate').value) document.getElementById('dpAssignDate').value = new Date().toISOString().slice(0, 10);
    fetchUsers();
    populateCatalogList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="eingabe"]')) [0, 150, 500].forEach((delay) => setTimeout(install, delay));
  }, true);
  window.addEventListener('pageshow', install);
})();
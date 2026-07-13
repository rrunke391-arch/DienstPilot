(() => {
  'use strict';

  if (window.__dienstpilotVacationReviewPanel) return;
  window.__dienstpilotVacationReviewPanel = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const ACTIVE_PROFILE_KEY = 'dienstpilot_aktiver_kollege';
  const PANEL_ID = 'dpVacationReviewPanel';
  const TOGGLE_ID = 'dpVacationReviewToggle';
  const STYLE_ID = 'dpVacationReviewPanelStyle';

  let open = false;
  let usersLoaded = false;
  let requests = [];
  let currentProfile = '';

  function normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  function normalizeProfile(value) {
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

  function role() {
    return normalizeRole(currentUser()?.role || sessionStorage.getItem(ROLE_KEY));
  }

  function permitted() {
    return ['geschaftsleitung', 'geschaeftsleitung', 'disposition', 'disponent', 'disponentin']
      .includes(role());
  }

  function headers(extra) {
    const result = new Headers(extra || {});
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(iso || '');
  }

  function statusInfo(value) {
    if (value === 'approved') return { text: 'Genehmigt', cls: 'approved' };
    if (value === 'rejected') return { text: 'Abgelehnt', cls: 'rejected' };
    return { text: 'Offen', cls: 'pending' };
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TOGGLE_ID}{margin-left:auto;min-height:40px;padding:9px 14px;border:1px solid #cbd5e1;border-radius:12px;background:#0f172a;color:#fff;font-weight:900;cursor:pointer}
      #tab-einstellungen .vacation-section .vacation-header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;cursor:pointer}
      #tab-einstellungen .vacation-section .vacation-header>div:first-child{min-width:0}
      #${PANEL_ID}{display:none;margin-top:14px;padding:18px;border:1px solid #dbe4ee;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.06)}
      #${PANEL_ID}.open{display:block}
      #${PANEL_ID} *{box-sizing:border-box}
      #${PANEL_ID} .dp-vrp-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:10px;align-items:end}
      #${PANEL_ID} label{display:grid;gap:6px;color:#334155;font-size:12px;font-weight:900}
      #${PANEL_ID} select{width:100%;min-width:0;padding:10px 11px;border:1px solid #cbd5e1;border-radius:11px;background:#fff;font:inherit}
      #${PANEL_ID} button{min-height:40px;padding:9px 13px;border-radius:11px;font:inherit;font-weight:900;cursor:pointer}
      #${PANEL_ID} .primary{border:1px solid #0f172a;background:#0f172a;color:#fff}
      #${PANEL_ID} .secondary{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${PANEL_ID} .approve{border:1px solid #86efac;background:#f0fdf4;color:#166534}
      #${PANEL_ID} .reject{border:1px solid #fecaca;background:#fff1f2;color:#b91c1c}
      #${PANEL_ID} .dp-vrp-status{min-height:22px;margin-top:10px;font-size:13px;font-weight:850;color:#475569}
      #${PANEL_ID} .dp-vrp-status.error{color:#b91c1c}
      #${PANEL_ID} .dp-vrp-list{display:grid;gap:10px;margin-top:14px}
      #${PANEL_ID} .dp-vrp-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid #dbe4ee;border-radius:15px;background:#f8fafc}
      #${PANEL_ID} .dp-vrp-title{font-size:16px;font-weight:950;color:#0f172a}
      #${PANEL_ID} .dp-vrp-range{margin-top:4px;color:#475569;font-weight:800}
      #${PANEL_ID} .dp-vrp-meta{margin-top:6px;color:#64748b;font-size:12px;line-height:1.45}
      #${PANEL_ID} .dp-vrp-badge{display:inline-flex;margin-top:8px;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:950}
      #${PANEL_ID} .dp-vrp-badge.pending{background:#fff7ed;color:#9a3412}
      #${PANEL_ID} .dp-vrp-badge.approved{background:#f0fdf4;color:#166534}
      #${PANEL_ID} .dp-vrp-badge.rejected{background:#fff1f2;color:#b91c1c}
      #${PANEL_ID} .dp-vrp-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      #${PANEL_ID} .dp-vrp-empty{padding:24px;border:1px dashed #cbd5e1;border-radius:15px;text-align:center;color:#64748b;font-weight:800}
      @media(max-width:700px){
        #${PANEL_ID} .dp-vrp-toolbar{grid-template-columns:1fr}
        #${PANEL_ID} .dp-vrp-card{grid-template-columns:1fr}
        #${PANEL_ID} .dp-vrp-actions{justify-content:flex-start}
        #${PANEL_ID} .dp-vrp-actions button{width:100%}
        #${TOGGLE_ID}{width:100%;margin-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function setStatus(text, error = false) {
    const node = document.querySelector(`#${PANEL_ID} .dp-vrp-status`);
    if (!node) return;
    node.textContent = text;
    node.className = `dp-vrp-status${error ? ' error' : ''}`;
  }

  function createPanel() {
    const section = document.querySelector('#tab-einstellungen .vacation-section');
    if (!section) return null;

    const header = section.querySelector('.vacation-header');
    if (header && !document.getElementById(TOGGLE_ID)) {
      const button = document.createElement('button');
      button.id = TOGGLE_ID;
      button.type = 'button';
      button.textContent = 'Urlaubswünsche öffnen';
      header.appendChild(button);
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <div class="dp-vrp-toolbar">
          <label>Fahrer<select id="dpVacationReviewDriver"><option value="">Fahrer auswählen</option></select></label>
          <button type="button" class="primary" id="dpVacationReviewLoad">Wünsche laden</button>
          <button type="button" class="secondary" id="dpVacationReviewRefresh">Aktualisieren</button>
        </div>
        <div class="dp-vrp-status" aria-live="polite">Bitte einen Fahrer auswählen.</div>
        <div class="dp-vrp-list"><div class="dp-vrp-empty">Noch keine Urlaubswünsche geladen.</div></div>`;
      section.insertAdjacentElement('afterend', panel);
      bindPanel(panel);
    }
    return panel;
  }

  async function loadUsers() {
    if (usersLoaded) return;
    const select = document.getElementById('dpVacationReviewDriver');
    if (!select) return;

    const found = new Map();
    document.querySelectorAll('#kollegeSelect option').forEach((option) => {
      const value = normalizeProfile(option.value || option.textContent);
      if (value) found.set(value, String(option.textContent || option.value).trim());
    });

    try {
      const response = await fetch(`${API_BASE}/api/users`, { cache: 'no-store', headers: headers() });
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.users)) {
        data.users.forEach((entry) => {
          if (normalizeRole(entry.role) !== 'fahrer') return;
          const value = normalizeProfile(entry.driverProfile || entry.username || entry.displayName);
          if (value) found.set(value, String(entry.displayName || entry.username || value));
        });
      }
    } catch {}

    [...found.entries()].sort((a, b) => a[1].localeCompare(b[1], 'de')).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });

    const preferred = normalizeProfile(
      localStorage.getItem(ACTIVE_PROFILE_KEY)
      || document.getElementById('kollegeSelect')?.value
    );
    if (preferred && [...select.options].some((option) => option.value === preferred)) select.value = preferred;
    usersLoaded = true;
  }

  async function loadRequests(profileHint) {
    const select = document.getElementById('dpVacationReviewDriver');
    const profile = normalizeProfile(profileHint || select?.value);
    if (!profile) {
      setStatus('Bitte zuerst einen Fahrer auswählen.', true);
      return;
    }

    currentProfile = profile;
    setStatus('Urlaubswünsche werden geladen …');
    try {
      const response = await fetch(`${API_BASE}/api/vacation-requests/${encodeURIComponent(profile)}`, {
        cache: 'no-store',
        headers: headers()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Urlaubswünsche konnten nicht geladen werden.');
      requests = Array.isArray(data.requests) ? data.requests : [];
      renderRequests();
      setStatus(`${requests.length} Urlaubswunsch${requests.length === 1 ? '' : 'e'} geladen.`);
    } catch (error) {
      requests = [];
      renderRequests();
      setStatus(error.message || 'Urlaubswünsche konnten nicht geladen werden.', true);
    }
  }

  function requestHtml(entry) {
    const info = statusInfo(entry.status);
    const meta = [];
    if (entry.requestedBy) meta.push(`Eingereicht von ${escapeHtml(entry.requestedBy)}`);
    if (entry.decidedBy) meta.push(`Entschieden von ${escapeHtml(entry.decidedBy)}`);
    if (entry.decisionNote) meta.push(`Hinweis: ${escapeHtml(entry.decisionNote)}`);

    const actions = entry.status === 'pending'
      ? `<div class="dp-vrp-actions"><button type="button" class="approve" data-vrp-approve="${escapeHtml(entry.id)}">Genehmigen</button><button type="button" class="reject" data-vrp-reject="${escapeHtml(entry.id)}">Ablehnen</button></div>`
      : '';

    return `<article class="dp-vrp-card">
      <div>
        <div class="dp-vrp-title">🌴 ${escapeHtml(entry.label || 'Urlaubswunsch')}</div>
        <div class="dp-vrp-range">${escapeHtml(formatDate(entry.start))} – ${escapeHtml(formatDate(entry.end))}</div>
        <div class="dp-vrp-badge ${info.cls}">${info.text}</div>
        ${meta.length ? `<div class="dp-vrp-meta">${meta.join('<br>')}</div>` : ''}
      </div>
      ${actions}
    </article>`;
  }

  function renderRequests() {
    const list = document.querySelector(`#${PANEL_ID} .dp-vrp-list`);
    if (!list) return;
    list.innerHTML = requests.length
      ? requests.map(requestHtml).join('')
      : '<div class="dp-vrp-empty">Für diesen Fahrer liegen keine Urlaubswünsche vor.</div>';

    list.querySelectorAll('[data-vrp-approve]').forEach((button) => {
      button.addEventListener('click', () => decide(button.dataset.vrpApprove, 'approved'));
    });
    list.querySelectorAll('[data-vrp-reject]').forEach((button) => {
      button.addEventListener('click', () => decide(button.dataset.vrpReject, 'rejected'));
    });
  }

  async function decide(id, decision) {
    const request = requests.find((entry) => String(entry.id) === String(id));
    if (!request) return;

    let note = '';
    if (decision === 'rejected') {
      const answer = window.prompt('Grund für die Ablehnung (optional):', request.decisionNote || '');
      if (answer === null) return;
      note = answer.trim();
    } else if (!window.confirm(`Urlaubswunsch ${formatDate(request.start)} bis ${formatDate(request.end)} genehmigen?`)) {
      return;
    }

    setStatus(decision === 'approved' ? 'Genehmigung wird gespeichert …' : 'Ablehnung wird gespeichert …');
    try {
      const response = await fetch(`${API_BASE}/api/vacation-requests/${encodeURIComponent(id)}/decision`, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: decision, note })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Entscheidung konnte nicht gespeichert werden.');
      await loadRequests(currentProfile);
      setStatus(decision === 'approved' ? 'Urlaubswunsch wurde genehmigt.' : 'Urlaubswunsch wurde abgelehnt.');
    } catch (error) {
      setStatus(error.message || 'Entscheidung konnte nicht gespeichert werden.', true);
    }
  }

  function setOpen(value) {
    open = Boolean(value);
    const panel = document.getElementById(PANEL_ID);
    const button = document.getElementById(TOGGLE_ID);
    panel?.classList.toggle('open', open);
    if (button) button.textContent = open ? 'Urlaubswünsche schließen' : 'Urlaubswünsche öffnen';
    if (open) {
      void loadUsers().then(() => {
        const select = document.getElementById('dpVacationReviewDriver');
        if (select?.value) void loadRequests(select.value);
      });
    }
  }

  function bindPanel(panel) {
    panel.querySelector('#dpVacationReviewLoad')?.addEventListener('click', () => loadRequests());
    panel.querySelector('#dpVacationReviewRefresh')?.addEventListener('click', () => loadRequests(currentProfile));
    panel.querySelector('#dpVacationReviewDriver')?.addEventListener('change', (event) => {
      if (event.target.value) void loadRequests(event.target.value);
    });
  }

  function install() {
    if (!permitted()) {
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById(TOGGLE_ID)?.remove();
      return;
    }

    addStyle();
    const panel = createPanel();
    if (!panel) return;

    const toggle = document.getElementById(TOGGLE_ID);
    if (toggle && toggle.dataset.bound !== '1') {
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(!open);
      });
    }

    const header = document.querySelector('#tab-einstellungen .vacation-section .vacation-header');
    if (header && header.dataset.dpReviewBound !== '1') {
      header.dataset.dpReviewBound = '1';
      header.addEventListener('click', (event) => {
        if (event.target.closest('button,input,select,a')) return;
        setOpen(!open);
      });
    }

    panel.classList.toggle('open', open);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="einstellungen"],#loadKollege,#loadRunke')) {
      [0, 180, 550, 1200, 2500].forEach((delay) => setTimeout(install, delay));
    }
  }, true);

  window.addEventListener('pageshow', install);
  window.addEventListener('focus', install);
})();
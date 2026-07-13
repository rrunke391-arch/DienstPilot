(() => {
  'use strict';

  if (window.__dienstpilotVacationRequestWorkflow) return;
  window.__dienstpilotVacationRequestWorkflow = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const ACTIVE_PROFILE_KEY = 'dienstpilot_aktiver_kollege';
  const PANEL_ID = 'dpVacationRequestWorkflow';
  const STYLE_ID = 'dpVacationRequestWorkflowStyle';

  let requests = [];
  let loadedProfile = '';
  let loading = false;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function currentRole() {
    return normalizeRole(currentUser()?.role || sessionStorage.getItem(ROLE_KEY));
  }

  function isDriver() {
    return currentRole() === 'fahrer';
  }

  function mayReview() {
    return ['geschaftsleitung', 'geschaeftsleitung', 'disposition'].includes(currentRole());
  }

  function mayReadAll() {
    return ['administrator', 'geschaftsleitung', 'geschaeftsleitung', 'disposition'].includes(currentRole());
  }

  function activeProfile() {
    const user = currentUser() || {};
    if (isDriver()) return normalize(user.driverProfile || user.username || user.displayName);

    let fromApp = '';
    try {
      if (typeof appSettings !== 'undefined' && appSettings) fromApp = appSettings.activeProfile || '';
    } catch {}

    return normalize(
      fromApp
      || document.getElementById('kollegeSelect')?.value
      || document.getElementById('profileSelect')?.value
      || localStorage.getItem(ACTIVE_PROFILE_KEY)
    );
  }

  function tokenHeaders(extra) {
    const headers = new Headers(extra || {});
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) headers.set('Authorization', 'Bearer ' + token);
    return headers;
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

  function statusInfo(status) {
    if (status === 'approved') return { text: 'Genehmigt', cls: 'approved', icon: '✓' };
    if (status === 'rejected') return { text: 'Abgelehnt', cls: 'rejected', icon: '×' };
    return { text: 'Offen – wartet auf Prüfung', cls: 'pending', icon: '…' };
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{display:grid;gap:16px;margin-top:14px}
      #${PANEL_ID} *{box-sizing:border-box}
      #${PANEL_ID} .dp-vr-note{padding:12px 14px;border:1px solid #bfdbfe;border-radius:14px;background:#eff6ff;color:#1e3a8a;font-weight:800;line-height:1.45}
      #${PANEL_ID} .dp-vr-profile{display:inline-flex;align-items:center;gap:7px;width:max-content;max-width:100%;padding:7px 11px;border-radius:999px;background:#f1f5f9;color:#334155;font-size:13px;font-weight:900}
      #${PANEL_ID} .dp-vr-form{display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:10px;align-items:end;padding:15px;border:1px solid #dbe4ee;border-radius:16px;background:#fff}
      #${PANEL_ID} label{display:grid;gap:6px;color:#334155;font-size:12px;font-weight:900}
      #${PANEL_ID} input{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:11px;padding:10px 11px;background:#fff;color:#0f172a;font:inherit}
      #${PANEL_ID} button{min-height:40px;border-radius:11px;padding:9px 13px;font:inherit;font-weight:900;cursor:pointer}
      #${PANEL_ID} .dp-vr-primary{border:1px solid #0f172a;background:#0f172a;color:#fff}
      #${PANEL_ID} .dp-vr-secondary{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${PANEL_ID} .dp-vr-approve{border:1px solid #86efac;background:#f0fdf4;color:#166534}
      #${PANEL_ID} .dp-vr-reject{border:1px solid #fecaca;background:#fff1f2;color:#b91c1c}
      #${PANEL_ID} .dp-vr-status{min-height:20px;font-size:13px;font-weight:850}
      #${PANEL_ID} .dp-vr-status.ok{color:#166534}#${PANEL_ID} .dp-vr-status.error{color:#b91c1c}
      #${PANEL_ID} .dp-vr-list{display:grid;gap:10px}
      #${PANEL_ID} .dp-vr-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid #dbe4ee;border-radius:16px;background:#fff}
      #${PANEL_ID} .dp-vr-title{font-size:16px;font-weight:950;color:#0f172a}
      #${PANEL_ID} .dp-vr-range{margin-top:4px;color:#475569;font-weight:800}
      #${PANEL_ID} .dp-vr-meta{margin-top:7px;color:#64748b;font-size:12px;line-height:1.45}
      #${PANEL_ID} .dp-vr-badge{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:950}
      #${PANEL_ID} .dp-vr-badge.pending{background:#fff7ed;color:#9a3412}
      #${PANEL_ID} .dp-vr-badge.approved{background:#f0fdf4;color:#166534}
      #${PANEL_ID} .dp-vr-badge.rejected{background:#fff1f2;color:#b91c1c}
      #${PANEL_ID} .dp-vr-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      #${PANEL_ID} .dp-vr-empty{padding:24px;border:1px dashed #cbd5e1;border-radius:16px;text-align:center;color:#64748b;font-weight:800}
      body.dp-vacation-request-active #tab-einstellungen .vacation-content{display:none!important}
      @media(max-width:760px){
        #${PANEL_ID} .dp-vr-form{grid-template-columns:1fr}
        #${PANEL_ID} .dp-vr-card{grid-template-columns:1fr}
        #${PANEL_ID} .dp-vr-actions{justify-content:flex-start}
        #${PANEL_ID} .dp-vr-actions button{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function setMessage(text, ok = true) {
    const node = document.querySelector(`#${PANEL_ID} .dp-vr-status`);
    if (!node) return;
    node.textContent = text;
    node.className = `dp-vr-status ${ok ? 'ok' : 'error'}`;
  }

  function approvedVacations() {
    return requests
      .filter((entry) => entry.status === 'approved')
      .map((entry) => ({
        id: entry.id,
        label: entry.label || 'Urlaub',
        emoji: entry.emoji || '🌴',
        start: entry.start,
        end: entry.end,
        status: 'approved'
      }));
  }

  function applyApprovedToCalendar() {
    const approved = approvedVacations();
    try { vacations = approved; } catch {}
    try {
      if (typeof renderDuties === 'function') renderDuties();
    } catch {}
    window.dispatchEvent(new CustomEvent('dienstpilot:vacation-requests-loaded', {
      detail: { profile: loadedProfile, requests: [...requests], approved }
    }));
  }

  async function fetchRequests(profile) {
    const response = await fetch(`${API_BASE}/api/vacation-requests/${encodeURIComponent(profile)}`, {
      cache: 'no-store',
      headers: tokenHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Urlaubswünsche konnten nicht geladen werden.');
    return Array.isArray(data.requests) ? data.requests : [];
  }

  async function load(profileHint) {
    const profile = normalize(profileHint || activeProfile());
    if (!profile || loading) return false;
    loading = true;
    try {
      requests = await fetchRequests(profile);
      loadedProfile = profile;
      applyApprovedToCalendar();
      render();
      return true;
    } catch (error) {
      setMessage(error.message || 'Urlaubswünsche konnten nicht geladen werden.', false);
      return false;
    } finally {
      loading = false;
    }
  }

  async function submitRequest() {
    const profile = normalize(activeProfile());
    const label = String(document.getElementById('dpVacationRequestLabel')?.value || '').trim();
    const start = document.getElementById('dpVacationRequestStart')?.value || '';
    const end = document.getElementById('dpVacationRequestEnd')?.value || '';

    if (!profile || !start || !end) {
      setMessage('Bitte Beginn und Ende des Urlaubswunsches eintragen.', false);
      return;
    }
    if (end < start) {
      setMessage('Das Enddatum darf nicht vor dem Anfangsdatum liegen.', false);
      return;
    }

    const response = await fetch(`${API_BASE}/api/vacation-requests`, {
      method: 'POST',
      headers: tokenHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        profile,
        label: label || 'Urlaubswunsch',
        emoji: '🌴',
        start,
        end
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || 'Urlaubswunsch konnte nicht gespeichert werden.', false);
      return;
    }

    document.getElementById('dpVacationRequestLabel').value = '';
    document.getElementById('dpVacationRequestStart').value = '';
    document.getElementById('dpVacationRequestEnd').value = '';
    await load(profile);
    setMessage('Urlaubswunsch wurde eingereicht und wartet auf Prüfung.');
  }

  async function decide(id, status) {
    if (!mayReview()) return;
    const request = requests.find((entry) => entry.id === id);
    if (!request) return;

    let note = '';
    if (status === 'rejected') {
      const answer = window.prompt('Grund für die Ablehnung (optional):', request.decisionNote || '');
      if (answer === null) return;
      note = answer.trim();
    }

    const response = await fetch(`${API_BASE}/api/vacation-requests/${encodeURIComponent(id)}/decision`, {
      method: 'PUT',
      headers: tokenHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, note })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || 'Entscheidung konnte nicht gespeichert werden.', false);
      return;
    }

    await load(loadedProfile || activeProfile());
    setMessage(status === 'approved' ? 'Urlaubswunsch wurde genehmigt.' : 'Urlaubswunsch wurde abgelehnt.');
  }

  async function withdraw(id) {
    const request = requests.find((entry) => entry.id === id);
    if (!request || !window.confirm('Diesen offenen Urlaubswunsch wirklich zurückziehen?')) return;

    const response = await fetch(`${API_BASE}/api/vacation-requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: tokenHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || 'Urlaubswunsch konnte nicht zurückgezogen werden.', false);
      return;
    }

    await load(loadedProfile || activeProfile());
    setMessage('Urlaubswunsch wurde zurückgezogen.');
  }

  function requestCard(entry) {
    const info = statusInfo(entry.status);
    const meta = [];
    if (entry.requestedBy) meta.push(`Eingereicht von ${escapeHtml(entry.requestedBy)}`);
    if (entry.decidedBy) meta.push(`Entschieden von ${escapeHtml(entry.decidedBy)}`);
    if (entry.decisionNote) meta.push(`Hinweis: ${escapeHtml(entry.decisionNote)}`);

    let actions = '';
    if (isDriver() && entry.status === 'pending') {
      actions = `<button type="button" class="dp-vr-secondary" data-vr-withdraw="${escapeHtml(entry.id)}">Zurückziehen</button>`;
    } else if (mayReview()) {
      actions = `
        <button type="button" class="dp-vr-approve" data-vr-approve="${escapeHtml(entry.id)}">Genehmigen</button>
        <button type="button" class="dp-vr-reject" data-vr-reject="${escapeHtml(entry.id)}">Ablehnen</button>`;
    }

    return `<article class="dp-vr-card">
      <div>
        <div class="dp-vr-title">${escapeHtml(entry.emoji || '🌴')} ${escapeHtml(entry.label || 'Urlaubswunsch')}</div>
        <div class="dp-vr-range">${escapeHtml(formatDate(entry.start))} – ${escapeHtml(formatDate(entry.end))}</div>
        <div class="dp-vr-badge ${info.cls}"><span>${info.icon}</span>${info.text}</div>
        ${meta.length ? `<div class="dp-vr-meta">${meta.join('<br>')}</div>` : ''}
      </div>
      ${actions ? `<div class="dp-vr-actions">${actions}</div>` : ''}
    </article>`;
  }

  function panelHtml(profile) {
    const role = currentRole();
    const driver = role === 'fahrer';
    const reviewer = mayReview();
    const readable = mayReadAll() || driver;

    if (!readable) {
      return '<div class="dp-vr-empty">Für diese Rolle ist der Jahresurlaub nicht freigegeben.</div>';
    }

    const note = driver
      ? 'Hier reichst du einen Urlaubswunsch ein. Erst nach der Genehmigung durch Geschäftsleitung oder Disposition wird er als Jahresurlaub übernommen.'
      : reviewer
        ? 'Prüfe die Urlaubswünsche des ausgewählten Fahrers. Nur genehmigte Wünsche erscheinen anschließend als Jahresurlaub im Dienstplan.'
        : 'Urlaubswünsche können hier eingesehen werden. Genehmigen oder ablehnen dürfen ausschließlich Geschäftsleitung und Disposition.';

    const form = driver ? `
      <div class="dp-vr-form">
        <label>Bezeichnung<input id="dpVacationRequestLabel" maxlength="80" placeholder="z. B. Sommerurlaub"></label>
        <label>Von<input id="dpVacationRequestStart" type="date"></label>
        <label>Bis<input id="dpVacationRequestEnd" type="date"></label>
        <button type="button" class="dp-vr-primary" id="dpVacationRequestSubmit">Urlaubswunsch einreichen</button>
      </div>` : '';

    const list = requests.length
      ? requests.map(requestCard).join('')
      : '<div class="dp-vr-empty">Für diesen Fahrer liegen noch keine Urlaubswünsche vor.</div>';

    return `
      <div class="dp-vr-note">${note}</div>
      <div class="dp-vr-profile">Fahrer: ${escapeHtml(profile || 'nicht ausgewählt')}</div>
      ${form}
      <div class="dp-vr-status" aria-live="polite"></div>
      <div class="dp-vr-list">${list}</div>`;
  }

  function bind(panel) {
    panel.querySelector('#dpVacationRequestSubmit')?.addEventListener('click', submitRequest);
    panel.querySelectorAll('[data-vr-withdraw]').forEach((button) => {
      button.addEventListener('click', () => withdraw(button.dataset.vrWithdraw));
    });
    panel.querySelectorAll('[data-vr-approve]').forEach((button) => {
      button.addEventListener('click', () => decide(button.dataset.vrApprove, 'approved'));
    });
    panel.querySelectorAll('[data-vr-reject]').forEach((button) => {
      button.addEventListener('click', () => decide(button.dataset.vrReject, 'rejected'));
    });
  }

  function render() {
    addStyle();
    const section = document.querySelector('#tab-einstellungen .vacation-section');
    if (!section) return false;

    document.body.classList.add('dp-vacation-request-active');
    const heading = section.querySelector('.vacation-header h2');
    const description = section.querySelector('.vacation-header .muted');
    if (heading) heading.textContent = '📁 Jahresurlaub';
    if (description) {
      description.textContent = isDriver()
        ? 'Urlaubswunsch einreichen und Bearbeitungsstand ansehen.'
        : 'Urlaubswünsche prüfen und genehmigen oder ablehnen.';
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      section.appendChild(panel);
    }

    const profile = activeProfile();
    panel.innerHTML = panelHtml(profile);
    bind(panel);
    return true;
  }

  async function installAndLoad() {
    render();
    const profile = activeProfile();
    if (profile && profile !== loadedProfile) await load(profile);
  }

  window.dienstpilotVacationRequestWorkflow = {
    load,
    profile: activeProfile,
    requests: () => [...requests]
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAndLoad, { once: true });
  } else {
    void installAndLoad();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#openJahresurlaubFix,#loginButton,#loadKollege,#loadRunke,#loadLady,.tab[data-tab="einstellungen"],.tab[data-tab="eingabe"]')) {
      [0, 150, 500, 1100].forEach((delay) => window.setTimeout(() => void installAndLoad(), delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'kollegeSelect' || event.target?.id === 'profileSelect') {
      loadedProfile = '';
      window.setTimeout(() => void installAndLoad(), 250);
    }
  }, true);

  window.addEventListener('pageshow', () => void installAndLoad());
  window.addEventListener('focus', () => void installAndLoad());
})();
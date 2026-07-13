(() => {
  'use strict';

  if (window.__dienstpilotVacationReviewDisponent) return;
  window.__dienstpilotVacationReviewDisponent = true;

  const API = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const HOST_ID = 'dpVacationReviewDisponent';
  const STYLE_ID = 'dpVacationReviewDisponentStyle';
  const ACTIVE_PROFILE_KEY = 'dienstpilot_aktiver_kollege';

  let selectedProfile = '';
  let requests = [];
  let drivers = [];
  let loading = false;

  function normalize(value) {
    return String(value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function normalizeRole(value) {
    return String(value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function isReviewer() {
    const role = normalizeRole(currentUser()?.role || sessionStorage.getItem(ROLE_KEY));
    return ['geschaftsleitung', 'geschaeftsleitung', 'disposition', 'disponent'].includes(role);
  }

  function headers(extra) {
    const result = new Headers(extra || {});
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function formatDate(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(iso || '');
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.dp-reviewer-vacation-active #tab-einstellungen .vacation-content,
      body.dp-reviewer-vacation-active #dpVacationRequestWorkflow{display:none!important}
      #${HOST_ID}{margin-top:14px;border:1px solid #dbe4ee;border-radius:16px;background:#fff;overflow:hidden}
      #${HOST_ID} summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;cursor:pointer;padding:15px 16px;background:#f8fafc;color:#0f172a;font-weight:950}
      #${HOST_ID} summary::-webkit-details-marker{display:none}
      #${HOST_ID} summary::after{content:'▼';font-size:12px;color:#64748b}
      #${HOST_ID}:not([open]) summary::after{content:'▶'}
      #${HOST_ID} .dp-rv-body{display:grid;gap:14px;padding:16px}
      #${HOST_ID} .dp-rv-note{padding:12px 14px;border:1px solid #bfdbfe;border-radius:13px;background:#eff6ff;color:#1e3a8a;font-weight:800;line-height:1.45}
      #${HOST_ID} .dp-rv-toolbar{display:grid;grid-template-columns:minmax(200px,1fr) auto auto;gap:9px;align-items:end}
      #${HOST_ID} label{display:grid;gap:6px;color:#334155;font-size:12px;font-weight:900}
      #${HOST_ID} select{width:100%;min-height:42px;border:1px solid #cbd5e1;border-radius:11px;padding:9px 11px;background:#fff;font:inherit}
      #${HOST_ID} button{min-height:42px;border-radius:11px;padding:9px 13px;font:inherit;font-weight:900;cursor:pointer}
      #${HOST_ID} .dp-rv-primary{border:1px solid #0f172a;background:#0f172a;color:#fff}
      #${HOST_ID} .dp-rv-secondary{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${HOST_ID} .dp-rv-approve{border:1px solid #86efac;background:#f0fdf4;color:#166534}
      #${HOST_ID} .dp-rv-reject{border:1px solid #fecaca;background:#fff1f2;color:#b91c1c}
      #${HOST_ID} .dp-rv-message{min-height:20px;font-size:13px;font-weight:850;color:#166534}
      #${HOST_ID} .dp-rv-message.error{color:#b91c1c}
      #${HOST_ID} .dp-rv-list{display:grid;gap:10px}
      #${HOST_ID} .dp-rv-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid #dbe4ee;border-radius:15px;background:#fff}
      #${HOST_ID} .dp-rv-title{font-size:16px;font-weight:950;color:#0f172a}
      #${HOST_ID} .dp-rv-range{margin-top:4px;color:#475569;font-weight:850}
      #${HOST_ID} .dp-rv-meta{margin-top:7px;color:#64748b;font-size:12px;line-height:1.45}
      #${HOST_ID} .dp-rv-badge{display:inline-flex;margin-top:8px;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:950}
      #${HOST_ID} .pending{background:#fff7ed;color:#9a3412}
      #${HOST_ID} .approved{background:#f0fdf4;color:#166534}
      #${HOST_ID} .rejected{background:#fff1f2;color:#b91c1c}
      #${HOST_ID} .dp-rv-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      #${HOST_ID} .dp-rv-empty{padding:22px;border:1px dashed #cbd5e1;border-radius:14px;text-align:center;color:#64748b;font-weight:800}
      @media(max-width:700px){#${HOST_ID} .dp-rv-toolbar{grid-template-columns:1fr}#${HOST_ID} .dp-rv-card{grid-template-columns:1fr}#${HOST_ID} .dp-rv-actions{justify-content:flex-start}#${HOST_ID} .dp-rv-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function setMessage(text, ok = true) {
    const node = document.querySelector(`#${HOST_ID} .dp-rv-message`);
    if (!node) return;
    node.textContent = text;
    node.className = `dp-rv-message${ok ? '' : ' error'}`;
  }

  function statusInfo(status) {
    if (status === 'approved') return { text: 'Genehmigt', cls: 'approved' };
    if (status === 'rejected') return { text: 'Abgelehnt', cls: 'rejected' };
    return { text: 'Offen – wartet auf Prüfung', cls: 'pending' };
  }

  async function loadDrivers() {
    const found = new Map();
    document.querySelectorAll('#kollegeSelect option').forEach((option) => {
      const value = normalize(option.value || option.textContent);
      if (value) found.set(value, String(option.textContent || option.value).trim());
    });

    try {
      const response = await fetch(`${API}/api/users`, { cache: 'no-store', headers: headers() });
      const data = await response.json().catch(() => ({}));
      const list = Array.isArray(data) ? data : (Array.isArray(data.users) ? data.users : []);
      list.forEach((entry) => {
        if (normalizeRole(entry.role) !== 'fahrer') return;
        const value = normalize(entry.driverProfile || entry.username || entry.displayName);
        if (value) found.set(value, String(entry.displayName || entry.username || value));
      });
    } catch {}

    drivers = [...found.entries()].map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));

    if (!selectedProfile) {
      const active = normalize(localStorage.getItem(ACTIVE_PROFILE_KEY));
      selectedProfile = drivers.some((item) => item.value === active) ? active : (drivers[0]?.value || '');
    }
  }

  async function fetchRequests() {
    if (!selectedProfile || loading) return;
    loading = true;
    setMessage('Urlaubswünsche werden geladen …');
    try {
      const response = await fetch(`${API}/api/vacation-requests/${encodeURIComponent(selectedProfile)}`, {
        cache: 'no-store', headers: headers()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Urlaubswünsche konnten nicht geladen werden.');
      requests = Array.isArray(data.requests) ? data.requests : [];
      renderBody();
      setMessage(`${requests.length} Urlaubswunsch${requests.length === 1 ? '' : 'e'} geladen.`);
    } catch (error) {
      requests = [];
      renderBody();
      setMessage(error.message || 'Urlaubswünsche konnten nicht geladen werden.', false);
    } finally {
      loading = false;
    }
  }

  async function decide(id, decision) {
    let note = '';
    if (decision === 'rejected') {
      const answer = window.prompt('Grund für die Ablehnung (optional):', '');
      if (answer === null) return;
      note = answer.trim();
    }

    setMessage('Entscheidung wird gespeichert …');
    try {
      const response = await fetch(`${API}/api/vacation-requests/${encodeURIComponent(id)}/decision`, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: decision, note })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Entscheidung konnte nicht gespeichert werden.');
      await fetchRequests();
      setMessage(decision === 'approved' ? 'Urlaubswunsch wurde genehmigt.' : 'Urlaubswunsch wurde abgelehnt.');
    } catch (error) {
      setMessage(error.message || 'Entscheidung konnte nicht gespeichert werden.', false);
    }
  }

  function cardHtml(entry) {
    const info = statusInfo(entry.status);
    const meta = [];
    if (entry.requestedBy) meta.push(`Eingereicht von ${escapeHtml(entry.requestedBy)}`);
    if (entry.requestedAt) meta.push(`Eingereicht am ${escapeHtml(new Date(entry.requestedAt).toLocaleDateString('de-DE'))}`);
    if (entry.decidedBy) meta.push(`Entschieden von ${escapeHtml(entry.decidedBy)}`);
    if (entry.decisionNote) meta.push(`Hinweis: ${escapeHtml(entry.decisionNote)}`);

    const actions = entry.status === 'pending' ? `
      <div class="dp-rv-actions">
        <button type="button" class="dp-rv-approve" data-rv-approve="${escapeHtml(entry.id)}">Genehmigen</button>
        <button type="button" class="dp-rv-reject" data-rv-reject="${escapeHtml(entry.id)}">Ablehnen</button>
      </div>` : '';

    return `<article class="dp-rv-card">
      <div>
        <div class="dp-rv-title">🌴 ${escapeHtml(entry.label || 'Urlaubswunsch')}</div>
        <div class="dp-rv-range">${escapeHtml(formatDate(entry.start))} – ${escapeHtml(formatDate(entry.end))}</div>
        <div class="dp-rv-badge ${info.cls}">${info.text}</div>
        ${meta.length ? `<div class="dp-rv-meta">${meta.join('<br>')}</div>` : ''}
      </div>${actions}
    </article>`;
  }

  function renderBody() {
    const host = document.getElementById(HOST_ID);
    if (!host) return;
    const body = host.querySelector('.dp-rv-body');
    if (!body) return;

    const options = drivers.length
      ? drivers.map((item) => `<option value="${escapeHtml(item.value)}"${item.value === selectedProfile ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('')
      : '<option value="">Keine Fahrer gefunden</option>';

    const list = !selectedProfile
      ? '<div class="dp-rv-empty">Bitte einen Fahrer auswählen.</div>'
      : requests.length
        ? requests.map(cardHtml).join('')
        : '<div class="dp-rv-empty">Für diesen Fahrer liegen keine Urlaubswünsche vor.</div>';

    body.innerHTML = `
      <div class="dp-rv-note">Wähle einen Fahrer. Offene Urlaubswünsche können hier genehmigt oder abgelehnt werden.</div>
      <div class="dp-rv-toolbar">
        <label>Fahrer<select id="dpVacationReviewDriver">${options}</select></label>
        <button type="button" class="dp-rv-primary" id="dpVacationReviewLoad">Urlaubswünsche laden</button>
        <button type="button" class="dp-rv-secondary" id="dpVacationReviewRefresh">Aktualisieren</button>
      </div>
      <div class="dp-rv-message" aria-live="polite"></div>
      <div class="dp-rv-list">${list}</div>`;

    body.querySelector('#dpVacationReviewDriver')?.addEventListener('change', (event) => {
      selectedProfile = normalize(event.target.value);
      localStorage.setItem(ACTIVE_PROFILE_KEY, selectedProfile);
      void fetchRequests();
    });
    body.querySelector('#dpVacationReviewLoad')?.addEventListener('click', () => void fetchRequests());
    body.querySelector('#dpVacationReviewRefresh')?.addEventListener('click', () => void fetchRequests());
    body.querySelectorAll('[data-rv-approve]').forEach((button) => button.addEventListener('click', () => void decide(button.dataset.rvApprove, 'approved')));
    body.querySelectorAll('[data-rv-reject]').forEach((button) => button.addEventListener('click', () => void decide(button.dataset.rvReject, 'rejected')));
  }

  async function install() {
    if (!isReviewer()) {
      document.getElementById(HOST_ID)?.remove();
      document.body.classList.remove('dp-reviewer-vacation-active');
      return;
    }

    const section = document.querySelector('#tab-einstellungen .vacation-section');
    if (!section) return;

    addStyle();
    document.body.classList.add('dp-reviewer-vacation-active');
    document.getElementById('dpVacationRequestWorkflow')?.remove();

    const heading = section.querySelector('.vacation-header h2');
    const description = section.querySelector('.vacation-header .muted');
    if (heading) heading.textContent = '📁 Jahresurlaub';
    if (description) description.textContent = 'Urlaubswünsche prüfen und genehmigen oder ablehnen.';

    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('details');
      host.id = HOST_ID;
      host.open = true;
      host.innerHTML = '<summary>Urlaubswünsche öffnen und prüfen</summary><div class="dp-rv-body"></div>';
      section.appendChild(host);
      host.addEventListener('toggle', () => { if (host.open) void fetchRequests(); });
    }

    await loadDrivers();
    renderBody();
    if (host.open && selectedProfile) await fetchRequests();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void install(), { once: true });
  else void install();

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="einstellungen"],#loadKollege,#loadRunke')) {
      [0, 200, 650, 1400].forEach((delay) => setTimeout(() => void install(), delay));
    }
  }, true);
  window.addEventListener('pageshow', () => void install());
  window.addEventListener('focus', () => setTimeout(() => void install(), 0));
})();
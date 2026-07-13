(() => {
  'use strict';

  if (window.__dienstpilotDriverVacationInline) return;
  window.__dienstpilotDriverVacationInline = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const STYLE_ID = 'dpDriverVacationInlineStyle';
  const HOST_ID = 'dpDriverVacationHost';

  let requests = [];
  let loading = false;

  function normalize(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/g, '_');
  }

  function normalizeRole(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function isDriver() {
    return normalizeRole(currentUser()?.role || sessionStorage.getItem(ROLE_KEY)) === 'fahrer';
  }

  function profileName() {
    const user = currentUser() || {};
    return normalize(user.driverProfile || user.username || user.displayName || '');
  }

  function headers(extra) {
    const result = new Headers(extra || {});
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value || '');
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
      #${HOST_ID} .dp-dvi-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
      #${HOST_ID} .dp-dvi-title{font-size:22px;font-weight:950;color:#0f172a}
      #${HOST_ID} .dp-dvi-sub{margin-top:4px;color:#475569;font-size:13px;font-weight:800;line-height:1.45}
      #${HOST_ID} .dp-dvi-form{display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:10px;align-items:end;padding:14px;border:1px solid #dbe4ee;border-radius:16px;background:#fff}
      #${HOST_ID} label{display:grid;gap:6px;color:#334155;font-size:12px;font-weight:900}
      #${HOST_ID} input{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:11px;padding:10px 11px;background:#fff;color:#0f172a;font:inherit}
      #${HOST_ID} button{min-height:40px;border-radius:11px;padding:9px 13px;font:inherit;font-weight:900;cursor:pointer}
      #${HOST_ID} .dp-dvi-primary{border:1px solid #166534;background:#166534;color:#fff}
      #${HOST_ID} .dp-dvi-secondary{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${HOST_ID} .dp-dvi-message{min-height:20px;margin:10px 0;font-size:13px;font-weight:850}
      #${HOST_ID} .dp-dvi-message.ok{color:#166534}#${HOST_ID} .dp-dvi-message.error{color:#b91c1c}
      #${HOST_ID} .dp-dvi-list{display:grid;gap:10px}
      #${HOST_ID} .dp-dvi-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px;border:1px solid #dbe4ee;border-radius:15px;background:#fff}
      #${HOST_ID} .dp-dvi-card-title{font-size:16px;font-weight:950;color:#0f172a}
      #${HOST_ID} .dp-dvi-range{margin-top:4px;color:#475569;font-weight:850}
      #${HOST_ID} .dp-dvi-meta{margin-top:7px;color:#64748b;font-size:12px;line-height:1.45}
      #${HOST_ID} .dp-dvi-badge{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:950}
      #${HOST_ID} .dp-dvi-badge.pending{background:#fff7ed;color:#9a3412}
      #${HOST_ID} .dp-dvi-badge.approved{background:#f0fdf4;color:#166534}
      #${HOST_ID} .dp-dvi-badge.rejected{background:#fff1f2;color:#b91c1c}
      #${HOST_ID} .dp-dvi-empty{padding:22px;border:1px dashed #cbd5e1;border-radius:15px;text-align:center;color:#64748b;font-weight:850;background:#fff}
      @media(max-width:760px){
        #${HOST_ID} .dp-dvi-form{grid-template-columns:1fr}
        #${HOST_ID} .dp-dvi-form button{width:100%}
        #${HOST_ID} .dp-dvi-card{grid-template-columns:1fr}
        #${HOST_ID} .dp-dvi-card button{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function setMessage(text, ok = true) {
    const node = document.querySelector(`#${HOST_ID} .dp-dvi-message`);
    if (!node) return;
    node.textContent = text;
    node.className = `dp-dvi-message ${ok ? 'ok' : 'error'}`;
  }

  function cardHtml(entry) {
    const info = statusInfo(entry.status);
    const meta = [];
    if (entry.requestedAt) meta.push(`Eingereicht am ${escapeHtml(new Date(entry.requestedAt).toLocaleDateString('de-DE'))}`);
    if (entry.decidedBy) meta.push(`Entschieden von ${escapeHtml(entry.decidedBy)}`);
    if (entry.decisionNote) meta.push(`Hinweis: ${escapeHtml(entry.decisionNote)}`);
    const withdraw = entry.status === 'pending'
      ? `<button type="button" class="dp-dvi-secondary" data-dvi-withdraw="${escapeHtml(entry.id)}">Zurückziehen</button>`
      : '';
    return `<article class="dp-dvi-card">
      <div>
        <div class="dp-dvi-card-title">🌴 ${escapeHtml(entry.label || 'Urlaubswunsch')}</div>
        <div class="dp-dvi-range">${escapeHtml(formatDate(entry.start))} – ${escapeHtml(formatDate(entry.end))}</div>
        <div class="dp-dvi-badge ${info.cls}"><span>${info.icon}</span>${info.text}</div>
        ${meta.length ? `<div class="dp-dvi-meta">${meta.join('<br>')}</div>` : ''}
      </div>
      ${withdraw}
    </article>`;
  }

  function render() {
    const host = document.getElementById(HOST_ID);
    if (!host || host.hidden || !isDriver()) return false;
    addStyle();
    host.innerHTML = `
      <div class="dp-dvi-head">
        <div>
          <div class="dp-dvi-title">Urlaubswunsch</div>
          <div class="dp-dvi-sub">Hier trägst du deinen Wunsch ein. Geschäftsleitung oder Disposition entscheidet anschließend über Genehmigung oder Ablehnung.</div>
        </div>
      </div>
      <div class="dp-dvi-form">
        <label>Bezeichnung<input id="dpDviLabel" maxlength="80" placeholder="z. B. Sommerurlaub"></label>
        <label>Von<input id="dpDviStart" type="date"></label>
        <label>Bis<input id="dpDviEnd" type="date"></label>
        <button type="button" class="dp-dvi-primary" id="dpDviSubmit">Urlaubswunsch einreichen</button>
      </div>
      <div class="dp-dvi-message" aria-live="polite"></div>
      <div class="dp-dvi-list">
        ${requests.length ? requests.map(cardHtml).join('') : '<div class="dp-dvi-empty">Noch keine Urlaubswünsche vorhanden.</div>'}
      </div>`;

    host.querySelector('#dpDviSubmit')?.addEventListener('click', submit);
    host.querySelectorAll('[data-dvi-withdraw]').forEach((button) => {
      button.addEventListener('click', () => withdraw(button.dataset.dviWithdraw));
    });
    return true;
  }

  async function load() {
    if (loading || !isDriver()) return;
    const profile = profileName();
    if (!profile) return;
    loading = true;
    try {
      const response = await fetch(`${API_BASE}/api/vacation-requests/${encodeURIComponent(profile)}`, {
        cache: 'no-store', headers: headers()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Urlaubswünsche konnten nicht geladen werden.');
      requests = Array.isArray(data.requests) ? data.requests : [];
      render();
    } catch (error) {
      render();
      setMessage(error.message || 'Urlaubswünsche konnten nicht geladen werden.', false);
    } finally {
      loading = false;
    }
  }

  async function submit() {
    const profile = profileName();
    const label = String(document.getElementById('dpDviLabel')?.value || '').trim();
    const start = document.getElementById('dpDviStart')?.value || '';
    const end = document.getElementById('dpDviEnd')?.value || '';
    if (!start || !end) { setMessage('Bitte Beginn und Ende des Urlaubswunsches eintragen.', false); return; }
    if (end < start) { setMessage('Das Enddatum darf nicht vor dem Anfangsdatum liegen.', false); return; }
    try {
      const response = await fetch(`${API_BASE}/api/vacation-requests`, {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ profile, label: label || 'Urlaubswunsch', emoji: '🌴', start, end })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Urlaubswunsch konnte nicht gespeichert werden.');
      await load();
      setMessage('Urlaubswunsch wurde eingereicht und wartet auf Prüfung.');
    } catch (error) {
      setMessage(error.message || 'Urlaubswunsch konnte nicht gespeichert werden.', false);
    }
  }

  async function withdraw(id) {
    if (!window.confirm('Diesen offenen Urlaubswunsch wirklich zurückziehen?')) return;
    try {
      const response = await fetch(`${API_BASE}/api/vacation-requests/${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: headers()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Urlaubswunsch konnte nicht zurückgezogen werden.');
      await load();
      setMessage('Urlaubswunsch wurde zurückgezogen.');
    } catch (error) {
      setMessage(error.message || 'Urlaubswunsch konnte nicht zurückgezogen werden.', false);
    }
  }

  window.addEventListener('dienstpilot:open-vacation-request', () => {
    render();
    void load();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-home-action="vacation"]')) {
      setTimeout(() => { render(); void load(); }, 0);
    }
  }, true);
})();
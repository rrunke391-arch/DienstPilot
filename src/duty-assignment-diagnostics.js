(() => {
  'use strict';

  if (window.__dienstpilotDutyAssignmentDiagnosticsV1) return;
  window.__dienstpilotDutyAssignmentDiagnosticsV1 = true;

  const API = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const PANEL_ID = 'dpDutyAssignmentDiagnostics';
  const LOG_LIMIT = 20;
  const originalFetch = window.fetch.bind(window);
  const logs = [];

  function normalize(value) {
    return String(value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function headers() {
    const result = new Headers();
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  function safeJson(text) {
    try { return JSON.parse(text); } catch { return text; }
  }

  function summarize(value) {
    if (!value || typeof value !== 'object') return value;
    const data = Object.prototype.hasOwnProperty.call(value, 'data') ? value.data : value;
    if (!data || typeof data !== 'object') return data;
    return {
      dutiesCount: Array.isArray(data.duties) ? data.duties.length : null,
      duties: Array.isArray(data.duties) ? data.duties.map((row) => ({
        id: row?.id,
        date: row?.date,
        number: row?.number,
        start: row?.start,
        end: row?.end,
        type: row?.type
      })) : null,
      activeProfile: data?.appSettings?.activeProfile || null,
      savedAt: data.savedAt || null
    };
  }

  function addLog(entry) {
    logs.unshift({ time: new Date().toLocaleTimeString('de-DE'), ...entry });
    logs.splice(LOG_LIMIT);
    render();
  }

  window.fetch = async function diagnosticFetch(input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    const relevant = url.includes('/api/data/plan_') || url.includes('/api/plan/');
    if (!relevant) return originalFetch(input, init);

    let requestBody = null;
    if (init?.body && typeof init.body === 'string') requestBody = summarize(safeJson(init.body));
    const started = performance.now();
    try {
      const response = await originalFetch(input, init);
      const clone = response.clone();
      const text = await clone.text().catch(() => '');
      addLog({
        kind: 'Netzwerk', method, url,
        status: response.status,
        durationMs: Math.round(performance.now() - started),
        requestBody,
        responseBody: summarize(safeJson(text))
      });
      return response;
    } catch (error) {
      addLog({ kind: 'Netzwerk', method, url, error: error?.message || String(error), requestBody });
      throw error;
    }
  };

  async function probe(url, label) {
    const started = performance.now();
    try {
      const response = await originalFetch(url, { cache: 'no-store', headers: headers() });
      const text = await response.text();
      addLog({
        kind: label,
        method: 'GET', url,
        status: response.status,
        durationMs: Math.round(performance.now() - started),
        responseBody: summarize(safeJson(text))
      });
    } catch (error) {
      addLog({ kind: label, method: 'GET', url, error: error?.message || String(error) });
    }
  }

  async function runProbe() {
    const assignmentRaw = document.getElementById('dpAssignDriverV2')?.value || '';
    const selected = document.getElementById('kollegeSelect');
    const monthlyRaw = selected?.value || selected?.selectedOptions?.[0]?.textContent || '';
    const assignment = normalize(assignmentRaw);
    const monthly = normalize(monthlyRaw);

    addLog({ kind: 'Profile', assignmentRaw, assignment, monthlyRaw, monthly });

    const profiles = [...new Set([assignment, monthly].filter(Boolean))];
    for (const profile of profiles) {
      await probe(`${API}/api/data/${encodeURIComponent('plan_' + profile)}`, `Direkt /api/data: ${profile}`);
      await probe(`${API}/api/data/${encodeURIComponent('plan_' + profile.replace(/^[a-z]_/, ''))}`, `Ohne Initiale: ${profile}`);
      await probe(`/api/plan/${encodeURIComponent(profile)}`, `Monatsplan /api/plan: ${profile}`);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function render() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const output = panel.querySelector('pre');
    if (!output) return;
    output.textContent = logs.length ? JSON.stringify(logs, null, 2) : 'Noch keine Diagnose ausgeführt.';
  }

  function install() {
    if (document.getElementById(PANEL_ID)) return;
    const assignment = document.getElementById('dpDutyAssignmentV2');
    if (!assignment) return;

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.style.cssText = 'margin:12px 0 18px;padding:14px;border:2px solid #f59e0b;border-radius:14px;background:#fffbeb;color:#0f172a';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <strong>Diagnose Dienstzuweisung</strong>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" id="dpRunAssignmentDiagnostics" style="padding:9px 12px;border:1px solid #92400e;border-radius:9px;background:#fff;font-weight:800;cursor:pointer">Diagnose aktualisieren</button>
          <button type="button" id="dpClearAssignmentDiagnostics" style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;font-weight:800;cursor:pointer">Anzeige leeren</button>
        </div>
      </div>
      <p style="margin:8px 0;font-size:13px">Zeigt ausschließlich die tatsächlich verwendeten Profile, Endpunkte und Serverantworten. Passwörter oder Token werden nicht angezeigt.</p>
      <pre style="max-height:420px;overflow:auto;margin:0;padding:10px;border-radius:9px;background:#111827;color:#f8fafc;font-size:12px;white-space:pre-wrap;word-break:break-word">Noch keine Diagnose ausgeführt.</pre>`;
    assignment.insertAdjacentElement('afterend', panel);
    panel.querySelector('#dpRunAssignmentDiagnostics')?.addEventListener('click', runProbe);
    panel.querySelector('#dpClearAssignmentDiagnostics')?.addEventListener('click', () => { logs.length = 0; render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  [100, 400, 1000, 2500].forEach((delay) => setTimeout(install, delay));
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.tab[data-tab="eingabe"],#loginButton')) setTimeout(install, 100);
  }, true);
})();
(() => {
  'use strict';

  if (window.__dienstpilotDriverVacationStatusLight) return;
  window.__dienstpilotDriverVacationStatusLight = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const LIGHT_ID = 'dpDriverVacationDecisionLight';
  const STYLE_ID = 'dpDriverVacationDecisionLightStyle';

  let latestDecision = null;
  let loading = false;
  let lastLoadedAt = 0;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function profileKey(value) {
    return normalize(value).replace(/[^a-z0-9_-]+/g, '_');
  }

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function isDriver() {
    return normalize(currentUser()?.role || sessionStorage.getItem(ROLE_KEY)) === 'fahrer';
  }

  function profileName() {
    const user = currentUser() || {};
    return profileKey(user.driverProfile || user.username || user.displayName || '');
  }

  function headers() {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${LIGHT_ID}{display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:9px 12px;border-radius:12px;font:inherit;font-size:13px;font-weight:950;cursor:pointer;white-space:nowrap}
      #${LIGHT_ID} .dp-vacation-light-dot{width:13px;height:13px;border-radius:50%;flex:0 0 13px;box-shadow:0 0 0 4px rgba(255,255,255,.16),0 0 14px currentColor}
      #${LIGHT_ID}.approved{border:1px solid #86efac;background:#dcfce7;color:#166534}
      #${LIGHT_ID}.approved .dp-vacation-light-dot{background:#22c55e}
      #${LIGHT_ID}.rejected{border:1px solid #fca5a5;background:#fee2e2;color:#991b1b}
      #${LIGHT_ID}.rejected .dp-vacation-light-dot{background:#ef4444}
      @media(max-width:760px){#${LIGHT_ID}{width:100%;justify-content:center}}
    `;
    document.head.appendChild(style);
  }

  function decisionTime(entry) {
    const value = entry?.decidedAt || entry?.requestedAt || '';
    const stamp = Date.parse(value);
    return Number.isFinite(stamp) ? stamp : 0;
  }

  function newestDecision(requests) {
    return [...requests]
      .filter((entry) => entry && (entry.status === 'approved' || entry.status === 'rejected'))
      .sort((a, b) => decisionTime(b) - decisionTime(a))[0] || null;
  }

  function formatDate(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(iso || '');
  }

  function lampText(entry) {
    if (!entry) return '';
    return entry.status === 'approved' ? 'Urlaub genehmigt' : 'Urlaub abgelehnt';
  }

  function lampTitle(entry) {
    if (!entry) return '';
    const result = lampText(entry);
    const range = entry.start && entry.end ? `${formatDate(entry.start)} bis ${formatDate(entry.end)}` : '';
    const note = entry.decisionNote ? ` – ${entry.decisionNote}` : '';
    return `${result}${range ? `: ${range}` : ''}${note}`;
  }

  function render() {
    if (!isDriver()) {
      document.getElementById(LIGHT_ID)?.remove();
      return;
    }

    const actions = document.querySelector('#dpDriverHome .dp-home-actions');
    if (!actions) return;

    if (!latestDecision) {
      document.getElementById(LIGHT_ID)?.remove();
      return;
    }

    addStyle();
    let light = document.getElementById(LIGHT_ID);
    if (!light) {
      light = document.createElement('button');
      light.type = 'button';
      light.id = LIGHT_ID;
      light.addEventListener('click', () => {
        const vacationButton = document.querySelector('#dpDriverHome [data-home-action="vacation"]');
        if (vacationButton) vacationButton.click();
      });
    }

    light.className = latestDecision.status;
    light.title = lampTitle(latestDecision);
    light.setAttribute('aria-label', lampTitle(latestDecision));
    light.innerHTML = `<span class="dp-vacation-light-dot" aria-hidden="true"></span><span>${lampText(latestDecision)}</span>`;

    const vacationButton = actions.querySelector('[data-home-action="vacation"]');
    if (vacationButton) actions.insertBefore(light, vacationButton);
    else actions.appendChild(light);
  }

  async function load(force = false) {
    if (!isDriver() || loading) return;
    const profile = profileName();
    if (!profile) return;

    const now = Date.now();
    if (!force && now - lastLoadedAt < 5000) {
      render();
      return;
    }

    loading = true;
    try {
      const response = await fetch(`${API_BASE}/api/vacation-requests/${encodeURIComponent(profile)}`, {
        cache: 'no-store',
        headers: headers()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Urlaubsstatus konnte nicht geladen werden.');
      latestDecision = newestDecision(Array.isArray(data.requests) ? data.requests : []);
      lastLoadedAt = Date.now();
      render();
    } catch {
      render();
    } finally {
      loading = false;
    }
  }

  function scheduleRenderAndLoad(force = false) {
    [0, 120, 400, 900].forEach((delay) => setTimeout(() => {
      render();
      if (delay === 400) void load(force);
    }, delay));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleRenderAndLoad(true), { once: true });
  } else {
    scheduleRenderAndLoad(true);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#dpDriverHome button,.tab[data-tab="eingabe"]')) {
      scheduleRenderAndLoad(event.target.closest?.('[data-home-action="vacation"]') != null);
    }
  }, true);

  window.addEventListener('dienstpilot:vacation-requests-loaded', () => scheduleRenderAndLoad(true));
  window.addEventListener('pageshow', () => scheduleRenderAndLoad(true));
  window.addEventListener('focus', () => scheduleRenderAndLoad(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRenderAndLoad(true);
  });

  window.setInterval(() => {
    if (!document.hidden && isDriver()) void load(true);
  }, 30000);
})();
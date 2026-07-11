(() => {
  'use strict';

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem('dienstpilot_user') || 'null');
    } catch {
      return null;
    }
  }

  function addStyle() {
    if (document.getElementById('dpSignoutStyle')) return;
    const style = document.createElement('style');
    style.id = 'dpSignoutStyle';
    style.textContent = '.dp-signout-area{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-left:auto}.dp-user-pill{border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:8px 12px;background:rgba(15,23,42,.45);color:#fff;font-size:13px;font-weight:800}.dp-signout-btn{border:1px solid rgba(255,255,255,.32);border-radius:999px;padding:9px 14px;background:#fff;color:#0f172a;font-weight:900;cursor:pointer}.dp-signout-btn:disabled{opacity:.65;cursor:wait}@media(max-width:700px){.dp-signout-area{width:100%;justify-content:flex-start;margin-left:0;margin-top:8px}}';
    document.head.appendChild(style);
  }

  function refreshName() {
    const pill = document.getElementById('dpCurrentUserPill');
    if (!pill) return;
    const user = readUser();
    pill.textContent = user ? `${user.displayName || user.username} · ${user.role || ''}` : 'Nicht angemeldet';
  }

  async function doSignout() {
    const button = document.getElementById('dpSignoutButton');
    if (button) {
      button.disabled = true;
      button.textContent = 'Speichere…';
    }

    try {
      if (typeof window.dienstpilotFlushBeforeSignout === 'function') {
        await Promise.race([
          Promise.resolve(window.dienstpilotFlushBeforeSignout()),
          new Promise((resolve) => window.setTimeout(resolve, 8000))
        ]);
      }
    } catch (error) {
      console.warn('Speichern vor Abmeldung fehlgeschlagen:', error);
    }

    sessionStorage.removeItem('dienstpilot_unlocked');
    sessionStorage.removeItem('dienstpilot_user');
    sessionStorage.removeItem('dienstpilot_role');
    sessionStorage.removeItem('dienstpilot_api_token');
    window.location.reload();
  }

  function createButton() {
    if (document.getElementById('dpSignoutButton')) {
      refreshName();
      return;
    }
    const hero = document.querySelector('.hero');
    if (!hero) return;
    addStyle();
    const area = document.createElement('div');
    area.className = 'dp-signout-area';
    const pill = document.createElement('div');
    pill.id = 'dpCurrentUserPill';
    pill.className = 'dp-user-pill';
    const button = document.createElement('button');
    button.id = 'dpSignoutButton';
    button.type = 'button';
    button.className = 'dp-signout-btn';
    button.textContent = 'Abmelden';
    button.addEventListener('click', doSignout);
    area.append(pill, button);
    hero.appendChild(area);
    refreshName();
  }

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    document.head.appendChild(script);
  }

  function loadStylesheet(id, href) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadUserModules() {
    loadScript('dpVacationPersistenceV3', 'src/vacation-persistence-v3.js?v=20260710-4');
    loadScript('dpDriverVacationAccess', 'src/driver-vacation-access.js?v=20260710-2');
    loadStylesheet('dpPasswordEyeSlash', 'src/password-eye-slash.css?v=20260711-1');
    loadScript('dpSelfPassword', 'src/self-password.js?v=20260711-3');
  }

  onReady(() => {
    createButton();
    loadUserModules();
    document.addEventListener('click', (event) => {
      if (event.target.closest && event.target.closest('#loginButton')) {
        setTimeout(refreshName, 500);
      }
    }, true);
  });
})();
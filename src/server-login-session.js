(() => {
  'use strict';

  if (window.__dienstpilotServerLoginSessionV1) return;
  window.__dienstpilotServerLoginSessionV1 = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const UNLOCKED_KEY = 'dienstpilot_unlocked';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';

  let loginRunning = false;

  function normalizeUser(raw, fallbackUsername) {
    const user = raw && typeof raw === 'object' ? raw : {};
    const username = String(user.username || fallbackUsername || '').trim();
    return {
      username,
      displayName: String(user.displayName || user.display_name || username).trim(),
      role: String(user.role || 'Fahrer').trim(),
      functionTitle: String(user.functionTitle || user.function_title || '').trim(),
      driverProfile: String(user.driverProfile || user.driver_profile || username).trim().toLowerCase(),
      access: String(user.access || '').trim()
    };
  }

  function setLoginError(text) {
    const node = document.getElementById('loginError');
    if (node) node.textContent = text;
  }

  function unlock(user, token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(ROLE_KEY, user.role);
    sessionStorage.setItem(UNLOCKED_KEY, 'yes');
    if (user.driverProfile) localStorage.setItem(ACTIVE_DRIVER_KEY, user.driverProfile);

    document.body.classList.remove('auth-locked');
    const screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'none';

    window.dispatchEvent(new CustomEvent('dienstpilot:authenticated', {
      detail: { user, tokenPresent: true }
    }));
  }

  async function serverLogin(username, password) {
    const response = await fetch(API_BASE + '/api/login', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => ({}));
    const token = String(data.token || data.accessToken || data.apiToken || '').trim();
    if (!response.ok || data.ok === false || !token) {
      throw new Error(data.error || 'Die Server-Anmeldung wurde abgelehnt.');
    }
    return { token, user: normalizeUser(data.user || data, username) };
  }

  async function handleLogin() {
    if (loginRunning) return;
    const usernameInput = document.getElementById('appUsername');
    const passwordInput = document.getElementById('appPassword');
    const username = String(usernameInput?.value || '').trim();
    const password = String(passwordInput?.value || '');
    if (!username || !password) return;

    loginRunning = true;
    try {
      const result = await serverLogin(username, password);
      setLoginError('');
      unlock(result.user, result.token);
    } catch (error) {
      // Die vorhandene lokale Anmeldung darf ihre verständliche Fehlermeldung anzeigen.
      console.error('DienstPilot Server-Anmeldung fehlgeschlagen:', error);
      window.dispatchEvent(new CustomEvent('dienstpilot:server-login-failed', {
        detail: { message: error?.message || 'Server-Anmeldung fehlgeschlagen.' }
      }));
    } finally {
      loginRunning = false;
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton')) void handleLogin();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (!event.target?.matches?.('#appUsername,#appPassword')) return;
    void handleLogin();
  }, true);

  // Bereits vorhandene gültige Sitzung nach einem normalen Neuladen bekanntgeben.
  const token = sessionStorage.getItem(TOKEN_KEY) || '';
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); } catch {}
  if (token && user) {
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('dienstpilot:authenticated', {
      detail: { user, tokenPresent: true }
    })), 0);
  }
})();
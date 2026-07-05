(() => {
  'use strict';

  const ADMIN_USER = {
    name: 'Runke',
    keyHash: '6c651e36960ed17a84e0ab3c3e927efc05f896976a1c29144b55a75a283c4e92',
    role: 'Administrator',
    profile: 'runke'
  };

  function ready(fn) {
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn();
  }

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function prepareLogin() {
    const oldInput = document.getElementById('appPassword');
    if (!oldInput) return;

    if (!document.getElementById('appUsername')) {
      const userInput = document.createElement('input');
      userInput.id = 'appUsername';
      userInput.type = 'text';
      userInput.placeholder = 'Benutzername';
      userInput.autocomplete = 'username';
      userInput.value = ADMIN_USER.name;
      oldInput.parentElement.insertBefore(userInput, oldInput);
    }

    oldInput.placeholder = 'Passwort';
    oldInput.autocomplete = 'current-password';

    const info = document.querySelector('#loginScreen .login-box p');
    if (info) info.textContent = 'Bitte Benutzername und Passwort eingeben.';
  }

  function unlockForAdmin() {
    sessionStorage.setItem('dienstpilot_unlocked', 'yes');
    sessionStorage.setItem('dienstpilot_user', ADMIN_USER.name);
    sessionStorage.setItem('dienstpilot_role', ADMIN_USER.role);
    localStorage.setItem('dienstpilot_aktiver_kollege', ADMIN_USER.profile);

    document.body.classList.remove('auth-locked');
    const screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'none';
  }

  async function login(event) {
    const userInput = document.getElementById('appUsername');
    const keyInput = document.getElementById('appPassword');
    if (!userInput || !keyInput) return;

    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    const error = document.getElementById('loginError');
    const userOk = userInput.value.trim().toLowerCase() === ADMIN_USER.name.toLowerCase();
    const keyOk = await sha256Hex(keyInput.value) === ADMIN_USER.keyHash;

    if (!userOk || !keyOk) {
      if (error) error.textContent = 'Benutzername oder Passwort ist falsch.';
      keyInput.value = '';
      keyInput.focus();
      return;
    }

    unlockForAdmin();
  }

  ready(() => {
    prepareLogin();

    document.addEventListener('click', (event) => {
      if (event.target.closest && event.target.closest('#loginButton')) login(event);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (!event.target || (event.target.id !== 'appUsername' && event.target.id !== 'appPassword')) return;
      login(event);
    }, true);
  });
})();

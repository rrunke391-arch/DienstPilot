(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const APP_URL = 'https://rrunke391-arch.github.io/DienstPilot/';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const UNLOCKED_KEY = 'dienstpilot_unlocked';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const BUTTON_ID = 'dpSendSecureInvite';
  const STYLE_ID = 'dpSecureInviteStyles';

  function ready(fn) {
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn, { once: true })
      : fn();
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function isAdmin() {
    return readUser()?.role === 'Administrator';
  }

  function displayRole(role) {
    return role === 'Geschaeftsleitung' ? 'Geschäftsleitung' : (role || '');
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dienstpilotUserAdminCard .dp-secure-invite-hint {
        margin-top: 14px;
        padding: 12px 14px;
        border: 1px solid #bfdbfe;
        border-radius: 12px;
        background: #eff6ff;
        color: #1e3a8a;
        line-height: 1.45;
      }
      .dp-invite-login-box { max-width: 480px; }
      .dp-invite-login-box .dp-invite-meta {
        margin: 12px 0;
        padding: 10px 12px;
        border-radius: 10px;
        background: #f1f5f9;
        text-align: left;
        line-height: 1.5;
      }
      .dp-invite-login-box input { margin-top: 10px; }
      .dp-invite-login-box button { margin-top: 12px; }
    `;
    document.head.appendChild(style);
  }

  async function jsonRequest(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Die Serveranfrage ist fehlgeschlagen.');
    }
    return data;
  }

  function adminHeaders() {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) headers.set('Authorization', 'Bearer ' + token);
    return headers;
  }

  function fieldValue(card, selector) {
    return card.querySelector(selector)?.value?.trim() || '';
  }

  function setAdminStatus(card, text, ok) {
    const status = card.querySelector('#dpUserAdminStatus');
    if (!status) return;
    status.textContent = text;
    status.style.color = ok ? '#166534' : '#b91c1c';
  }

  function createMailText(user, data) {
    const expiry = data.expiresAt
      ? new Date(data.expiresAt).toLocaleString('de-DE')
      : 'in 48 Stunden';
    return [
      `Hallo ${user.displayName},`,
      '',
      'du wurdest zu DienstPilot eingeladen.',
      '',
      `Einmal-Link: ${data.inviteUrl}`,
      `Benutzername: ${user.username}`,
      `Einmal-Passwort: ${data.startPassword}`,
      `Rolle: ${displayRole(user.role)}`,
      '',
      `Der Link ist nur einmal verwendbar und bis ${expiry} gültig.`,
      'Nach der Anmeldung musst du sofort ein eigenes Passwort festlegen.',
      '',
      'Viele Grüße',
      'Runke'
    ].join('\n');
  }

  async function sendSecureInvitation(card) {
    const username = fieldValue(card, '#dpNewUsername');
    const displayName = fieldValue(card, '#dpNewDisplayName') || username;
    const email = fieldValue(card, '#dpNewEmail');
    const role = fieldValue(card, '#dpNewRole') || 'Fahrer';
    const driverProfile = fieldValue(card, '#dpNewDriver') || normalize(username);

    if (!username) {
      setAdminStatus(card, 'Bitte einen Benutzernamen eintragen.', false);
      return;
    }
    if (!email) {
      setAdminStatus(card, 'Bitte eine E-Mail-Adresse eintragen.', false);
      return;
    }
    if (normalize(username) === 'runke') {
      setAdminStatus(card, 'Der Hauptadministrator kann nicht eingeladen werden.', false);
      return;
    }

    setAdminStatus(card, 'Einladung wird erzeugt und versendet ...', true);
    try {
      const data = await jsonRequest(API_BASE + '/api/invitations', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ username, displayName, email, role, driverProfile })
      });

      const mailText = createMailText({ username, displayName, email, role }, data);
      const wrap = card.querySelector('#dpUserAdminMailWrap');
      const area = card.querySelector('#dpUserAdminMail');
      const mailLink = card.querySelector('#dpMailInvite');
      if (wrap && area && mailLink) {
        wrap.classList.remove('hidden');
        area.value = mailText;
        mailLink.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('DienstPilot Einladung')}&body=${encodeURIComponent(mailText)}`;
        mailLink.textContent = 'E-Mail im Mailprogramm öffnen';
      }

      if (data.sent) {
        setAdminStatus(card, `Einladung an ${email} wurde versendet. Link und Einmal-Passwort sind 48 Stunden gültig.`, true);
      } else {
        setAdminStatus(card, 'Einladung wurde erzeugt. Der automatische E-Mail-Versand ist noch nicht eingerichtet; bitte den Einladungstext über das Mailprogramm senden.', false);
      }
    } catch (error) {
      setAdminStatus(card, error.message, false);
    }
  }

  function enhanceAdminCard() {
    if (!isAdmin()) return;
    const card = document.getElementById('dienstpilotUserAdminCard');
    if (!card || document.getElementById(BUTTON_ID)) return;

    installStyles();
    const actions = card.querySelector('.dp-user-admin-actions');
    const saveButton = card.querySelector('#dpSaveUser');
    if (!actions) return;

    const inviteButton = document.createElement('button');
    inviteButton.type = 'button';
    inviteButton.id = BUTTON_ID;
    inviteButton.className = 'btn-primary';
    inviteButton.textContent = '✉ Einladung per E-Mail senden';
    inviteButton.addEventListener('click', () => sendSecureInvitation(card));

    if (saveButton && saveButton.parentElement === actions) {
      actions.insertBefore(inviteButton, saveButton);
    } else {
      actions.prepend(inviteButton);
    }

    const hint = document.createElement('div');
    hint.className = 'dp-secure-invite-hint';
    hint.textContent = 'Der Server erzeugt automatisch ein Einmal-Passwort und einen einmal verwendbaren Link. Beides läuft nach 48 Stunden ab. Nach der ersten Prüfung muss der Empfänger sofort ein eigenes Passwort festlegen.';
    actions.insertAdjacentElement('afterend', hint);
  }

  function publicUser(serverUser) {
    const username = String(serverUser.username || '').trim();
    const role = String(serverUser.role || 'Fahrer').trim();
    return {
      username,
      displayName: String(serverUser.displayName || username).trim(),
      role,
      functionTitle: role === 'Administrator' ? 'Administrator DienstPilot Server' : 'Server-Benutzer',
      driverProfile: normalize(serverUser.driverProfile || username),
      access: role === 'Fahrer' ? 'Eigener Bereich' : 'Vollzugriff'
    };
  }

  function saveInviteSession(data) {
    const user = publicUser(data.user || {});
    sessionStorage.setItem(TOKEN_KEY, data.token || '');
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(ROLE_KEY, user.role);
    sessionStorage.setItem(UNLOCKED_KEY, 'yes');
    if (user.driverProfile) localStorage.setItem(ACTIVE_DRIVER_KEY, user.driverProfile);
  }

  function replaceLoginBox() {
    const screen = document.getElementById('loginScreen');
    const box = screen?.querySelector('.login-box');
    if (!screen || !box) return null;
    installStyles();
    document.body.classList.add('auth-locked');
    screen.style.display = '';
    box.classList.add('dp-invite-login-box');
    box.innerHTML = '';
    return box;
  }

  function setInviteError(box, message) {
    const error = box.querySelector('.login-error');
    if (error) error.textContent = message;
  }

  async function showPasswordChange(box, changeToken, invitation) {
    box.innerHTML = `
      <img src="favicon.png?v=dienstpilot-8" alt="DienstPilot Logo" class="login-logo">
      <h1>Eigenes Passwort festlegen</h1>
      <p>Das Einmal-Passwort wurde akzeptiert. Der Einladungslink ist jetzt verbraucht.</p>
      <div class="dp-invite-meta"><strong>${invitation.displayName || invitation.username}</strong><br>${displayRole(invitation.role)}</div>
      <input id="dpInviteNewPassword" type="password" placeholder="Neues Passwort" autocomplete="new-password">
      <input id="dpInviteNewPassword2" type="password" placeholder="Neues Passwort wiederholen" autocomplete="new-password">
      <button id="dpInviteSavePassword" type="button">Passwort speichern und anmelden</button>
      <div class="login-error"></div>
    `;

    const first = box.querySelector('#dpInviteNewPassword');
    const second = box.querySelector('#dpInviteNewPassword2');
    const button = box.querySelector('#dpInviteSavePassword');

    async function savePassword() {
      const password = first.value.trim();
      if (password.length < 8) {
        setInviteError(box, 'Das neue Passwort muss mindestens 8 Zeichen haben.');
        return;
      }
      if (password !== second.value.trim()) {
        setInviteError(box, 'Die beiden Passwörter stimmen nicht überein.');
        return;
      }
      setInviteError(box, 'Passwort wird gespeichert ...');
      try {
        const data = await jsonRequest(API_BASE + '/api/invitations/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changeToken, newPassword: password })
        });
        saveInviteSession(data);
        location.replace(APP_URL);
      } catch (error) {
        setInviteError(box, error.message);
      }
    }

    button.addEventListener('click', savePassword);
    [first, second].forEach((input) => input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') savePassword();
    }));
    first.focus();
  }

  async function showInvitation(inviteToken) {
    const box = replaceLoginBox();
    if (!box) return;
    box.innerHTML = `
      <img src="favicon.png?v=dienstpilot-8" alt="DienstPilot Logo" class="login-logo">
      <h1>DienstPilot-Einladung</h1>
      <p>Einladung wird geprüft ...</p>
      <div class="login-error"></div>
    `;

    try {
      const preview = await jsonRequest(API_BASE + '/api/invitations/' + encodeURIComponent(inviteToken), { method: 'GET' });
      const invitation = preview.invitation || {};
      box.innerHTML = `
        <img src="favicon.png?v=dienstpilot-8" alt="DienstPilot Logo" class="login-logo">
        <h1>Einladung annehmen</h1>
        <p>Gib das Einmal-Passwort aus der E-Mail ein.</p>
        <div class="dp-invite-meta"><strong>${invitation.displayName || invitation.username}</strong><br>Benutzername: ${invitation.username}<br>Rolle: ${displayRole(invitation.role)}<br>Gültig bis: ${new Date(invitation.expiresAt).toLocaleString('de-DE')}</div>
        <input id="dpInviteStartPassword" type="password" placeholder="Einmal-Passwort" autocomplete="one-time-code">
        <button id="dpInviteVerify" type="button">Einmal-Passwort prüfen</button>
        <div class="login-error"></div>
      `;

      const input = box.querySelector('#dpInviteStartPassword');
      const button = box.querySelector('#dpInviteVerify');

      async function verify() {
        const startPassword = input.value.trim();
        if (!startPassword) {
          setInviteError(box, 'Bitte das Einmal-Passwort eingeben.');
          return;
        }
        setInviteError(box, 'Einmal-Passwort wird geprüft ...');
        try {
          const data = await jsonRequest(API_BASE + '/api/invitations/' + encodeURIComponent(inviteToken) + '/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startPassword })
          });
          await showPasswordChange(box, data.changeToken, invitation);
        } catch (error) {
          setInviteError(box, error.message);
          input.value = '';
          input.focus();
        }
      }

      button.addEventListener('click', verify);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') verify();
      });
      input.focus();
    } catch (error) {
      box.innerHTML = `
        <img src="favicon.png?v=dienstpilot-8" alt="DienstPilot Logo" class="login-logo">
        <h1>Einladung ungültig</h1>
        <p>Der Link wurde bereits verwendet, ist abgelaufen oder nicht gültig.</p>
        <div class="login-error">${error.message}</div>
        <button type="button" id="dpInviteBack">Zur normalen Anmeldung</button>
      `;
      box.querySelector('#dpInviteBack').addEventListener('click', () => location.replace(APP_URL));
    }
  }

  ready(() => {
    const inviteToken = new URLSearchParams(location.search).get('invite');
    if (inviteToken) {
      showInvitation(inviteToken);
      return;
    }

    enhanceAdminCard();
    [500, 1200, 2500].forEach((delay) => window.setTimeout(enhanceAdminCard, delay));
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-tab="einstellungen"], #loginButton')) {
        window.setTimeout(enhanceAdminCard, 100);
      }
    }, true);
  });
})();
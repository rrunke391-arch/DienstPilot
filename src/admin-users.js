(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const APP_URL = 'https://rrunke391-arch.github.io/DienstPilot/';
  const CARD_ID = 'dienstpilotUserAdminCard';

  function ready(fn) {
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn, { once: true })
      : fn();
  }

  function currentUser() {
    return window.DienstPilotAuth?.getCurrentUser?.() || null;
  }

  function isAdmin() {
    const user = currentUser();
    return user && user.role === 'Administrator';
  }

  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function apiHeaders(extra) {
    const headers = new Headers(extra || {});
    const t = token();
    if (t) headers.set('Authorization', 'Bearer ' + t);
    return headers;
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function displayRole(role) {
    if (role === 'Geschaeftsleitung') return 'Geschäftsleitung';
    return role || '';
  }

  function roleAccess(role) {
    if (role === 'Administrator') return 'Vollzugriff';
    if (role === 'Geschaeftsleitung') return 'Leitung';
    if (role === 'Disposition') return 'Planung';
    return 'Eigener Bereich';
  }

  function createMailText(user, startPassword) {
    return [
      `Hallo ${user.displayName},`,
      '',
      'für dich wurde ein Zugang zu DienstPilot eingerichtet.',
      '',
      `Link: ${APP_URL}`,
      `Benutzername: ${user.username}`,
      `Startpasswort: ${startPassword}`,
      `Rolle: ${displayRole(user.role)}`,
      '',
      'Bitte melde dich damit in DienstPilot an.',
      '',
      'Viele Grüße',
      'Runke'
    ].join('\n');
  }

  function fieldValue(card, selector) {
    return card.querySelector(selector)?.value?.trim() || '';
  }

  function setStatus(card, text, ok = true) {
    const status = card.querySelector('#dpUserAdminStatus');
    if (!status) return;
    status.textContent = text;
    status.style.color = ok ? '#166534' : '#b91c1c';
  }

  async function apiGetUsers() {
    const response = await fetch(API_BASE + '/api/users', {
      method: 'GET',
      headers: apiHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Benutzerliste konnte nicht geladen werden.');
    return Array.isArray(data.users) ? data.users : [];
  }

  async function apiCreateUser(payload) {
    const response = await fetch(API_BASE + '/api/users', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Benutzer konnte nicht gespeichert werden.');
    return data;
  }

  async function apiResetPassword(username, password) {
    const response = await fetch(API_BASE + '/api/users/' + encodeURIComponent(username) + '/password', {
      method: 'PUT',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Passwort konnte nicht geändert werden.');
    return data;
  }

  async function apiDeleteUser(username) {
    const response = await fetch(API_BASE + '/api/users/' + encodeURIComponent(username), {
      method: 'DELETE',
      headers: apiHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Benutzer konnte nicht gelöscht werden.');
    return data;
  }

  function installStyles() {
    if (document.getElementById('dienstpilotUserAdminStyles')) return;

    const style = document.createElement('style');
    style.id = 'dienstpilotUserAdminStyles';
    style.textContent = `
      #${CARD_ID} .dp-user-admin-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 16px;
      }
      #${CARD_ID} .dp-user-admin-grid label {
        display: grid;
        gap: 6px;
        font-weight: 800;
        color: #0f172a;
      }
      #${CARD_ID} .dp-user-admin-grid input,
      #${CARD_ID} .dp-user-admin-grid select,
      #${CARD_ID} textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 11px 12px;
        font: inherit;
        background: white;
        color: #0f172a;
      }
      #${CARD_ID} .dp-user-admin-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 14px;
      }
      #${CARD_ID} .dp-user-admin-status {
        margin-top: 12px;
        font-weight: 800;
        color: #166534;
      }
      #${CARD_ID} .dp-user-admin-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 18px;
      }
      #${CARD_ID} .dp-user-admin-table th,
      #${CARD_ID} .dp-user-admin-table td {
        border-bottom: 1px solid #e2e8f0;
        padding: 9px 8px;
        text-align: left;
        vertical-align: top;
      }
      #${CARD_ID} .dp-user-admin-table th {
        font-size: 12px;
        text-transform: uppercase;
        color: #64748b;
      }
      #${CARD_ID} .dp-user-admin-small {
        font-size: 13px;
        color: #64748b;
      }
      #${CARD_ID} .dp-user-admin-mail {
        margin-top: 16px;
      }
      #${CARD_ID} .dp-user-action-cell {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      @media (max-width: 720px) {
        #${CARD_ID} .dp-user-admin-grid { grid-template-columns: 1fr; }
        #${CARD_ID} .dp-user-admin-table { font-size: 13px; }
      }
    `;
    document.head.appendChild(style);
  }

  async function resetPassword(card, user) {
    const username = user.username || '';
    const password = prompt(`Neues Startpasswort für ${username} eingeben:`);
    if (password === null) return;
    if (password.trim().length < 8) {
      setStatus(card, 'Das neue Passwort muss mindestens 8 Zeichen haben.', false);
      return;
    }

    try {
      await apiResetPassword(username, password.trim());
      const mailText = createMailText(user, password.trim());
      const mailWrap = card.querySelector('#dpUserAdminMailWrap');
      const mailArea = card.querySelector('#dpUserAdminMail');
      const mailLink = card.querySelector('#dpMailInvite');
      mailWrap.classList.remove('hidden');
      mailArea.value = mailText;
      mailLink.href = `mailto:?subject=${encodeURIComponent('DienstPilot Zugang')}&body=${encodeURIComponent(mailText)}`;
      setStatus(card, `Passwort für ${username} wurde zurückgesetzt.`, true);
    } catch (error) {
      setStatus(card, error.message, false);
    }
  }

  async function deleteUser(card, user) {
    const username = user.username || '';
    if (!confirm(`Benutzer ${username} wirklich vom Server löschen?`)) return;

    try {
      await apiDeleteUser(username);
      setStatus(card, `Benutzer ${username} wurde gelöscht.`, true);
      await renderUserRows(card);
    } catch (error) {
      setStatus(card, error.message, false);
    }
  }

  async function renderUserRows(card) {
    const body = card.querySelector('#dpUserAdminRows');
    if (!body) return;

    body.innerHTML = '<tr><td colspan="6">Benutzer werden vom Server geladen ...</td></tr>';

    try {
      const users = await apiGetUsers();
      body.innerHTML = '';

      users.forEach((user) => {
        const username = user.username || '';
        const role = user.role || '';
        const driverProfile = normalize(username) || 'alle';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${username}</strong><div class="dp-user-admin-small">Server-ID: ${user.id || ''}</div></td>
          <td>${user.displayName || ''}</td>
          <td>${displayRole(role)}</td>
          <td>${driverProfile}</td>
          <td>Server aktiv</td>
          <td class="dp-user-action-cell"></td>
        `;

        const actionCell = tr.querySelector('.dp-user-action-cell');
        if (normalize(username) === 'runke') {
          actionCell.textContent = 'Geschützt';
        } else {
          const resetButton = document.createElement('button');
          resetButton.type = 'button';
          resetButton.className = 'btn-secondary';
          resetButton.textContent = 'Passwort zurücksetzen';
          resetButton.addEventListener('click', () => resetPassword(card, user));

          const deleteButton = document.createElement('button');
          deleteButton.type = 'button';
          deleteButton.className = 'btn-secondary';
          deleteButton.textContent = 'Löschen';
          deleteButton.addEventListener('click', () => deleteUser(card, user));

          actionCell.append(resetButton, deleteButton);
        }

        body.appendChild(tr);
      });

      if (users.length === 0) {
        body.innerHTML = '<tr><td colspan="6">Noch keine Benutzer auf dem Server.</td></tr>';
      }
    } catch (error) {
      body.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
      setStatus(card, error.message, false);
    }
  }

  function buildCard() {
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'card';
    card.innerHTML = `
      <h2>👥 Benutzerverwaltung</h2>
      <p class="muted">Diese Benutzerverwaltung arbeitet mit dem DienstPilot-Server. Neue Benutzer werden auf dem VPS gespeichert. Fahrer können gelöscht und Passwörter können zurückgesetzt werden.</p>
      <div class="dp-user-admin-grid">
        <label>Benutzername<input id="dpNewUsername" type="text" placeholder="z. B. Gerding"></label>
        <label>Anzeigename<input id="dpNewDisplayName" type="text" placeholder="z. B. Gerding"></label>
        <label>E-Mail<input id="dpNewEmail" type="email" placeholder="name@example.de"></label>
        <label>Rolle<select id="dpNewRole"><option value="Fahrer">Fahrer</option><option value="Disposition">Disposition</option><option value="Geschaeftsleitung">Geschäftsleitung</option><option value="Administrator">Administrator</option></select></label>
        <label>Zugeordneter Fahrer<input id="dpNewDriver" type="text" placeholder="wird später für Rechte genutzt"></label>
        <label>Startpasswort<input id="dpNewStartPassword" type="text" placeholder="mindestens 8 Zeichen"></label>
      </div>
      <div class="dp-user-admin-actions">
        <button type="button" class="btn-primary" id="dpSaveUser">Auf Server speichern</button>
        <button type="button" class="btn-secondary" id="dpRefreshUsers">Serverliste aktualisieren</button>
      </div>
      <div class="dp-user-admin-status" id="dpUserAdminStatus"></div>
      <div class="dp-user-admin-mail hidden" id="dpUserAdminMailWrap">
        <h3>Einladungstext</h3>
        <textarea id="dpUserAdminMail" rows="10" readonly></textarea>
        <div class="dp-user-admin-actions">
          <button type="button" class="btn-secondary" id="dpCopyInvite">Einladung kopieren</button>
          <a class="btn-secondary" id="dpMailInvite" href="#">E-Mail vorbereiten</a>
        </div>
      </div>
      <table class="dp-user-admin-table">
        <thead><tr><th>Benutzer</th><th>Name</th><th>Rolle</th><th>Fahrer</th><th>Status</th><th>Aktion</th></tr></thead>
        <tbody id="dpUserAdminRows"></tbody>
      </table>
    `;
    return card;
  }

  async function saveUser(card) {
    const username = fieldValue(card, '#dpNewUsername');
    const displayName = fieldValue(card, '#dpNewDisplayName') || username;
    const email = fieldValue(card, '#dpNewEmail');
    const role = fieldValue(card, '#dpNewRole') || 'Fahrer';
    const startPassword = fieldValue(card, '#dpNewStartPassword');

    if (!username || !startPassword) {
      setStatus(card, 'Bitte mindestens Benutzername und Startpasswort eintragen.', false);
      return;
    }

    if (normalize(username) === 'runke') {
      setStatus(card, 'Runke ist der Hauptadministrator und wird nicht überschrieben.', false);
      return;
    }

    if (startPassword.length < 8) {
      setStatus(card, 'Das Startpasswort muss mindestens 8 Zeichen haben.', false);
      return;
    }

    setStatus(card, 'Benutzer wird auf dem Server gespeichert ...', true);

    try {
      const user = { username, displayName, email, role, access: roleAccess(role) };
      await apiCreateUser({ username, displayName, role, password: startPassword });

      const mailText = createMailText(user, startPassword);
      const mailWrap = card.querySelector('#dpUserAdminMailWrap');
      const mailArea = card.querySelector('#dpUserAdminMail');
      const mailLink = card.querySelector('#dpMailInvite');
      mailWrap.classList.remove('hidden');
      mailArea.value = mailText;
      mailLink.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('DienstPilot Zugang')}&body=${encodeURIComponent(mailText)}`;

      card.querySelector('#dpNewStartPassword').value = '';
      setStatus(card, `Benutzer ${username} wurde auf dem Server gespeichert.`, true);
      await renderUserRows(card);
    } catch (error) {
      setStatus(card, error.message, false);
    }
  }

  function render() {
    if (!isAdmin()) return;
    if (document.getElementById(CARD_ID)) return;

    const settingsTab = document.getElementById('tab-einstellungen');
    if (!settingsTab) return;

    installStyles();
    const card = buildCard();
    settingsTab.appendChild(card);

    card.querySelector('#dpSaveUser').addEventListener('click', () => saveUser(card));
    card.querySelector('#dpRefreshUsers').addEventListener('click', () => renderUserRows(card));
    card.querySelector('#dpCopyInvite').addEventListener('click', async () => {
      const text = card.querySelector('#dpUserAdminMail')?.value || '';
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setStatus(card, 'Einladung wurde kopiert.', true);
    });

    renderUserRows(card);
  }

  ready(() => {
    render();

    document.addEventListener('click', (event) => {
      if (event.target.closest && event.target.closest('#loginButton')) setTimeout(render, 700);
      if (event.target.closest && event.target.closest('[data-tab="einstellungen"]')) setTimeout(render, 50);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target && (event.target.id === 'appUsername' || event.target.id === 'appPassword')) {
        setTimeout(render, 700);
      }
    }, true);
  });
})();

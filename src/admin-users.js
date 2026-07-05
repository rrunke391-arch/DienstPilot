(() => {
  'use strict';

  const USERS_KEY = 'dienstpilot_users_v1';
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

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function loadStoredUsers() {
    try {
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return Array.isArray(users) ? users : [];
    } catch {
      return [];
    }
  }

  function saveStoredUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  async function sha256Hex(value) {
    const data = new TextEncoder().encode(String(value || ''));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
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
      @media (max-width: 720px) {
        #${CARD_ID} .dp-user-admin-grid {
          grid-template-columns: 1fr;
        }
        #${CARD_ID} .dp-user-admin-table {
          font-size: 13px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function roleAccess(role) {
    if (role === 'Administrator') return 'Vollzugriff';
    if (role === 'Geschäftsleitung') return 'Leitung';
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
      `Rolle: ${user.role}`,
      '',
      'Das Startpasswort ist nur für die erste Anmeldung gedacht.',
      'Nach dem ersten Login musst du ein eigenes Passwort festlegen.',
      '',
      'Viele Grüße',
      'Runke'
    ].join('\n');
  }

  function fieldValue(card, selector) {
    return card.querySelector(selector)?.value?.trim() || '';
  }

  function renderUserRows(card) {
    const body = card.querySelector('#dpUserAdminRows');
    if (!body) return;

    const authUsers = window.DienstPilotAuth?.getAllUsers?.() || [];
    const stored = loadStoredUsers();
    const storedMap = new Map(stored.map((user) => [normalize(user.username), user]));

    body.innerHTML = '';
    authUsers.forEach((user) => {
      const storedUser = storedMap.get(normalize(user.username));
      const email = storedUser?.email || '';
      const needsChange = user.mustChangePassword || Boolean(user.startPasswordHash);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${user.username}</strong><div class="dp-user-admin-small">${email || 'Keine E-Mail'}</div></td>
        <td>${user.displayName || ''}</td>
        <td>${user.role || ''}</td>
        <td>${user.driverProfile || 'alle'}</td>
        <td>${needsChange ? 'Startpasswort aktiv' : 'Aktiv'}</td>
        <td></td>
      `;

      const actionCell = tr.lastElementChild;
      if (normalize(user.username) !== 'runke') {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn-secondary';
        deleteButton.textContent = 'Löschen';
        deleteButton.addEventListener('click', () => {
          if (!confirm(`Benutzer ${user.username} löschen?`)) return;
          saveStoredUsers(loadStoredUsers().filter((item) => normalize(item.username) !== normalize(user.username)));
          renderUserRows(card);
        });
        actionCell.appendChild(deleteButton);
      } else {
        actionCell.textContent = 'Geschützt';
      }

      body.appendChild(tr);
    });
  }

  function buildCard() {
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'card';
    card.innerHTML = `
      <h2>👥 Benutzerverwaltung</h2>
      <p class="muted">Nur Administratoren können Benutzer anlegen. Neue Benutzer erhalten ein Startpasswort und müssen beim ersten Login ein eigenes Passwort festlegen.</p>
      <div class="dp-user-admin-grid">
        <label>Benutzername<input id="dpNewUsername" type="text" placeholder="z. B. Gerding"></label>
        <label>Anzeigename<input id="dpNewDisplayName" type="text" placeholder="z. B. Gerding"></label>
        <label>E-Mail<input id="dpNewEmail" type="email" placeholder="name@example.de"></label>
        <label>Rolle<select id="dpNewRole"><option>Fahrer</option><option>Disposition</option><option>Geschäftsleitung</option><option>Administrator</option></select></label>
        <label>Zugeordneter Fahrer<input id="dpNewDriver" type="text" placeholder="z. B. gerding oder alle"></label>
        <label>Startpasswort<input id="dpNewStartPassword" type="text" placeholder="z. B. Gerding-Start-DP2026!"></label>
      </div>
      <div class="dp-user-admin-actions">
        <button type="button" class="btn-primary" id="dpSaveUser">Benutzer speichern</button>
        <button type="button" class="btn-secondary" id="dpRefreshUsers">Liste aktualisieren</button>
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
    const driver = fieldValue(card, '#dpNewDriver') || (role === 'Fahrer' ? normalize(displayName) : 'alle');
    const startPassword = fieldValue(card, '#dpNewStartPassword');
    const status = card.querySelector('#dpUserAdminStatus');

    if (!username || !startPassword) {
      status.textContent = 'Bitte mindestens Benutzername und Startpasswort eintragen.';
      status.style.color = '#b91c1c';
      return;
    }

    if (normalize(username) === 'runke') {
      status.textContent = 'Runke ist der feste Hauptadministrator und kann hier nicht überschrieben werden.';
      status.style.color = '#b91c1c';
      return;
    }

    if (startPassword.length < 8) {
      status.textContent = 'Das Startpasswort muss mindestens 8 Zeichen haben.';
      status.style.color = '#b91c1c';
      return;
    }

    const startPasswordHash = await sha256Hex(startPassword);
    const users = loadStoredUsers();
    const user = {
      username,
      displayName,
      email,
      role,
      functionTitle: '',
      driverProfile: driver,
      access: roleAccess(role),
      passwordHash: '',
      startPasswordHash,
      mustChangePassword: true,
      isBuiltin: false
    };

    const index = users.findIndex((item) => normalize(item.username) === normalize(username));
    if (index >= 0) users[index] = user;
    else users.push(user);

    saveStoredUsers(users);

    const mailText = createMailText(user, startPassword);
    const mailWrap = card.querySelector('#dpUserAdminMailWrap');
    const mailArea = card.querySelector('#dpUserAdminMail');
    const mailLink = card.querySelector('#dpMailInvite');
    mailWrap.classList.remove('hidden');
    mailArea.value = mailText;
    mailLink.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('DienstPilot Zugang')}&body=${encodeURIComponent(mailText)}`;

    status.textContent = `Benutzer ${username} wurde gespeichert. Einladungstext ist vorbereitet.`;
    status.style.color = '#166534';
    card.querySelector('#dpNewStartPassword').value = '';
    renderUserRows(card);
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
      const status = card.querySelector('#dpUserAdminStatus');
      status.textContent = 'Einladung wurde kopiert.';
      status.style.color = '#166534';
    });

    renderUserRows(card);
  }

  ready(() => {
    render();

    document.addEventListener('click', (event) => {
      if (event.target.closest && event.target.closest('#loginButton')) {
        setTimeout(render, 500);
      }
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target && (event.target.id === 'appUsername' || event.target.id === 'appPassword')) {
        setTimeout(render, 500);
      }
    }, true);

    document.addEventListener('click', (event) => {
      if (event.target.closest && event.target.closest('[data-tab="einstellungen"]')) {
        setTimeout(render, 50);
      }
    });
  });
})();

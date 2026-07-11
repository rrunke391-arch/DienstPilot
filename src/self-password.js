(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const BUTTON_ID = 'dpSelfPasswordButton';
  const MODAL_ID = 'dpSelfPasswordModal';
  const STYLE_ID = 'dpSelfPasswordStyle';

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dp-self-password-btn{border:1px solid rgba(255,255,255,.32);border-radius:999px;padding:9px 14px;background:transparent;color:#fff;font-weight:900;cursor:pointer}
      .dp-self-password-modal{position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:18px}
      .dp-self-password-card{width:min(460px,100%);background:#fff;border-radius:22px;padding:22px;box-shadow:0 24px 70px rgba(2,6,23,.35)}
      .dp-self-password-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
      .dp-self-password-head h2{margin:0;font-size:24px;color:#0f172a}
      .dp-self-password-close{border:0;background:#eef2f7;border-radius:999px;width:38px;height:38px;font-size:24px;cursor:pointer;color:#0f172a}
      .dp-self-password-field{display:block;margin:12px 0}
      .dp-self-password-field>span{display:block;font-weight:800;color:#334155;margin-bottom:6px}
      .dp-self-password-input-wrap{display:flex;align-items:stretch;width:100%;border:1px solid #cbd5e1;border-radius:12px;background:#fff;overflow:hidden}
      .dp-self-password-input-wrap:focus-within{border-color:#64748b;box-shadow:0 0 0 3px rgba(100,116,139,.15)}
      .dp-self-password-input-wrap input{min-width:0;flex:1;width:100%;box-sizing:border-box;padding:12px 14px;border:0;outline:0;font-size:16px;background:transparent;color:#0f172a}
      .dp-self-password-eye{flex:0 0 48px;border:0;border-left:1px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center}
      .dp-self-password-eye:hover,.dp-self-password-eye:focus-visible{background:#e2e8f0;outline:0}
      .dp-self-password-note{font-size:13px;color:#64748b;margin:4px 0 12px}
      .dp-self-password-message{min-height:22px;font-weight:800;margin:10px 0;color:#b91c1c}
      .dp-self-password-message.ok{color:#047857}
      .dp-self-password-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
      .dp-self-password-actions button{padding:11px 16px;border-radius:12px;font-weight:900;cursor:pointer}
      .dp-self-password-cancel{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      .dp-self-password-save{border:1px solid #020617;background:#020617;color:#fff}
      .dp-self-password-save:disabled{opacity:.6;cursor:wait}
      @media(max-width:700px){.dp-self-password-btn{width:100%;text-align:center}.dp-self-password-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function clearSessionAndReload() {
    sessionStorage.removeItem('dienstpilot_unlocked');
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem('dienstpilot_role');
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
    document.body.classList.remove('modal-open');
  }

  function wirePasswordEye(button, input) {
    if (!button || !input) return;
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? '🙈' : '👁';
      button.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
      button.setAttribute('title', show ? 'Passwort verbergen' : 'Passwort anzeigen');
      button.setAttribute('aria-pressed', show ? 'true' : 'false');
      input.focus({ preventScroll: true });
    });
  }

  function openModal() {
    closeModal();
    addStyles();

    const user = readUser();
    if (!user || !token()) return;

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'dp-self-password-modal';
    modal.innerHTML = `
      <div class="dp-self-password-card" role="dialog" aria-modal="true" aria-labelledby="dpSelfPasswordTitle">
        <div class="dp-self-password-head">
          <div><h2 id="dpSelfPasswordTitle">Eigenes Passwort ändern</h2><div class="dp-self-password-note">Benutzer: ${String(user.displayName || user.username || '').replace(/[&<>"']/g, '')}</div></div>
          <button type="button" class="dp-self-password-close" aria-label="Schließen">×</button>
        </div>
        <label class="dp-self-password-field">
          <span>Aktuelles Passwort</span>
          <div class="dp-self-password-input-wrap">
            <input id="dpCurrentPassword" type="password" autocomplete="current-password">
            <button type="button" class="dp-self-password-eye" data-for="dpCurrentPassword" aria-label="Passwort anzeigen" title="Passwort anzeigen" aria-pressed="false">👁</button>
          </div>
        </label>
        <label class="dp-self-password-field">
          <span>Neues Passwort</span>
          <div class="dp-self-password-input-wrap">
            <input id="dpNewPassword" type="password" autocomplete="new-password" minlength="8">
            <button type="button" class="dp-self-password-eye" data-for="dpNewPassword" aria-label="Passwort anzeigen" title="Passwort anzeigen" aria-pressed="false">👁</button>
          </div>
        </label>
        <label class="dp-self-password-field">
          <span>Neues Passwort wiederholen</span>
          <div class="dp-self-password-input-wrap">
            <input id="dpNewPasswordRepeat" type="password" autocomplete="new-password" minlength="8">
            <button type="button" class="dp-self-password-eye" data-for="dpNewPasswordRepeat" aria-label="Passwort anzeigen" title="Passwort anzeigen" aria-pressed="false">👁</button>
          </div>
        </label>
        <div class="dp-self-password-note">Das neue Passwort muss mindestens 8 Zeichen haben.</div>
        <div id="dpSelfPasswordMessage" class="dp-self-password-message" aria-live="polite"></div>
        <div class="dp-self-password-actions">
          <button type="button" class="dp-self-password-cancel">Abbrechen</button>
          <button type="button" class="dp-self-password-save">Passwort speichern</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const currentInput = modal.querySelector('#dpCurrentPassword');
    const newInput = modal.querySelector('#dpNewPassword');
    const repeatInput = modal.querySelector('#dpNewPasswordRepeat');
    const message = modal.querySelector('#dpSelfPasswordMessage');
    const saveButton = modal.querySelector('.dp-self-password-save');

    modal.querySelectorAll('.dp-self-password-eye').forEach((button) => {
      wirePasswordEye(button, modal.querySelector('#' + button.dataset.for));
    });

    modal.querySelector('.dp-self-password-close')?.addEventListener('click', closeModal);
    modal.querySelector('.dp-self-password-cancel')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });

    async function submit() {
      const currentPassword = currentInput.value;
      const newPassword = newInput.value;
      const repeated = repeatInput.value;
      message.classList.remove('ok');
      message.textContent = '';

      if (!currentPassword) {
        message.textContent = 'Bitte das aktuelle Passwort eingeben.';
        currentInput.focus();
        return;
      }
      if (newPassword.length < 8) {
        message.textContent = 'Das neue Passwort muss mindestens 8 Zeichen haben.';
        newInput.focus();
        return;
      }
      if (newPassword !== repeated) {
        message.textContent = 'Die beiden neuen Passwörter stimmen nicht überein.';
        repeatInput.focus();
        return;
      }
      if (currentPassword === newPassword) {
        message.textContent = 'Das neue Passwort muss sich vom bisherigen Passwort unterscheiden.';
        newInput.focus();
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = 'Speichere…';

      try {
        const response = await fetch(API_BASE + '/api/account/password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token()
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Das Passwort konnte nicht geändert werden.');
        }

        message.classList.add('ok');
        message.textContent = 'Passwort geändert. Du wirst jetzt abgemeldet.';
        window.setTimeout(clearSessionAndReload, 1400);
      } catch (error) {
        message.textContent = error.message || 'Das Passwort konnte nicht geändert werden.';
        saveButton.disabled = false;
        saveButton.textContent = 'Passwort speichern';
      }
    }

    saveButton.addEventListener('click', submit);
    [currentInput, newInput, repeatInput].forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void submit();
        }
      });
    });

    currentInput.focus();
  }

  function installButton() {
    if (!readUser() || !token()) return;
    if (document.getElementById(BUTTON_ID)) return;

    const area = document.querySelector('.dp-signout-area');
    const signout = document.getElementById('dpSignoutButton');
    if (!area || !signout) return;

    addStyles();
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'dp-self-password-btn';
    button.textContent = 'Passwort ändern';
    button.addEventListener('click', openModal);
    area.insertBefore(button, signout);
  }

  function install() {
    installButton();
    window.setTimeout(installButton, 500);
    window.setTimeout(installButton, 1500);
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#loginButton')) {
        [500, 1200].forEach((delay) => window.setTimeout(installButton, delay));
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
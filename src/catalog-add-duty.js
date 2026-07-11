(() => {
  'use strict';

  const API = 'https://api.dienstpilot-runke.de/api/data/catalog_custom';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const BUTTON_ID = 'dpCatalogAddDuty';
  const MODAL_ID = 'dpCatalogEditModal';
  const STYLE_ID = 'dpCatalogAddDutyStyle';
  const RESERVED_NAMES = new Set(['__proto__', 'prototype', 'constructor']);

  function readJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function currentUser() {
    return readJson(sessionStorage, USER_KEY, {}) || {};
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function cleanDutyName(value) {
    return String(value || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30);
  }

  function allowed() {
    const user = currentUser();
    const role = String(user.role || '').trim();
    return (role === 'Administrator' && normalize(user.username) === 'runke')
      || role === 'Geschaeftsleitung'
      || role === 'Geschäftsleitung';
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{white-space:nowrap}
      .dp-cat-number-help{font-size:12px;color:#64748b;font-weight:700}
      .dp-cat-add-message{min-height:24px;margin-top:12px;font-weight:800;color:#b91c1c}
      .dp-cat-add-message.ok{color:#047857}
    `;
    document.head.appendChild(style);
  }

  function saveLocal() {
    try {
      const main = readJson(localStorage, MAIN_KEY, {});
      localStorage.setItem(MAIN_KEY, JSON.stringify({ ...main, customCatalog }));
    } catch {
      // Der Server bleibt die zentrale Quelle.
    }
  }

  async function saveServer() {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) throw new Error('Bitte erneut anmelden.');
    if (!allowed()) throw new Error('Keine Berechtigung zum Hinzufügen von Diensten.');

    const response = await fetch(API, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(customCatalog || {})
    });

    const text = await response.text().catch(() => '');
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) throw new Error(data.error || 'Der neue Dienst konnte nicht gespeichert werden.');
    saveLocal();
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
    document.body.classList.remove('modal-open');
  }

  function validTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
  }

  function openModal() {
    if (!allowed()) return;
    closeModal();

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'dp-cat-modal';
    modal.innerHTML = `
      <div class="dp-cat-box" role="dialog" aria-modal="true" aria-labelledby="dpCatAddTitle">
        <div class="dp-cat-head">
          <div>
            <h2 id="dpCatAddTitle">Dienst hinzufügen</h2>
            <div class="muted">Der neue Dienst wird zentral für alle Benutzer gespeichert.</div>
          </div>
          <button class="dp-cat-close" type="button" aria-label="Schließen">×</button>
        </div>
        <div class="dp-cat-grid">
          <label class="dp-cat-field">
            Dienstnummer oder Bezeichnung
            <input id="dpCatNumber" type="text" maxlength="30" placeholder="z. B. 3026 oder Reserve" autocomplete="off">
            <span class="dp-cat-number-help">Zahlen oder Text, maximal 30 Zeichen</span>
          </label>
          <label class="dp-cat-field">
            Gültige Tage
            <select id="dpCatDays">
              <option value="Mo-Fr">Montag bis Freitag</option>
              <option value="Mo-Do">Montag bis Donnerstag</option>
              <option value="Fr">Freitag</option>
              <option value="Sa">Samstag</option>
              <option value="So">Sonntag</option>
              <option value="Mo-Sa">Montag bis Samstag</option>
            </select>
          </label>
          <label class="dp-cat-field">Beginn<input id="dpCatStart" type="time" value="06:00"></label>
          <label class="dp-cat-field">Ende<input id="dpCatEnd" type="time" value="14:00"></label>
          <label class="dp-cat-field">Freitag Ende<input id="dpCatFriday" type="time" value=""></label>
        </div>
        <div class="muted" style="margin-top:12px">Eine abweichende Freitag-Endzeit ist optional.</div>
        <div id="dpCatAddMessage" class="dp-cat-add-message" role="status" aria-live="polite"></div>
        <div class="dp-cat-actions">
          <button class="dp-cat-cancel" type="button">Abbrechen</button>
          <button class="dp-cat-save" type="button">Dienst speichern</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const numberInput = modal.querySelector('#dpCatNumber');
    const message = modal.querySelector('#dpCatAddMessage');
    const saveButton = modal.querySelector('.dp-cat-save');

    numberInput.addEventListener('input', () => {
      const cleaned = String(numberInput.value || '').replace(/[\r\n\t]+/g, ' ').slice(0, 30);
      if (numberInput.value !== cleaned) numberInput.value = cleaned;
    });

    modal.querySelector('.dp-cat-close').addEventListener('click', closeModal);
    modal.querySelector('.dp-cat-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });

    saveButton.addEventListener('click', async () => {
      const number = cleanDutyName(numberInput.value);
      const days = modal.querySelector('#dpCatDays').value;
      const start = modal.querySelector('#dpCatStart').value;
      const end = modal.querySelector('#dpCatEnd').value;
      const fridayEnd = modal.querySelector('#dpCatFriday').value;

      if (!number) {
        message.textContent = 'Bitte eine Dienstnummer oder Bezeichnung eingeben.';
        numberInput.focus();
        return;
      }
      if (RESERVED_NAMES.has(normalize(number))) {
        message.textContent = 'Diese Bezeichnung kann nicht verwendet werden.';
        numberInput.focus();
        return;
      }
      if (typeof getCatalog !== 'function' || typeof renderAll !== 'function') {
        message.textContent = 'Der Dienstkatalog ist noch nicht vollständig geladen.';
        return;
      }

      const catalog = getCatalog();
      const existingName = Object.keys(catalog).find((key) => normalize(key) === normalize(number));
      if (existingName) {
        message.textContent = `Dienst ${existingName} ist bereits vorhanden.`;
        numberInput.focus();
        return;
      }
      if (!validTime(start) || !validTime(end) || (fridayEnd && !validTime(fridayEnd))) {
        message.textContent = 'Bitte die Uhrzeiten vollständig einstellen.';
        return;
      }

      const previous = customCatalog[number];
      customCatalog[number] = {
        start,
        end,
        days,
        fridayEnd,
        varianten: {}
      };

      saveButton.disabled = true;
      message.className = 'dp-cat-add-message';
      message.textContent = 'Dienst wird gespeichert …';

      try {
        await saveServer();
        message.className = 'dp-cat-add-message ok';
        message.textContent = `Dienst ${number} wurde hinzugefügt.`;
        window.setTimeout(() => {
          closeModal();
          renderAll();
          const card = document.querySelector(`#catalogGrid .catalog-card[data-cat-number="${CSS.escape(number)}"]`);
          card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
      } catch (error) {
        if (previous === undefined) delete customCatalog[number];
        else customCatalog[number] = previous;
        message.textContent = error.message;
        saveButton.disabled = false;
      }
    });

    numberInput.focus();
  }

  function installButton() {
    addStyle();
    const existing = document.getElementById(BUTTON_ID);
    if (!allowed()) {
      existing?.remove();
      return false;
    }
    if (existing) return true;

    const toolbar = document.querySelector('#tab-katalog .toolbar');
    if (!toolbar) return false;
    let group = toolbar.querySelector('.toolbar-group');
    if (!group) {
      group = document.createElement('div');
      group.className = 'toolbar-group';
      toolbar.prepend(group);
    }

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'btn-primary dp-catalog-add';
    button.textContent = '＋ Dienst hinzufügen';
    button.addEventListener('click', openModal);
    group.prepend(button);
    return true;
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton')) {
      window.setTimeout(installButton, 500);
      window.setTimeout(installButton, 1200);
    }
  }, true);

  [0, 200, 700, 1600, 3000].forEach((delay) => window.setTimeout(installButton, delay));
  window.setInterval(installButton, 2500);
})();
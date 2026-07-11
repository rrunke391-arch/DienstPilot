(() => {
  'use strict';

  const API = 'https://api.dienstpilot-runke.de/api/data/catalog_custom';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const BUTTON_ID = 'dpCatalogAddDutyStable';
  const LEGACY_ID = 'dpCatalogAddDuty';
  const MODAL_ID = 'dpCatalogAddDutyStableModal';
  const STYLE_ID = 'dpCatalogAddDutyStableStyle';
  const RESERVED = new Set(['__proto__', 'prototype', 'constructor']);

  function readJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function currentUser() {
    return readJson(sessionStorage, USER_KEY, {}) || {};
  }

  function canUse() {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return false;

    const user = currentUser();
    const username = normalize(user.username || user.displayName);
    const role = normalize(user.role || sessionStorage.getItem(ROLE_KEY));

    return username === 'runke'
      || role === 'administrator'
      || role === 'admin'
      || role === 'geschaeftsleitung'
      || role === 'geschäftsleitung';
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dp-add-duty-legacy-sentinel{display:none!important}
      #${BUTTON_ID}{display:inline-flex!important;align-items:center;justify-content:center;white-space:nowrap;visibility:visible!important;opacity:1!important}
      #${BUTTON_ID}[hidden]{display:none!important}
      .dp-add-stable-modal{position:fixed;inset:0;z-index:100500;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.74)}
      .dp-add-stable-box{width:min(650px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:22px;border-radius:22px;background:#fff;box-shadow:0 28px 80px rgba(2,6,23,.45)}
      .dp-add-stable-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.dp-add-stable-head h2{margin:0}
      .dp-add-stable-close{width:40px;height:40px;border:0;border-radius:999px;font-size:24px;cursor:pointer}
      .dp-add-stable-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}
      .dp-add-stable-field{display:grid;gap:7px;font-weight:800;color:#334155}.dp-add-stable-field>input,.dp-add-stable-field>select{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd5e1;border-radius:12px;font:inherit}
      .dp-add-time{display:grid;gap:8px;padding:10px 11px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc}
      .dp-add-time-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.dp-add-time-value{min-width:72px;padding:6px 10px;border-radius:10px;background:#0f172a;color:#fff;text-align:center;font-size:18px;font-weight:900;font-variant-numeric:tabular-nums}
      .dp-add-time-controls{display:grid;grid-template-columns:42px minmax(0,1fr) 42px;gap:8px;align-items:center}.dp-add-time-controls button{width:42px;height:38px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font-size:21px;font-weight:900;cursor:pointer}.dp-add-time-controls input{width:100%;padding:0;border:0;background:transparent}
      .dp-add-time-marks{display:flex;justify-content:space-between;color:#64748b;font-size:11px;font-weight:700}.dp-add-friday-toggle{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800}
      .dp-add-stable-message{min-height:24px;margin-top:12px;font-weight:800;color:#b91c1c}.dp-add-stable-message.ok{color:#047857}
      .dp-add-stable-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:8px;flex-wrap:wrap}.dp-add-stable-actions button{padding:11px 15px;border-radius:12px;font-weight:900;cursor:pointer}.dp-add-stable-save{border:1px solid #020617;background:#020617;color:#fff}.dp-add-stable-cancel{border:1px solid #cbd5e1;background:#fff}
      @media(max-width:620px){.dp-add-stable-grid{grid-template-columns:1fr}.dp-add-stable-actions{display:grid}.dp-add-stable-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function neutralizeLegacyButton() {
    let legacy = document.getElementById(LEGACY_ID);
    if (legacy && legacy.dataset.stableSentinel !== '1') legacy.remove();
    legacy = document.getElementById(LEGACY_ID);
    if (!legacy) {
      legacy = document.createElement('button');
      legacy.id = LEGACY_ID;
      legacy.type = 'button';
      legacy.dataset.stableSentinel = '1';
      legacy.className = 'dp-add-duty-legacy-sentinel';
      legacy.hidden = true;
      legacy.setAttribute('aria-hidden', 'true');
      document.body.appendChild(legacy);
    }
  }

  function ensureButton() {
    addStyle();
    neutralizeLegacyButton();

    const toolbar = document.querySelector('#tab-katalog .toolbar');
    const upload = document.getElementById('uploadDienstkarteCatalog');
    const group = upload?.closest('.toolbar-group') || toolbar?.querySelector('.toolbar-group');
    if (!group) return false;

    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.className = 'btn-primary dp-catalog-add';
      button.textContent = '＋ Dienst hinzufügen';
      button.addEventListener('click', openModal);
    }

    if (button.parentElement !== group) group.insertBefore(button, upload || group.firstChild);

    const permitted = canUse();
    button.hidden = !permitted;
    button.disabled = !permitted;
    button.style.setProperty('display', permitted ? 'inline-flex' : 'none', 'important');
    button.setAttribute('aria-hidden', permitted ? 'false' : 'true');
    return permitted;
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
    document.body.classList.remove('modal-open');
  }

  function toMinutes(value) {
    const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return 0;
    return Math.max(0, Math.min(1439, Number(match[1]) * 60 + Number(match[2])));
  }

  function toTime(value) {
    const minutes = Math.max(0, Math.min(1439, Number(value) || 0));
    return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  }

  function timeControl(id, label, value, optional = false) {
    const enabled = !optional || Boolean(value);
    const initial = value || '14:00';
    return `
      <div class="dp-add-stable-field" data-time-field="${id}">
        <span>${label}</span>
        <div class="dp-add-time${enabled ? '' : ' is-disabled'}">
          ${optional ? '<label class="dp-add-friday-toggle"><input type="checkbox" class="dp-add-time-enabled"' + (enabled ? ' checked' : '') + '> Abweichende Freitag-Endzeit verwenden</label>' : ''}
          <div class="dp-add-time-head"><span>Minutengenaue Skala</span><output class="dp-add-time-value">${enabled ? initial : 'keine'}</output></div>
          <div class="dp-add-time-controls"><button type="button" class="dp-add-time-minus">−</button><input id="${id}" type="range" min="0" max="1439" step="1" value="${toMinutes(initial)}"><button type="button" class="dp-add-time-plus">+</button></div>
          <div class="dp-add-time-marks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
        </div>
      </div>`;
  }

  function wireTime(modal, id, optional = false) {
    const field = modal.querySelector(`[data-time-field="${id}"]`);
    const range = field?.querySelector(`#${id}`);
    const output = field?.querySelector('.dp-add-time-value');
    const minus = field?.querySelector('.dp-add-time-minus');
    const plus = field?.querySelector('.dp-add-time-plus');
    const enabled = field?.querySelector('.dp-add-time-enabled');
    if (!range || !output || !minus || !plus) return () => '';

    const render = () => {
      const active = !enabled || enabled.checked;
      range.disabled = !active;
      minus.disabled = !active;
      plus.disabled = !active;
      output.textContent = active ? toTime(range.value) : 'keine';
    };
    const move = (delta) => {
      if (range.disabled) return;
      range.value = String(Math.max(0, Math.min(1439, Number(range.value) + delta)));
      render();
    };
    range.addEventListener('input', render);
    minus.addEventListener('click', () => move(-1));
    plus.addEventListener('click', () => move(1));
    enabled?.addEventListener('change', render);
    render();
    return () => (!optional || enabled?.checked ? toTime(range.value) : '');
  }

  function cleanName(value) {
    return String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
  }

  function localSave() {
    try {
      const state = readJson(localStorage, MAIN_KEY, {});
      localStorage.setItem(MAIN_KEY, JSON.stringify({ ...state, customCatalog }));
    } catch {}
  }

  async function serverSave() {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) throw new Error('Bitte erneut anmelden.');
    const response = await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(customCatalog || {})
    });
    const text = await response.text().catch(() => '');
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) throw new Error(data.error || 'Der neue Dienst konnte nicht gespeichert werden.');
    localSave();
  }

  function openModal() {
    if (!canUse()) return;
    if (typeof getCatalog !== 'function' || typeof renderAll !== 'function' || typeof customCatalog === 'undefined') {
      window.setTimeout(openModal, 300);
      return;
    }

    closeModal();
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'dp-add-stable-modal';
    modal.innerHTML = `
      <div class="dp-add-stable-box" role="dialog" aria-modal="true" aria-labelledby="dpAddStableTitle">
        <div class="dp-add-stable-head"><div><h2 id="dpAddStableTitle">Dienst hinzufügen</h2><div class="muted">Der neue Dienst wird zentral für alle Benutzer gespeichert.</div></div><button class="dp-add-stable-close" type="button" aria-label="Schließen">×</button></div>
        <div class="dp-add-stable-grid">
          <label class="dp-add-stable-field">Dienstnummer oder Bezeichnung<input id="dpAddDutyName" type="text" maxlength="30" placeholder="z. B. 3026 oder Reserve" autocomplete="off"><small>Zahlen oder Text, maximal 30 Zeichen</small></label>
          <label class="dp-add-stable-field">Gültige Tage<select id="dpAddDutyDays"><option value="Mo-Fr">Montag bis Freitag</option><option value="Mo-Do">Montag bis Donnerstag</option><option value="Fr">Freitag</option><option value="Sa">Samstag</option><option value="So">Sonntag</option><option value="Mo-Sa">Montag bis Samstag</option></select></label>
          ${timeControl('dpAddStart', 'Beginn', '06:00')}
          ${timeControl('dpAddEnd', 'Ende', '14:00')}
          ${timeControl('dpAddFriday', 'Freitag Ende', '', true)}
        </div>
        <div id="dpAddStableMessage" class="dp-add-stable-message" role="status" aria-live="polite"></div>
        <div class="dp-add-stable-actions"><button class="dp-add-stable-cancel" type="button">Abbrechen</button><button class="dp-add-stable-save" type="button">Dienst speichern</button></div>
      </div>`;
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const getStart = wireTime(modal, 'dpAddStart');
    const getEnd = wireTime(modal, 'dpAddEnd');
    const getFriday = wireTime(modal, 'dpAddFriday', true);
    const nameInput = modal.querySelector('#dpAddDutyName');
    const message = modal.querySelector('#dpAddStableMessage');
    const save = modal.querySelector('.dp-add-stable-save');

    modal.querySelector('.dp-add-stable-close').addEventListener('click', closeModal);
    modal.querySelector('.dp-add-stable-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });

    save.addEventListener('click', async () => {
      const name = cleanName(nameInput.value);
      const normalizedName = normalize(name);
      if (!name) {
        message.textContent = 'Bitte eine Dienstnummer oder Bezeichnung eingeben.';
        nameInput.focus();
        return;
      }
      if (RESERVED.has(normalizedName)) {
        message.textContent = 'Diese Bezeichnung kann nicht verwendet werden.';
        return;
      }
      const existing = Object.keys(getCatalog()).find((key) => normalize(key) === normalizedName);
      if (existing) {
        message.textContent = `Dienst ${existing} ist bereits vorhanden.`;
        return;
      }

      const previous = customCatalog[name];
      customCatalog[name] = {
        start: getStart(),
        end: getEnd(),
        days: modal.querySelector('#dpAddDutyDays').value,
        fridayEnd: getFriday(),
        varianten: {}
      };
      save.disabled = true;
      message.className = 'dp-add-stable-message';
      message.textContent = 'Dienst wird gespeichert …';

      try {
        await serverSave();
        message.className = 'dp-add-stable-message ok';
        message.textContent = `Dienst ${name} wurde hinzugefügt.`;
        window.setTimeout(() => {
          closeModal();
          renderAll();
        }, 450);
      } catch (error) {
        if (previous === undefined) delete customCatalog[name]; else customCatalog[name] = previous;
        message.textContent = error.message;
        save.disabled = false;
      }
    });

    nameInput.focus();
  }

  function refresh() {
    ensureButton();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="katalog"]')) {
      [0, 100, 350, 800, 1500, 3000].forEach((delay) => window.setTimeout(refresh, delay));
    }
  }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  [0, 200, 600, 1200, 2500, 5000].forEach((delay) => window.setTimeout(refresh, delay));
  window.setInterval(refresh, 2000);
})();
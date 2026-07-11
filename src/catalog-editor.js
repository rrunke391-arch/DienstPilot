(() => {
  'use strict';

  const API = 'https://api.dienstpilot-runke.de/api/data/catalog_custom';
  const TOKEN = 'dienstpilot_api_token';
  const USER = 'dienstpilot_user';
  const MAIN = 'lenkRuhezeitenRunke20260413';
  let patched = false;
  let loadedToken = '';
  let saveTimer = null;

  function json(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch { return fallback; }
  }

  function user() { return json(sessionStorage, USER, {}) || {}; }
  function token() { return sessionStorage.getItem(TOKEN) || ''; }
  function norm(value) { return String(value || '').trim().toLowerCase(); }

  function allowed() {
    const u = user();
    const role = String(u.role || '').trim();
    return (role === 'Administrator' && norm(u.username) === 'runke')
      || role === 'Geschaeftsleitung'
      || role === 'Geschäftsleitung';
  }

  function addStyle() {
    if (document.getElementById('dpCatalogEditorStyle')) return;
    const style = document.createElement('style');
    style.id = 'dpCatalogEditorStyle';
    style.textContent = `
      #dpCatalogEditorInfo{margin:14px 0;padding:12px 14px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;color:#334155;font-weight:800}
      #dpCatalogEditorInfo.ok{border-color:#86efac;background:#f0fdf4;color:#166534}
      #dpCatalogEditorInfo.error{border-color:#fecaca;background:#fef2f2;color:#991b1b}
      body.dp-catalog-readonly #catalogGrid [data-cat-field]{pointer-events:none!important;opacity:.7;background:#f1f5f9!important}
      body.dp-catalog-readonly #catalogGrid .delete-template,
      body.dp-catalog-readonly #catalogGrid .catalog-card-review,
      body.dp-catalog-readonly #catalogGrid .cat-review-note-edit,
      body.dp-catalog-readonly #uploadDienstkarteCatalog{display:none!important}
      .dp-cat-modal{position:fixed;inset:0;z-index:100300;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:18px}
      .dp-cat-box{width:min(620px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#fff;border-radius:22px;padding:22px;box-shadow:0 28px 80px rgba(2,6,23,.4)}
      .dp-cat-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.dp-cat-head h2{margin:0}.dp-cat-close{border:0;border-radius:999px;width:40px;height:40px;font-size:24px;cursor:pointer}
      .dp-cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:18px}.dp-cat-field{display:grid;gap:6px;font-weight:800;color:#334155}.dp-cat-field input,.dp-cat-field select{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd5e1;border-radius:12px;font:inherit}
      .dp-cat-check{display:flex;gap:9px;align-items:center;margin:14px 0;font-weight:800}.dp-cat-message{min-height:24px;font-weight:800;color:#b91c1c}.dp-cat-message.ok{color:#047857}
      .dp-cat-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}.dp-cat-actions button{padding:11px 15px;border-radius:12px;font-weight:900;cursor:pointer}.dp-cat-save{background:#020617;color:#fff;border:1px solid #020617}.dp-cat-cancel{background:#fff;border:1px solid #cbd5e1}.dp-cat-reset{margin-right:auto;background:#fff;border:1px solid #fecaca;color:#b91c1c}
      @media(max-width:620px){.dp-cat-grid{grid-template-columns:1fr}.dp-cat-actions{display:grid}.dp-cat-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function info(text, state) {
    let el = document.getElementById('dpCatalogEditorInfo');
    const card = document.querySelector('#tab-katalog > .card');
    if (!el && card) {
      el = document.createElement('div');
      el.id = 'dpCatalogEditorInfo';
      card.insertBefore(el, card.querySelector('.toolbar') || null);
    }
    if (!el) return;
    el.textContent = text;
    el.className = state || '';
  }

  function saveLocal() {
    try {
      const main = json(localStorage, MAIN, {});
      localStorage.setItem(MAIN, JSON.stringify({ ...main, customCatalog }));
    } catch {}
  }

  async function responseJson(response) {
    const text = await response.text().catch(() => '');
    try { return text ? JSON.parse(text) : {}; }
    catch { return {}; }
  }

  async function loadServer() {
    const t = token();
    if (!t) return;
    try {
      const response = await fetch(API, { headers: { Authorization: 'Bearer ' + t }, cache: 'no-store' });
      const wrapper = await responseJson(response);
      if (!response.ok) throw new Error('Dienstkatalog konnte nicht geladen werden.');
      const remote = wrapper.data && typeof wrapper.data === 'object' ? wrapper.data : {};
      customCatalog = { ...(customCatalog || {}), ...remote };
      saveLocal();
      if (typeof renderAll === 'function') renderAll();
      showRights();
    } catch (error) {
      info(error.message, 'error');
    }
  }

  async function saveServer() {
    if (!allowed()) throw new Error('Keine Berechtigung zum Bearbeiten des Dienstkatalogs.');
    const response = await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(customCatalog || {})
    });
    const data = await responseJson(response);
    if (!response.ok) throw new Error(data.error || 'Dienstkatalog konnte nicht gespeichert werden.');
    saveLocal();
  }

  function showRights() {
    document.body.classList.toggle('dp-catalog-readonly', !allowed());
    info(
      allowed()
        ? 'Bearbeiten erlaubt: Administrator Runke und Geschäftsleitung. Änderungen gelten für alle Benutzer.'
        : 'Nur Administrator Runke und Geschäftsleitung dürfen den Dienstkatalog bearbeiten.',
      allowed() ? 'ok' : ''
    );
  }

  function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

  function closeModal() {
    document.getElementById('dpCatalogEditModal')?.remove();
    document.body.classList.remove('modal-open');
  }

  function edit(number) {
    if (!allowed()) return;
    const entry = getCatalog()[number];
    if (!entry) return;
    const settings = dutySettings(number);
    const own = Object.prototype.hasOwnProperty.call(customCatalog || {}, number);
    closeModal();

    const modal = document.createElement('div');
    modal.id = 'dpCatalogEditModal';
    modal.className = 'dp-cat-modal';
    modal.innerHTML = `
      <div class="dp-cat-box" role="dialog" aria-modal="true">
        <div class="dp-cat-head"><div><h2>Dienst ${number} bearbeiten</h2><div class="muted">Zentrale Änderung für alle Benutzer</div></div><button class="dp-cat-close" type="button">×</button></div>
        <div class="dp-cat-grid">
          <label class="dp-cat-field">Gültige Tage<input id="dpCatDays" value="${String(entry.days || '').replace(/"/g, '&quot;')}" placeholder="Mo-Fr"></label>
          <label class="dp-cat-field">Beginn<input id="dpCatStart" type="time" value="${entry.start || ''}"></label>
          <label class="dp-cat-field">Ende<input id="dpCatEnd" type="time" value="${entry.end || ''}"></label>
          <label class="dp-cat-field">Freitag Ende<input id="dpCatFriday" type="time" value="${entry.fridayEnd || ''}"></label>
          <label class="dp-cat-field">Verkehrsart<select id="dpCatLine"><option value="linie50"${settings.lineMode === 'linie50' ? ' selected' : ''}>Linienverkehr ≤ 50 km</option><option value="eu"${settings.lineMode === 'eu' ? ' selected' : ''}>EU-Regel &gt; 50 km</option></select></label>
          <label class="dp-cat-field">Haltestellenabstand<select id="dpCatStop"><option value="gt3"${settings.stopDistance === 'gt3' ? ' selected' : ''}>mehr als 3 km</option><option value="lte3"${settings.stopDistance === 'lte3' ? ' selected' : ''}>höchstens 3 km</option></select></label>
          <label class="dp-cat-field">Pausenregel<select id="dpCatPause"><option value="auto"${settings.pauseRule === 'auto' ? ' selected' : ''}>Automatisch</option><option value="block"${settings.pauseRule === 'block' ? ' selected' : ''}>Blockregel</option><option value="sixth"${settings.pauseRule === 'sixth' ? ' selected' : ''}>Ein-Sechstel</option></select></label>
        </div>
        <label class="dp-cat-check"><input id="dpCatTariff" type="checkbox"${settings.tariffEight ? ' checked' : ''}>Tarifregel ab 8 Minuten</label>
        <div class="muted" style="margin-bottom:12px">Bereits eingetragene Dienste werden nicht automatisch überschrieben. Dort kann anschließend „Aus Katalog“ gewählt werden.</div>
        <div id="dpCatMessage" class="dp-cat-message"></div>
        <div class="dp-cat-actions">${own ? '<button class="dp-cat-reset" type="button">Auf Original zurücksetzen</button>' : ''}<button class="dp-cat-cancel" type="button">Abbrechen</button><button class="dp-cat-save" type="button">Änderungen speichern</button></div>
      </div>`;
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const message = modal.querySelector('#dpCatMessage');
    const save = modal.querySelector('.dp-cat-save');
    const reset = modal.querySelector('.dp-cat-reset');
    modal.querySelector('.dp-cat-close').onclick = closeModal;
    modal.querySelector('.dp-cat-cancel').onclick = closeModal;
    modal.onclick = (event) => { if (event.target === modal) closeModal(); };

    save.onclick = async () => {
      const start = modal.querySelector('#dpCatStart').value;
      const end = modal.querySelector('#dpCatEnd').value;
      const fridayEnd = modal.querySelector('#dpCatFriday').value;
      if (!validTime(start) || !validTime(end) || (fridayEnd && !validTime(fridayEnd))) {
        message.textContent = 'Bitte alle Uhrzeiten vollständig eingeben.';
        return;
      }
      const previous = own ? JSON.parse(JSON.stringify(customCatalog[number])) : undefined;
      const lineMode = modal.querySelector('#dpCatLine').value;
      customCatalog[number] = {
        ...(customCatalog[number] || {}),
        days: modal.querySelector('#dpCatDays').value.trim(), start, end, fridayEnd, lineMode,
        stopDistance: modal.querySelector('#dpCatStop').value,
        pauseRule: lineMode === 'linie50' ? modal.querySelector('#dpCatPause').value : 'auto',
        tariffEight: modal.querySelector('#dpCatTariff').checked
      };
      save.disabled = true;
      message.textContent = 'Speichere …';
      try {
        await saveServer();
        message.className = 'dp-cat-message ok';
        message.textContent = 'Dienst gespeichert.';
        setTimeout(() => { closeModal(); renderAll(); }, 450);
      } catch (error) {
        if (previous === undefined) delete customCatalog[number]; else customCatalog[number] = previous;
        message.textContent = error.message;
        save.disabled = false;
      }
    };

    if (reset) reset.onclick = async () => {
      if (!confirm(`Dienst ${number} auf Originalwerte zurücksetzen?`)) return;
      const previous = customCatalog[number];
      delete customCatalog[number];
      try {
        await saveServer();
        closeModal();
        renderAll();
      } catch (error) {
        customCatalog[number] = previous;
        message.textContent = error.message;
      }
    };
  }

  function enhance() {
    addStyle();
    showRights();
    const canEdit = allowed();
    document.querySelectorAll('#catalogGrid [data-cat-field]').forEach((el) => { el.disabled = !canEdit; });
    document.querySelectorAll('#catalogGrid .catalog-card').forEach((card) => {
      if (!canEdit || card.querySelector('.dp-catalog-edit')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-secondary btn-small dp-catalog-edit';
      button.textContent = '✎ Bearbeiten';
      button.onclick = () => edit(card.dataset.catNumber);
      (card.querySelector('.catalog-card-actions') || card).appendChild(button);
    });
  }

  function patch() {
    if (patched || typeof renderCatalog !== 'function') return;
    const original = renderCatalog;
    renderCatalog = function (...args) {
      const result = original.apply(this, args);
      enhance();
      return result;
    };
    patched = true;
    enhance();
  }

  document.addEventListener('click', (event) => {
    const locked = event.target.closest?.('#catalogGrid .delete-template,#catalogGrid .review-btn,#catalogGrid .cat-review-note-edit,#uploadDienstkarteCatalog');
    if (locked && !allowed()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (allowed() && event.target.closest?.('#catalogGrid .delete-template')) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveServer().catch((error) => info(error.message, 'error')), 100);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (!event.target.closest?.('#catalogGrid [data-cat-field]')) return;
    if (!allowed()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveServer().then(() => info('Dienstkatalog gespeichert.', 'ok')).catch((error) => info(error.message, 'error')), 200);
  }, true);

  function check() {
    patch();
    enhance();
    const t = token();
    if (!t || loadedToken === t) return;
    loadedToken = t;
    loadServer();
  }

  [0, 100, 400, 1000, 2000].forEach((delay) => setTimeout(check, delay));
  setInterval(check, 1500);
})();
(() => {
  'use strict';

  if (window.__dienstpilotVehiclePlateOptionsV3) return;
  window.__dienstpilotVehiclePlateOptionsV3 = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const LIST_ID = 'dpDailyVehiclePlateList';
  const STYLE_ID = 'dpVehiclePlateOptionsStyleV3';
  const MANUAL_VALUE = '__manual__';
  const OLD_PLATE = 'OS-JF 215';
  const NEW_PLATE = 'OS-IF 215';
  const LOCAL_KEY = 'dienstpilot_daily_duty_plans_v1';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const API_URL = 'https://api.dienstpilot-runke.de/api/data/daily_duty_plans';
  const REQUIRED_PLATES = [
    'OS-LK 621',
    'OS-TG 324',
    'OS-GZ 123',
    'OS-LF 223',
    'OS-RE 224',
    'OS-NP 617',
    'OS-JY 122',
    'OS-SU 722',
    'OS-GO 717',
    'OS-KX 220',
    'OS-OP 622',
    'OS-ZT 626',
    'OS-KF 526',
    'OS-YG 120',
    'OS-XB 925',
    'OS-WP 918',
    'OS-EV 118',
    'OS-BU 816',
    'OS-PK 216',
    'OS-RS 725',
    'OS-DZ 116',
    'OS-UL 818',
    'OS-IF 215',
    'OS-HD 124',
    'OS-FN 919',
    'OS-AX 716',
    'OS-MR 825',
    'OS-CL 916',
    'OS-QS 519',
    'OS-VH 721'
  ];

  let timer = 0;
  let observer = null;
  let observedBody = null;
  let installing = false;
  let migrationRunning = false;
  let remoteMigrationDone = false;

  function normalizeRaw(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function normalize(value) {
    const plate = normalizeRaw(value);
    return plate === OLD_PLATE ? NEW_PLATE : plate;
  }

  function normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function currentRole() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {};
      return normalizeRole(user.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalizeRole(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function maySavePlans() {
    const role = currentRole();
    return role === 'administrator'
      || role === 'admin'
      || role === 'geschaftsleitung'
      || role === 'geschaeftsleitung'
      || role === 'disposition';
  }

  function tokenHeaders(extra = {}) {
    const headers = new Headers(extra);
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  function replacePlateDeep(value) {
    let changes = 0;

    function walk(node) {
      if (Array.isArray(node)) return node.map(walk);
      if (node && typeof node === 'object') {
        const result = {};
        Object.entries(node).forEach(([key, item]) => {
          result[key] = walk(item);
        });
        return result;
      }
      if (typeof node === 'string' && normalizeRaw(node) === OLD_PLATE) {
        changes += 1;
        return NEW_PLATE;
      }
      return node;
    }

    return { value: walk(value), changes };
  }

  function containsOldPlate(value) {
    if (Array.isArray(value)) return value.some(containsOldPlate);
    if (value && typeof value === 'object') return Object.values(value).some(containsOldPlate);
    return typeof value === 'string' && normalizeRaw(value) === OLD_PLATE;
  }

  function unwrap(wrapper) {
    return wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data')
      ? (wrapper.data || {})
      : (wrapper || {});
  }

  function setStatus(text) {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status ok';
  }

  function migrateLocalStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      const migrated = replacePlateDeep(raw);
      if (!migrated.changes) return 0;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(migrated.value));
      return migrated.changes;
    } catch {
      return 0;
    }
  }

  async function migrateRemoteStore() {
    if (remoteMigrationDone || migrationRunning || !maySavePlans()) return 0;
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return 0;

    migrationRunning = true;
    try {
      const response = await fetch(API_URL, {
        cache: 'no-store',
        headers: tokenHeaders()
      });
      if (!response.ok) throw new Error(`Serverstatus ${response.status}`);
      const wrapper = await response.json().catch(() => ({}));
      const current = unwrap(wrapper);
      const migrated = replacePlateDeep(current);

      if (migrated.changes) {
        const saveResponse = await fetch(API_URL, {
          method: 'PUT',
          headers: tokenHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(migrated.value)
        });
        if (!saveResponse.ok) throw new Error(`Serverstatus ${saveResponse.status}`);

        const verifyResponse = await fetch(API_URL, {
          cache: 'no-store',
          headers: tokenHeaders()
        });
        if (!verifyResponse.ok) throw new Error(`Prüfung: Serverstatus ${verifyResponse.status}`);
        const verifiedWrapper = await verifyResponse.json().catch(() => ({}));
        const verified = unwrap(verifiedWrapper);
        if (containsOldPlate(verified)) throw new Error('Das alte Kennzeichen ist nach dem Speichern noch vorhanden.');
        localStorage.setItem(LOCAL_KEY, JSON.stringify(verified));
      }

      remoteMigrationDone = true;
      return migrated.changes;
    } catch (error) {
      console.warn('Kennzeichenkorrektur OS-IF 215 konnte noch nicht vollständig gespeichert werden:', error);
      return 0;
    } finally {
      migrationRunning = false;
    }
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TABLE_ID} .dp-vehicle-editor{display:grid;gap:5px;min-width:0}
      #${TABLE_ID} .dp-vehicle-select{
        display:block;width:100%;box-sizing:border-box;padding:8px 28px 8px 9px;
        border:1px solid #2563eb;border-radius:9px;background:#fff;color:#0f172a;
        font:inherit;font-weight:800;cursor:pointer
      }
      #${TABLE_ID} .dp-vehicle-select:focus{outline:2px solid #2563eb;outline-offset:1px}
      #${TABLE_ID} .dp-vehicle-manual-input[hidden]{display:none!important}
      #${TABLE_ID} .dp-vehicle-manual-input{font-size:12px!important}
      body.dp-daily-readonly #${TABLE_ID} .dp-vehicle-select{background:#f8fafc;color:#475569;cursor:default}
    `;
    document.head.appendChild(style);
  }

  function collectPlates() {
    const plates = [];
    const add = (value) => {
      const plate = normalize(value);
      if (!plate || plate === 'OS-XX 123') return;
      if (!plates.includes(plate)) plates.push(plate);
    };

    REQUIRED_PLATES.forEach(add);
    document.querySelectorAll(`#${TABLE_ID} input[data-field="bus"]`).forEach((input) => add(input.value));
    return plates.sort((a, b) => a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' }));
  }

  function ensureList(plates) {
    let list = document.getElementById(LIST_ID);
    if (!list) {
      list = document.createElement('datalist');
      list.id = LIST_ID;
      document.body.appendChild(list);
    }

    list.replaceChildren(...plates.map((plate) => {
      const option = document.createElement('option');
      option.value = plate;
      return option;
    }));
    return list;
  }

  function rebuildSelect(select, plates, current) {
    const normalizedCurrent = normalize(current);
    const values = [...plates];
    if (normalizedCurrent && !values.includes(normalizedCurrent)) values.unshift(normalizedCurrent);

    const fragment = document.createDocumentFragment();
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Kennzeichen auswählen';
    fragment.appendChild(blank);

    values.forEach((plate) => {
      const option = document.createElement('option');
      option.value = plate;
      option.textContent = plate;
      fragment.appendChild(option);
    });

    const manual = document.createElement('option');
    manual.value = MANUAL_VALUE;
    manual.textContent = 'Anderes Kennzeichen eingeben …';
    fragment.appendChild(manual);

    select.replaceChildren(fragment);
    select.value = normalizedCurrent && values.includes(normalizedCurrent) ? normalizedCurrent : '';
  }

  function dispatchValue(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function correctVisibleInput(input) {
    const original = normalizeRaw(input.value);
    const corrected = normalize(input.value);
    if (original !== OLD_PLATE || corrected === original) return false;
    input.value = corrected;
    dispatchValue(input);
    return true;
  }

  function ensureEditor(input, plates) {
    correctVisibleInput(input);

    let editor = input.closest('.dp-vehicle-editor');
    if (!editor) {
      editor = document.createElement('div');
      editor.className = 'dp-vehicle-editor';
      input.parentNode.insertBefore(editor, input);
      editor.appendChild(input);
    }

    let select = editor.querySelector('.dp-vehicle-select');
    if (!select) {
      select = document.createElement('select');
      select.className = 'dp-vehicle-select';
      select.setAttribute('aria-label', 'Buskennzeichen auswählen');
      editor.insertBefore(select, input);
    }

    input.classList.add('dp-vehicle-manual-input');
    input.setAttribute('list', LIST_ID);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', 'Buskennzeichen manuell eingeben');
    input.placeholder = 'Kennzeichen manuell eingeben';

    rebuildSelect(select, plates, input.value);
    select.disabled = input.disabled;

    if (!select.dataset.dpVehicleBound) {
      select.dataset.dpVehicleBound = '1';
      select.addEventListener('change', () => {
        if (select.value === MANUAL_VALUE) {
          select.dataset.manual = '1';
          input.hidden = false;
          input.focus({ preventScroll: true });
          input.select();
          return;
        }

        select.dataset.manual = '0';
        input.hidden = true;
        input.value = normalize(select.value);
        dispatchValue(input);
      });
    }

    if (!input.dataset.dpVehicleBound) {
      input.dataset.dpVehicleBound = '1';
      input.addEventListener('change', () => {
        input.value = normalize(input.value);
        select.dataset.manual = '0';
        input.hidden = true;
        dispatchValue(input);
        schedule(20);
      });
      input.addEventListener('input', () => {
        if (select.dataset.manual === '1') return;
        const current = normalize(input.value);
        if ([...select.options].some((option) => option.value === current)) select.value = current;
      });
    }

    input.hidden = select.dataset.manual !== '1';
  }

  function install() {
    if (installing) return;
    installing = true;
    try {
      addStyle();
      const corrected = [...document.querySelectorAll(`#${TABLE_ID} input[data-field="bus"]`)]
        .filter((input) => correctVisibleInput(input)).length;
      const plates = collectPlates();
      ensureList(plates);
      document.querySelectorAll(`#${TABLE_ID} input[data-field="bus"]`).forEach((input) => ensureEditor(input, plates));
      if (corrected) setStatus(`Kennzeichen ${OLD_PLATE} wurde in ${NEW_PLATE} geändert.`);
    } finally {
      installing = false;
    }
  }

  async function migrateStoredPlans() {
    const localChanges = migrateLocalStore();
    const remoteChanges = await migrateRemoteStore();
    if (localChanges || remoteChanges) {
      setStatus(`Kennzeichen ${OLD_PLATE} wurde dauerhaft in ${NEW_PLATE} geändert.`);
      [0, 100, 350].forEach((delay) => window.setTimeout(install, delay));
    }
  }

  function schedule(delay = 80) {
    window.clearTimeout(timer);
    timer = window.setTimeout(install, delay);
  }

  function installObserver() {
    const body = document.getElementById(TABLE_ID);
    if (!body || body === observedBody) return;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => schedule(40));
    observer.observe(body, { childList: true });
  }

  function refresh() {
    installObserver();
    [0, 120, 400, 900, 1800].forEach((delay) => window.setTimeout(install, delay));
    void migrateStoredPlans();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailySave,#loginButton,.tab[data-tab="eingabe"]')) refresh();
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpDailyPlanDate') refresh();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();

  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
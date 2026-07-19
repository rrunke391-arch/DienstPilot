(() => {
  'use strict';

  if (window.__dienstpilotVehiclePlateOptionsV5) return;
  window.__dienstpilotVehiclePlateOptionsV5 = true;
  window.__dienstpilotVehiclePlateOptionsV4 = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const LIST_ID = 'dpDailyVehiclePlateList';
  const STYLE_ID = 'dpVehiclePlateOptionsStyleV4';
  const MANUAL_VALUE = '__manual__';
  const OLD_PLATE = 'OS-JF 215';
  const NEW_PLATE = 'OS-IF 215';
  const LOCAL_KEY = 'dienstpilot_daily_duty_plans_v1';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const API_URL = 'https://api.dienstpilot-runke.de/api/data/daily_duty_plans';

  const REQUIRED_PLATES = [
    'OS-LK 621', 'OS-TG 324', 'OS-GZ 123', 'OS-LF 223', 'OS-RE 224',
    'OS-NP 617', 'OS-JY 122', 'OS-SU 722', 'OS-GO 717', 'OS-KX 220',
    'OS-OP 622', 'OS-ZT 626', 'OS-KF 526', 'OS-YG 120', 'OS-XB 925',
    'OS-WP 918', 'OS-EV 118', 'OS-BU 816', 'OS-PK 216', 'OS-RS 725',
    'OS-DZ 116', 'OS-UL 818', 'OS-IF 215', 'OS-HD 124', 'OS-FN 919',
    'OS-AX 716', 'OS-MR 825', 'OS-CL 916', 'OS-QS 519', 'OS-VH 721'
  ];

  let timer = 0;
  let observer = null;
  let observedBody = null;
  let installing = false;
  let remoteMigrationRunning = false;
  let remoteMigrationDone = false;

  function rawPlate(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function canonicalPlate(value) {
    const plate = rawPlate(value);
    return plate === OLD_PLATE ? NEW_PLATE : plate;
  }

  function normalizedRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function currentRole() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {};
      return normalizedRole(user.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalizedRole(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function maySavePlans() {
    return [
      'administrator', 'admin',
      'geschaftsleitung', 'geschaeftsleitung',
      'disposition', 'disponent', 'disponentin'
    ].includes(currentRole());
  }

  function authHeaders(extra = {}) {
    const headers = new Headers(extra);
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  function unwrap(value) {
    return value && Object.prototype.hasOwnProperty.call(value, 'data')
      ? (value.data || {})
      : (value || {});
  }

  function replacePlateDeep(value) {
    let changes = 0;

    function walk(node) {
      if (Array.isArray(node)) return node.map(walk);
      if (node && typeof node === 'object') {
        return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, walk(item)]));
      }
      if (typeof node === 'string' && rawPlate(node) === OLD_PLATE) {
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
    return typeof value === 'string' && rawPlate(value) === OLD_PLATE;
  }

  function setStatus(text) {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    if (status.textContent !== text) status.textContent = text;
    if (status.className !== 'dp-daily-status ok') status.className = 'dp-daily-status ok';
  }

  function migrateLocalStore() {
    try {
      const current = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      const migrated = replacePlateDeep(current);
      if (!migrated.changes) return 0;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(migrated.value));
      return migrated.changes;
    } catch {
      return 0;
    }
  }

  async function migrateRemoteStore() {
    if (remoteMigrationDone || remoteMigrationRunning || !maySavePlans()) return 0;
    if (!sessionStorage.getItem(TOKEN_KEY)) return 0;

    remoteMigrationRunning = true;
    try {
      const getResponse = await fetch(API_URL, { cache: 'no-store', headers: authHeaders() });
      if (!getResponse.ok) throw new Error(`Serverstatus ${getResponse.status}`);
      const current = unwrap(await getResponse.json().catch(() => ({})));
      const migrated = replacePlateDeep(current);

      if (migrated.changes) {
        const putResponse = await fetch(API_URL, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(migrated.value)
        });
        if (!putResponse.ok) throw new Error(`Serverstatus ${putResponse.status}`);

        const verifyResponse = await fetch(API_URL, { cache: 'no-store', headers: authHeaders() });
        if (!verifyResponse.ok) throw new Error(`Prüfung: Serverstatus ${verifyResponse.status}`);
        const verified = unwrap(await verifyResponse.json().catch(() => ({})));
        if (containsOldPlate(verified)) throw new Error('Das alte Kennzeichen ist nach der Speicherung noch vorhanden.');
        localStorage.setItem(LOCAL_KEY, JSON.stringify(verified));
      }

      remoteMigrationDone = true;
      return migrated.changes;
    } catch (error) {
      console.warn('Kennzeichen OS-IF 215 konnte noch nicht vollständig gespeichert werden:', error);
      return 0;
    } finally {
      remoteMigrationRunning = false;
    }
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TABLE_ID} .dp-vehicle-editor{display:grid;gap:5px;min-width:0}
      #${TABLE_ID} .dp-vehicle-select{display:block;width:100%;box-sizing:border-box;padding:8px 28px 8px 9px;border:1px solid #2563eb;border-radius:9px;background:#fff;color:#0f172a;font:inherit;font-weight:800;cursor:pointer}
      #${TABLE_ID} .dp-vehicle-select:focus{outline:2px solid #2563eb;outline-offset:1px}
      #${TABLE_ID} .dp-vehicle-manual-input[hidden]{display:none!important}
      #${TABLE_ID} .dp-vehicle-manual-input{font-size:12px!important}
      body.dp-daily-readonly #${TABLE_ID} .dp-vehicle-select{background:#f8fafc;color:#475569;cursor:default}
    `;
    document.head.appendChild(style);
  }

  function dispatchInput(input, includeChange = false) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (includeChange) input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function correctVisibleInput(input) {
    if (rawPlate(input.value) !== OLD_PLATE) return false;
    input.value = NEW_PLATE;
    dispatchInput(input);
    return true;
  }

  function collectPlates() {
    const plates = [];
    const add = (value) => {
      const plate = canonicalPlate(value);
      if (!plate || plate === 'OS-XX 123' || plates.includes(plate)) return;
      plates.push(plate);
    };

    REQUIRED_PLATES.forEach(add);
    document.querySelectorAll(`#${TABLE_ID} input[data-field="bus"]`).forEach((input) => add(input.value));
    return plates.sort((a, b) => a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' }));
  }

  function optionValues(node) {
    return [...node.options].map((option) => `${option.value}\u001f${option.textContent}`);
  }

  function sameOptions(node, desired) {
    const current = optionValues(node);
    return current.length === desired.length && current.every((value, index) => value === desired[index]);
  }

  function ensureList(plates) {
    let list = document.getElementById(LIST_ID);
    if (!list) {
      list = document.createElement('datalist');
      list.id = LIST_ID;
      document.body.appendChild(list);
    }

    const desired = plates.map((plate) => `${plate}\u001f`);
    if (sameOptions(list, desired)) return;

    const fragment = document.createDocumentFragment();
    plates.forEach((plate) => {
      const option = document.createElement('option');
      option.value = plate;
      fragment.appendChild(option);
    });
    list.replaceChildren(fragment);
  }

  function desiredSelectOptions(plates, currentValue) {
    const current = canonicalPlate(currentValue);
    const values = [...plates];
    if (current && !values.includes(current)) values.unshift(current);

    return {
      current,
      values,
      options: [
        { value: '', text: 'Kennzeichen auswählen' },
        ...values.map((plate) => ({ value: plate, text: plate })),
        { value: MANUAL_VALUE, text: 'Anderes Kennzeichen eingeben …' }
      ]
    };
  }

  function rebuildSelect(select, plates, currentValue) {
    const desired = desiredSelectOptions(plates, currentValue);
    const signature = desired.options.map((entry) => `${entry.value}\u001f${entry.text}`);

    if (!sameOptions(select, signature)) {
      const fragment = document.createDocumentFragment();
      desired.options.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.value;
        option.textContent = entry.text;
        fragment.appendChild(option);
      });
      select.replaceChildren(fragment);
    }

    const nextValue = desired.current && desired.values.includes(desired.current) ? desired.current : '';
    if (select.dataset.manual !== '1' && select.value !== nextValue) select.value = nextValue;
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
    if (select.disabled !== input.disabled) select.disabled = input.disabled;

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
        const next = canonicalPlate(select.value);
        if (input.value !== next) {
          input.value = next;
          dispatchInput(input, true);
        }
      });
    }

    if (!input.dataset.dpVehicleBound) {
      input.dataset.dpVehicleBound = '1';
      input.addEventListener('change', () => {
        const corrected = canonicalPlate(input.value);
        if (input.value !== corrected) {
          input.value = corrected;
          dispatchInput(input);
        }
        select.dataset.manual = '0';
        input.hidden = true;
        schedule(20);
      });
      input.addEventListener('input', () => {
        if (select.dataset.manual === '1') return;
        const current = canonicalPlate(input.value);
        if ([...select.options].some((option) => option.value === current) && select.value !== current) select.value = current;
      });
    }

    const shouldHide = select.dataset.manual !== '1';
    if (input.hidden !== shouldHide) input.hidden = shouldHide;
  }

  function install() {
    if (installing) return;
    installing = true;
    try {
      addStyle();
      const inputs = [...document.querySelectorAll(`#${TABLE_ID} input[data-field="bus"]`)];
      const corrected = inputs.filter(correctVisibleInput).length;
      const plates = collectPlates();
      ensureList(plates);
      inputs.forEach((input) => ensureEditor(input, plates));
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
      [0, 120, 360].forEach((delay) => window.setTimeout(install, delay));
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
    observer = new MutationObserver(() => schedule(50));
    observer.observe(body, { childList: true });
  }

  function refresh() {
    installObserver();
    [0, 180, 600, 1400].forEach((delay) => window.setTimeout(install, delay));
    void migrateStoredPlans();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#loginButton,.tab[data-tab="eingabe"]')) refresh();
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpDailyPlanDate') refresh();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();

  window.addEventListener('pageshow', () => schedule(120));
  window.addEventListener('focus', () => schedule(160));
})();
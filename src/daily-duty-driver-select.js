(() => {
  'use strict';

  if (window.__dienstpilotDailyDutyDriverSelectV4) return;
  window.__dienstpilotDailyDutyDriverSelectV4 = true;
  window.__dienstpilotDailyDutyDriverSelectV3 = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const API_BASE = 'https://api.dienstpilot-runke.de';
  const STYLE_ID = 'dpDailyDutyDriverSelectStyleV2';
  const TABLE_ID = 'dpDailyPlanRows';

  if (!document.getElementById('dpAdditionalDriverOptionsScript')) {
    const script = document.createElement('script');
    script.id = 'dpAdditionalDriverOptionsScript';
    script.src = 'src/additional-driver-options.js?v=20260716-3';
    script.async = false;
    document.head.appendChild(script);
  }

  const FALLBACK_DRIVERS = [
    'Y.Yasar', 'Bumhoffer', 'M.Entrup', 'M.Schweppe', 'I.Janzen', 'K.Alomar', 'H.AI Sayek',
    'A.Szczepanik', 'A.Kocdemir', 'W.Wüllner', 'S.Wittwer', 'F.Biermann', 'A.Gerding',
    'R.Runke', 'P.Lommel', 'M.Malko', 'N.Murad', 'S.Kurta', 'T.Wiemann', 'A.Muth',
    'S.Suleimani', 'J.Faber', 'L.Hergerdt', 'A.Hergerdt', 'A.Hasan', 'D.Knigge',
    'N.Awdullahi', 'K.Giotis', 'K.Igelbrink', 'A.Alrobaie', 'A.Morzsa', 'M.Al Dabbah',
    'C.Strotmann', 'M.Eggern', 'S.Yasatemur', 'N.Ghulami', 'M.Alsaba'
  ];

  const NAME_ALIASES = new Map([
    ['alomar', 'K.Alomar'], ['kalomar', 'K.Alomar'],
    ['sayek', 'H.AI Sayek'], ['halsayek', 'H.AI Sayek'], ['haisayek', 'H.AI Sayek'],
    ['wiemann', 'T.Wiemann'], ['twiemann', 'T.Wiemann'],
    ['murad', 'N.Murad'], ['nmurad', 'N.Murad'],
    ['biermann', 'F.Biermann'], ['fbiermann', 'F.Biermann'],
    ['schweppe', 'M.Schweppe'], ['mschweppe', 'M.Schweppe'],
    ['wullner', 'W.Wüllner'], ['wwullner', 'W.Wüllner'],
    ['szczepanik', 'A.Szczepanik'], ['aszczepanik', 'A.Szczepanik'],
    ['lommel', 'P.Lommel'], ['lhommel', 'P.Lommel'], ['plommel', 'P.Lommel'], ['plhommel', 'P.Lommel'],
    ['entrup', 'M.Entrup'], ['mentrup', 'M.Entrup'],
    ['gerding', 'A.Gerding'], ['agerding', 'A.Gerding'],
    ['kocdemir', 'A.Kocdemir'], ['akocdemir', 'A.Kocdemir'],
    ['kurta', 'S.Kurta'], ['skurta', 'S.Kurta']
  ]);

  let remoteDrivers = [];
  let remoteRequested = false;
  let timer = 0;
  let observer = null;
  let observedBody = null;
  let installing = false;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function compact(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, '');
  }

  function canonicalSingle(value) {
    const name = String(value || '').trim();
    if (!name) return '';
    if (normalize(name) === 'hergerdt') return 'L.Hergerdt';
    return NAME_ALIASES.get(compact(name)) || name;
  }

  function canonicalName(value) {
    const name = String(value || '').trim();
    if (!name) return '';
    if (!name.includes('/')) return canonicalSingle(name);

    const names = [];
    name.split('/').forEach((part) => {
      const corrected = canonicalSingle(part);
      if (corrected && !names.some((entry) => normalize(entry) === normalize(corrected))) names.push(corrected);
    });
    return names.join(' / ');
  }

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function role() {
    return normalize(currentUser()?.role || sessionStorage.getItem(ROLE_KEY));
  }

  function maySelectDrivers() {
    return [
      'administrator', 'admin',
      'disposition', 'disponent', 'disponentin',
      'geschaftsleitung', 'geschaeftsleitung'
    ].includes(role());
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TABLE_ID} .dp-daily-driver-select{
        display:block!important;width:100%!important;box-sizing:border-box!important;
        padding:8px 30px 8px 9px!important;border:1px solid #2563eb!important;
        border-radius:9px!important;background:#fff!important;color:#0f172a!important;
        font:inherit!important;font-weight:800!important;cursor:pointer!important;
      }
      #${TABLE_ID} .dp-daily-driver-select:focus{
        outline:2px solid #2563eb!important;outline-offset:1px!important;
      }
      #${TABLE_ID} .dp-daily-driver-source{
        display:none!important;visibility:hidden!important;position:absolute!important;
        width:1px!important;height:1px!important;overflow:hidden!important;
      }
    `;
    document.head.appendChild(style);
  }

  function addName(value, names) {
    const name = canonicalName(value);
    if (!name) return;
    if (!names.some((item) => normalize(item) === normalize(name))) names.push(name);
  }

  function availableDrivers() {
    const names = [];
    FALLBACK_DRIVERS.forEach((name) => addName(name, names));
    remoteDrivers.forEach((name) => addName(name, names));

    document.querySelectorAll('#kollegeSelect option').forEach((option) => {
      addName(option.textContent || option.label || option.value, names);
    });

    document.querySelectorAll(`#${TABLE_ID} input[data-field="name"]`).forEach((input) => {
      const value = canonicalName(input.value);
      if (value.includes('/')) value.split('/').forEach((part) => addName(part, names));
      else addName(value, names);
    });

    return names.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  function desiredOptions(selected, names) {
    const current = canonicalName(selected);
    const values = [...names];
    if (current && !values.some((name) => normalize(name) === normalize(current))) values.unshift(current);
    return {
      current,
      values,
      options: [
        { value: '', text: 'Fahrer auswählen' },
        ...values.map((name) => ({ value: name, text: name }))
      ]
    };
  }

  function optionsMatch(select, desired) {
    const current = [...select.options];
    return current.length === desired.length
      && current.every((option, index) => option.value === desired[index].value && option.textContent === desired[index].text);
  }

  function rebuildOptions(select, selected, names) {
    const desired = desiredOptions(selected, names);
    if (!optionsMatch(select, desired.options)) {
      const fragment = document.createDocumentFragment();
      desired.options.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.value;
        option.textContent = entry.text;
        fragment.appendChild(option);
      });
      select.replaceChildren(fragment);
    }

    const selectedName = desired.values.find((name) => normalize(name) === normalize(desired.current));
    const nextValue = selectedName || '';
    if (select.value !== nextValue) select.value = nextValue;
  }

  function syncSelect(input, select) {
    const current = canonicalName(input.value);
    if (current && ![...select.options].some((option) => normalize(option.value) === normalize(current))) {
      const option = document.createElement('option');
      option.value = current;
      option.textContent = current;
      select.appendChild(option);
    }
    const match = [...select.options].find((option) => normalize(option.value) === normalize(current));
    const nextValue = match?.value || '';
    if (select.value !== nextValue) select.value = nextValue;
  }

  function observeCurrentBody() {
    if (!observer || !observedBody?.isConnected) return;
    observer.observe(observedBody, { childList: true, subtree: true });
  }

  function installSelects() {
    if (installing || !maySelectDrivers()) return false;
    installing = true;
    observer?.disconnect();

    try {
      addStyle();
      const names = availableDrivers();
      const inputs = [...document.querySelectorAll(`#${TABLE_ID} input[data-field="name"]`)];
      if (!inputs.length) return false;

      inputs.forEach((input) => {
        const cell = input.closest('td');
        if (!cell) return;

        const correctedName = canonicalName(input.value);
        if (correctedName !== String(input.value || '').trim()) {
          input.value = correctedName;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        let select = cell.querySelector('.dp-daily-driver-select');
        if (!select) {
          select = document.createElement('select');
          select.className = 'dp-daily-driver-select';
          select.setAttribute('aria-label', 'Fahrer auswählen');

          select.addEventListener('change', () => {
            input.value = canonicalName(select.value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          });

          cell.insertBefore(select, input);
        }

        rebuildOptions(select, correctedName, names);
        input.classList.add('dp-daily-driver-source');
        input.setAttribute('aria-hidden', 'true');
        input.tabIndex = -1;
        input.style.setProperty('display', 'none', 'important');

        if (!input.dataset.dpDriverSyncV4) {
          input.dataset.dpDriverSyncV4 = '1';
          input.addEventListener('input', () => syncSelect(input, select));
          input.addEventListener('change', () => syncSelect(input, select));
        }
      });

      return true;
    } finally {
      installing = false;
      observeCurrentBody();
    }
  }

  async function requestDrivers() {
    if (remoteRequested || !maySelectDrivers()) return;
    remoteRequested = true;
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/users`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      const users = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
      remoteDrivers = users
        .filter((user) => normalize(user?.role) === 'fahrer' || user?.driverProfile)
        .map((user) => canonicalName(user.displayName || user.driverProfile || user.username || ''))
        .filter(Boolean);
      scheduleInstall(20);
    } catch {}
  }

  function scheduleInstall(delay = 80) {
    window.clearTimeout(timer);
    timer = window.setTimeout(installSelects, delay);
  }

  function installObserver() {
    const body = document.getElementById(TABLE_ID);
    if (!body) return;
    if (body !== observedBody) {
      observer?.disconnect();
      observedBody = body;
      observer = new MutationObserver(() => {
        if (!installing) scheduleInstall(60);
      });
    }
    observeCurrentBody();
  }

  function refresh() {
    installObserver();
    [0, 120, 350, 800].forEach((delay) => window.setTimeout(installSelects, delay));
    void requestDrivers();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailyPlanRows [data-action],#loginButton,.tab[data-tab="eingabe"]')) {
      refresh();
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpDailyPlanDate' || event.target?.matches?.(`#${TABLE_ID} input[data-field="duty"]`)) {
      refresh();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();

  [1200, 3000].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
(() => {
  'use strict';

  if (window.__dienstpilotDailyDutyDriverSelectV2) return;
  window.__dienstpilotDailyDutyDriverSelectV2 = true;

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
    'Y.Yasar', 'Bumhoffer', 'M.Entrup', 'M.Schweppe', 'I.Janzen', 'Alomar', 'H.Al Sayek',
    'A.Szczepanik', 'Kocdemir', 'W.Wüllner', 'S.Wittwer', 'Biermann', 'A.Gerding',
    'R.Runke', 'P.Lhommel', 'M.Malko', 'N.Murad', 'S.Kurta', 'T.Wiemann', 'A.Muth',
    'S.Suleimani', 'J.Faber', 'L.Hergerdt', 'A.Hergerdt', 'A.Hasan', 'D.Knigge',
    'N.Awdullahi', 'K.Giotis', 'K.Igelbrink', 'A.Alrobaie', 'A.Morzsa', 'M.Al Dabbah',
    'C.Strotmann', 'M.Eggern', 'S.Yasatemur', 'N.Ghulami'
  ];

  let remoteDrivers = [];
  let remoteRequested = false;
  let timer = 0;
  let observer = null;
  let observedBody = null;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function canonicalName(value) {
    const name = String(value || '').trim();
    return normalize(name) === 'hergerdt' ? 'L.Hergerdt' : name;
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
      addName(option.value || option.textContent, names);
    });

    document.querySelectorAll(`#${TABLE_ID} input[data-field="name"]`).forEach((input) => {
      const value = canonicalName(input.value);
      if (value.includes('/')) {
        value.split('/').forEach((part) => addName(part, names));
      } else {
        addName(value, names);
      }
    });

    return names.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  function rebuildOptions(select, selected, names) {
    const current = canonicalName(selected);
    const values = [...names];
    if (current && !values.some((name) => normalize(name) === normalize(current))) values.unshift(current);

    select.replaceChildren();

    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Fahrer auswählen';
    select.appendChild(blank);

    values.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      option.selected = normalize(name) === normalize(current);
      select.appendChild(option);
    });

    select.value = current;
  }

  function syncSelect(input, select) {
    const current = canonicalName(input.value);
    if (![...select.options].some((option) => normalize(option.value) === normalize(current))) {
      const option = document.createElement('option');
      option.value = current;
      option.textContent = current;
      select.appendChild(option);
    }
    if (normalize(select.value) !== normalize(current)) select.value = current;
  }

  function installSelects() {
    if (!maySelectDrivers()) return false;
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

      if (!input.dataset.dpDriverSyncV2) {
        input.dataset.dpDriverSyncV2 = '1';
        input.addEventListener('input', () => syncSelect(input, select));
        input.addEventListener('change', () => syncSelect(input, select));
      }
    });

    return true;
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
    timer = window.setTimeout(() => installSelects(), delay);
  }

  function installObserver() {
    const body = document.getElementById(TABLE_ID);
    if (!body || body === observedBody) return;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => scheduleInstall(60));
    observer.observe(body, { childList: true, subtree: true });
  }

  function refresh() {
    installObserver();
    [0, 120, 350, 800, 1600].forEach((delay) => window.setTimeout(installSelects, delay));
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

  [1200, 3000, 6000, 10000].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
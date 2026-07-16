(() => {
  'use strict';

  if (window.__dienstpilotDailyDutyDriverSelect) return;
  window.__dienstpilotDailyDutyDriverSelect = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const API_BASE = 'https://api.dienstpilot-runke.de';
  const STYLE_ID = 'dpDailyDutyDriverSelectStyle';

  if (!document.getElementById('dpAdditionalDriverOptionsScript')) {
    const script = document.createElement('script');
    script.id = 'dpAdditionalDriverOptionsScript';
    script.src = 'src/additional-driver-options.js?v=20260716-3';
    script.async = false;
    document.head.appendChild(script);
  }

  const FALLBACK_DRIVERS = [
    'Yasar', 'Bumhoffer', 'Entrup', 'Schweppe', 'Janzen', 'Alomar', 'Al Sayek',
    'Szczepanik', 'Kocdemir', 'Wüllner', 'Wittwer', 'Biermann', 'Gerding',
    'Runke', 'Lommel', 'Malko', 'Murad', 'Kurta', 'Wiemann', 'Muth',
    'Suleimani', 'Faber', 'L.Hergerdt', 'A.Hergerdt', 'A.Hasan', 'D.Knigge',
    'N.Awdullahi', 'K.Giotis', 'K.Igelbrink', 'A.Alrobaie', 'A.Morzsa',
    'C.Strotmann', 'M.Eggern'
  ];

  let remoteDrivers = [];
  let remoteRequested = false;

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
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function role() {
    return normalize(currentUser()?.role || sessionStorage.getItem(ROLE_KEY));
  }

  function maySelectDrivers() {
    return [
      'disposition', 'disponent', 'disponentin',
      'geschaftsleitung', 'geschaeftsleitung'
    ].includes(role());
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dpDailyPlanRows .dp-daily-driver-select{
        width:100%;box-sizing:border-box;padding:8px 30px 8px 9px;
        border:1px solid #94a3b8;border-radius:9px;background:#fff;
        color:#0f172a;font:inherit;font-weight:750;cursor:pointer;
      }
      #dpDailyPlanRows .dp-daily-driver-select:focus{
        outline:2px solid #2563eb;outline-offset:1px;border-color:#2563eb;
      }
      #dpDailyPlanRows .dp-daily-driver-source{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function addName(target, names) {
    const value = canonicalName(target);
    if (!value) return;
    if (!names.some((name) => normalize(name) === normalize(value))) names.push(value);
  }

  function availableDrivers() {
    const names = [];
    FALLBACK_DRIVERS.forEach((name) => addName(name, names));
    remoteDrivers.forEach((name) => addName(name, names));

    document.querySelectorAll('#kollegeSelect option').forEach((option) => {
      addName(option.textContent || option.value, names);
    });

    document.querySelectorAll('#dpDailyPlanRows input[data-field="name"]').forEach((input) => {
      addName(input.value, names);
    });

    return names.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  function optionHtml(value, selected) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = normalize(value) === normalize(selected);
    return option;
  }

  function installSelects() {
    if (!maySelectDrivers()) return false;
    addStyle();

    const names = availableDrivers();
    const inputs = [...document.querySelectorAll('#dpDailyPlanRows input[data-field="name"]')];
    if (!inputs.length) return false;

    inputs.forEach((input) => {
      const cell = input.closest('td');
      if (!cell) return;

      const correctedName = canonicalName(input.value);
      if (correctedName !== String(input.value || '').trim()) {
        input.value = correctedName;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const existing = cell.querySelector('.dp-daily-driver-select');
      if (existing) {
        if (normalize(existing.value) !== normalize(correctedName)) existing.value = correctedName;
        return;
      }

      const select = document.createElement('select');
      select.className = 'dp-daily-driver-select';
      select.setAttribute('aria-label', 'Fahrer auswählen');

      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Fahrer auswählen';
      select.appendChild(blank);

      addName(correctedName, names);
      names.forEach((name) => select.appendChild(optionHtml(name, correctedName)));
      select.value = correctedName;

      input.classList.add('dp-daily-driver-source');
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;

      select.addEventListener('change', () => {
        input.value = canonicalName(select.value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      cell.insertBefore(select, input);
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
      installSelects();
    } catch {}
  }

  function scheduleInstall() {
    [0, 80, 250, 700].forEach((delay) => window.setTimeout(installSelects, delay));
    void requestDrivers();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailyPlanRows [data-action],#loginButton')) {
      scheduleInstall();
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target.id === 'dpDailyPlanDate' || event.target.matches?.('#dpDailyPlanRows input[data-field="duty"]')) {
      scheduleInstall();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInstall, { once: true });
  else scheduleInstall();
  window.addEventListener('pageshow', scheduleInstall);
  window.addEventListener('focus', scheduleInstall);
})();
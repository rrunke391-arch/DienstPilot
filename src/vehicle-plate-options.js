(() => {
  'use strict';

  if (window.__dienstpilotVehiclePlateOptionsV1) return;
  window.__dienstpilotVehiclePlateOptionsV1 = true;

  const TABLE_ID = 'dpDailyPlanRows';
  const LIST_ID = 'dpDailyVehiclePlateList';
  const REQUIRED_PLATES = [
    'OS-LK 621'
  ];

  let timer = 0;
  let observer = null;
  let observedBody = null;

  function normalize(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
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

  function ensureList() {
    let list = document.getElementById(LIST_ID);
    if (!list) {
      list = document.createElement('datalist');
      list.id = LIST_ID;
      document.body.appendChild(list);
    }

    const plates = collectPlates();
    list.replaceChildren(...plates.map((plate) => {
      const option = document.createElement('option');
      option.value = plate;
      return option;
    }));

    return list;
  }

  function install() {
    ensureList();
    document.querySelectorAll(`#${TABLE_ID} input[data-field="bus"]`).forEach((input) => {
      input.setAttribute('list', LIST_ID);
      input.setAttribute('autocomplete', 'off');
      if (!input.getAttribute('aria-label')) input.setAttribute('aria-label', 'Buskennzeichen auswählen oder eingeben');
    });
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
    observer.observe(body, { childList: true, subtree: true });
  }

  function refresh() {
    installObserver();
    [0, 120, 400, 900].forEach((delay) => window.setTimeout(install, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#loginButton,.tab[data-tab="eingabe"]')) {
      refresh();
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpDailyPlanDate' || event.target?.matches?.(`#${TABLE_ID} input[data-field="bus"]`)) {
      schedule(50);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();

  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
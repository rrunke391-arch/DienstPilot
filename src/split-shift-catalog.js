(() => {
  'use strict';

  if (window.__dienstpilotSplitShiftCatalogV3) return;
  window.__dienstpilotSplitShiftCatalogV3 = true;

  const API = 'https://api.dienstpilot-runke.de/api/data/catalog_custom';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const STYLE_ID = 'dpSplitShiftCatalogStyle';
  const INFO_CLASS = 'dp-split-catalog-times';
  const VERSION_KEY = 'dienstpilot_split_shift_catalog_saved_v3';

  const DEFINITIONS = {
    '1341': {
      days: 'Mo-Fr',
      start: '05:13',
      end: '23:38',
      splitShift: true,
      splitShifts: [
        { label: 'Früh', start: '05:13', end: '14:21' },
        { label: 'Spät', start: '14:04', end: '23:38' }
      ]
    },
    '1941': {
      days: 'Mo-Fr',
      start: '05:35',
      end: '21:49',
      splitShift: true,
      splitShifts: [
        { label: 'Früh', start: '05:35', end: '14:29' },
        { label: 'Spät', start: '14:09', end: '21:49' }
      ]
    },
    '1743': {
      days: 'Mo-Fr',
      start: '06:05',
      end: '00:50',
      splitShift: true,
      splitShifts: [
        { label: 'Früh', start: '06:05', end: '15:17' },
        { label: 'Spät', start: '14:57', end: '00:50' }
      ]
    }
  };

  window.DIENSTPILOT_SPLIT_SHIFT_DUTIES = DEFINITIONS;

  function readJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function mergeDefinitions(source) {
    const catalog = source && typeof source === 'object' ? { ...source } : {};
    Object.entries(DEFINITIONS).forEach(([number, definition]) => {
      catalog[number] = {
        ...(catalog[number] || {}),
        ...definition,
        splitShifts: definition.splitShifts.map((shift) => ({ ...shift }))
      };
    });
    return catalog;
  }

  function saveLocal() {
    const main = readJson(localStorage, MAIN_KEY, {}) || {};
    const merged = mergeDefinitions(main.customCatalog || {});
    localStorage.setItem(MAIN_KEY, JSON.stringify({ ...main, customCatalog: merged }));

    try {
      if (typeof customCatalog !== 'undefined') customCatalog = mergeDefinitions(customCatalog || {});
    } catch {}

    return merged;
  }

  async function responseJson(response) {
    const text = await response.text().catch(() => '');
    try { return text ? JSON.parse(text) : {}; }
    catch { return {}; }
  }

  async function saveServer() {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token || sessionStorage.getItem(VERSION_KEY) === '1') return;

    try {
      const getResponse = await fetch(API, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      const wrapper = await responseJson(getResponse);
      const remote = getResponse.ok
        ? (wrapper.data && typeof wrapper.data === 'object' ? wrapper.data : wrapper)
        : {};
      const merged = mergeDefinitions(remote);

      const putResponse = await fetch(API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(merged)
      });
      if (!putResponse.ok) return;

      sessionStorage.setItem(VERSION_KEY, '1');
      const main = readJson(localStorage, MAIN_KEY, {}) || {};
      localStorage.setItem(MAIN_KEY, JSON.stringify({ ...main, customCatalog: merged }));
      try {
        if (typeof customCatalog !== 'undefined') customCatalog = mergeDefinitions(merged);
      } catch {}
    } catch {}
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${INFO_CLASS}{margin:10px 0 0;padding:9px 10px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;color:#1e3a8a;font-size:12px;line-height:1.45;font-weight:850}
      #dpSplitAssignmentTimes{margin-top:9px;padding:10px 11px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;color:#1e3a8a;font-weight:850;line-height:1.45}
      #dpSplitAssignmentTimes label{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:7px}
      #dpSplitAssignmentShift{padding:7px 9px;border:1px solid #93c5fd;border-radius:8px;background:#fff;font:inherit;font-weight:850}
    `;
    document.head.appendChild(style);
  }

  function shiftText(number) {
    const definition = DEFINITIONS[number];
    if (!definition) return '';
    return definition.splitShifts
      .map((shift) => `${shift.label}: ${shift.start}–${shift.end}`)
      .join(' · ');
  }

  function setAssignmentTimes(number, index) {
    const definition = DEFINITIONS[number];
    const shift = definition?.splitShifts?.[Number(index) || 0];
    if (!shift) return;
    const start = document.getElementById('dpAssignStartV2');
    const end = document.getElementById('dpAssignEndV2');
    if (start) start.value = shift.start;
    if (end) end.value = shift.end;
  }

  function decorateCatalog() {
    addStyle();
    Object.keys(DEFINITIONS).forEach((number) => {
      const card = document.querySelector(`#catalogGrid .catalog-card[data-cat-number="${number}"],#catalogGrid [data-cat-number="${number}"]`);
      if (!card) return;
      let info = card.querySelector(`.${INFO_CLASS}`);
      if (!info) {
        info = document.createElement('div');
        info.className = INFO_CLASS;
        (card.querySelector('.catalog-card-actions') || card).insertAdjacentElement('beforebegin', info);
      }
      info.textContent = `Geteilter Dienst · ${shiftText(number)} · Fahrer wechseln in der Regel wochenweise.`;
    });
  }

  function decorateAssignment() {
    const panel = document.getElementById('dpDutyAssignmentV2');
    const dutySelect = document.getElementById('dpAssignDutyV2');
    if (!panel || !dutySelect) return;

    let info = document.getElementById('dpSplitAssignmentTimes');
    const number = String(dutySelect.value || '').trim();
    const definition = DEFINITIONS[number];
    if (!definition) {
      info?.remove();
      return;
    }

    if (!info) {
      info = document.createElement('div');
      info.id = 'dpSplitAssignmentTimes';
      panel.querySelector('.dp-a-grid')?.insertAdjacentElement('afterend', info);
    }

    const previous = info.querySelector('#dpSplitAssignmentShift')?.value || '0';
    info.innerHTML = `<div>Dienst ${number}: ${shiftText(number)}.</div><label>Schicht auswählen <select id="dpSplitAssignmentShift"><option value="0">Frühschicht</option><option value="1">Spätschicht</option></select></label>`;
    const shiftSelect = info.querySelector('#dpSplitAssignmentShift');
    shiftSelect.value = previous === '1' ? '1' : '0';
    shiftSelect.addEventListener('change', () => setAssignmentTimes(number, shiftSelect.value));
    setAssignmentTimes(number, shiftSelect.value);
  }

  function refresh() {
    saveLocal();
    try {
      if (typeof renderAll === 'function') renderAll();
      else if (typeof renderCatalog === 'function') renderCatalog();
    } catch {}
    window.setTimeout(decorateCatalog, 80);
    window.setTimeout(decorateAssignment, 80);
    void saveServer();
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpAssignDutyV2') decorateAssignment();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.tab[data-tab="katalog"],#dpDutyAssignmentV2,#loginButton')) {
      [100, 400, 1000].forEach((delay) => window.setTimeout(refresh, delay));
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();

  [500, 1800, 4200].forEach((delay) => window.setTimeout(refresh, delay));
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
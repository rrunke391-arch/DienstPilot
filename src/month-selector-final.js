(() => {
  'use strict';

  const STYLE_ID = 'dpMonthSelectorFinalStyle';
  const STORAGE_KEYS = [
    'dienstpilot_selected_overview_month_final',
    'dienstpilot_selected_overview_month',
    'dienstpilot_overview_selected_month'
  ];
  const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const MONTH_RE = /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(20\d{2})$/i;

  let selectedMonth = '';
  let renderHooksInstalled = false;

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function keyFromLabel(value) {
    const match = normalizeText(value).match(MONTH_RE);
    if (!match) return '';
    const index = MONTHS.findIndex((name) => name.toLowerCase() === match[1].toLowerCase());
    return index >= 0 ? `${match[2]}-${String(index + 1).padStart(2, '0')}` : '';
  }

  function readStoredMonth() {
    if (selectedMonth) return selectedMonth;
    for (const key of STORAGE_KEYS) {
      try {
        const value = sessionStorage.getItem(key) || '';
        if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) {
          selectedMonth = value;
          return value;
        }
      } catch {}
    }
    return '';
  }

  function storeMonth(value) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) return;
    selectedMonth = value;
    for (const key of STORAGE_KEYS) {
      try { sessionStorage.setItem(key, value); } catch {}
    }
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dutiesContainer.dp-month-filter-final > details.month-group{display:none!important}
      #dutiesContainer.dp-month-filter-final > details.month-group.dp-month-final-current{display:block!important}
      #dutiesContainer > .past-divider{display:none!important}
      #tab-eingabe .dp-month-final-active{border-color:#0f172a!important;background:#0f172a!important;color:#fff!important}
    `;
    document.head.appendChild(style);
  }

  function monthCards() {
    const container = document.getElementById('dutiesContainer');
    if (!container) return [];
    return [...container.children]
      .filter((node) => node.matches?.('details.month-group[data-month]'))
      .map((card) => ({ card, key: String(card.dataset.month || '').trim() }))
      .filter(({ key }) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(key));
  }

  function monthControls() {
    const section = document.getElementById('tab-eingabe');
    if (!section) return [];
    return [...section.querySelectorAll('button,a,[role="button"]')]
      .filter((control) => !control.closest('#dutiesContainer'))
      .map((control) => ({ control, key: control.dataset.dpMonthFinal || keyFromLabel(control.textContent) }))
      .filter(({ key }) => key);
  }

  function chooseMonth(entries) {
    const available = new Set(entries.map(({ key }) => key));
    const stored = readStoredMonth();
    if (stored && available.has(stored)) return stored;

    const today = new Date();
    const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const chosen = available.has(current) ? current : entries[0]?.key || '';
    storeMonth(chosen);
    return chosen;
  }

  function applyMonth(openSelected = false) {
    addStyle();
    const container = document.getElementById('dutiesContainer');
    const entries = monthCards();
    if (!container || !entries.length) return false;

    const available = new Set(entries.map(({ key }) => key));
    const chosen = available.has(readStoredMonth()) ? readStoredMonth() : chooseMonth(entries);
    storeMonth(chosen);
    container.classList.add('dp-month-filter-final');

    entries.forEach(({ card, key }) => {
      const visible = key === chosen;

      card.classList.remove('dp-ui-month-hidden', 'dp-stable-month-hidden', 'dp-month-current');
      card.classList.toggle('dp-month-final-current', visible);
      card.hidden = !visible;
      card.setAttribute('aria-hidden', visible ? 'false' : 'true');

      if (visible) {
        card.style.setProperty('display', 'block', 'important');
        if (openSelected) card.open = true;
      } else {
        card.style.setProperty('display', 'none', 'important');
        card.open = false;
      }
    });

    monthControls().forEach(({ control, key }) => {
      control.dataset.dpMonthFinal = key;
      const active = key === chosen;
      control.classList.toggle('dp-month-final-active', active);
      control.classList.toggle('dp-ui-month-active', active);
      control.setAttribute('aria-current', active ? 'true' : 'false');
    });

    return true;
  }

  function selectMonth(key) {
    if (!key) return;
    storeMonth(key);
    applyMonth(true);
  }

  function wrapRenderFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__dpMonthFinalWrapped) return;

    const wrapped = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(() => applyMonth(false));
      return result;
    };
    wrapped.__dpMonthFinalWrapped = true;
    wrapped.__dpMonthFinalOriginal = original;
    window[name] = wrapped;
  }

  function installRenderHooks() {
    if (renderHooksInstalled) return;
    wrapRenderFunction('renderDuties');
    wrapRenderFunction('renderAll');
    renderHooksInstalled = typeof window.renderDuties === 'function' || typeof window.renderAll === 'function';
  }

  function install() {
    installRenderHooks();
    applyMonth(false);
  }

  document.addEventListener('click', (event) => {
    const control = event.target.closest?.('button,a,[role="button"]');
    if (control && !control.closest('#dutiesContainer')) {
      const key = control.dataset.dpMonthFinal || keyFromLabel(control.textContent);
      if (key) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        selectMonth(key);
        return;
      }
    }

    if (event.target.closest?.('.tab[data-tab="eingabe"],#loginButton,#loadRunke,#loadSelectedProfile,#loadKollege,#tab-eingabe summary,#tab-eingabe button')) {
      setTimeout(install, 0);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'monthPicker') {
      const value = String(event.target.value || '');
      if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) storeMonth(value);
    }
    if (event.target.closest?.('#tab-eingabe')) setTimeout(install, 0);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  [80, 250, 700, 1400].forEach((delay) => setTimeout(install, delay));
  window.addEventListener('pageshow', install);
})();
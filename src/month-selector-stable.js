(() => {
  'use strict';

  const STYLE_ID = 'dpMonthSelectorStableStyle';
  const FALLBACK_ID = 'dpMonthSelectorFallback';
  const STORAGE_KEY = 'dienstpilot_selected_overview_month';
  const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const MONTH_RE = /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(20\d{2})$/i;
  let selectedKey = '';

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function monthKeyFromText(value) {
    const match = normalizeText(value).match(MONTH_RE);
    if (!match) return '';
    const month = MONTHS.findIndex((name) => name.toLowerCase() === match[1].toLowerCase()) + 1;
    return month ? `${match[2]}-${String(month).padStart(2, '0')}` : '';
  }

  function monthLabel(key) {
    const match = String(key || '').match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
    if (!match) return key;
    return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
  }

  function readSelected() {
    if (selectedKey) return selectedKey;
    try { selectedKey = sessionStorage.getItem(STORAGE_KEY) || ''; } catch {}
    return selectedKey;
  }

  function saveSelected(key) {
    selectedKey = key;
    try { sessionStorage.setItem(STORAGE_KEY, key); } catch {}
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dutiesContainer[data-dp-month-filter="active"] > details.month-group{display:none!important}
      #dutiesContainer[data-dp-month-filter="active"] > details.month-group.dp-month-current{display:block!important}
      #dutiesContainer > .past-divider{display:none!important}
      #tab-eingabe .dp-month-control-active{border-color:#0f172a!important;background:#0f172a!important;color:#fff!important}
      #${FALLBACK_ID}{margin:0 0 12px;padding:15px;border:1px solid #dbe4ee;border-radius:18px;background:#fff}
      #${FALLBACK_ID} strong{display:block;margin-bottom:10px;color:#334155;font-size:12px;text-transform:uppercase}
      #${FALLBACK_ID} .dp-month-fallback-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
      #${FALLBACK_ID} button{flex:0 0 auto;padding:8px 13px;border:1px solid #dbe4ee;border-radius:999px;background:#f8fafc;font-weight:900;cursor:pointer}
    `;
    document.head.appendChild(style);
  }

  function cards() {
    const duties = document.getElementById('dutiesContainer');
    if (!duties) return [];
    return [...duties.children]
      .filter((node) => node.matches?.('details.month-group[data-month]'))
      .map((card) => ({ card, key: String(card.dataset.month || '').trim() }))
      .filter((entry) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(entry.key));
  }

  function monthControls(section) {
    if (!section) return [];
    return [...section.querySelectorAll('button,a,[role="button"]')]
      .filter((control) => !control.closest('#dutiesContainer'))
      .map((control) => ({ control, key: monthKeyFromText(control.textContent) }))
      .filter((entry) => entry.key);
  }

  function chooseInitial(entries) {
    const available = new Set(entries.map((entry) => entry.key));
    const stored = readSelected();
    if (stored && available.has(stored)) return stored;

    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const chosen = available.has(current) ? current : entries[0]?.key || '';
    saveSelected(chosen);
    return chosen;
  }

  function ensureFallback(section, entries) {
    if (monthControls(section).length) {
      document.getElementById(FALLBACK_ID)?.remove();
      return;
    }

    let box = document.getElementById(FALLBACK_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = FALLBACK_ID;
      box.innerHTML = '<strong>Monat auswählen</strong><div class="dp-month-fallback-row"></div>';
      document.getElementById('dutiesContainer')?.insertAdjacentElement('beforebegin', box);
    }

    const row = box.querySelector('.dp-month-fallback-row');
    const signature = entries.map((entry) => entry.key).join('|');
    if (row.dataset.signature === signature) return;
    row.dataset.signature = signature;
    row.replaceChildren();

    entries.forEach(({ key }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.dpMonth = key;
      button.textContent = monthLabel(key);
      row.appendChild(button);
    });
  }

  function applySelection(requestedKey, openSelected = false) {
    const duties = document.getElementById('dutiesContainer');
    const section = document.getElementById('tab-eingabe');
    const entries = cards();
    if (!duties || !section || !entries.length) return false;

    const available = new Set(entries.map((entry) => entry.key));
    const chosen = available.has(requestedKey) ? requestedKey : chooseInitial(entries);
    saveSelected(chosen);
    duties.dataset.dpMonthFilter = 'active';

    entries.forEach(({ card, key }) => {
      const visible = key === chosen;
      card.classList.toggle('dp-month-current', visible);
      card.classList.toggle('dp-stable-month-hidden', !visible);
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

    monthControls(section).forEach(({ control, key }) => {
      control.dataset.dpMonth = key;
      const active = key === chosen;
      control.classList.toggle('dp-month-control-active', active);
      control.classList.toggle('dp-ui-month-active', active);
      control.setAttribute('aria-current', active ? 'true' : 'false');
    });

    document.querySelectorAll(`#${FALLBACK_ID} button[data-dp-month]`).forEach((button) => {
      const active = button.dataset.dpMonth === chosen;
      button.classList.toggle('dp-month-control-active', active);
      button.setAttribute('aria-current', active ? 'true' : 'false');
    });
    return true;
  }

  function install() {
    addStyle();
    const section = document.getElementById('tab-eingabe');
    const entries = cards();
    if (!section || !entries.length) return;
    ensureFallback(section, entries);
    applySelection(readSelected() || chooseInitial(entries), false);
  }

  function clickedMonth(event) {
    const section = event.target.closest?.('#tab-eingabe');
    if (!section) return '';
    const control = event.target.closest?.('button,a,[role="button"]');
    if (!control || control.closest('#dutiesContainer')) return '';
    return control.dataset.dpMonth || monthKeyFromText(control.textContent);
  }

  document.addEventListener('click', (event) => {
    const key = clickedMonth(event);
    if (key) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      saveSelected(key);
      applySelection(key, true);
      window.setTimeout(() => {
        document.querySelector(`#dutiesContainer > details.month-group[data-month="${CSS.escape(key)}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 20);
      return;
    }

    if (event.target.closest?.('.tab[data-tab="eingabe"],#loginButton,#loadRunke,#loadSelectedProfile,#loadKollege,#tab-eingabe summary')) {
      [0, 100, 300, 700].forEach((delay) => window.setTimeout(install, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'monthPicker') {
      const key = String(event.target.value || '');
      if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(key)) saveSelected(key);
      [100, 350, 800].forEach((delay) => window.setTimeout(install, delay));
    }
  }, true);

  [0, 100, 300, 700, 1500, 3000].forEach((delay) => window.setTimeout(install, delay));
  window.addEventListener('pageshow', install);
  window.addEventListener('focus', install);
  window.setInterval(install, 800);
})();
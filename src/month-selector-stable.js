(() => {
  'use strict';

  const ID = 'dpMonthSelectorStable';
  const STYLE_ID = 'dpMonthSelectorStableStyle';
  const STORAGE_KEY = 'dienstpilot_selected_overview_month';
  const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  let selectedKey = '';

  function readSelected() {
    if (selectedKey) return selectedKey;
    try { selectedKey = sessionStorage.getItem(STORAGE_KEY) || ''; } catch {}
    return selectedKey;
  }

  function saveSelected(key) {
    selectedKey = key;
    try { sessionStorage.setItem(STORAGE_KEY, key); } catch {}
  }

  function monthLabel(key) {
    const match = String(key || '').match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
    if (!match) return key;
    return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #tab-eingabe .dp-old-month-navigation{display:none!important}
      #${ID}{grid-column:1/-1;position:relative;margin:0 0 12px;padding:16px;border:1px solid #dbe4ee;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.055)}
      #${ID} .dp-month-selector-title{display:block;margin-bottom:10px;color:#334155;font-size:12px;font-weight:950;letter-spacing:.045em;text-transform:uppercase}
      #${ID} .dp-month-selector-buttons{display:flex;align-items:center;gap:8px;overflow-x:auto;padding:1px 1px 6px;scrollbar-width:thin}
      #${ID} button{flex:0 0 auto;min-height:38px;padding:8px 13px;border:1px solid #dbe4ee;border-radius:999px;background:#f8fafc;color:#334155;font-size:12px;font-weight:900;white-space:nowrap;cursor:pointer}
      #${ID} button:hover{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8}
      #${ID} button.dp-month-selected{border-color:#0f172a;background:#0f172a;color:#fff}
      #dutiesContainer>details.month-group.dp-stable-month-hidden{display:none!important}
      #dutiesContainer>.past-divider{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function cards() {
    const duties = document.getElementById('dutiesContainer');
    if (!duties) return [];
    return [...duties.querySelectorAll(':scope > details.month-group[data-month]')]
      .map((card) => ({ card, key: String(card.dataset.month || '').trim() }))
      .filter((entry) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(entry.key));
  }

  function pickInitial(entries) {
    const available = new Set(entries.map((entry) => entry.key));
    const stored = readSelected();
    if (stored && available.has(stored)) return stored;

    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const initial = available.has(current) ? current : entries[0]?.key || '';
    saveSelected(initial);
    return initial;
  }

  function hideOldNavigation(section) {
    [...section.children].forEach((node) => {
      if (node.id === ID || node.id === 'dutiesContainer') return;
      const monthControls = [...node.querySelectorAll?.('button,a,[role="button"]') || []]
        .filter((control) => /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+20\d{2}$/.test(String(control.textContent || '').trim()));
      if (monthControls.length >= 2 || /^Monate?:/i.test(String(node.textContent || '').trim())) {
        node.classList.add('dp-old-month-navigation');
        node.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function applySelection(key, open = false) {
    const entries = cards();
    if (!entries.length) return;
    const available = new Set(entries.map((entry) => entry.key));
    const chosen = available.has(key) ? key : pickInitial(entries);
    saveSelected(chosen);

    entries.forEach(({ card, key: cardKey }) => {
      const visible = cardKey === chosen;
      card.classList.toggle('dp-stable-month-hidden', !visible);
      card.hidden = !visible;
      card.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (visible) {
        card.style.removeProperty('display');
        if (open) card.open = true;
      } else {
        card.style.setProperty('display', 'none', 'important');
      }
    });

    document.querySelectorAll(`#${ID} button[data-month]`).forEach((button) => {
      const active = button.dataset.month === chosen;
      button.classList.toggle('dp-month-selected', active);
      button.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  function buildSelector(section, entries) {
    let box = document.getElementById(ID);
    if (!box) {
      box = document.createElement('div');
      box.id = ID;
      box.innerHTML = '<span class="dp-month-selector-title">Monat auswählen</span><div class="dp-month-selector-buttons"></div>';
      document.getElementById('dutiesContainer')?.insertAdjacentElement('beforebegin', box);
    }

    const row = box.querySelector('.dp-month-selector-buttons');
    const signature = entries.map((entry) => entry.key).join('|');
    if (row.dataset.signature !== signature) {
      row.dataset.signature = signature;
      row.replaceChildren();
      entries.forEach(({ key }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.month = key;
        button.textContent = monthLabel(key);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          saveSelected(key);
          applySelection(key, true);
          document.querySelector(`#dutiesContainer > details.month-group[data-month="${CSS.escape(key)}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        row.appendChild(button);
      });
    }
  }

  function install() {
    addStyle();
    const section = document.getElementById('tab-eingabe');
    const entries = cards();
    if (!section || !entries.length) return;
    hideOldNavigation(section);
    buildSelector(section, entries);
    applySelection(readSelected() || pickInitial(entries), false);
  }

  [0, 150, 500, 1200, 2500].forEach((delay) => setTimeout(install, delay));
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.tab[data-tab="eingabe"],#loginButton,#loadRunke,#tab-eingabe summary,#monthPicker')) {
      [0, 100, 300, 800].forEach((delay) => setTimeout(install, delay));
    }
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target?.id === 'monthPicker') [100, 350, 800].forEach((delay) => setTimeout(install, delay));
  }, true);
  addEventListener('pageshow', install);
  addEventListener('focus', install);
  setInterval(install, 1500);
})();
(() => {
  'use strict';

  if (window.__dienstpilotDirectMonthSelectorV7) return;
  window.__dienstpilotDirectMonthSelectorV7 = true;

  const BOX_ID = 'dpDirectMonthSelector';
  const DRIVER_PANEL_ID = 'dpDriverQuickOverview';
  const STYLE_ID = 'dpDirectMonthSelectorStyleV7';
  const STORAGE_KEY = 'dienstpilot_selected_overview_month_v3';
  const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  let selectedMonth = '';
  let renderHookInstalled = false;

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BOX_ID}{margin:18px 0 12px;padding:14px;border:1px solid #dbe4ee;border-radius:16px;background:#fff;box-shadow:0 5px 16px rgba(15,23,42,.04)}
      #${BOX_ID} .dp-direct-month-inner{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap}
      #${BOX_ID} .dp-direct-month-label{padding-top:8px;color:#475569;font-size:14px;font-weight:900;white-space:nowrap}
      #${BOX_ID} .dp-direct-month-buttons{display:flex;gap:7px;flex-wrap:wrap;min-width:0}
      #${BOX_ID} .dp-direct-month-button{appearance:none;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;padding:8px 12px;font:inherit;font-size:13px;font-weight:900;line-height:1.15;cursor:pointer;touch-action:manipulation}
      #${BOX_ID} .dp-direct-month-button:hover{border-color:#64748b;background:#f8fafc}
      #${BOX_ID} .dp-direct-month-button.active{border-color:#0f172a;background:#0f172a;color:#fff}
      #dutiesContainer.dp-direct-month-filter > :not(details.month-group):not(.past-divider){display:none!important}
      #dutiesContainer.dp-direct-month-filter > details.month-group{display:none!important}
      #dutiesContainer.dp-direct-month-filter > details.month-group.dp-direct-month-visible{display:block!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
      #dutiesContainer.dp-direct-month-filter > details.month-group.dp-direct-month-visible > summary{display:none!important}
      #dutiesContainer.dp-direct-month-filter > details.month-group > :not(summary):not(details.week-group){display:none!important}
      #dutiesContainer.dp-direct-month-filter > details.month-group.dp-direct-month-visible > details.week-group:first-of-type{margin-top:0!important}
      #dutiesContainer > .past-divider{display:none!important}
      @media(max-width:700px){#${BOX_ID} .dp-direct-month-inner{display:block}#${BOX_ID} .dp-direct-month-label{display:block;margin-bottom:9px;padding-top:0}#${BOX_ID} .dp-direct-month-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}#${BOX_ID} .dp-direct-month-button{width:100%}}
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

  function monthLabel(key) {
    const match = String(key || '').match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
    if (!match) return key;
    return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
  }

  function readSelected() {
    if (selectedMonth) return selectedMonth;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY) || '';
      if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(stored)) selectedMonth = stored;
    } catch {}
    return selectedMonth;
  }

  function saveSelected(key) {
    selectedMonth = key;
    try { sessionStorage.setItem(STORAGE_KEY, key); } catch {}
  }

  function chooseInitial(entries) {
    const available = new Set(entries.map(({ key }) => key));
    const stored = readSelected();
    if (stored && available.has(stored)) return stored;

    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const chosen = available.has(current) ? current : entries[0]?.key || '';
    if (chosen) saveSelected(chosen);
    return chosen;
  }

  function removeStructuralExtras(section, duties, box) {
    if (!section || !duties || !box) return;

    // Zwischen Monatsauswahl und Kalender werden alte Zusatzleisten entfernt.
    // Die neue Fahrerübersicht ist ausdrücklich geschützt und wird vor die
    // Monatsauswahl verschoben, statt gelöscht zu werden.
    let sibling = box.nextElementSibling;
    while (sibling && sibling !== duties) {
      const next = sibling.nextElementSibling;
      if (sibling.id === DRIVER_PANEL_ID) {
        section.insertBefore(sibling, box);
      } else {
        sibling.remove();
      }
      sibling = next;
    }

    // Im Kalendercontainer sind nur echte Monatskarten zulässig.
    [...duties.children].forEach((node) => {
      if (!node.matches?.('details.month-group,.past-divider')) node.remove();
    });

    // Innerhalb einer Monatskarte bleiben nur Überschrift und Kalenderwochen.
    duties.querySelectorAll(':scope > details.month-group').forEach((card) => {
      [...card.children].forEach((node) => {
        if (!node.matches?.('summary,details.week-group')) node.remove();
      });
    });

    section.querySelectorAll('#dpMonthSelectorStable,#dpMonthSelectorFallback,[data-dp-old-month-bar="1"]').forEach((node) => {
      if (node !== box && node.id !== DRIVER_PANEL_ID && !node.closest(`#${BOX_ID}`)) node.remove();
    });
  }

  function applySelection(key) {
    const container = document.getElementById('dutiesContainer');
    const entries = monthCards();
    if (!container || !entries.length) return false;

    const available = new Set(entries.map(({ key: entryKey }) => entryKey));
    const chosen = available.has(key) ? key : chooseInitial(entries);
    if (!chosen) return false;
    saveSelected(chosen);
    container.classList.add('dp-direct-month-filter');

    entries.forEach(({ card, key: entryKey }) => {
      const visible = entryKey === chosen;
      card.classList.toggle('dp-direct-month-visible', visible);
      card.hidden = !visible;
      card.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (visible) {
        card.style.setProperty('display', 'block', 'important');
        card.open = true;
      } else {
        card.style.setProperty('display', 'none', 'important');
        card.open = false;
      }
    });

    document.querySelectorAll(`#${BOX_ID} .dp-direct-month-button`).forEach((button) => {
      const active = button.dataset.month === chosen;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    return true;
  }

  function buildSelector() {
    addStyle();
    const section = document.getElementById('tab-eingabe');
    const duties = document.getElementById('dutiesContainer');
    const entries = monthCards();
    if (!section || !duties || !entries.length) return false;

    const signature = entries.map(({ key }) => key).join('|');
    let box = document.getElementById(BOX_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = BOX_ID;
      box.innerHTML = '<div class="dp-direct-month-inner"><div class="dp-direct-month-label">Monat auswählen:</div><div class="dp-direct-month-buttons"></div></div>';
      duties.insertAdjacentElement('beforebegin', box);
    }

    removeStructuralExtras(section, duties, box);

    const buttonRow = box.querySelector('.dp-direct-month-buttons');
    if (buttonRow.dataset.signature !== signature) {
      buttonRow.dataset.signature = signature;
      buttonRow.replaceChildren();

      entries.forEach(({ key }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dp-direct-month-button';
        button.dataset.month = key;
        button.textContent = monthLabel(key);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          saveSelected(key);
          applySelection(key);
          removeStructuralExtras(section, duties, box);
        });
        buttonRow.appendChild(button);
      });
    }

    applySelection(readSelected() || chooseInitial(entries));
    removeStructuralExtras(section, duties, box);
    return true;
  }

  function wrapRender(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__dpDirectMonthWrappedV7) return false;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(buildSelector);
      return result;
    };
    wrapped.__dpDirectMonthWrappedV7 = true;
    window[name] = wrapped;
    return true;
  }

  function installRenderHook() {
    if (renderHookInstalled) return;
    const a = wrapRender('renderDuties');
    const b = wrapRender('renderAll');
    renderHookInstalled = a || b;
  }

  function install() {
    installRenderHook();
    buildSelector();
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'monthPicker') {
      const key = String(event.target.value || '');
      if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(key)) saveSelected(key);
      setTimeout(install, 0);
    }
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.tab[data-tab="eingabe"],#loginButton,#loadRunke,#loadSelectedProfile,#loadKollege')) {
      [0, 120, 400].forEach((delay) => setTimeout(install, delay));
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  [80, 250, 700, 1400, 2400].forEach((delay) => setTimeout(install, delay));
  window.addEventListener('pageshow', install);
})();
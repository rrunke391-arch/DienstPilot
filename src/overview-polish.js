(() => {
  'use strict';

  const MONTH_RE = /(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(20\d{2})/i;
  const GRID_STYLE_ID = 'dpOverviewToolbarGridStyle';
  const MONTH_INDEX = {
    januar: 1,
    februar: 2,
    märz: 3,
    maerz: 3,
    april: 4,
    mai: 5,
    juni: 6,
    juli: 7,
    august: 8,
    september: 9,
    oktober: 10,
    november: 11,
    dezember: 12
  };

  let selectedMonthKey = '';

  function addGridStyle() {
    if (document.getElementById(GRID_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = GRID_STYLE_ID;
    style.textContent = `
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid{display:grid!important;grid-template-columns:.8fr 1.15fr 1.35fr;gap:12px;width:100%;margin:0 0 12px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group{position:relative;display:flex!important;align-items:center;align-content:flex-start;gap:9px!important;flex-wrap:wrap;min-width:0;margin:0!important;padding:47px 14px 14px!important;border:1px solid #dbe4ee!important;border-radius:18px!important;background:#fff!important;box-shadow:0 8px 22px rgba(15,23,42,.055)!important}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group::before{content:attr(data-dp-title);position:absolute;left:14px;right:14px;top:13px;color:#334155;font-size:12px;font-weight:950;letter-spacing:.045em;text-transform:uppercase}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group::after{content:"";position:absolute;left:14px;top:36px;width:42px;height:3px;border-radius:999px;background:#2563eb}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-period::after{background:#0ea5e9}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-actions::after{background:#0f172a}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group>*{max-width:100%}
      #dutiesContainer>.dp-ui-month-hidden{display:none!important}
      @media(min-width:900px){#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid{grid-column:1/-1}}
      @media(max-width:900px){#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid{grid-template-columns:1fr 1fr}#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-actions{grid-column:1/-1}}
      @media(max-width:700px){#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid{grid-template-columns:1fr}#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-actions{grid-column:auto}#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group{display:grid!important;grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function text(node) {
    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function monthKey(value) {
    const match = String(value || '').match(MONTH_RE);
    if (!match) return '';
    const month = MONTH_INDEX[match[1].toLowerCase()];
    return month ? `${match[2]}-${String(month).padStart(2, '0')}` : '';
  }

  function currentCalendarMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function markGroup(group) {
    const value = text(group).toLowerCase();
    group.classList.remove('dp-ui-profile', 'dp-ui-period', 'dp-ui-actions');
    delete group.dataset.dpTitle;

    if (value.includes('monat hinzufügen')) {
      group.classList.add('dp-ui-period');
      group.dataset.dpTitle = 'Monat und Zeitraum';
    } else if (value.includes('runke laden') || value.includes('kollege') || value.includes('vorlage')) {
      group.classList.add('dp-ui-profile');
      group.dataset.dpTitle = 'Fahrer und Vorlage';
    } else if (value.includes('alle löschen') || value.includes('jahresurlaub') || value.includes('dienstplan drucken') || value.includes('server speichern')) {
      group.classList.add('dp-ui-actions');
      group.dataset.dpTitle = 'Aktionen';
    }
  }

  function markTopBlocks(section, duties) {
    section.querySelectorAll('.toolbar-group').forEach(markGroup);

    [...section.children].forEach((node) => {
      if (node === duties) return;
      node.classList.remove('dp-ui-profile', 'dp-ui-period', 'dp-ui-actions', 'dp-ui-monthnav', 'dp-ui-toolbar-grid');

      const directGroups = node.matches('.toolbar') ? node.querySelectorAll(':scope > .toolbar-group') : [];
      if (directGroups.length > 1) {
        node.classList.add('dp-ui-toolbar-grid');
        return;
      }

      const value = text(node).toLowerCase();
      if (value.includes('monate:')) {
        node.classList.add('dp-ui-monthnav');
        node.dataset.dpTitle = 'Monat auswählen';
      } else if (value.includes('kollege') || value.includes('vorlage neu laden') || value.includes('runke laden')) {
        node.classList.add('dp-ui-profile');
        node.dataset.dpTitle = 'Fahrer und Vorlage';
      } else if (value.includes('alle löschen') || value.includes('jahresurlaub') || value.includes('dienstplan drucken') || value.includes('server speichern')) {
        node.classList.add('dp-ui-actions');
        node.dataset.dpTitle = 'Aktionen';
      } else if (value.includes('monat hinzufügen')) {
        node.classList.add('dp-ui-period');
        node.dataset.dpTitle = 'Monat und Zeitraum';
      }
    });
  }

  function collectMonthCards(duties) {
    return [...duties.children].map((card) => {
      card.classList.add('dp-ui-month-card');
      const candidates = [...card.querySelectorAll('button,summary,h2,h3')];
      const title = candidates.find((node) => MONTH_RE.test(text(node)));
      const key = monthKey(text(title));
      if (title) title.classList.add('dp-ui-month-title');
      if (key) card.dataset.dpMonthKey = key;
      candidates.forEach((node) => {
        if (/^KW\s+\d+/i.test(text(node))) node.classList.add('dp-ui-week-row');
      });
      const open = card.matches('details[open]') || Boolean(card.querySelector('details[open],[aria-expanded="true"]'));
      card.classList.toggle('dp-ui-month-open', open);
      return { card, title, key, open };
    }).filter((entry) => entry.key);
  }

  function chooseInitialMonth(cards) {
    const available = new Set(cards.map((entry) => entry.key));
    if (selectedMonthKey && available.has(selectedMonthKey)) return;

    const current = currentCalendarMonthKey();
    if (available.has(current)) {
      selectedMonthKey = current;
      return;
    }

    const opened = cards.find((entry) => entry.open);
    selectedMonthKey = opened?.key || cards[0]?.key || '';
  }

  function markMonths(duties, section) {
    duties.classList.add('dp-ui-months');
    const cards = collectMonthCards(duties);
    chooseInitialMonth(cards);

    cards.forEach(({ card, key }) => {
      const visible = key === selectedMonthKey;
      card.classList.toggle('dp-ui-month-hidden', !visible);
      card.hidden = !visible;
      card.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });

    section.querySelectorAll('.dp-ui-monthnav button,.dp-ui-monthnav a').forEach((button) => {
      const key = monthKey(text(button));
      if (key) button.dataset.dpMonthKey = key;
      const active = Boolean(key && key === selectedMonthKey);
      button.classList.toggle('dp-ui-month-active', active);
      button.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  function selectMonth(key) {
    if (!/^20\d{2}-\d{2}$/.test(String(key || ''))) return;
    selectedMonthKey = key;
    install();
  }

  function install() {
    addGridStyle();
    const section = document.getElementById('tab-eingabe');
    const duties = document.getElementById('dutiesContainer');
    if (!section || !duties) return;
    section.classList.add('dp-overview-polished');
    markTopBlocks(section, duties);
    markMonths(duties, section);
  }

  [0, 150, 500, 1200, 2500].forEach((delay) => setTimeout(install, delay));

  document.addEventListener('click', (event) => {
    const monthButton = event.target.closest?.('.dp-ui-monthnav button,.dp-ui-monthnav a');
    if (monthButton) {
      const key = monthButton.dataset.dpMonthKey || monthKey(text(monthButton));
      if (key) selectMonth(key);
      [80, 220, 500].forEach((delay) => setTimeout(install, delay));
      return;
    }

    if (event.target.closest?.('.tab[data-tab="eingabe"],#loginButton,#tab-eingabe button,#tab-eingabe summary')) {
      [0, 100, 300].forEach((delay) => setTimeout(install, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'monthPicker' && /^20\d{2}-\d{2}$/.test(event.target.value)) {
      selectedMonthKey = event.target.value;
      [120, 350, 800].forEach((delay) => setTimeout(install, delay));
      return;
    }
    if (event.target.closest?.('#tab-eingabe')) setTimeout(install, 100);
  });

  addEventListener('pageshow', install);
  addEventListener('focus', install);
  setInterval(install, 2500);
})();
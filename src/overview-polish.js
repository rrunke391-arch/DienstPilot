(() => {
  'use strict';

  const MONTH_RE = /(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+20\d{2}/i;
  const GRID_STYLE_ID = 'dpOverviewToolbarGridStyle';
  const RETIRED_TABS = ['auswertung', 'tests'];
  const RETIRED_SECTIONS = ['tab-auswertung', 'tab-tests'];

  function addGridStyle() {
    if (document.getElementById(GRID_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = GRID_STYLE_ID;
    style.textContent = `
      .tabs>.tab[data-tab="auswertung"],
      .tabs>.tab[data-tab="tests"],
      #tab-auswertung,
      #tab-tests,
      #overallPanel{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #reloadKollegeTemplate{display:none!important}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid{display:grid!important;grid-template-columns:minmax(170px,.8fr) minmax(0,1.2fr) minmax(0,1.35fr);gap:12px;width:100%;margin:0 0 12px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group{position:relative;display:flex!important;align-items:center;align-content:flex-start;gap:9px!important;flex-wrap:wrap;min-width:0;max-width:100%;overflow:hidden;margin:0!important;padding:47px 14px 14px!important;border:1px solid #dbe4ee!important;border-radius:18px!important;background:#fff!important;box-shadow:0 8px 22px rgba(15,23,42,.055)!important}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group::before{content:attr(data-dp-title);position:absolute;left:14px;right:14px;top:13px;color:#334155;font-size:12px;font-weight:950;letter-spacing:.045em;text-transform:uppercase}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group::after{content:"";position:absolute;left:14px;top:36px;width:42px;height:3px;border-radius:999px;background:#2563eb}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-period::after{background:#0ea5e9}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-actions::after{background:#0f172a}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group>*{min-width:0;max-width:100%}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-profile select{flex:1 1 170px;min-width:0!important}
      #tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-profile button{flex:0 1 auto}
      @media(min-width:900px){#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid{grid-column:1/-1}}
      @media(max-width:900px){#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid{grid-template-columns:1fr 1fr}#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-actions{grid-column:1/-1}}
      @media(max-width:700px){#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid{grid-template-columns:1fr}#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.dp-ui-actions{grid-column:auto}#tab-eingabe.dp-overview-polished>.dp-ui-toolbar-grid>.toolbar-group{display:grid!important;grid-template-columns:1fr;overflow:visible}}
    `;
    document.head.appendChild(style);
  }

  function text(node) {
    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function openOverview() {
    const overview = document.querySelector('.tab[data-tab="eingabe"]');
    if (overview && !overview.classList.contains('active')) overview.click();
  }

  function retireObsoleteViews() {
    let retiredWasActive = false;

    RETIRED_TABS.forEach((name) => {
      const button = document.querySelector(`.tabs>.tab[data-tab="${name}"]`);
      if (!button) return;
      retiredWasActive ||= button.classList.contains('active');
      button.hidden = true;
      button.disabled = true;
      button.tabIndex = -1;
      button.classList.remove('active');
      button.setAttribute('aria-hidden', 'true');
      button.style.setProperty('display', 'none', 'important');
    });

    RETIRED_SECTIONS.forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;
      retiredWasActive ||= !section.hidden && !section.classList.contains('hidden');
      section.hidden = true;
      section.classList.add('hidden');
      section.setAttribute('aria-hidden', 'true');
      section.style.setProperty('display', 'none', 'important');
    });

    const overall = document.getElementById('overallPanel');
    if (overall) {
      overall.hidden = true;
      overall.setAttribute('aria-hidden', 'true');
      overall.style.setProperty('display', 'none', 'important');
    }

    if (retiredWasActive) openOverview();
  }

  function removeOldControls() {
    document.getElementById('reloadKollegeTemplate')?.remove();

    document.querySelectorAll('#tab-eingabe button').forEach((button) => {
      const value = text(button).toLowerCase();
      if (value === 'vorlage neu laden' || value === 'vorlage laden') button.remove();
    });
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
      if (node === duties || node.id === 'dpMonthSelectorStable' || node.id === 'dpMonthSelectorFallback') return;
      node.classList.remove('dp-ui-profile', 'dp-ui-period', 'dp-ui-actions', 'dp-ui-toolbar-grid');

      const directGroups = node.matches('.toolbar') ? node.querySelectorAll(':scope > .toolbar-group') : [];
      if (directGroups.length > 1) {
        node.classList.add('dp-ui-toolbar-grid');
        return;
      }

      const value = text(node).toLowerCase();
      if (value.includes('kollege') || value.includes('vorlage neu laden') || value.includes('runke laden')) {
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

  function markMonths(duties) {
    duties.classList.add('dp-ui-months');
    duties.querySelectorAll(':scope > details.month-group').forEach((card) => {
      card.classList.add('dp-ui-month-card');
      const title = card.querySelector(':scope > summary');
      if (title && MONTH_RE.test(text(title))) title.classList.add('dp-ui-month-title');
      card.querySelectorAll('summary').forEach((summary) => {
        if (/^KW\s+\d+/i.test(text(summary))) summary.classList.add('dp-ui-week-row');
      });
      card.classList.toggle('dp-ui-month-open', Boolean(card.open));
    });
  }

  function install() {
    addGridStyle();
    retireObsoleteViews();
    removeOldControls();
    const section = document.getElementById('tab-eingabe');
    const duties = document.getElementById('dutiesContainer');
    if (!section || !duties) return;
    section.classList.add('dp-overview-polished');
    markTopBlocks(section, duties);
    markMonths(duties);
  }

  [0, 150, 500, 1200].forEach((delay) => setTimeout(install, delay));
  document.addEventListener('click', (event) => {
    const retired = event.target.closest?.('.tab[data-tab="auswertung"],.tab[data-tab="tests"]');
    if (retired) {
      event.preventDefault();
      event.stopImmediatePropagation();
      retireObsoleteViews();
      openOverview();
      return;
    }
    if (event.target.closest?.('.tab[data-tab="eingabe"],#loginButton,#tab-eingabe button,#tab-eingabe summary')) {
      [0, 100, 300].forEach((delay) => setTimeout(install, delay));
    }
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target.closest?.('#tab-eingabe')) setTimeout(install, 100);
  });
  addEventListener('pageshow', install);
  addEventListener('focus', retireObsoleteViews);
})();
(() => {
  'use strict';

  const MONTH_RE = /^(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+20\d{2}/i;

  function text(node) {
    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function markTopBlocks(section, duties) {
    [...section.children].forEach((node) => {
      if (node === duties) return;
      const value = text(node).toLowerCase();
      node.classList.remove('dp-ui-profile', 'dp-ui-period', 'dp-ui-actions', 'dp-ui-monthnav');

      if (value.includes('monate:')) {
        node.classList.add('dp-ui-monthnav');
        node.dataset.dpTitle = 'Monate auswählen';
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

    section.querySelectorAll('.toolbar-group').forEach((group) => {
      const value = text(group).toLowerCase();
      if (value.includes('monat hinzufügen')) group.classList.add('dp-ui-period');
      if (value.includes('runke laden') || value.includes('kollege')) group.classList.add('dp-ui-profile');
      if (value.includes('alle löschen') || value.includes('dienstplan drucken')) group.classList.add('dp-ui-actions');
    });
  }

  function markMonths(duties, section) {
    duties.classList.add('dp-ui-months');
    [...duties.children].forEach((card) => {
      card.classList.add('dp-ui-month-card');
      const candidates = [...card.querySelectorAll('button,summary,h2,h3')];
      const title = candidates.find((node) => MONTH_RE.test(text(node)));
      if (title) title.classList.add('dp-ui-month-title');
      candidates.forEach((node) => {
        if (/^KW\s+\d+/i.test(text(node))) node.classList.add('dp-ui-week-row');
      });
      const open = card.matches('details[open]') || Boolean(card.querySelector('details[open],[aria-expanded="true"]'));
      card.classList.toggle('dp-ui-month-open', open);
    });

    const expanded = duties.querySelector('.dp-ui-month-open .dp-ui-month-title');
    const activeText = text(expanded);
    section.querySelectorAll('.dp-ui-monthnav button,.dp-ui-monthnav a').forEach((button) => {
      const label = text(button);
      button.classList.toggle('dp-ui-month-active', Boolean(activeText && label && activeText.includes(label)));
    });
  }

  function install() {
    const section = document.getElementById('tab-eingabe');
    const duties = document.getElementById('dutiesContainer');
    if (!section || !duties) return;
    section.classList.add('dp-overview-polished');
    markTopBlocks(section, duties);
    markMonths(duties, section);
  }

  [0, 150, 500, 1200, 2500].forEach((delay) => setTimeout(install, delay));
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.tab[data-tab="eingabe"],#loginButton,#tab-eingabe button,#tab-eingabe summary')) {
      [0, 100, 300].forEach((delay) => setTimeout(install, delay));
    }
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target.closest?.('#tab-eingabe')) setTimeout(install, 100);
  });
  addEventListener('pageshow', install);
  addEventListener('focus', install);
  setInterval(install, 2500);
})();
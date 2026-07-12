(() => {
  'use strict';

  const DAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

  function minutes(value) {
    const match = String(value || '').match(/^(\d{1,2}):([0-5]\d)$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function durationText(start, end) {
    const a = minutes(start);
    const b = minutes(end);
    if (a === null || b === null) return '—';
    let total = b - a;
    if (total < 0) total += 1440;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (!hours) return `${mins} Min.`;
    if (!mins) return `${hours} Std.`;
    return `${hours} Std. ${String(mins).padStart(2, '0')} Min.`;
  }

  function dateText(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value || 'Datum nicht eingetragen';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
    return `${DAYS[date.getDay()]}, ${match[3]}.${match[2]}.${match[1]}`;
  }

  function value(card, field) {
    return String(card.querySelector(`[data-field="${field}"]`)?.value || '').trim();
  }

  function updateCard(card) {
    card.classList.add('dp-duty-simple-card');
    let summary = card.querySelector('.dp-duty-simple-summary');
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'dp-duty-simple-summary';
      card.querySelector('.duty-head')?.insertAdjacentElement('afterend', summary);
    }

    const number = value(card, 'number');
    const heading = card.querySelector('.duty-head h2');
    if (heading) heading.textContent = `Dienst ${number || 'ohne Nummer'}`;

    const nextHtml = `
      <div class="dp-duty-summary-date">${dateText(value(card, 'date'))}</div>
      <div class="dp-duty-summary-duration"><span>Dienstzeit</span><strong>${durationText(value(card, 'start'), value(card, 'end'))}</strong></div>
    `;
    if (summary.innerHTML !== nextHtml) summary.innerHTML = nextHtml;
  }

  function install() {
    const section = document.getElementById('tab-eingabe');
    if (!section) return;
    section.classList.add('dp-simple-duty-view');
    section.querySelectorAll('.duty-card:not(.frei-card)').forEach(updateCard);
  }

  [0, 150, 500, 1200].forEach((delay) => setTimeout(install, delay));

  document.addEventListener('input', (event) => {
    if (!event.target.closest?.('#tab-eingabe .duty-card [data-field]')) return;
    setTimeout(install, 0);
  }, true);

  document.addEventListener('change', (event) => {
    if (!event.target.closest?.('#tab-eingabe .duty-card [data-field]')) return;
    [0, 100, 300].forEach((delay) => setTimeout(install, delay));
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.tab[data-tab="eingabe"],#loginButton,#tab-eingabe button,#tab-eingabe summary')) {
      [0, 100, 300].forEach((delay) => setTimeout(install, delay));
    }
  }, true);

  addEventListener('pageshow', install);
})();
(() => {
  'use strict';

  const STYLE_ID = 'dpDailyPlanSeparationStyle';
  const WEEKDAY_PRINT_ID = 'dpDailyPrintWeekday';
  const WEEKEND_PRINT_ID = 'dpDailyPrintWeekend';
  const MODE_ID = 'dpDailyPlanModeLabel';

  function currentDate() {
    return String(document.getElementById('dpDailyPlanDate')?.value || '').trim();
  }

  function dayOfWeek(date) {
    const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return -1;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0).getDay();
  }

  function isWeekday(date) {
    const day = dayOfWeek(date);
    return day >= 1 && day <= 5;
  }

  function isWeekend(date) {
    const day = dayOfWeek(date);
    return day === 0 || day === 6;
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status' + (kind ? ' ' + kind : '');
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dpDailyInsertDefaults,#dpDailyPrint,#dpDailyPrintA4{display:none!important}
      .dp-daily-plan-print-separation{display:grid;grid-template-columns:minmax(260px,1fr) minmax(260px,1fr);gap:10px;width:100%;margin-bottom:2px}
      .dp-daily-plan-print-separation button{min-height:48px;padding:11px 15px;border:2px solid #cbd5e1;border-radius:12px;background:#fff;color:#0f172a;font-weight:900;cursor:pointer;text-align:center}
      .dp-daily-plan-print-separation button.dp-active-plan{border-color:#020617;background:#020617;color:#fff}
      .dp-daily-plan-mode-label{padding:10px 12px;border-radius:12px;background:#f1f5f9;color:#334155;font-weight:900}
      .dp-daily-plan-mode-label.weekday{background:#e0f2fe;color:#075985}
      .dp-daily-plan-mode-label.weekend{background:#fef3c7;color:#92400e}
      @media(max-width:760px){.dp-daily-plan-print-separation{grid-template-columns:1fr}.dp-daily-plan-print-separation button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function printCurrentPlan(expectedMode) {
    const date = currentDate();
    if (!date) {
      setStatus('Bitte zuerst ein Datum auswählen.', 'error');
      return;
    }

    if (expectedMode === 'weekday' && !isWeekday(date)) {
      setStatus('Für diesen Druck bitte ein Datum von Montag bis Freitag auswählen.', 'error');
      return;
    }

    if (expectedMode === 'weekend' && !isWeekend(date)) {
      setStatus('Für diesen Druck bitte einen Samstag oder Sonntag auswählen.', 'error');
      return;
    }

    const printButton = document.getElementById('dpDailyPrintA4');
    if (!printButton) {
      setStatus('Die A4-Druckfunktion wird noch geladen. Bitte den Schalter gleich noch einmal drücken.', 'error');
      return;
    }

    printButton.click();
  }

  function createPrintButtons(actions) {
    let wrapper = document.querySelector('.dp-daily-plan-print-separation');
    if (wrapper) return wrapper;

    wrapper = document.createElement('div');
    wrapper.className = 'dp-daily-plan-print-separation';

    const weekday = document.createElement('button');
    weekday.id = WEEKDAY_PRINT_ID;
    weekday.type = 'button';
    weekday.textContent = 'Dienstplan von Montag bis Freitag drucken';
    weekday.addEventListener('click', () => printCurrentPlan('weekday'));

    const weekend = document.createElement('button');
    weekend.id = WEEKEND_PRINT_ID;
    weekend.type = 'button';
    weekend.textContent = 'Dienstplan Samstag, Sonntag drucken';
    weekend.addEventListener('click', () => printCurrentPlan('weekend'));

    wrapper.append(weekday, weekend);
    actions.insertAdjacentElement('beforebegin', wrapper);
    return wrapper;
  }

  function installModeLabel(card) {
    let label = document.getElementById(MODE_ID);
    if (label) return label;

    label = document.createElement('div');
    label.id = MODE_ID;
    label.className = 'dp-daily-plan-mode-label';
    const top = card.querySelector('.dp-daily-top');
    top?.insertAdjacentElement('afterend', label);
    return label;
  }

  function updateMode() {
    const date = currentDate();
    const weekday = isWeekday(date);
    const weekend = isWeekend(date);
    const weekdayButton = document.getElementById(WEEKDAY_PRINT_ID);
    const weekendButton = document.getElementById(WEEKEND_PRINT_ID);
    const label = document.getElementById(MODE_ID);

    weekdayButton?.classList.toggle('dp-active-plan', weekday);
    weekendButton?.classList.toggle('dp-active-plan', weekend);

    if (weekdayButton) {
      weekdayButton.title = weekday
        ? 'Den ausgewählten Werktagsdienstplan drucken'
        : 'Dafür ein Datum von Montag bis Freitag auswählen';
    }
    if (weekendButton) {
      weekendButton.title = weekend
        ? 'Den ausgewählten Samstags- oder Sonntagsdienstplan drucken'
        : 'Dafür einen Samstag oder Sonntag auswählen';
    }

    if (label) {
      label.className = 'dp-daily-plan-mode-label' + (weekday ? ' weekday' : weekend ? ' weekend' : '');
      label.textContent = weekday
        ? 'Aktiver Plan: Montag bis Freitag – Werktagsdienste sind vom Wochenende getrennt.'
        : weekend
          ? 'Aktiver Plan: Samstag oder Sonntag – Wochenenddienste sind von Montag bis Freitag getrennt.'
          : 'Bitte ein Datum auswählen.';
    }

    const empty = document.querySelector('#dpDailyPlanRows .dp-preview-empty');
    if (empty && /Noch keine Einträge|Standarddienste/.test(empty.textContent || '')) {
      empty.textContent = weekday
        ? 'Der Dienstplan Montag bis Freitag wird für dieses Datum automatisch eingefügt.'
        : weekend
          ? 'Der passende Samstags- oder Sonntagsdienstplan wird für dieses Datum automatisch eingefügt.'
          : 'Bitte ein Datum auswählen.';
    }
  }

  function install() {
    addStyle();
    const card = document.querySelector('#tab-daily-duty-plan .dp-daily-card');
    const actions = card?.querySelector('.dp-daily-actions');
    if (!card || !actions) return false;

    const insertButton = document.getElementById('dpDailyInsertDefaults');
    if (insertButton) {
      insertButton.hidden = true;
      insertButton.setAttribute('aria-hidden', 'true');
      insertButton.tabIndex = -1;
    }

    const oldPrint = document.getElementById('dpDailyPrint');
    const a4Print = document.getElementById('dpDailyPrintA4');
    [oldPrint, a4Print].filter(Boolean).forEach((button) => {
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });

    const subtitle = card.querySelector('.dp-daily-title .muted');
    if (subtitle) subtitle.textContent = 'Werktagspläne sowie Samstags- und Sonntagspläne werden getrennt bearbeitet, gespeichert und gedruckt.';

    createPrintButtons(actions);
    installModeLabel(card);
    updateMode();
    return true;
  }

  [0, 150, 500, 1200, 2500].forEach((delay) => window.setTimeout(install, delay));
  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpDailyPlanDate') window.setTimeout(updateMode, 80);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton,#dpDailyAddRow,#dpDailyClear')) {
      [0, 120, 350].forEach((delay) => window.setTimeout(() => {
        install();
        updateMode();
      }, delay));
    }
  }, true);
  window.addEventListener('pageshow', () => { install(); updateMode(); });
  window.addEventListener('focus', () => { install(); updateMode(); });
  window.setInterval(() => { install(); updateMode(); }, 1500);
})();
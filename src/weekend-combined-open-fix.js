(() => {
  'use strict';

  if (window.__dienstpilotWeekendCombinedOpenFixV1) return;
  window.__dienstpilotWeekendCombinedOpenFixV1 = true;

  const WEEKEND_BUTTON_ID = 'dpDailyPrintWeekend';
  const EDIT_BUTTON_ID = 'dpDailyEditWeekend';
  const PANEL_ID = 'dpWeekendCombinedEditor';
  const STYLE_ID = 'dpWeekendCombinedOpenFixStyle';

  let opening = false;
  let refreshTimer = 0;

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #tab-daily-duty-plan .dp-weekend-edit-buttons{display:none!important}
      body.dp-weekend-combined-open #tab-daily-duty-plan .dp-daily-card > .dp-daily-actions,
      body.dp-weekend-combined-open #tab-daily-duty-plan .dp-daily-card > .dp-daily-table-wrap,
      body.dp-weekend-combined-open #tab-daily-duty-plan .dp-daily-card > .dp-daily-preview{display:none!important}
      body.dp-weekend-combined-open #${PANEL_ID}{display:grid!important;visibility:visible!important;opacity:1!important}
      #${PANEL_ID} [data-day="saturday"],#${PANEL_ID} [data-day="sunday"]{display:grid!important;visibility:visible!important}
      #${PANEL_ID} [data-day="sunday"]{margin-top:8px;border-top:4px solid #0f172a;padding-top:16px}
    `;
    document.head.appendChild(style);
  }

  function refreshButton() {
    addStyle();
    const button = document.getElementById(WEEKEND_BUTTON_ID);
    if (button) {
      const label = 'Samstag und Sonntag gemeinsam bearbeiten und anschließend drucken';
      if (button.textContent !== label) button.textContent = label;
      button.title = 'Öffnet Samstag und Sonntag gleichzeitig. Danach gemeinsam speichern und drucken.';
    }

    const editButton = document.getElementById(EDIT_BUTTON_ID);
    if (editButton) {
      editButton.hidden = true;
      editButton.setAttribute('aria-hidden', 'true');
      editButton.tabIndex = -1;
    }
  }

  function forceVisible() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return false;

    panel.hidden = false;
    panel.removeAttribute('hidden');
    panel.style.setProperty('display', 'grid', 'important');
    panel.style.setProperty('visibility', 'visible', 'important');
    document.body.classList.add('dp-weekend-combined-open');

    const saturday = panel.querySelector('[data-day="saturday"]');
    const sunday = panel.querySelector('[data-day="sunday"]');
    saturday?.style.setProperty('display', 'grid', 'important');
    sunday?.style.setProperty('display', 'grid', 'important');

    return Boolean(saturday && sunday);
  }

  async function openCombinedEditor() {
    if (opening) return;
    opening = true;

    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (typeof window.dienstpilotOpenWeekendCombinedEditor === 'function') break;
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }

      if (typeof window.dienstpilotOpenWeekendCombinedEditor !== 'function') return;
      await Promise.resolve(window.dienstpilotOpenWeekendCombinedEditor());

      for (const delay of [0, 80, 220, 500, 900]) {
        window.setTimeout(() => {
          const complete = forceVisible();
          if (!complete && typeof window.dienstpilotOpenWeekendCombinedEditor === 'function') {
            void window.dienstpilotOpenWeekendCombinedEditor();
          }
        }, delay);
      }

      window.setTimeout(() => {
        const panel = document.getElementById(PANEL_ID);
        panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 260);
    } finally {
      opening = false;
    }
  }

  document.addEventListener('click', (event) => {
    const weekendButton = event.target.closest?.(`#${WEEKEND_BUTTON_ID}`);
    const editButton = event.target.closest?.(`#${EDIT_BUTTON_ID}`);
    if (!weekendButton && !editButton) return;

    // Ein programmgesteuerter Klick nach „Speichern und gemeinsam drucken“
    // muss weiterhin direkt den Druckdialog öffnen.
    if (weekendButton && !event.isTrusted) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void openCombinedEditor();
  }, true);

  function scheduleRefresh(delay = 40) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshButton, delay);
  }

  const start = () => {
    refreshButton();
    const observer = new MutationObserver(() => scheduleRefresh(25));
    observer.observe(document.body, { childList: true, subtree: true });
    [100, 300, 800, 1600].forEach((delay) => window.setTimeout(refreshButton, delay));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', refreshButton);
  window.addEventListener('focus', refreshButton);
})();
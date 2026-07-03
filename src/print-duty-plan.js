(() => {
  'use strict';

  const PRINT_BUTTON_ID = 'printDutyPlan';
  const DUTIES_CONTAINER_ID = 'dutiesContainer';
  const PROFILE_TITLE_ID = 'profileTitle';

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  ready(() => {
    ensurePrintButton();

    document.addEventListener('click', (event) => {
      const printBtn = event.target.closest?.('#' + PRINT_BUTTON_ID);
      if (!printBtn) return;

      event.preventDefault();
      printDutyPlan();
    });

    const observer = new MutationObserver(() => ensurePrintButton());
    observer.observe(document.body, { childList: true, subtree: true });
  });

  function ensurePrintButton() {
    if (document.getElementById(PRINT_BUTTON_ID)) {
      return;
    }

    const clearBtn = document.getElementById('clearDuties');
    const toggleSundays = document.getElementById('toggleSundays')?.closest('label');
    const toolbarGroup = clearBtn?.closest('.toolbar-group') || toggleSundays?.closest('.toolbar-group');

    if (!toolbarGroup) {
      console.warn('Druckbutton konnte nicht eingefügt werden: Toolbar-Gruppe nicht gefunden.');
      return;
    }

    const printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.className = 'btn-secondary';
    printBtn.id = PRINT_BUTTON_ID;
    printBtn.textContent = '🖨 Dienstplan drucken';

    if (toggleSundays) {
      toolbarGroup.insertBefore(printBtn, toggleSundays);
    } else if (clearBtn) {
      clearBtn.insertAdjacentElement('afterend', printBtn);
    } else {
      toolbarGroup.appendChild(printBtn);
    }
  }

  function printDutyPlan() {
    const dutiesContainer = document.getElementById(DUTIES_CONTAINER_ID);
    const profileTitle = document.getElementById(PROFILE_TITLE_ID)?.textContent?.trim() || 'Dienstplan';

    if (!dutiesContainer || !dutiesContainer.innerHTML.trim()) {
      alert('Kein Dienstplan zum Drucken vorhanden.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=800');

    if (!printWindow) {
      alert('Druckfenster konnte nicht geöffnet werden. Bitte Pop-ups erlauben.');
      return;
    }

    const today = new Date().toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const printableContent = preparePrintableContent(dutiesContainer);

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(profileTitle)} drucken</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }

    body {
      margin: 24px;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.35;
    }

    h1 {
      margin: 0 0 4px;
      font-size: 24px;
      line-height: 1.2;
    }

    .print-meta {
      margin: 0 0 24px;
      color: #6b7280;
      font-size: 14px;
    }

    button,
    input,
    select,
    textarea,
    .toolbar,
    .btn-primary,
    .btn-secondary,
    .tab,
    .tabs,
    .hidden {
      display: none !important;
    }

    .card,
    .duty-card,
    .day-card,
    .duty,
    .day,
    article,
    section > div {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .card,
    .duty-card,
    .day-card {
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 12px;
      background: #ffffff;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }

    th,
    td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
      font-size: 13px;
    }

    th {
      background: #f3f4f6;
      font-weight: 700;
    }

    .muted,
    small {
      color: #6b7280;
    }

    img {
      max-width: 100%;
    }

    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <h1>DienstPilot · Dienstplan</h1>
  <div class="print-meta">${escapeHtml(profileTitle)} · gedruckt am ${escapeHtml(today)}</div>
  <main>${printableContent}</main>
  <script>
    window.addEventListener('load', () => {
      window.focus();
      window.print();
    });

    window.addEventListener('afterprint', () => {
      window.close();
    });
  <\/script>
</body>
</html>`);
    printWindow.document.close();
  }

  function preparePrintableContent(container) {
    const clone = container.cloneNode(true);

    clone.querySelectorAll('button, input, select, textarea, script').forEach((element) => {
      const replacement = document.createElement('span');
      const value = getControlText(element);

      if (value) {
        replacement.textContent = value;
      }

      element.replaceWith(replacement);
    });

    clone.querySelectorAll('[contenteditable="true"]').forEach((element) => {
      element.removeAttribute('contenteditable');
    });

    return clone.innerHTML;
  }

  function getControlText(element) {
    if (element.matches('input[type="checkbox"], input[type="radio"]')) {
      return element.checked ? '✓' : '';
    }

    if (element.matches('input, textarea, select')) {
      return element.value || element.getAttribute('value') || '';
    }

    return element.textContent?.trim() || '';
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();

(() => {
  'use strict';

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function installJahresurlaubStyle() {
    if (document.getElementById('jahresurlaubDienstplanStyle')) return;
    const style = document.createElement('style');
    style.id = 'jahresurlaubDienstplanStyle';
    style.textContent = `
      .jahresurlaub-dienstplan-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 6px;
        white-space: nowrap;
      }
      .day-group.jahresurlaub-day > summary {
        box-shadow: inset 4px 0 0 #16a34a;
      }
    `;
    document.head.appendChild(style);
  }

  function getAllJahresurlaubDates() {
    const selected = new Set();
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('dienstpilot_urlaubswunsch_')) continue;
      try {
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(arr)) {
          arr.forEach((date) => selected.add(date));
        }
      } catch {
        /* defekten Eintrag ignorieren */
      }
    }
    return selected;
  }

  function applyJahresurlaubToDienstplan() {
    installJahresurlaubStyle();
    const selected = getAllJahresurlaubDates();

    document.querySelectorAll('details.day-group[data-day]').forEach((dayEl) => {
      const date = dayEl.getAttribute('data-day');
      const summary = dayEl.querySelector(':scope > summary');
      if (!summary || !date) return;

      let badge = summary.querySelector('.jahresurlaub-dienstplan-badge');
      if (selected.has(date)) {
        dayEl.classList.add('jahresurlaub-day', 'vacation');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'vacation-badge jahresurlaub-dienstplan-badge';
          badge.textContent = '🌴 Jahresurlaub';
          const beforeDuty = summary.querySelector('.summary-duty');
          if (beforeDuty) {
            summary.insertBefore(badge, beforeDuty);
          } else {
            summary.appendChild(badge);
          }
        }
      } else {
        dayEl.classList.remove('jahresurlaub-day');
        if (badge) badge.remove();
      }
    });
  }

  function renameUrlaubswunschUi() {
    const oldBtn = document.getElementById('openUrlaubswunsch');
    const newBtn = document.getElementById('openJahresurlaub');
    [oldBtn, newBtn].filter(Boolean).forEach((btn) => {
      btn.textContent = '🌴 Jahresurlaub';
      btn.title = 'Jahresurlaub öffnen';
    });

    document.querySelectorAll('.urlaubswunsch-head h2').forEach((title) => {
      title.textContent = '🌴 Jahresurlaub';
    });
    document.querySelectorAll('.urlaubswunsch-head p').forEach((text) => {
      text.textContent = 'Jahreskalender: Tage anklicken, um Jahresurlaub zu markieren oder wieder zu entfernen.';
    });
    document.querySelectorAll('#urlaubswunschInfo').forEach((info) => {
      info.innerHTML = info.innerHTML
        .replaceAll('Urlaubswunsch-Tag', 'Jahresurlaub-Tag')
        .replaceAll('Urlaubswunsch-Tage', 'Jahresurlaub-Tage');
    });
  }

  function refreshJahresurlaub() {
    renameUrlaubswunschUi();
    applyJahresurlaubToDienstplan();
  }

  ready(() => {
    refreshJahresurlaub();

    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#openUrlaubswunsch, #openJahresurlaub, .urlaubswunsch-day, #urlaubswunschClear, #urlaubswunschPrev, #urlaubswunschNext')) {
        setTimeout(refreshJahresurlaub, 50);
        setTimeout(refreshJahresurlaub, 250);
      }
    });

    const observer = new MutationObserver(() => {
      window.clearTimeout(observer._timer);
      observer._timer = window.setTimeout(refreshJahresurlaub, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(refreshJahresurlaub, 800);
    setTimeout(refreshJahresurlaub, 1800);
  });
})();

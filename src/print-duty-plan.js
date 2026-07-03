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

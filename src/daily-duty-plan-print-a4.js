(() => {
  'use strict';

  const ORIGINAL_ID = 'dpDailyPrint';
  const A4_ID = 'dpDailyPrintA4';
  let installed = false;

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status' + (kind ? ' ' + kind : '');
  }

  function printA4() {
    const preview = document.getElementById('dpDailyPlanPreview');
    const rows = preview ? [...preview.querySelectorAll('.dp-preview-row')] : [];
    const header = preview?.querySelector('.dp-preview-head');

    if (!rows.length || !header) {
      setStatus('Es sind keine Einträge zum Drucken vorhanden.', 'error');
      return;
    }

    const chunks = [];
    for (let index = 0; index < rows.length; index += 17) {
      chunks.push(rows.slice(index, index + 17));
    }

    const pages = chunks.map((chunk, index) => `
      <section class="page${index === chunks.length - 1 ? ' last' : ''}">
        ${index === 0 ? header.outerHTML : ''}
        <div class="rows">${chunk.map((row) => row.outerHTML).join('')}</div>
      </section>
    `).join('');

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      setStatus('Die Druckansicht konnte nicht geöffnet werden.', 'error');
      return;
    }

    doc.open();
    doc.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Dienstplan</title><style>
      @page { size: A4 portrait; margin: 10mm; }
      html, body { margin: 0; padding: 0; width: 100%; max-width: 100%; }
      * { box-sizing: border-box; }
      body {
        color: #111;
        background: #fff;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 9.8pt;
        overflow: visible;
      }
      .page {
        width: 100%;
        max-width: 100%;
        min-height: 277mm;
        overflow: hidden;
        page-break-after: always;
        break-after: page;
      }
      .page.last { page-break-after: auto; break-after: auto; }
      .dp-preview-head {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(0, .75fr) minmax(0, 1fr);
        column-gap: 3mm;
        row-gap: 1mm;
        width: 100%;
        max-width: 100%;
        margin: 0 0 6mm;
        align-items: start;
        font-size: 11.2pt;
        font-weight: 800;
      }
      .dp-preview-head > * { min-width: 0; overflow-wrap: anywhere; }
      .dp-preview-head .right { text-align: right; }
      .dp-preview-stop-title {
        grid-column: 3;
        margin-top: 0;
        text-align: left;
        font-size: 10.4pt;
      }
      .rows { width: 100%; max-width: 100%; }
      .dp-preview-row {
        display: grid;
        grid-template-columns: minmax(0, 23fr) minmax(0, 31fr) minmax(0, 46fr);
        column-gap: 3mm;
        width: 100%;
        max-width: 100%;
        min-height: 14.5mm;
        align-items: start;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .dp-preview-left,
      .dp-preview-middle,
      .dp-preview-right {
        min-width: 0;
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: normal;
      }
      .dp-preview-left,
      .dp-preview-middle {
        display: flex;
        flex-direction: column;
        line-height: 1.25;
      }
      .dp-preview-row strong {
        display: block;
        max-width: 100%;
        font-size: 10.3pt;
        line-height: 1.2;
      }
      .dp-preview-row span,
      .dp-preview-right {
        display: block;
        max-width: 100%;
        font-size: 9.5pt;
        line-height: 1.25;
      }
      .dp-preview-right { padding-top: 5mm; }
      @media print {
        html, body { width: 100%; max-width: 100%; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style></head><body>${pages}</body></html>`);
    doc.close();

    window.setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setStatus('Druckansicht im A4-Format geöffnet.', 'ok');
      } finally {
        window.setTimeout(() => frame.remove(), 1800);
      }
    }, 300);
  }

  function install() {
    const original = document.getElementById(ORIGINAL_ID);
    const existing = document.getElementById(A4_ID);

    if (existing) {
      installed = true;
      return true;
    }
    if (!original) return false;

    original.id = A4_ID;
    original.dataset.a4Print = '1';
    original.title = 'Dienstplan passend auf A4 drucken';
    original.addEventListener('click', printA4);
    installed = true;
    return true;
  }

  [0, 150, 500, 1200, 2500].forEach((delay) => window.setTimeout(install, delay));
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton')) {
      [0, 150, 500].forEach((delay) => window.setTimeout(install, delay));
    }
  }, true);
  window.addEventListener('pageshow', install);
  window.addEventListener('focus', install);
})();
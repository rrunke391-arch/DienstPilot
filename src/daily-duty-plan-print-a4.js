(() => {
  'use strict';

  const ORIGINAL_ID = 'dpDailyPrint';
  const A4_ID = 'dpDailyPrintA4';
  const PRINT_VERSION = '2';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status' + (kind ? ` ${kind}` : '');
  }

  function selectedDate() {
    return String(document.getElementById('dpDailyPlanDate')?.value || '').trim();
  }

  function dateObject(iso) {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }

  function germanDate(iso) {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
  }

  function weekdayName(iso) {
    const date = dateObject(iso);
    return date ? new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(date) : '';
  }

  function isoWeek(iso) {
    const date = dateObject(iso);
    if (!date) return '';
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  }

  function printDeparture(value) {
    if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return '';
    const [hours, minutes] = String(value).split(':');
    return `${Number(hours)}.${minutes}`;
  }

  function rowValue(row, field, selectClass = '') {
    const select = selectClass ? row.querySelector(selectClass) : null;
    const input = row.querySelector(`input[data-field="${field}"]`);
    if (select && String(select.value || '').trim()) return String(select.value).trim();
    return String(input?.value || '').trim();
  }

  function visibleRows() {
    return [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')]
      .map((row) => ({
        name: rowValue(row, 'name', '.dp-daily-driver-select'),
        duty: rowValue(row, 'duty', '.dp-daily-duty-select'),
        bus: rowValue(row, 'bus'),
        start: rowValue(row, 'start'),
        end: rowValue(row, 'end'),
        departure: rowValue(row, 'departure'),
        stop: rowValue(row, 'stop')
      }))
      .filter((row) => Object.values(row).some((value) => String(value || '').trim()));
  }

  function dutyRowHtml(row) {
    const duty = row.duty ? `Dienst ${escapeHtml(row.duty)}` : '';
    const bus = row.bus ? `/ ${escapeHtml(row.bus)}` : '';
    const times = row.start || row.end
      ? `/ ${escapeHtml(row.start || '--:--')} - ${escapeHtml(row.end || '--:--')} Uhr`
      : '';
    const departure = row.departure ? `${escapeHtml(printDeparture(row.departure))} Uhr` : '';
    const right = [departure, escapeHtml(row.stop)].filter(Boolean).join(' ');

    return `<div class="row">
      <div class="left"><strong>${escapeHtml(row.name) || '&nbsp;'}</strong><span>${duty || '&nbsp;'}</span></div>
      <div class="middle"><strong>${bus || '&nbsp;'}</strong><span>${times || '&nbsp;'}</span></div>
      <div class="rightcol">${right || '&nbsp;'}</div>
    </div>`;
  }

  function freeSummaryHtml(names) {
    return `<div class="free-summary">
      <div><strong>Frei</strong><span>Diese Fahrer haben frei:</span></div>
      <strong class="free-names">${names.map(escapeHtml).join(', ')}</strong>
    </div>`;
  }

  function headerHtml(date, pageIndex, pageCount) {
    return `<header>
      <div>Dienstplan für ${escapeHtml(weekdayName(date))}, den</div>
      <div>${escapeHtml(germanDate(date))}</div>
      <div class="right">Kalenderwoche&nbsp;&nbsp; ${escapeHtml(isoWeek(date))}</div>
      <div class="plan-title">Dienstplan Montag bis Freitag${pageCount > 1 ? ` · Seite ${pageIndex + 1}/${pageCount}` : ''}</div>
      <div class="stop-title">Abfahrzeit ab 1. Haltestelle</div>
    </header>`;
  }

  function buildPages(rows, date) {
    const freeNames = rows
      .filter((row) => normalize(row.duty) === 'frei')
      .map((row) => row.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));

    const dutyRows = rows.filter((row) => normalize(row.duty) !== 'frei');
    const items = dutyRows.map(dutyRowHtml);
    const chunks = [];
    const perPage = freeNames.length ? 16 : 17;

    for (let index = 0; index < items.length; index += perPage) {
      chunks.push(items.slice(index, index + perPage));
    }
    if (!chunks.length) chunks.push([]);

    if (freeNames.length) {
      const last = chunks[chunks.length - 1];
      if (last.length >= 16) chunks.push([]);
      chunks[chunks.length - 1].push(freeSummaryHtml(freeNames));
    }

    return chunks.map((chunk, index) => `<section class="page${index === chunks.length - 1 ? ' last' : ''}">
      ${headerHtml(date, index, chunks.length)}
      <div class="rows">${chunk.join('')}</div>
    </section>`).join('');
  }

  function printA4(event) {
    event?.preventDefault();
    event?.stopPropagation();
    event?.stopImmediatePropagation();

    const date = selectedDate();
    const rows = visibleRows();
    if (!date || !rows.length) {
      setStatus('Es sind keine aktuellen Einträge zum Drucken vorhanden.', 'error');
      return;
    }

    const pages = buildPages(rows, date);
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
    doc.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Dienstplan ${escapeHtml(germanDate(date))}</title><style>
      @page{size:A4 portrait;margin:10mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;width:100%;max-width:100%}
      body{color:#111;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:9.8pt}
      .page{width:100%;min-height:277mm;page-break-after:always;break-after:page;overflow:hidden}
      .page.last{page-break-after:auto;break-after:auto}
      header{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.75fr) minmax(0,1fr);column-gap:3mm;row-gap:1mm;width:100%;margin:0 0 6mm;font-size:11.2pt;font-weight:800}
      header>*{min-width:0;overflow-wrap:anywhere}
      header .right{text-align:right}
      .plan-title{grid-column:1 / 3;font-size:9.5pt;text-align:center;font-weight:700}
      .stop-title{grid-column:3;font-size:10.4pt;text-align:left}
      .rows{width:100%}
      .row{display:grid;grid-template-columns:minmax(0,23fr) minmax(0,31fr) minmax(0,46fr);column-gap:3mm;width:100%;min-height:14.5mm;align-items:start;break-inside:avoid;page-break-inside:avoid}
      .left,.middle{display:flex;flex-direction:column;line-height:1.25;min-width:0;overflow-wrap:anywhere}
      .rightcol{padding-top:5mm;line-height:1.25;min-width:0;overflow-wrap:anywhere}
      .row strong{font-size:10.3pt;line-height:1.2}
      .row span,.rightcol{font-size:9.5pt}
      .free-summary{display:grid;grid-template-columns:23% 77%;gap:3mm;border-top:2px solid #111;margin-top:3mm;padding-top:3mm;min-height:12mm;break-inside:avoid;page-break-inside:avoid}
      .free-summary>div{display:flex;flex-direction:column;line-height:1.25}
      .free-summary span{font-size:9.5pt}
      .free-names{font-size:10.3pt;line-height:1.35;overflow-wrap:anywhere}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>${pages}</body></html>`);
    doc.close();

    window.setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setStatus('Der aktuell sichtbare Dienstplan wurde zur Druckvorschau übertragen.', 'ok');
      } finally {
        window.setTimeout(() => frame.remove(), 1800);
      }
    }, 300);
  }

  function install() {
    const current = document.getElementById(A4_ID) || document.getElementById(ORIGINAL_ID);
    if (!current) return false;
    if (current.dataset.directTablePrint === PRINT_VERSION) return true;

    const button = current.cloneNode(true);
    button.id = A4_ID;
    button.dataset.a4Print = '1';
    button.dataset.directTablePrint = PRINT_VERSION;
    button.title = 'Aktuell sichtbaren Dienstplan passend auf A4 drucken';
    button.addEventListener('click', printA4, true);
    current.replaceWith(button);
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
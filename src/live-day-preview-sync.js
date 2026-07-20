(() => {
  'use strict';

  if (window.__dienstpilotLiveDayPreviewSyncV2) return;
  window.__dienstpilotLiveDayPreviewSyncV2 = true;

  let timer = null;

  const valueOf = (cell) => {
    const field = cell?.querySelector('input, select, textarea');
    return String(field?.value ?? cell?.textContent ?? '').trim();
  };

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const normalizeName = (value) => String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

  function targetTable() {
    return [...document.querySelectorAll('table')].find((table) => {
      const headers = [...table.querySelectorAll('thead th, tr:first-child th')]
        .map((node) => String(node.textContent || '').trim().toLowerCase());
      return headers.includes('name') && headers.includes('dienst')
        && headers.includes('kennzeichen') && headers.includes('beginn')
        && headers.includes('ende');
    }) || null;
  }

  function previewContainer(table) {
    const candidates = [...document.querySelectorAll('div, section, article')]
      .filter((node) => {
        if (node.contains(table)) return false;
        const text = String(node.textContent || '');
        return text.includes('Dienstplan für') && text.includes('Kalenderwoche');
      })
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    return candidates[0] || null;
  }

  function existingMeta(preview) {
    const text = String(preview?.textContent || '').replace(/\s+/g, ' ');
    const title = text.match(/Dienstplan für\s+(.+?)\s+Kalenderwoche/i)?.[1]?.trim() || '';
    const kw = text.match(/Kalenderwoche\s+(\d+)/i)?.[1] || '';
    return { title, kw };
  }

  function rowData(row) {
    const cells = [...row.cells];
    if (cells.length < 7) return null;
    const name = valueOf(cells[0]);
    const duty = valueOf(cells[1]);
    if (!name || !duty) return null;

    const free = duty.toLowerCase() === 'frei';
    return {
      name,
      duty: free ? 'Frei' : duty.replace(/^Dienst\s*/i, 'Dienst '),
      vehicle: free ? '' : valueOf(cells[2]),
      start: free ? '' : valueOf(cells[3]),
      end: free ? '' : valueOf(cells[4]),
      departure: free ? '' : valueOf(cells[5]),
      stop: free ? '' : valueOf(cells[6]),
      free
    };
  }

  function currentRows(table) {
    const byDriver = new Map();
    [...table.querySelectorAll('tbody tr')].map(rowData).filter(Boolean).forEach((row) => {
      const key = normalizeName(row.name);
      const previous = byDriver.get(key);
      if (!previous || row.free || !previous.free) byDriver.set(key, row);
    });
    return [...byDriver.values()];
  }

  function render() {
    const table = targetTable();
    if (!table) return;
    const preview = previewContainer(table);
    if (!preview) return;

    const meta = existingMeta(preview);
    const rows = currentRows(table);

    preview.classList.add('dp-live-day-preview');
    preview.innerHTML = `
      <div class="dp-live-preview-head">
        <strong>Dienstplan für ${esc(meta.title || 'den aktuellen Tag')}</strong>
        <strong>Kalenderwoche ${esc(meta.kw || '—')}</strong>
      </div>
      <div class="dp-live-preview-sub">Abfahrtszeit ab 1. Haltestelle</div>
      <div class="dp-live-preview-rows">
        ${rows.map((row) => row.free
          ? `<div class="dp-live-preview-row free"><div><strong>${esc(row.name)}</strong><span>Frei</span></div><div class="dp-live-preview-free">Frei</div><div></div></div>`
          : `<div class="dp-live-preview-row"><div><strong>${esc(row.name)}</strong><span>${esc(row.duty)}</span></div><div><strong>${esc(row.vehicle || '—')}</strong><span>${esc(row.start || '--:--')} - ${esc(row.end || '--:--')} Uhr</span></div><div>${esc(row.departure || '--:--')} Uhr ${esc(row.stop || '')}</div></div>`
        ).join('')}
      </div>`;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 80);
  }

  function addStyle() {
    if (document.getElementById('dpLiveDayPreviewSyncStyle')) return;
    const style = document.createElement('style');
    style.id = 'dpLiveDayPreviewSyncStyle';
    style.textContent = `
      .dp-live-day-preview{padding:20px!important;border:1px solid #dbe4ee!important;border-radius:16px!important;background:#fff!important}
      .dp-live-preview-head{display:grid;grid-template-columns:1fr 1fr;gap:18px;text-align:center;font-size:16px}
      .dp-live-preview-sub{text-align:center;font-weight:800;margin:12px 0 16px}
      .dp-live-preview-rows{display:grid;gap:10px;max-width:760px;margin:0 auto}
      .dp-live-preview-row{display:grid;grid-template-columns:1fr 1fr 1.35fr;gap:24px;align-items:start}
      .dp-live-preview-row>div{display:grid;gap:2px}.dp-live-preview-row span{font-size:13px}
      .dp-live-preview-row.free{font-weight:800}.dp-live-preview-free{font-size:15px}
      @media(max-width:760px){.dp-live-preview-row{grid-template-columns:1fr}.dp-live-preview-head{grid-template-columns:1fr}}
      @media print{.dp-live-day-preview{border:0!important}.dp-live-preview-row{break-inside:avoid}}
    `;
    document.head.appendChild(style);
  }

  addStyle();
  document.addEventListener('input', (event) => {
    if (event.target.closest?.('table')) schedule();
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target.closest?.('table')) schedule();
  }, true);
  document.addEventListener('click', () => setTimeout(schedule, 100), true);

  const observer = new MutationObserver(schedule);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    [0, 200, 700, 1500].forEach((delay) => setTimeout(render, delay));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
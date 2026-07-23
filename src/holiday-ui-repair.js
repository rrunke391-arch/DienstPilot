(() => {
  'use strict';

  const API = '__dienstpilotHolidayUiRepairV3';
  if (window[API]?.restart) {
    window[API].restart();
    return;
  }

  const TABLE_ID = 'dpDailyPlanRows';
  const DATE_ID = 'dpDailyPlanDate';
  const SECTION_ID = 'tab-daily-duty-plan';
  const CONTROL_ID = 'dpHolidayFreeControlRow';
  const PERIODS = [
    ['2025-10-13','2025-10-25'],['2025-12-22','2026-01-05'],
    ['2026-02-02','2026-02-03'],['2026-03-23','2026-04-07'],
    ['2026-05-15','2026-05-15'],['2026-05-26','2026-05-26'],
    ['2026-07-02','2026-08-12'],['2026-10-12','2026-10-24'],
    ['2026-12-23','2027-01-09'],['2027-02-01','2027-02-02'],
    ['2027-03-22','2027-04-03'],['2027-05-07','2027-05-07'],
    ['2027-05-18','2027-05-18'],['2027-07-08','2027-08-18'],
    ['2027-10-16','2027-10-30'],['2027-12-23','2028-01-08']
  ];

  const CP1252_BYTES = new Map([
    [0x20AC,0x80],[0x201A,0x82],[0x0192,0x83],[0x201E,0x84],[0x2026,0x85],
    [0x2020,0x86],[0x2021,0x87],[0x02C6,0x88],[0x2030,0x89],[0x0160,0x8A],
    [0x2039,0x8B],[0x0152,0x8C],[0x017D,0x8E],[0x2018,0x91],[0x2019,0x92],
    [0x201C,0x93],[0x201D,0x94],[0x2022,0x95],[0x2013,0x96],[0x2014,0x97],
    [0x02DC,0x98],[0x2122,0x99],[0x0161,0x9A],[0x203A,0x9B],[0x0153,0x9C],
    [0x017E,0x9E],[0x0178,0x9F]
  ]);

  let observer = null;
  let observedSection = null;
  let timer = 0;
  let adding = false;

  const clean = (value) => String(value || '').trim();
  const selectedDate = () => clean(document.getElementById(DATE_ID)?.value);
  const rows = () => [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  const dutyValue = (row) => clean(row?.querySelector('input[data-field="duty"]')?.value);

  function isHoliday(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    return day > 0 && day < 6 && PERIODS.some(([start, end]) => date >= start && date <= end);
  }

  function sectionVisible() {
    const section = document.getElementById(SECTION_ID);
    return Boolean(section && !section.classList.contains('hidden'));
  }

  function suspiciousScore(value) {
    const text = String(value || '');
    const matches = text.match(/Ã|Â|â|ð|ï¿½|�|ƒ|€|™|œ|ž|Ä/g);
    return matches ? matches.length : 0;
  }

  function windows1252Bytes(value) {
    const bytes = [];
    for (const character of String(value || '')) {
      const code = character.codePointAt(0);
      if (code <= 0xFF) bytes.push(code);
      else if (CP1252_BYTES.has(code)) bytes.push(CP1252_BYTES.get(code));
      else return null;
    }
    return new Uint8Array(bytes);
  }

  function decodeOnePass(value) {
    const bytes = windows1252Bytes(value);
    if (!bytes) return String(value || '');
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return String(value || '');
    }
  }

  function repairText(value) {
    let text = String(value ?? '');
    for (let pass = 0; pass < 5; pass += 1) {
      const decoded = decodeOnePass(text);
      if (decoded === text || suspiciousScore(decoded) >= suspiciousScore(text)) break;
      text = decoded;
    }
    return text
      .replace(/ï¼‹/g, '+')
      .replace(/Â·/g, '·')
      .replace(/Â /g, ' ');
  }

  function repairVisibleText() {
    const section = document.getElementById(SECTION_ID);
    if (!section) return;

    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const next = repairText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });

    section.querySelectorAll('option').forEach((option) => {
      const next = repairText(option.textContent);
      if (next !== option.textContent) option.textContent = next;
      const nextValue = repairText(option.value);
      if (nextValue !== option.value) option.value = nextValue;
    });

    section.querySelectorAll('input, textarea').forEach((field) => {
      const next = repairText(field.value);
      if (next !== field.value) field.value = next;
      if (field.placeholder) field.placeholder = repairText(field.placeholder);
      if (field.title) field.title = repairText(field.title);
    });

    section.querySelectorAll('[title],[aria-label]').forEach((element) => {
      if (element.title) element.title = repairText(element.title);
      const label = element.getAttribute('aria-label');
      if (label) element.setAttribute('aria-label', repairText(label));
    });

    const banner = document.getElementById('dpNiHolidayDutyStatus');
    if (banner && isHoliday(selectedDate())) {
      banner.textContent = 'Niedersachsen-Ferien: 18 Dienste – 3031 bis 3045 sowie 1341, 1941 und 1743. Der Einsatzwagen wird separat geführt. Über „+ Frei“ können beliebig viele freie Fahrer ergänzt werden.';
    }
    const insert = document.getElementById('dpHolidayInsert18');
    if (insert) insert.textContent = '18 Ferien-Dienste einfügen';
  }

  function ensureStyle() {
    if (document.getElementById('dpHolidayUiRepairStyle')) return;
    const style = document.createElement('style');
    style.id = 'dpHolidayUiRepairStyle';
    style.textContent = `
      #${CONTROL_ID} td{padding:9px!important;background:#f8fafc;border-top:2px solid #cbd5e1!important}
      #${CONTROL_ID} .dp-free-control{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      #${CONTROL_ID} .dp-free-button{padding:9px 16px;border:1px solid #16a34a;border-radius:10px;background:#f0fdf4;color:#166534;font:inherit;font-weight:900;cursor:pointer}
      #${CONTROL_ID} .dp-free-button:hover{background:#dcfce7}
      #${CONTROL_ID} .dp-free-help{font-size:12px;font-weight:800;color:#475569}
    `;
    document.head.appendChild(style);
  }

  async function addFreeRow() {
    if (adding || !isHoliday(selectedDate())) return;
    const addButton = document.getElementById('dpDailyAddRow');
    if (!addButton || addButton.disabled) return;
    adding = true;
    try {
      const before = new Set(rows().map((row) => row.dataset.rowId));
      addButton.click();
      await new Promise((resolve) => setTimeout(resolve, 120));
      const row = rows().find((candidate) => !before.has(candidate.dataset.rowId)) || rows().at(-1);
      const duty = row?.querySelector('input[data-field="duty"]');
      if (!duty) return;
      duty.value = 'Frei';
      duty.dispatchEvent(new Event('input', { bubbles: true }));
      duty.dispatchEvent(new Event('change', { bubbles: true }));
      ['bus','start','end','departure','stop'].forEach((field) => {
        const input = row.querySelector(`input[data-field="${field}"]`);
        if (input && !input.disabled) input.value = '';
      });
      setTimeout(restart, 150);
    } finally {
      adding = false;
    }
  }

  function ensureFreeControl() {
    if (!isHoliday(selectedDate()) || !sectionVisible()) {
      document.getElementById(CONTROL_ID)?.remove();
      return;
    }
    const body = document.getElementById(TABLE_ID);
    if (!body) return;
    ensureStyle();

    let control = document.getElementById(CONTROL_ID);
    if (!control) {
      control = document.createElement('tr');
      control.id = CONTROL_ID;
      const cell = document.createElement('td');
      cell.colSpan = 8;
      cell.innerHTML = '<div class="dp-free-control"><button type="button" class="dp-free-button">+ Frei</button><span class="dp-free-help"></span></div>';
      control.appendChild(cell);
      control.querySelector('.dp-free-button')?.addEventListener('click', addFreeRow);
    }

    const freeRows = rows().filter((row) => dutyValue(row).toLowerCase() === 'frei');
    const help = control.querySelector('.dp-free-help');
    if (help) help.textContent = `Fahrer ohne Dienst hinzufügen${freeRows.length ? ` · aktuell ${freeRows.length} Fahrer frei` : ''}`;
    const firstFree = freeRows[0] || null;
    if (control.parentElement !== body || control.nextElementSibling !== firstFree) body.insertBefore(control, firstFree);
  }

  function observeSection() {
    const section = document.getElementById(SECTION_ID);
    if (!section || section === observedSection) return;
    observer?.disconnect();
    observedSection = section;
    observer = new MutationObserver(() => schedule(60));
    observer.observe(section, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value','title','aria-label','class'] });
  }

  function run() {
    observeSection();
    repairVisibleText();
    ensureFreeControl();
  }

  function schedule(delay = 0) {
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }

  function restart() {
    observedSection = null;
    observer?.disconnect();
    observer = null;
    [0,100,300,700,1500,3000,6000,12000].forEach((delay) => setTimeout(run, delay));
  }

  window[API] = { restart };
  window.__dienstpilotHolidayUiRepairV2 = window[API];
  window.__dienstpilotHolidayUiRepairV1 = window[API];
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton,.tab[data-tab="eingabe"],.tab[data-tab="katalog"]')) restart();
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) restart();
  }, true);
  window.addEventListener('dienstpilot:login-ready', restart);
  window.addEventListener('dienstpilot:authenticated', restart);
  window.addEventListener('pageshow', restart);
  window.addEventListener('focus', () => schedule(100));
  restart();
})();
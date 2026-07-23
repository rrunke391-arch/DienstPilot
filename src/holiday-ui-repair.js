(() => {
  'use strict';

  const API = '__dienstpilotHolidayUiRepairV2';
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

  let observer = null;
  let observedBody = null;
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

  function repairText(value) {
    let text = String(value ?? '');
    const replacements = [
      [/ÃƒÂ¼/g, 'ü'], [/ÃƒÂ¤/g, 'ä'], [/ÃƒÂ¶/g, 'ö'], [/ÃƒÅ¸/g, 'ß'],
      [/ÃƒÅ“/g, 'Ü'], [/Ãƒâ€ž/g, 'Ä'], [/Ãƒâ€“/g, 'Ö'],
      [/Ã¼/g, 'ü'], [/Ã¤/g, 'ä'], [/Ã¶/g, 'ö'], [/ÃŸ/g, 'ß'],
      [/Ãœ/g, 'Ü'], [/Ã„/g, 'Ä'], [/Ã–/g, 'Ö'],
      [/â€“/g, '–'], [/â€”/g, '—'], [/â€ž/g, '„'], [/â€œ/g, '“'],
      [/â€¦/g, '…'], [/ï¼‹/g, '+'], [/Â·/g, '·'], [/Â /g, ' ']
    ];
    replacements.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
    return text;
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
    });

    section.querySelectorAll('input[type="text"], textarea').forEach((field) => {
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

  function observeTable() {
    const body = document.getElementById(TABLE_ID);
    if (!body || body === observedBody) return;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => schedule(80));
    observer.observe(body, { childList: true, subtree: true, characterData: true });
  }

  function run() {
    observeTable();
    repairVisibleText();
    ensureFreeControl();
  }

  function schedule(delay = 0) {
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }

  function restart() {
    observedBody = null;
    observer?.disconnect();
    observer = null;
    [0,100,300,700,1500,3000,6000,12000].forEach((delay) => setTimeout(run, delay));
  }

  window[API] = { restart };
  window.__dienstpilotHolidayUiRepairV1 = window[API];
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton,.tab[data-tab="eingabe"]')) restart();
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) restart();
  }, true);
  window.addEventListener('dienstpilot:login-ready', restart);
  window.addEventListener('pageshow', restart);
  window.addEventListener('focus', () => schedule(100));
  restart();
})();

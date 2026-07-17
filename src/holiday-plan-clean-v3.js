(() => {
  'use strict';
  if (window.__dienstpilotHolidayPlan18V4) return;
  window.__dienstpilotHolidayPlan18V4 = true;

  // Diese alten Bausteine würden sonst weitere Ferienzeilen erzeugen.
  window.__dienstpilotNiedersachsenHolidayDutyPlan = true;
  window.__dienstpilotHolidayExtraDutiesV3 = true;
  window.__dienstpilotHolidayPhotoTemplateV2 = true;

  const TABLE = 'dpDailyPlanRows';
  const DATE = 'dpDailyPlanDate';
  const ADD = 'dpDailyAddRow';
  const INSERT = 'dpDailyInsertDefaults';
  const HOLIDAY_INSERT = 'dpHolidayInsert18';
  const SECTION = 'tab-daily-duty-plan';
  const GENERAL_MARKER = 'dienstpilot_photo_bus_defaults_v3';
  const MIGRATION = 'dienstpilot_holiday_plan_18_v4';
  const VERSION = '18-dienste-v4';

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

  // 15 normale Feriendienste + Einsatzwagen. 1341, 1941 und 1743 stehen nur
  // im blauen Schichtbereich. Damit gibt es genau 18 Dienste, ohne Doppelzeilen.
  const TEMPLATE = [
    ['3031','A.Gerding','OS-LF 223','05:03','13:21','05:20','Wellingholzhausen, Schule'],
    ['3032','D.Knigge','OS-VH 721','04:45','12:04','05:26','Osnabrück, HBF'],
    ['3033','Y.Yasar','OS-QS 519','05:43','12:21','06:16','Buer, Schulzentrum'],
    ['3034','S.Wittwer','OS-SU 722','05:47','15:39','06:12','Neuenkirchen, Schulzentrum'],
    ['3035','H.AI Sayek','OS-IF 215','05:51','17:21','06:18','Westerhausen, Vinkenaue'],
    ['3036','P.Lommel','OS-XB 925','06:03','18:04','06:27','Gesmold, Schimmweg'],
    ['3037','K.Igelbrink','OS-YG 120','06:03','16:05','06:20','Wellingholzhausen, Schule'],
    ['3038','W.Wüllner','OS-DZ 116','06:03','12:06','06:28','Neuenkirchen, Schulzentrum'],
    ['3039','A.Hergerdt','OS-ZT 626','06:42','19:21','07:15','Bruchmühlen, Schule'],
    ['3040','N.Awdullahi','OS-EV 118','07:20','19:33','07:45','Melle, ZOB'],
    ['3041','A.Hasan','OS-BU 816','08:20','19:41','08:45','Melle, ZOB'],
    ['3042','K.Giotis','OS-KX 220','11:20','21:05','11:45','Melle, ZOB'],
    ['3043','T.Wiemann','OS-UL 818','12:03','20:21','12:20','Wellingholzhausen, Schule'],
    ['3044','A.Alrobaie','OS-PK 216','12:20','22:03','12:45','Melle, ZOB'],
    ['3045','N.Murad','OS-HD 124','13:03','21:50','13:20','Wellingholzhausen, Schule'],
    ['Einsatzwagen','Einsatzwagen','OS-QS 519','','','','Melle, ZOB']
  ].map(([duty,name,bus,start,end,departure,stop]) => ({ duty,name,bus,start,end,departure,stop }));

  const DUTIES = TEMPLATE.map((row) => row.duty);
  const DUTY_SET = new Set(DUTIES);
  const ALLOWED = new Set([...DUTIES, 'Frei']);
  const BLOCKED = new Set([
    '3001','3003','3004','3005','3006','3007','3008','3009','3010','3011','3012',
    '3013','3014','3015','3016','3017','3018','3019','3020','3021','3022','3023',
    '3024','3025','3095','1341','1941','1743'
  ]);

  let running = false;
  let timer = 0;
  let observer = null;
  let observedBody = null;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clean = (value) => String(value || '').trim();
  const selectedDate = () => clean(document.getElementById(DATE)?.value);
  const rows = () => [...document.querySelectorAll(`#${TABLE} tr[data-row-id]`)];
  const input = (row, field) => row?.querySelector(`input[data-field="${field}"]`) || null;
  const value = (row, field) => clean(input(row, field)?.value);

  function holiday(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    return day > 0 && day < 6 && PERIODS.some(([start,end]) => date >= start && date <= end);
  }

  function visible() {
    const section = document.getElementById(SECTION);
    return Boolean(section && !section.classList.contains('hidden'));
  }

  function read(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch { return {}; }
  }

  function mark(key, date, valueToStore = true) {
    if (!date) return;
    const data = read(key);
    data[date] = valueToStore;
    localStorage.setItem(key, JSON.stringify(data));
  }

  function status(text, kind = '') {
    const node = document.getElementById('dpDailyPlanStatus');
    if (!node) return;
    node.textContent = text;
    node.className = 'dp-daily-status' + (kind ? ` ${kind}` : '');
  }

  function banner() {
    if (!holiday(selectedDate())) return;
    if (!document.getElementById('dpHoliday18BannerStyle')) {
      const style = document.createElement('style');
      style.id = 'dpHoliday18BannerStyle';
      style.textContent = '#dpNiHolidayDutyStatus{padding:10px 12px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;color:#166534;font-weight:900;line-height:1.35}';
      document.head.appendChild(style);
    }
    let node = document.getElementById('dpNiHolidayDutyStatus');
    if (!node) {
      node = document.createElement('div');
      node.id = 'dpNiHolidayDutyStatus';
      document.getElementById('dpDailyPlanStatus')?.insertAdjacentElement('afterend', node);
    }
    node.textContent = 'Niedersachsen-Ferien: genau 18 Dienste – 3031 bis 3045 sowie 1341, 1941 und 1743. Der Einsatzwagen wird separat geführt. Schultagsdienste und 3095 sind nicht zulässig.';
    const button = document.getElementById(INSERT) || document.getElementById(HOLIDAY_INSERT);
    if (button) {
      button.id = HOLIDAY_INSERT;
      button.textContent = '18 Ferien-Dienste einfügen';
    }
  }

  function restoreSchoolButton() {
    const button = document.getElementById(HOLIDAY_INSERT);
    if (!button) return;
    button.id = INSERT;
    button.textContent = 'Standarddienste einfügen';
  }

  const currentDuties = () => rows().map((row) => value(row, 'duty'));

  function exact() {
    const current = currentDuties();
    return current.length === DUTIES.length && current.every((duty,index) => duty === DUTIES[index]);
  }

  function acceptable() {
    const current = currentDuties();
    if (current.length !== DUTIES.length || current.some((duty) => !duty || !ALLOWED.has(duty))) return false;
    const seen = new Set();
    for (const duty of current) {
      if (duty === 'Frei') continue;
      if (seen.has(duty)) return false;
      seen.add(duty);
    }
    return true;
  }

  function corrupted() {
    const current = currentDuties();
    return current.length > DUTIES.length
      || current.some((duty) => BLOCKED.has(duty))
      || current.filter((duty) => duty === 'Einsatzwagen').length > 1;
  }

  function needsRebuild(date) {
    if (!holiday(date) || !visible() || running || window.__dienstpilotHolidayPhotoRebuilding) return false;
    const migrated = read(MIGRATION)[date] === VERSION;
    if (!migrated) {
      if (exact() || acceptable()) {
        mark(MIGRATION, date, VERSION);
        return false;
      }
      return true;
    }
    return corrupted();
  }

  function snapshot() {
    const result = new Map();
    rows().forEach((row) => {
      const duty = value(row, 'duty');
      if (!DUTY_SET.has(duty) || result.has(duty)) return;
      result.set(duty, { name: value(row,'name'), bus: value(row,'bus') });
    });
    return result;
  }

  async function clearRows() {
    let guard = 0;
    while (rows().length && guard < 100) {
      const button = rows()[0]?.querySelector('[data-action="delete"]');
      if (!button || button.disabled) break;
      button.click();
      await wait(55);
      guard += 1;
    }
    return rows().length === 0;
  }

  function fire(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function byId(id) {
    const escaped = window.CSS?.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
    return document.querySelector(`#${TABLE} tr[data-row-id="${escaped}"]`);
  }

  async function addRow(data) {
    const button = document.getElementById(ADD);
    if (!button || button.disabled) return false;
    const before = new Set(rows().map((row) => clean(row.dataset.rowId)));
    button.click();
    await wait(65);
    let row = rows().find((candidate) => !before.has(clean(candidate.dataset.rowId))) || rows().at(-1);
    const id = clean(row?.dataset.rowId);
    const dutyInput = input(row, 'duty');
    if (!id || !dutyInput || dutyInput.disabled) return false;
    dutyInput.dataset.dpDutyCommit = '1';
    dutyInput.value = data.duty;
    fire(dutyInput);
    delete dutyInput.dataset.dpDutyCommit;
    await wait(90);
    row = byId(id);
    if (!row) return false;
    for (const field of ['name','bus','start','end','departure','stop']) {
      const fieldInput = input(row, field);
      if (!fieldInput || fieldInput.disabled) continue;
      fieldInput.value = data[field] || '';
      fire(fieldInput);
    }
    return true;
  }

  async function rebuild() {
    const date = selectedDate();
    if (running || !holiday(date) || !visible()) return false;
    running = true;
    window.__dienstpilotHolidayPhotoRebuilding = true;
    mark(GENERAL_MARKER, date);
    const old = snapshot();
    status('Der Ferienplan wird auf genau 18 Dienste bereinigt …');
    try {
      if (!await clearRows()) throw new Error('Alte Zeilen konnten nicht vollständig entfernt werden.');
      for (const template of TEMPLATE) {
        const previous = old.get(template.duty) || {};
        const data = {
          ...template,
          name: previous.name || template.name,
          bus: previous.bus && previous.bus !== 'OS-XX 123' ? previous.bus : template.bus
        };
        if (!await addRow(data)) throw new Error(`Dienst ${template.duty} konnte nicht eingefügt werden.`);
      }
      if (!exact()) throw new Error('Die Dienstfolge 3031 bis 3045 ist noch nicht vollständig.');
      mark(MIGRATION, date, VERSION);
      mark(GENERAL_MARKER, date);
      installOptions();
      banner();
      status('Korrekt: 15 Feriendienste 3031–3045 plus 1341, 1941 und 1743 ergeben 18 Dienste. Der Einsatzwagen steht separat. Sichtbar sind genau 16 Bearbeitungszeilen.', 'ok');
      setTimeout(() => document.getElementById('dpDailySave')?.click(), 350);
      return true;
    } catch (error) {
      status(`Ferienplan konnte nicht vollständig aufgebaut werden: ${error.message}`, 'error');
      return false;
    } finally {
      window.__dienstpilotHolidayPhotoRebuilding = false;
      running = false;
      schedule(700);
    }
  }

  function usedElsewhere(duty, ownInput) {
    return duty && duty !== 'Frei' && [...document.querySelectorAll(`#${TABLE} input[data-field="duty"]`)]
      .some((candidate) => candidate !== ownInput && clean(candidate.value) === duty);
  }

  function installOptions() {
    if (!holiday(selectedDate())) return;
    document.querySelectorAll(`#${TABLE} tr[data-row-id]`).forEach((row) => {
      const dutyInput = input(row, 'duty');
      const select = row.querySelector('.dp-daily-duty-select');
      if (!dutyInput || !select) return;
      const current = clean(dutyInput.value);
      const desired = [{ value:'', text:'Feriendienst oder Frei auswählen' }];
      ['Frei', ...DUTIES].forEach((duty) => {
        if (duty !== current && usedElsewhere(duty, dutyInput)) return;
        desired.push({ value:duty, text:duty === 'Frei' ? 'Frei' : duty === 'Einsatzwagen' ? 'Einsatzwagen' : `Dienst ${duty}` });
      });
      const old = [...select.options].map((option) => `${option.value}|${option.textContent}`);
      const next = desired.map((option) => `${option.value}|${option.text}`);
      if (old.length !== next.length || old.some((entry,index) => entry !== next[index])) {
        select.replaceChildren(...desired.map((item) => {
          const option = document.createElement('option');
          option.value = item.value;
          option.textContent = item.text;
          return option;
        }));
      }
      select.value = ALLOWED.has(current) ? current : '';
      select.classList.toggle('invalid', Boolean(current && !ALLOWED.has(current)));
      select.classList.remove('duplicate');
      if (!select.dataset.dpHoliday18Bound) {
        select.dataset.dpHoliday18Bound = '1';
        select.addEventListener('change', (event) => {
          const nextDuty = clean(select.value);
          if (usedElsewhere(nextDuty, dutyInput)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            select.value = clean(dutyInput.value);
            status(`Dienst ${nextDuty} ist bereits vergeben. Jeder Feriendienst darf nur einmal erscheinen.`, 'error');
            return;
          }
          setTimeout(() => schedule(0), 100);
        }, true);
      }
    });
  }

  function refresh() {
    const date = selectedDate();
    if (!holiday(date)) {
      restoreSchoolButton();
      return;
    }
    mark(GENERAL_MARKER, date);
    banner();
    installOptions();
    if (needsRebuild(date)) void rebuild();
  }

  function schedule(delay = 250) {
    clearTimeout(timer);
    timer = setTimeout(refresh, delay);
  }

  function observe() {
    const body = document.getElementById(TABLE);
    if (!body || body === observedBody) return;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => schedule(80));
    observer.observe(body, { childList:true, subtree:true });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.(`#${HOLIDAY_INSERT},#${INSERT}`) && holiday(selectedDate())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void rebuild();
      return;
    }
    if (event.target.closest?.('#dpDailyDutyPlanTab,#loginButton,.tab[data-tab="eingabe"]')) {
      [250,700,1400].forEach((delay) => setTimeout(() => { observe(); refresh(); }, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id !== DATE) return;
    if (holiday(selectedDate())) mark(GENERAL_MARKER, selectedDate());
    else restoreSchoolButton();
    [0,300,800,1500].forEach((delay) => setTimeout(refresh, delay));
  }, true);

  function start() {
    observe();
    if (holiday(selectedDate())) mark(GENERAL_MARKER, selectedDate());
    [0,300,900,1800,3600].forEach((delay) => setTimeout(refresh, delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
  window.addEventListener('pageshow', () => schedule(500));
  window.addEventListener('focus', () => schedule(500));
})();
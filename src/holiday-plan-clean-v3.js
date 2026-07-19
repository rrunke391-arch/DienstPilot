(() => {
  'use strict';
  if (window.__dienstpilotHolidayPlan18V5) return;
  window.__dienstpilotHolidayPlan18V5 = true;

  // Alte Ferien-Bausteine dürfen keine zusätzlichen Zeilen mehr erzeugen.
  window.__dienstpilotNiedersachsenHolidayDutyPlan = true;
  window.__dienstpilotHolidayExtraDutiesV3 = true;
  window.__dienstpilotHolidayPhotoTemplateV2 = true;
  window.__dienstpilotHolidayPlanCleanV3 = true;

  const TABLE = 'dpDailyPlanRows';
  const DATE = 'dpDailyPlanDate';
  const ADD = 'dpDailyAddRow';
  const INSERT = 'dpDailyInsertDefaults';
  const HOLIDAY_INSERT = 'dpHolidayInsert18';
  const SECTION = 'tab-daily-duty-plan';
  const CONTROL_ID = 'dpHolidayFreeControlRow';
  const GENERAL_MARKER = 'dienstpilot_photo_bus_defaults_v3';
  const MIGRATION = 'dienstpilot_holiday_plan_18_v5';
  const VERSION = '18-dienste-frei-v5';

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

  // 15 normale Feriendienste + Einsatzwagen. Die geteilten Dienste 1341,
  // 1941 und 1743 werden im blauen Schichtbereich verwaltet.
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
  let addingFree = false;
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
    const className = 'dp-daily-status' + (kind ? ` ${kind}` : '');
    if (node.textContent !== text) node.textContent = text;
    if (node.className !== className) node.className = className;
  }

  function restoreSchoolButton() {
    const button = document.getElementById(HOLIDAY_INSERT);
    if (!button) return;
    if (button.id !== INSERT) button.id = INSERT;
    if (button.textContent !== 'Standarddienste einfügen') button.textContent = 'Standarddienste einfügen';
  }

  function setHolidayUi(active) {
    const generalAdd = document.getElementById(ADD);
    if (generalAdd) {
      const display = active ? 'none' : '';
      if (generalAdd.style.display !== display) generalAdd.style.display = display;
    }
    if (!active) {
      document.getElementById(CONTROL_ID)?.remove();
      restoreSchoolButton();
    }
  }

  function banner() {
    if (!holiday(selectedDate())) return;
    if (!document.getElementById('dpHoliday18BannerStyle')) {
      const style = document.createElement('style');
      style.id = 'dpHoliday18BannerStyle';
      style.textContent = `
        #dpNiHolidayDutyStatus{padding:10px 12px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;color:#166534;font-weight:900;line-height:1.35}
        #${CONTROL_ID} td{padding:9px!important;background:#f8fafc;border-top:2px solid #cbd5e1!important}
        #${CONTROL_ID} .dp-free-control{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        #${CONTROL_ID} .dp-free-button{padding:9px 16px;border:1px solid #16a34a;border-radius:10px;background:#f0fdf4;color:#166534;font:inherit;font-weight:950;cursor:pointer}
        #${CONTROL_ID} .dp-free-button:hover{background:#dcfce7}
        #${CONTROL_ID} .dp-free-help{font-size:12px;font-weight:800;color:#475569}
      `;
      document.head.appendChild(style);
    }
    let node = document.getElementById('dpNiHolidayDutyStatus');
    if (!node) {
      node = document.createElement('div');
      node.id = 'dpNiHolidayDutyStatus';
      document.getElementById('dpDailyPlanStatus')?.insertAdjacentElement('afterend', node);
    }
    const bannerText = 'Niedersachsen-Ferien: 18 Dienste – 3031 bis 3045 sowie 1341, 1941 und 1743. Der Einsatzwagen wird separat geführt. Über „＋ Frei“ können beliebig viele freie Fahrer ergänzt werden.';
    if (node.textContent !== bannerText) node.textContent = bannerText;
    const button = document.getElementById(INSERT) || document.getElementById(HOLIDAY_INSERT);
    if (button) {
      if (button.id !== HOLIDAY_INSERT) button.id = HOLIDAY_INSERT;
      if (button.textContent !== '18 Ferien-Dienste einfügen') button.textContent = '18 Ferien-Dienste einfügen';
    }
    setHolidayUi(true);
  }

  const currentDuties = () => rows().map((row) => value(row, 'duty'));

  function exact() {
    const all = currentDuties();
    const services = all.filter((duty) => duty !== 'Frei');
    return services.length === DUTIES.length
      && services.every((duty,index) => duty === DUTIES[index])
      && all.every((duty) => duty === 'Frei' || DUTY_SET.has(duty));
  }

  function acceptable() {
    const all = currentDuties();
    const services = all.filter((duty) => duty && duty !== 'Frei');
    if (services.length !== DUTIES.length || services.some((duty) => !DUTY_SET.has(duty))) return false;
    const seen = new Set();
    for (const duty of services) {
      if (seen.has(duty)) return false;
      seen.add(duty);
    }
    return all.every((duty) => !duty || ALLOWED.has(duty));
  }

  function corrupted() {
    const all = currentDuties();
    const services = all.filter((duty) => duty && duty !== 'Frei');
    const seen = new Set();
    if (services.length > DUTIES.length) return true;
    for (const duty of services) {
      if (BLOCKED.has(duty) || !DUTY_SET.has(duty) || seen.has(duty)) return true;
      seen.add(duty);
    }
    return services.filter((duty) => duty === 'Einsatzwagen').length > 1;
  }

  function needsRebuild(date) {
    if (!holiday(date) || !visible() || running || addingFree || window.__dienstpilotHolidayPhotoRebuilding) return false;
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
    const services = new Map();
    const free = [];
    rows().forEach((row) => {
      const duty = value(row, 'duty');
      if (duty === 'Frei') {
        free.push({ name: value(row,'name'), duty:'Frei', bus:'', start:'', end:'', departure:'', stop:'' });
        return;
      }
      if (!DUTY_SET.has(duty) || services.has(duty)) return;
      services.set(duty, { name: value(row,'name'), bus: value(row,'bus') });
    });
    return { services, free };
  }

  async function clearRows() {
    let guard = 0;
    while (rows().length && guard < 120) {
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
    await wait(70);
    let row = rows().find((candidate) => !before.has(clean(candidate.dataset.rowId))) || rows().at(-1);
    const id = clean(row?.dataset.rowId);
    const dutyInput = input(row, 'duty');
    if (!id || !dutyInput || dutyInput.disabled) return false;
    dutyInput.dataset.dpDutyCommit = '1';
    dutyInput.value = data.duty;
    fire(dutyInput);
    delete dutyInput.dataset.dpDutyCommit;
    await wait(100);
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
    status('Der Ferienplan wird auf 18 Dienste bereinigt …');
    try {
      if (!await clearRows()) throw new Error('Alte Zeilen konnten nicht vollständig entfernt werden.');
      for (const template of TEMPLATE) {
        const previous = old.services.get(template.duty) || {};
        const data = {
          ...template,
          name: previous.name || template.name,
          bus: previous.bus && previous.bus !== 'OS-XX 123' ? previous.bus : template.bus
        };
        if (!await addRow(data)) throw new Error(`Dienst ${template.duty} konnte nicht eingefügt werden.`);
      }
      for (const freeRow of old.free) {
        if (!await addRow(freeRow)) throw new Error('Ein vorhandener Frei-Eintrag konnte nicht wiederhergestellt werden.');
      }
      if (!exact()) throw new Error('Die Dienstfolge 3031 bis 3045 ist noch nicht vollständig.');
      mark(MIGRATION, date, VERSION);
      mark(GENERAL_MARKER, date);
      installOptions();
      installFreeControl();
      banner();
      status(`Korrekt: 18 Feriendienste. Zusätzlich sind ${old.free.length} Frei-Einträge vorhanden.`, 'ok');
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

  function clearFreeFields(row) {
    ['bus','start','end','departure','stop'].forEach((field) => {
      const fieldInput = input(row, field);
      if (!fieldInput || fieldInput.disabled || !fieldInput.value) return;
      fieldInput.value = '';
      fire(fieldInput);
    });
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
      if (current === 'Frei') clearFreeFields(row);
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
          if (nextDuty === 'Frei') setTimeout(() => clearFreeFields(row), 80);
          setTimeout(() => schedule(0), 120);
        }, true);
      }
    });
  }

  async function addFreeRow() {
    if (addingFree || running || !holiday(selectedDate())) return;
    addingFree = true;
    try {
      const ok = await addRow({ name:'', duty:'Frei', bus:'', start:'', end:'', departure:'', stop:'' });
      if (!ok) throw new Error('Die Frei-Zeile konnte nicht angelegt werden.');
      installOptions();
      installFreeControl();
      const freeRows = rows().filter((row) => value(row,'duty') === 'Frei');
      const newest = freeRows.at(-1);
      const driverSelect = newest?.querySelector('.dp-daily-driver-select');
      if (driverSelect) driverSelect.focus({ preventScroll:true });
      status('Frei wurde hinzugefügt. Bitte den Fahrer auswählen und anschließend speichern.', 'ok');
    } catch (error) {
      status(error.message, 'error');
    } finally {
      addingFree = false;
      schedule(400);
    }
  }

  function installFreeControl() {
    if (!holiday(selectedDate()) || !visible()) return;
    const body = document.getElementById(TABLE);
    if (!body) return;

    let control = document.getElementById(CONTROL_ID);
    if (!control) {
      control = document.createElement('tr');
      control.id = CONTROL_ID;
      const cell = document.createElement('td');
      cell.colSpan = 8;
      cell.innerHTML = '<div class="dp-free-control"><button type="button" class="dp-free-button">＋ Frei</button><span class="dp-free-help"></span></div>';
      control.appendChild(cell);
      control.querySelector('.dp-free-button')?.addEventListener('click', addFreeRow);
    }

    const count = rows().filter((row) => value(row,'duty') === 'Frei').length;
    const helpText = `Fahrer ohne Dienst hinzufügen${count ? ` · aktuell ${count} Fahrer frei` : ''}`;
    const help = control.querySelector('.dp-free-help');
    if (help && help.textContent !== helpText) help.textContent = helpText;

    const firstFree = rows().find((row) => value(row,'duty') === 'Frei') || null;
    const alreadyCorrect = control.parentElement === body && control.nextElementSibling === firstFree;
    if (!alreadyCorrect) body.insertBefore(control, firstFree);
  }

  function refresh() {
    const date = selectedDate();
    if (!holiday(date)) {
      setHolidayUi(false);
      return;
    }
    mark(GENERAL_MARKER, date);
    banner();
    installOptions();
    installFreeControl();
    if (needsRebuild(date)) void rebuild();
  }

  function schedule(delay = 250) {
    clearTimeout(timer);
    timer = setTimeout(refresh, delay);
  }

  function isControlOnlyMutation(mutation) {
    const target = mutation.target?.nodeType === 1 ? mutation.target : mutation.target?.parentElement;
    if (target?.closest?.(`#${CONTROL_ID}`)) return true;
    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return changedNodes.length > 0 && changedNodes.every((node) => {
      if (node.nodeType !== 1) return false;
      return node.id === CONTROL_ID || node.closest?.(`#${CONTROL_ID}`);
    });
  }

  function observe() {
    const body = document.getElementById(TABLE);
    if (!body || body === observedBody) return;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver((mutations) => {
      if (running || addingFree) return;
      if (mutations.some((mutation) => !isControlOnlyMutation(mutation))) schedule(100);
    });
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
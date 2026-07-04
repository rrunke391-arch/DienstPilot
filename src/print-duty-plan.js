(() => {
  'use strict';

  const STORE_MAIN = 'lenkRuhezeitenRunke20260413';
  const VAC_PREFIX = 'dienstpilot-vacations-';
  const PRINT_BUTTON_ID = 'printDutyPlan';
  const VAC_BUTTON_ID = 'openJahresurlaub';
  const DUTIES_CONTAINER_ID = 'dutiesContainer';
  const PROFILE_TITLE_ID = 'profileTitle';
  const TEMPLATE_VERSION = 'kollegenplan-2026-v4';
  const BASE_MONTHS = ['2026-04','2026-05','2026-06','2026-07'];

  const KOLLEGEN = [
    ['yasar','Yasar'], ['bumhoffer','Bumhoffer'], ['entrup','Entrup'], ['schweppe','Schweppe'],
    ['janzen','Janzen'], ['alomar','Alomar'], ['al-sayek','Al Sayek'], ['szczepanik','Szczepanik'],
    ['seidensticker','Seidensticker'], ['kocdemir','Kocdemir'], ['wuellner','Wüllner'], ['wittwer','Wittwer'],
    ['biermann','Biermann'], ['gerding','Gerding'], ['runke','Runke'], ['lommel','Lommel'],
    ['malko','Malko'], ['murad','Murad'], ['kurta','Kurta'], ['wiemann','Wiemann']
  ];

  const PLAN_ROWS = [
    ['2026-04-13','2026-04-17',['Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Seidensticker','Kocdemir','Wüllner','Wittwer','Wiemann','Gerding','Runke','Lhommel','Malko','Murad']],
    ['2026-04-20','2026-04-24',['Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Seidensticker','Kocdemir','Wüllner','Wittwer','Wiemann','Gerding','Runke','Lhommel','Malko']],
    ['2026-04-27','2026-04-30',['Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Seidensticker','Kocdemir','Wüllner','Wittwer','Wiemann','Gerding','Runke','Lhommel']],
    ['2026-05-04','2026-05-08',['Lhommel','Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Kurta','Kocdemir','Wüllner','Wittwer','Wiemann','Gerding','Runke']],
    ['2026-05-11','2026-05-13',['Runke','Lhommel','Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Kurta','Kocdemir','Wüllner','Wittwer','Wiemann','Gerding']],
    ['2026-05-18','2026-05-22',['Gerding','Runke','Lhommel','Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Kurta','Kocdemir','Wüllner','Wittwer','Wiemann']],
    ['2026-05-27','2026-05-29',['Wiemann','Gerding','Runke','Lhommel','Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Kurta','Kocdemir','Wüllner','Wittwer']],
    ['2026-06-01','2026-06-05',['Wittwer','Wiemann','Gerding','Runke','Lhommel','Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Kurta','Kocdemir','Wüllner']],
    ['2026-06-08','2026-06-12',['Wüllner','Wittwer','Wiemann','Gerding','Runke','Lhommel','Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Kurta','Kocdemir']],
    ['2026-06-15','2026-06-19',['Kocdemir','Wüllner','Wittwer','Wiemann','Gerding','Runke','Lhommel','Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik','Kurta']],
    ['2026-06-22','2026-06-26',['Kurta','Kocdemir','Wüllner','Wittwer','Wiemann','Gerding','Runke','Lhommel','Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek','Szczepanik']],
    ['2026-06-29','2026-07-01',['Szczepanik','Kurta','Kocdemir','Wüllner','Wittwer','Wiemann','Gerding','Runke','Lhommel','Malko','Murad','Yasar','Bumhoffer','Entrup','Schweppe','Janzen','Alomar','Al Sayek']]
  ];

  const COLUMN_PATTERNS = [
    {0:'3023',1:'3023',2:'3023',3:'3023',4:'3023'}, {0:'3005',1:'3005',2:'3005',3:'3005'},
    {0:'3003',1:'3003',2:'3003',3:'3003',4:'3003'}, {1:'3016',2:'3016',3:'3016',4:'3016'},
    {1:'3014',2:'3014',3:'3006',4:'3005'}, {0:'3006',1:'3006',2:'3006',4:'3006'},
    {0:'3007',1:'3007',2:'3007',3:'3009',4:'3009'}, {0:'3019',2:'3019',3:'3019',4:'3019'},
    {0:'3025',1:'3025',2:'3025',3:'3025',4:'3025'}, {0:'3011',1:'3011',3:'3014',4:'3014'},
    {0:'3013',1:'3013',2:'3001',3:'3001',4:'3001'}, {0:'3012',1:'3012',3:'3012',4:'3012'},
    {0:'3024',1:'3024',2:'3024',3:'3024',4:'3024'}, {0:'3001',1:'3001',2:'3013',3:'3013',4:'3013'},
    {0:'3014',2:'3011',3:'3011',4:'3011'}, {0:'3016',1:'3019',2:'3012',4:'3095'},
    {0:'3022',1:'3022',2:'3022',3:'3022',4:'3022'}, {0:'3009',1:'3009',2:'3009',3:'3007',4:'3007'}
  ];

  const TIMES = {
    '3001':['05:03','12:12'], '3003':['05:47','14:10'], '3005':['05:51','15:49'], '3006':['06:00','16:20'],
    '3007':['06:03','14:19'], '3009':['06:04','16:25'], '3011':['06:23','17:00'], '3012':['06:31','16:50'],
    '3013':['06:35','17:05'], '3014':['06:35','15:39'], '3016':['06:43','18:06'], '3019':['06:49','17:28'],
    '3022':['12:03','19:21'], '3023':['12:03','20:21'], '3024':['12:20','21:05'], '3025':['13:10','21:50'], '3095':['20:20','04:05']
  };
  const FRIDAY_TIMES = {'3005':['05:51','15:49'], '3006':['06:00','14:21'], '3007':['06:03','14:19'], '3009':['06:04','15:30'], '3011':['06:23','14:34'], '3019':['06:49','15:50']};

  ready(() => {
    cleanupOldVacationWish();
    installStyles();
    ensurePrintButton();
    ensureVacationButton();
    ensureColleaguePicker();
    enhanceCalendar();

    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#loadKollege')) { event.preventDefault(); loadSelectedColleague(false); return; }
      if (event.target.closest?.('#reloadKollegeTemplate')) { event.preventDefault(); loadSelectedColleague(true); return; }
      if (event.target.closest?.('#' + VAC_BUTTON_ID)) { event.preventDefault(); openVacationWindow(); return; }
      if (event.target.closest?.('[data-month-jump]')) { event.preventDefault(); openMonth(event.target.closest('[data-month-jump]').dataset.monthJump); return; }
      if (event.target.closest?.('#' + PRINT_BUTTON_ID)) { event.preventDefault(); printDutyPlan(); }
    }, true);

    document.addEventListener('change', (event) => {
      if (event.target && event.target.id === 'kollegeSelect') loadSelectedColleague(false);
    }, true);

    window.addEventListener('focus', enhanceCalendar);
    window.addEventListener('storage', enhanceCalendar);
    const observer = new MutationObserver(() => {
      clearTimeout(observer._timer);
      observer._timer = setTimeout(() => { ensurePrintButton(); ensureVacationButton(); ensureColleaguePicker(); enhanceCalendar(); }, 120);
    });
    observer.observe(document.body, { childList:true, subtree:true });
  });

  function ready(fn) { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once:true }) : fn(); }

  function installStyles() {
    if (document.getElementById('dienstpilotHelperStyles')) return;
    const style = document.createElement('style');
    style.id = 'dienstpilotHelperStyles';
    style.textContent = `
      .kollegen-panel{display:inline-flex;align-items:center;gap:8px;padding:4px;border-radius:14px}.kollegen-panel span{font-weight:800;font-size:14px}.kollegen-panel select{min-width:170px;padding:10px 12px;border-radius:14px;border:1px solid #cbd5e1;background:#fff;font-weight:800;color:#020617}.kollegen-hinweis{font-size:12px;color:#64748b;font-weight:700}
      .month-jump-nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0 16px;padding:10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:16px}.month-jump-nav-title{font-weight:900;color:#475569;margin-right:4px}.month-jump-nav button{padding:8px 12px;border-radius:999px;background:#fff;border:1px solid #cbd5e1;color:#0f172a;font-weight:900}
      .month-group>summary{display:flex!important;align-items:center;gap:10px;flex-wrap:wrap}.month-overview-pills{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}.month-pill{display:inline-flex;align-items:center;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900;border:1px solid #e2e8f0;background:#f8fafc;color:#334155}.month-pill.work{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}.month-pill.vacation{background:#ecfdf5;border-color:#bbf7d0;color:#166534}.month-pill.free{background:#f8fafc;border-color:#cbd5e1;color:#475569}.month-pill.fail{background:#fef2f2;border-color:#fecaca;color:#991b1b}.month-pill.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
      .week-group{margin:8px 0!important;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;background:#fff}.week-group>summary{padding:10px 12px!important;background:#f8fafc;font-size:14px!important;gap:8px!important}
      .day-group{margin:6px 0!important;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}.day-group>summary{display:grid!important;grid-template-columns:minmax(42px,55px) minmax(86px,110px) minmax(130px,1fr) auto;align-items:center;gap:8px;padding:9px 12px!important;font-size:14px!important}.day-group.compact-vacation>summary{box-shadow:inset 5px 0 0 #16a34a;background:#f0fdf4}.day-group.compact-free>summary{box-shadow:inset 4px 0 0 #94a3b8;background:#f8fafc}.dp-vacation-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 9px;background:#dcfce7;color:#166534;font-weight:900;font-size:12px}
      @media(max-width:720px){.day-group>summary{grid-template-columns:46px 1fr}.day-group>summary .summary-duty,.day-group>summary .summary-status,.day-group>summary .badge{grid-column:1/-1}.month-overview-pills{width:100%;margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function cleanupOldVacationWish() {
    const remove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('dienstpilot_urlaubswunsch_')) remove.push(k);
    }
    remove.forEach(k => localStorage.removeItem(k));
    document.getElementById('openUrlaubswunsch')?.remove();
    document.getElementById('urlaubswunschBackdrop')?.remove();
  }

  function ensureVacationButton() {
    if (document.getElementById(VAC_BUTTON_ID)) return;
    const printBtn = document.getElementById(PRINT_BUTTON_ID);
    const clearBtn = document.getElementById('clearDuties');
    const group = printBtn?.closest('.toolbar-group') || clearBtn?.closest('.toolbar-group');
    if (!group) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn-secondary'; btn.id = VAC_BUTTON_ID; btn.textContent = '🌴 Jahresurlaub';
    if (printBtn) group.insertBefore(btn, printBtn); else group.appendChild(btn);
  }

  function openVacationWindow() {
    const profile = activeProfile() || localStorage.getItem('dienstpilot_aktiver_kollege');
    if (!profile) { alert('Bitte zuerst einen Kollegen laden.'); return; }
    const stored = readVacationProfile(profile);
    let vacations = Array.isArray(stored.vacations) ? stored.vacations.slice() : [];
    const win = window.open('', 'DienstPilotJahresurlaub', 'width=820,height=760,scrollbars=yes,resizable=yes');
    if (!win) { alert('Das Jahresurlaub-Fenster konnte nicht geöffnet werden. Bitte Pop-ups erlauben.'); return; }
    win.document.open();
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Jahresurlaub</title><style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#0f172a}.wrap{max-width:760px;margin:0 auto;padding:20px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;margin:12px 0;box-shadow:0 10px 30px rgba(15,23,42,.08)}h1{margin:0 0 4px;font-size:24px}.muted{color:#64748b;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}label{display:flex;flex-direction:column;font-weight:800;font-size:13px;gap:5px}input{padding:10px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px}button{border:0;border-radius:12px;padding:10px 14px;font-weight:900;cursor:pointer}.primary{background:#2563eb;color:white}.secondary{background:#e2e8f0;color:#0f172a}.danger{background:#fee2e2;color:#991b1b}.row{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #e2e8f0;border-radius:14px;padding:10px;margin:8px 0;background:#fff}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.status{font-weight:900;color:#166534;margin-left:8px}.error{color:#991b1b}@media(max-width:640px){.grid{grid-template-columns:1fr}}</style></head><body><div class="wrap"><div class="card"><h1>🌴 Jahresurlaub</h1><div class="muted">${escapeHtml(colleagueName(profile))} · Urlaub wird getrennt pro Kollege gespeichert.</div></div><div class="card"><div class="grid"><label>Bezeichnung<input id="vacLabel" value="Urlaub"></label><label>Anspruch Tage/Jahr<input id="vacEntitlement" type="number" min="0" max="99" value="${escapeHtml(stored.vacationEntitlement || 30)}"></label><label>Von<input id="vacStart" type="date"></label><label>Bis<input id="vacEnd" type="date"></label></div><div class="actions"><button class="primary" id="addVac">Urlaub hinzufügen</button><button class="primary" id="saveVac">💾 Jahresurlaub speichern</button><button class="secondary" id="closeVac">Fenster schließen</button><span class="status" id="status"></span></div></div><div class="card"><strong>Gespeicherte Urlaube</strong><div id="vacList"></div></div></div></body></html>`);
    win.document.close();

    const $ = id => win.document.getElementById(id);
    const status = (text, error=false) => { $('status').textContent = text; $('status').className = error ? 'status error' : 'status'; };
    const render = () => {
      const list = $('vacList');
      list.innerHTML = vacations.length ? vacations.map((v, i) => `<div class="row"><div><strong>${escapeHtml(v.label || 'Urlaub')}</strong><br><span class="muted">${escapeHtml(v.start)} bis ${escapeHtml(v.end)}</span></div><button class="danger" data-del="${i}">Löschen</button></div>`).join('') : '<p class="muted">Noch kein Urlaub eingetragen.</p>';
      list.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => { vacations.splice(Number(btn.dataset.del), 1); render(); }));
    };
    const addFromFields = () => {
      const start = $('vacStart').value;
      const end = $('vacEnd').value || start;
      if (!start) return false;
      if (end < start) { status('Das Bis-Datum liegt vor dem Von-Datum. Bitte 10.04.2026 statt 10.03.2026 wählen.', true); return null; }
      vacations.push({ id:'vac-' + Date.now() + '-' + Math.random().toString(16).slice(2), label:$('vacLabel').value || 'Urlaub', emoji:'🌴', start, end });
      $('vacStart').value = ''; $('vacEnd').value = ''; status('Urlaub wurde zur Liste hinzugefügt.'); render();
      return true;
    };
    const save = () => {
      const added = addFromFields();
      if (added === null) return;
      if (!vacations.length) { status('Bitte erst ein Von-Datum eintragen oder Urlaub hinzufügen.', true); return; }
      persistVacationProfile(profile, vacations, Number($('vacEntitlement').value) || 30);
      status('Gespeichert. DienstPilot wird neu geladen.');
      setTimeout(() => { try { window.location.reload(); } catch {} }, 350);
    };
    $('addVac').addEventListener('click', () => { addFromFields(); });
    $('saveVac').addEventListener('click', save);
    $('closeVac').addEventListener('click', () => win.close());
    render(); win.focus();
  }

  function readVacationProfile(profile) {
    const stable = readJson(VAC_PREFIX + profile) || {};
    const named = readJson('lrz-plan-' + profile) || {};
    return {
      vacations: Array.isArray(stable.vacations) ? stable.vacations : (Array.isArray(named.vacations) ? named.vacations : []),
      vacationEntitlement: Number.isFinite(stable.vacationEntitlement) ? stable.vacationEntitlement : (Number.isFinite(named.vacationEntitlement) ? named.vacationEntitlement : 30)
    };
  }

  function persistVacationProfile(profile, vacations, entitlement) {
    const clean = (Array.isArray(vacations) ? vacations : []).filter(v => v && v.start && v.end && v.end >= v.start);
    localStorage.setItem(VAC_PREFIX + profile, JSON.stringify({ vacations: clean, vacationEntitlement: entitlement, savedAt: new Date().toISOString() }));

    const main = readJson(STORE_MAIN) || {};
    const appSettings = { ...(main.appSettings || {}), activeProfile: profile };
    const shown = new Set([...(appSettings.shownMonths || []), ...BASE_MONTHS]);
    monthsCovered(clean).forEach(m => shown.add(m));
    appSettings.shownMonths = [...shown].sort();
    localStorage.setItem(STORE_MAIN, JSON.stringify({ ...main, appSettings }));

    const named = readJson('lrz-plan-' + profile) || {};
    localStorage.setItem('lrz-plan-' + profile, JSON.stringify({ ...named, vacations: clean, vacationEntitlement: entitlement, savedAt: new Date().toISOString(), templateVersion: named.templateVersion || TEMPLATE_VERSION }));
  }

  function getActiveVacations() {
    const profile = activeProfile() || localStorage.getItem('dienstpilot_aktiver_kollege');
    return profile ? readVacationProfile(profile).vacations : [];
  }

  function enhanceCalendar() {
    const container = document.getElementById(DUTIES_CONTAINER_ID);
    if (!container) return;
    const months = [...container.querySelectorAll('details.month-group[data-month]')];
    if (!months.length) return;
    addVacationBadges(container);
    ensureMonthNav(container, months);
    months.forEach(month => {
      enhanceMonthSummary(month);
      month.querySelectorAll('details.day-group').forEach(day => {
        if (!day.dataset.compactReady) { day.removeAttribute('open'); day.dataset.compactReady = '1'; }
        const text = day.querySelector(':scope > summary')?.textContent || '';
        day.classList.toggle('compact-free', /Frei|kein Dienst/.test(text));
        day.classList.toggle('compact-vacation', !!day.querySelector('.vacation-badge,.dp-vacation-badge'));
      });
    });
  }

  function addVacationBadges(container) {
    const vacations = getActiveVacations();
    container.querySelectorAll('.dp-vacation-badge').forEach(el => el.remove());
    if (!vacations.length) return;
    container.querySelectorAll('details.day-group[data-day]').forEach(day => {
      const iso = day.dataset.day;
      const vacation = vacations.find(v => v && v.start && v.end && iso >= v.start && iso <= v.end);
      if (!vacation) return;
      const summary = day.querySelector(':scope > summary');
      if (!summary) return;
      if (!summary.querySelector('.vacation-badge')) {
        const badge = document.createElement('span');
        badge.className = 'vacation-badge dp-vacation-badge';
        badge.textContent = (vacation.emoji || '🌴') + ' ' + (vacation.label || 'Urlaub');
        const duty = summary.querySelector('.summary-duty');
        if (duty) summary.insertBefore(badge, duty); else summary.appendChild(badge);
      }
      day.classList.add('compact-vacation');
    });
  }

  function ensureMonthNav(container, months) {
    let nav = container.querySelector(':scope > .month-jump-nav');
    if (!nav) { nav = document.createElement('div'); nav.className = 'month-jump-nav'; container.insertBefore(nav, container.firstChild); }
    const key = months.map(m => m.dataset.month).join('|');
    if (nav.dataset.months === key) return;
    nav.dataset.months = key;
    nav.innerHTML = '<span class="month-jump-nav-title">Monate:</span>' + months.map(m => `<button type="button" data-month-jump="${escapeAttr(m.dataset.month)}">${escapeHtml(monthLabel(m.dataset.month))}</button>`).join('');
  }

  function enhanceMonthSummary(month) {
    const summary = month.querySelector(':scope > summary');
    if (!summary) return;
    summary.querySelector('.month-overview-pills')?.remove();
    const days = [...month.querySelectorAll('details.day-group')];
    let vacation = 0, free = 0, work = 0, fail = 0, warn = 0;
    days.forEach(day => {
      const txt = day.querySelector(':scope > summary')?.textContent || '';
      if (day.querySelector('.vacation-badge,.dp-vacation-badge')) vacation++;
      if (/Frei|kein Dienst/.test(txt)) free++; else work++;
      if (day.querySelector('.fail,.summary-status.fail,.badge.fail')) fail++;
      else if (day.querySelector('.warn,.summary-status.warn,.badge.warn')) warn++;
    });
    const pills = document.createElement('span'); pills.className = 'month-overview-pills';
    pills.innerHTML = [`<span class="month-pill work">${work} Arbeit</span>`, vacation ? `<span class="month-pill vacation">${vacation} Urlaub</span>` : '', free ? `<span class="month-pill free">${free} frei</span>` : '', fail ? `<span class="month-pill fail">${fail} Fehler</span>` : '', warn ? `<span class="month-pill warn">${warn} Hinweise</span>` : ''].filter(Boolean).join('');
    summary.appendChild(pills);
  }

  function ensureColleaguePicker() {
    let panel = document.getElementById('kollegenPanel');
    const runkeBtn = document.getElementById('loadRunke');
    const sync = document.getElementById('syncStatus');
    const group = runkeBtn?.closest('.toolbar-group') || sync?.closest('.toolbar-group');
    if (!group) return;
    if (!panel) { panel = document.createElement('div'); panel.id = 'kollegenPanel'; panel.className = 'kollegen-panel'; group.insertBefore(panel, runkeBtn || sync || group.firstChild); }
    if (!document.getElementById('kollegeSelect')) {
      panel.innerHTML = '<span>👤 Kollege</span>';
      const select = document.createElement('select'); select.id = 'kollegeSelect';
      KOLLEGEN.forEach(([id, name]) => { const o = document.createElement('option'); o.value = id; o.textContent = name; select.appendChild(o); });
      const load = document.createElement('button'); load.type = 'button'; load.id = 'loadKollege'; load.className = 'btn-secondary'; load.textContent = 'Kollege laden';
      const reload = document.createElement('button'); reload.type = 'button'; reload.id = 'reloadKollegeTemplate'; reload.className = 'btn-secondary'; reload.textContent = 'Vorlage neu laden';
      const note = document.createElement('span'); note.className = 'kollegen-hinweis'; note.textContent = 'Dienste aus Fotoplan';
      panel.append(select, load, reload, note);
    }
    const active = activeProfile() || localStorage.getItem('dienstpilot_aktiver_kollege') || 'runke';
    const select = document.getElementById('kollegeSelect');
    if (select && [...select.options].some(o => o.value === active)) select.value = active;
    setTitle(active);
  }

  function loadSelectedColleague(forceTemplate) {
    const profile = document.getElementById('kollegeSelect')?.value || 'runke';
    const stored = readJson('lrz-plan-' + profile) || {};
    const vac = readVacationProfile(profile);
    const useTemplate = forceTemplate || localStorage.getItem('dienstpilot_kollege_template_' + profile) !== TEMPLATE_VERSION || !Array.isArray(stored.duties);
    const duties = profile === 'biermann' ? [] : (useTemplate ? buildPlan(profile) : stored.duties);
    const shownMonths = [...new Set([...BASE_MONTHS, ...monthsCovered(vac.vacations)])].sort();
    const current = readJson(STORE_MAIN) || {};
    const state = { ...current, duties, customCatalog: current.customCatalog || {}, appSettings: { ...(current.appSettings || {}), activeProfile: profile, shownMonths } };
    const named = { ...stored, duties, vacations: vac.vacations, vacationEntitlement: vac.vacationEntitlement, savedAt: new Date().toISOString(), templateVersion: TEMPLATE_VERSION };
    localStorage.setItem('dienstpilot_aktiver_kollege', profile);
    localStorage.setItem('dienstpilot_kollege_template_' + profile, TEMPLATE_VERSION);
    localStorage.setItem(STORE_MAIN, JSON.stringify(state));
    localStorage.setItem('lrz-plan-' + profile, JSON.stringify(named));
    localStorage.setItem(VAC_PREFIX + profile, JSON.stringify({ vacations: vac.vacations, vacationEntitlement: vac.vacationEntitlement, savedAt: new Date().toISOString() }));
    setTitle(profile); location.reload();
  }

  function buildPlan(profile) {
    const target = planName(profile); const out = [];
    PLAN_ROWS.forEach(([start, end, names]) => {
      let d = parseIso(start); const last = parseIso(end);
      while (d <= last) {
        const iso = formatIso(d); const weekday = d.getDay() === 0 ? 6 : d.getDay() - 1;
        names.forEach((name, col) => { if (norm(name) === target) { const number = COLUMN_PATTERNS[col]?.[weekday]; if (number) out.push(makeDuty(profile, iso, number, out.length + 1)); } });
        d.setDate(d.getDate() + 1);
      }
    });
    return out;
  }

  function makeDuty(profile, date, number, index) {
    const friday = new Date(date + 'T12:00:00').getDay() === 5;
    const t = friday && FRIDAY_TIMES[number] ? FRIDAY_TIMES[number] : TIMES[number];
    return { id:`${profile}-${String(index).padStart(3,'0')}-${date}-${number}`, date, number, start:t?.[0] || '', end:t?.[1] || '', breaks:'', drivingBlocks:'', lineMode:'linie50', stopDistance:'lte3', pauseRule:'auto', tariffEight:false };
  }

  function printDutyPlan() {
    const c = document.getElementById(DUTIES_CONTAINER_ID);
    if (!c || !c.innerHTML.trim()) { alert('Kein Dienstplan zum Drucken vorhanden.'); return; }
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) { alert('Druckfenster konnte nicht geöffnet werden. Bitte Pop-ups erlauben.'); return; }
    const title = document.getElementById(PROFILE_TITLE_ID)?.textContent?.trim() || 'Dienstplan';
    w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:20px;color:#111}button,input,select,textarea,.toolbar,.tabs{display:none!important}.card,.day-group,.week-group,.month-group{break-inside:avoid;border:1px solid #ddd;border-radius:8px;margin:8px 0;padding:8px}</style></head><body><h1>DienstPilot · ${escapeHtml(title)}</h1>${c.cloneNode(true).innerHTML}<script>window.onload=()=>{window.print();};<\/script></body></html>`);
    w.document.close();
  }

  function ensurePrintButton() {
    if (document.getElementById(PRINT_BUTTON_ID)) return;
    const clear = document.getElementById('clearDuties');
    const group = clear?.closest('.toolbar-group');
    if (!group) return;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn-secondary'; btn.id = PRINT_BUTTON_ID; btn.textContent = '🖨 Dienstplan drucken';
    clear.insertAdjacentElement('afterend', btn);
  }

  function openMonth(monthKey) { const m = document.querySelector(`details.month-group[data-month="${CSS.escape(monthKey)}"]`); if (m) { m.open = true; m.scrollIntoView({ behavior:'smooth', block:'start' }); } }
  function activeProfile() { return readJson(STORE_MAIN)?.appSettings?.activeProfile || null; }
  function readJson(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
  function monthsCovered(vacations) { const set = new Set(); (vacations || []).forEach(v => { let cur = v.start; let guard = 0; while (/^\d{4}-\d{2}-\d{2}$/.test(cur) && cur <= v.end && guard++ < 400) { set.add(cur.slice(0,7)); cur = addDays(cur, 1); } }); return [...set]; }
  function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return formatIso(d); }
  function parseIso(iso) { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); }
  function formatIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function monthLabel(m) { const names = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']; const parts = String(m).split('-').map(Number); return names[(parts[1] || 1) - 1] + ' ' + parts[0]; }
  function planName(profile) { return ({ 'al-sayek':'alsayek', wuellner:'wullner', lommel:'lhommel' })[profile] || profile; }
  function norm(v) { return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,''); }
  function colleagueName(profile) { return (KOLLEGEN.find(([id]) => id === profile) || [profile, profile])[1]; }
  function setTitle(profile) { const t = document.getElementById(PROFILE_TITLE_ID); if (t && profile) { t.textContent = 'Dienstplan ' + colleagueName(profile); t.classList.remove('empty'); } }
  function escapeHtml(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function escapeAttr(v) { return escapeHtml(v).replaceAll('`','&#096;'); }
})();

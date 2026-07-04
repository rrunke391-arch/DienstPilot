(() => {
  'use strict';

  const PRINT_BUTTON_ID = 'printDutyPlan';
  const VACATION_BUTTON_ID = 'openJahresurlaub';
  const VACATION_SAVE_ID = 'saveJahresurlaub';
  const DUTIES_CONTAINER_ID = 'dutiesContainer';
  const PROFILE_TITLE_ID = 'profileTitle';
  const MONTHS_TO_SHOW = ['2026-04','2026-05','2026-06','2026-07'];
  const TEMPLATE_VERSION = 'kollegenplan-2026-v3';

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
    repairDomTypos();
    neutralizeOldVacationWish();
    installExtraStyles();
    ensurePrintButton();
    ensureJahresurlaubButton();
    ensureKollegenAuswahl();
    ensureVacationSaveButton();
    updateKollegenTitelOnly();
    enhanceMonthOverview();

    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#loadKollege')) { event.preventDefault(); event.stopPropagation(); loadSelectedKollege(false); return; }
      if (event.target.closest?.('#reloadKollegeTemplate')) { event.preventDefault(); event.stopPropagation(); loadSelectedKollege(true); return; }
      if (event.target.closest?.('#' + VACATION_BUTTON_ID)) { event.preventDefault(); openJahresurlaub(); return; }
      if (event.target.closest?.('#' + VACATION_SAVE_ID)) { event.preventDefault(); saveJahresurlaubNow(); return; }
      const jump = event.target.closest?.('[data-month-jump]');
      if (jump) { event.preventDefault(); openAndScrollToMonth(jump.dataset.monthJump); return; }
      if (event.target.closest?.('#' + PRINT_BUTTON_ID)) { event.preventDefault(); printDutyPlan(); }
    }, true);

    document.addEventListener('change', (event) => {
      if (event.target && event.target.id === 'kollegeSelect') loadSelectedKollege(false);
    }, true);

    const observer = new MutationObserver(() => {
      window.clearTimeout(observer._timer);
      observer._timer = window.setTimeout(() => {
        neutralizeOldVacationWish();
        ensurePrintButton();
        ensureJahresurlaubButton();
        ensureKollegenAuswahl();
        ensureVacationSaveButton();
        updateKollegenTitelOnly();
        enhanceMonthOverview();
      }, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  function ready(callback) { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', callback, { once:true }) : callback(); }

  function repairDomTypos() {
    const loginError = document.getElementById('loginError');
    if (loginError && loginError.tagName !== 'DIV') {
      const fixed = document.createElement('div');
      fixed.id = 'loginError';
      fixed.className = 'login-error';
      loginError.replaceWith(fixed);
    }
  }

  function neutralizeOldVacationWish() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('dienstpilot_urlaubswunsch_')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    document.getElementById('openUrlaubswunsch')?.remove();
    document.getElementById('urlaubswunschBackdrop')?.remove();
    try { window.openUrlaubswunschCalendar = undefined; } catch {}
  }

  function installExtraStyles() {
    if (document.getElementById('dienstpilotKollegenStyles')) return;
    const style = document.createElement('style');
    style.id = 'dienstpilotKollegenStyles';
    style.textContent = `
      .kollegen-panel{display:inline-flex;align-items:center;gap:8px;padding:4px;border-radius:14px}.kollegen-panel span{font-weight:800;font-size:14px}.kollegen-panel select{min-width:170px;padding:10px 12px;border-radius:14px;border:1px solid #cbd5e1;background:#fff;font-weight:800;color:#020617}.kollegen-hinweis{font-size:12px;color:#64748b;font-weight:700}
      .month-jump-nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0 16px;padding:10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:16px}.month-jump-nav-title{font-weight:900;color:#475569;margin-right:4px}.month-jump-nav button{padding:8px 12px;border-radius:999px;background:#fff;border:1px solid #cbd5e1;color:#0f172a;font-weight:900}
      .month-group{border-radius:22px;overflow:hidden}.month-group>summary{display:flex!important;align-items:center;gap:10px;flex-wrap:wrap}.month-group>summary .month-overview-pills{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}.month-pill{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900;border:1px solid #e2e8f0;background:#f8fafc;color:#334155}.month-pill.work{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}.month-pill.vacation{background:#ecfdf5;border-color:#bbf7d0;color:#166534}.month-pill.free{background:#f8fafc;border-color:#cbd5e1;color:#475569}.month-pill.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}.month-pill.fail{background:#fef2f2;border-color:#fecaca;color:#991b1b}
      .week-group{margin:8px 0!important;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;background:#fff}.week-group>summary{padding:10px 12px!important;background:#f8fafc;font-size:14px!important;gap:8px!important}
      .day-group{margin:6px 0!important;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}.day-group>summary{display:grid!important;grid-template-columns:minmax(42px,55px) minmax(86px,110px) minmax(130px,1fr) auto;align-items:center;gap:8px;padding:9px 12px!important;font-size:14px!important}.day-group>summary .summary-dow{font-weight:900;color:#475569}.day-group>summary .summary-date{font-weight:800}.day-group>summary .summary-duty{font-weight:900}.day-group.compact-vacation>summary{box-shadow:inset 4px 0 0 #16a34a;background:#f0fdf4}.day-group.compact-free>summary{box-shadow:inset 4px 0 0 #94a3b8;background:#f8fafc}.day-group.compact-problem>summary{box-shadow:inset 4px 0 0 #dc2626;background:#fef2f2}.day-group.compact-warning>summary{box-shadow:inset 4px 0 0 #f59e0b;background:#fffbeb}.day-group[open]>summary{border-bottom:1px solid #e2e8f0}
      .jahresurlaub-save-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.jahresurlaub-save-status{font-size:13px;font-weight:800;color:#166534}.jahresurlaub-save-status.error{color:#991b1b}
      @media(max-width:720px){.day-group>summary{grid-template-columns:46px 1fr;}.day-group>summary .summary-duty,.day-group>summary .summary-status,.day-group>summary .badge{grid-column:1/-1}.month-group>summary .month-overview-pills{width:100%;margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function ensureJahresurlaubButton() {
    if (document.getElementById(VACATION_BUTTON_ID)) return;
    const printBtn = document.getElementById(PRINT_BUTTON_ID);
    const clearBtn = document.getElementById('clearDuties');
    const toolbarGroup = printBtn?.closest('.toolbar-group') || clearBtn?.closest('.toolbar-group');
    if (!toolbarGroup) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-secondary';
    btn.id = VACATION_BUTTON_ID;
    btn.textContent = '🌴 Jahresurlaub';
    if (printBtn) toolbarGroup.insertBefore(btn, printBtn); else toolbarGroup.appendChild(btn);
  }

  function openJahresurlaub() {
    const profile = activeProfileFromLocal() || localStorage.getItem('dienstpilot_aktiver_kollege');
    if (!profile) { alert('Bitte zuerst einen Kollegen laden.'); return; }
    const popup = window.open('', 'DienstPilotJahresurlaub', 'width=820,height=760,scrollbars=yes,resizable=yes');
    if (!popup) { alert('Das Jahresurlaub-Fenster konnte nicht geöffnet werden. Bitte Pop-ups erlauben.'); return; }
    const named = loadNamedPlan(profile) || {};
    let vacations = Array.isArray(named.vacations) ? named.vacations.slice() : [];
    const colleague = kollegeName(profile);
    popup.document.open();
    popup.document.write('<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Jahresurlaub</title><style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#0f172a}.wrap{max-width:760px;margin:0 auto;padding:20px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;margin:12px 0;box-shadow:0 10px 30px rgba(15,23,42,.08)}h1{margin:0 0 4px;font-size:24px}.muted{color:#64748b;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}label{display:flex;flex-direction:column;font-weight:800;font-size:13px;gap:5px}input{padding:10px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px}button{border:0;border-radius:12px;padding:10px 14px;font-weight:900;cursor:pointer}.primary{background:#2563eb;color:white}.secondary{background:#e2e8f0;color:#0f172a}.danger{background:#fee2e2;color:#991b1b}.row{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #e2e8f0;border-radius:14px;padding:10px;margin:8px 0;background:#fff}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.status{font-weight:900;color:#166534;margin-left:8px}@media(max-width:640px){.grid{grid-template-columns:1fr}}</style></head><body><div class="wrap"><div class="card"><h1>🌴 Jahresurlaub</h1><div class="muted">' + escapeHtml(colleague) + ' · Urlaub wird getrennt pro Kollege gespeichert.</div></div><div class="card"><div class="grid"><label>Bezeichnung<input id="vacLabel" value="Urlaub"></label><label>Anspruch Tage/Jahr<input id="vacEntitlement" type="number" min="0" max="99" value="' + escapeHtml(named.vacationEntitlement || 30) + '"></label><label>Von<input id="vacStart" type="date"></label><label>Bis<input id="vacEnd" type="date"></label></div><div class="actions"><button class="primary" id="addVac">Urlaub hinzufügen</button><button class="primary" id="saveVac">💾 Jahresurlaub speichern</button><button class="secondary" id="closeVac">Fenster schließen</button><span class="status" id="status"></span></div></div><div class="card"><strong>Gespeicherte Urlaube</strong><div id="vacList"></div></div></div></body></html>');
    popup.document.close();
    const $ = id => popup.document.getElementById(id);
    const render = () => {
      const list = $('vacList');
      list.innerHTML = vacations.length ? vacations.map((v, i) => '<div class="row"><div><strong>' + escapeHtml(v.label || 'Urlaub') + '</strong><br><span class="muted">' + escapeHtml(v.start || '') + ' bis ' + escapeHtml(v.end || '') + '</span></div><button class="danger" data-del="' + i + '">Löschen</button></div>').join('') : '<p class="muted">Noch kein Urlaub eingetragen.</p>';
      list.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => { vacations.splice(Number(btn.dataset.del), 1); render(); }));
    };
    const save = () => {
      const current = loadNamedPlan(profile) || {};
      const state = loadMainState() || {};
      const next = { ...current, duties: Array.isArray(state.duties) ? state.duties : (Array.isArray(current.duties) ? current.duties : []), vacations, vacationEntitlement: Number($('vacEntitlement').value) || 30, savedAt: new Date().toISOString(), templateVersion: current.templateVersion || TEMPLATE_VERSION };
      localStorage.setItem('lrz-plan-' + profile, JSON.stringify(next));
      $('status').textContent = 'Gespeichert.';
    };
    $('addVac').addEventListener('click', () => {
      const start = $('vacStart').value;
      const end = $('vacEnd').value || start;
      if (!start) { $('status').textContent = 'Bitte Startdatum eintragen.'; return; }
      vacations.push({ id: 'vac-' + Date.now(), label: $('vacLabel').value || 'Urlaub', emoji: '🌴', start, end });
      $('vacStart').value = ''; $('vacEnd').value = ''; $('status').textContent = '';
      render();
    });
    $('saveVac').addEventListener('click', save);
    $('closeVac').addEventListener('click', () => popup.close());
    render();
    popup.focus();
  }

  function ensureVacationSaveButton() {
    const section = document.querySelector('.vacation-section');
    if (!section || document.getElementById(VACATION_SAVE_ID)) return;
    const row = document.createElement('div');
    row.className = 'jahresurlaub-save-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-primary';
    btn.id = VACATION_SAVE_ID;
    btn.textContent = '💾 Jahresurlaub speichern';
    const status = document.createElement('span');
    status.id = 'jahresurlaubSaveStatus';
    status.className = 'jahresurlaub-save-status';
    row.appendChild(btn);
    row.appendChild(status);
    const addBtn = document.getElementById('vacationAddBtn');
    if (addBtn) addBtn.insertAdjacentElement('afterend', row); else section.appendChild(row);
  }

  function saveJahresurlaubNow() {
    const form = document.getElementById('vacationForm');
    const formSave = document.getElementById('vacationFormSave');
    if (form && !form.classList.contains('hidden') && formSave) { formSave.click(); }
    setTimeout(() => {
      const status = document.getElementById('jahresurlaubSaveStatus');
      const profile = activeProfileFromLocal() || localStorage.getItem('dienstpilot_aktiver_kollege');
      if (!profile) { if (status) { status.textContent = 'Bitte zuerst einen Kollegen laden.'; status.classList.add('error'); } return; }
      const state = loadMainState() || {};
      const named = loadNamedPlan(profile) || {};
      const entitlementInput = document.getElementById('vacationEntitlement');
      const entitlement = entitlementInput && entitlementInput.value !== '' ? Number(entitlementInput.value) : named.vacationEntitlement;
      const nextNamed = { ...named, duties: Array.isArray(state.duties) ? state.duties : (Array.isArray(named.duties) ? named.duties : []), vacations: Array.isArray(named.vacations) ? named.vacations : [], vacationEntitlement: Number.isFinite(entitlement) ? entitlement : 30, hideSundays: !!(state.appSettings && state.appSettings.hideSundays), savedAt: new Date().toISOString(), templateVersion: named.templateVersion || TEMPLATE_VERSION };
      localStorage.setItem('lrz-plan-' + profile, JSON.stringify(nextNamed));
      if (state.appSettings) { state.appSettings.activeProfile = profile; localStorage.setItem('lenkRuhezeitenRunke20260413', JSON.stringify(state)); }
      if (status) { status.textContent = 'Jahresurlaub gespeichert.'; status.classList.remove('error'); }
    }, 180);
  }

  function enhanceMonthOverview() {
    const container = document.getElementById(DUTIES_CONTAINER_ID);
    if (!container) return;
    const months = [...container.querySelectorAll('details.month-group[data-month]')];
    if (!months.length) return;
    ensureMonthJumpNav(container, months);
    months.forEach(month => {
      enhanceOneMonth(month);
      month.querySelectorAll('details.day-group').forEach(day => {
        if (!day.dataset.compactReady) { day.removeAttribute('open'); day.dataset.compactReady = '1'; }
        markDayClass(day);
      });
    });
  }

  function ensureMonthJumpNav(container, months) {
    let nav = container.querySelector(':scope > .month-jump-nav');
    if (!nav) { nav = document.createElement('div'); nav.className = 'month-jump-nav'; container.insertBefore(nav, container.firstChild); }
    const monthNames = months.map(m => m.dataset.month).join('|');
    if (nav.dataset.months === monthNames) return;
    nav.dataset.months = monthNames;
    nav.innerHTML = '<span class="month-jump-nav-title">Monate:</span>' + months.map(month => {
      const label = month.querySelector(':scope > summary')?.childNodes?.[0]?.textContent?.trim() || month.dataset.month;
      return `<button type="button" data-month-jump="${escapeAttr(month.dataset.month)}">${escapeHtml(label)}</button>`;
    }).join('');
  }

  function enhanceOneMonth(month) {
    const summary = month.querySelector(':scope > summary');
    if (!summary) return;
    summary.querySelector('.month-overview-pills')?.remove();
    const days = [...month.querySelectorAll('details.day-group')];
    let work = 0, free = 0, vacation = 0, warn = 0, fail = 0;
    days.forEach(day => {
      const text = day.querySelector(':scope > summary')?.textContent || '';
      const isFree = /Frei|kein Dienst/.test(text);
      const isVacation = !!day.querySelector('.vacation-badge');
      const hasFail = !!day.querySelector('.fail,.summary-status.fail,.badge.fail');
      const hasWarn = !!day.querySelector('.warn,.summary-status.warn,.badge.warn');
      if (isVacation) vacation += 1;
      if (isFree) free += 1; else work += 1;
      if (hasFail) fail += 1; else if (hasWarn) warn += 1;
    });
    const pills = document.createElement('span');
    pills.className = 'month-overview-pills';
    pills.innerHTML = [`<span class="month-pill work">${work} Arbeit</span>`, vacation ? `<span class="month-pill vacation">${vacation} Urlaub</span>` : '', free ? `<span class="month-pill free">${free} frei</span>` : '', fail ? `<span class="month-pill fail">${fail} Fehler</span>` : '', warn ? `<span class="month-pill warn">${warn} Hinweise</span>` : ''].filter(Boolean).join('');
    summary.appendChild(pills);
  }

  function markDayClass(day) {
    const text = day.querySelector(':scope > summary')?.textContent || '';
    day.classList.toggle('compact-free', /Frei|kein Dienst/.test(text));
    day.classList.toggle('compact-vacation', !!day.querySelector('.vacation-badge'));
    day.classList.toggle('compact-problem', !!day.querySelector('.fail,.summary-status.fail,.badge.fail'));
    day.classList.toggle('compact-warning', !day.classList.contains('compact-problem') && !!day.querySelector('.warn,.summary-status.warn,.badge.warn'));
  }

  function openAndScrollToMonth(monthKey) {
    const month = document.querySelector(`details.month-group[data-month="${CSS.escape(monthKey)}"]`);
    if (!month) return;
    month.open = true;
    month.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ensureKollegenAuswahl() {
    let panel = document.getElementById('kollegenPanel');
    const runkeBtn = document.getElementById('loadRunke');
    const syncStatus = document.getElementById('syncStatus');
    const toolbarGroup = runkeBtn?.closest('.toolbar-group') || syncStatus?.closest('.toolbar-group');
    if (!toolbarGroup) return;
    if (!panel) { panel = document.createElement('div'); panel.className = 'kollegen-panel'; panel.id = 'kollegenPanel'; toolbarGroup.insertBefore(panel, runkeBtn || syncStatus || toolbarGroup.firstChild); }
    if (!document.getElementById('kollegeSelect')) {
      panel.innerHTML = '';
      const label = document.createElement('span'); label.textContent = '👤 Kollege'; panel.appendChild(label);
      const select = document.createElement('select'); select.id = 'kollegeSelect'; select.setAttribute('aria-label', 'Kollege auswählen');
      for (const [id, name] of KOLLEGEN) { const option = document.createElement('option'); option.value = id; option.textContent = name; select.appendChild(option); }
      panel.appendChild(select);
      const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'loadKollege'; btn.className = 'btn-secondary'; btn.textContent = 'Kollege laden'; panel.appendChild(btn);
      const reset = document.createElement('button'); reset.type = 'button'; reset.id = 'reloadKollegeTemplate'; reset.className = 'btn-secondary'; reset.textContent = 'Vorlage neu laden'; panel.appendChild(reset);
      const note = document.createElement('span'); note.className = 'kollegen-hinweis'; note.textContent = 'Dienste aus Fotoplan'; panel.appendChild(note);
    }
    const active = activeProfileFromLocal() || localStorage.getItem('dienstpilot_aktiver_kollege') || 'runke';
    const select = document.getElementById('kollegeSelect');
    if (select && [...select.options].some(o => o.value === active)) select.value = active;
  }

  function loadSelectedKollege(forceTemplate) {
    const select = document.getElementById('kollegeSelect');
    const profile = select?.value || 'runke';
    const stored = loadNamedPlan(profile);
    const templateKey = 'dienstpilot_kollege_template_' + profile;
    const useTemplate = forceTemplate || !stored || localStorage.getItem(templateKey) !== TEMPLATE_VERSION;
    const duties = useTemplate ? buildPlanForProfile(profile) : (Array.isArray(stored.duties) ? stored.duties : buildPlanForProfile(profile));
    const vacations = Array.isArray(stored?.vacations) ? stored.vacations : [];
    const vacationEntitlement = Number.isFinite(stored?.vacationEntitlement) ? stored.vacationEntitlement : 30;
    const hideSundays = typeof stored?.hideSundays === 'boolean' ? stored.hideSundays : false;
    const state = { duties, customCatalog: getExistingCustomCatalog(), appSettings: { activeProfile: profile, shownMonths: MONTHS_TO_SHOW, hideSundays } };
    const namedPlan = { duties, vacations, vacationEntitlement, bundeslaender: stored?.bundeslaender || null, hideSundays, savedAt: new Date().toISOString(), templateVersion: TEMPLATE_VERSION };
    localStorage.setItem('dienstpilot_aktiver_kollege', profile);
    localStorage.setItem(templateKey, TEMPLATE_VERSION);
    localStorage.setItem('lenkRuhezeitenRunke20260413', JSON.stringify(state));
    localStorage.setItem('lrz-plan-' + profile, JSON.stringify(namedPlan));
    setKollegenTitel(profile);
    location.reload();
  }

  function buildPlanForProfile(profile) {
    if (profile === 'biermann') return [];
    const target = profileToPlanName(profile);
    const out = [];
    for (const [start, end, names] of PLAN_ROWS) {
      const d = parseIso(start); const last = parseIso(end);
      while (d <= last) {
        const iso = formatIso(d); const weekday = d.getDay() === 0 ? 6 : d.getDay() - 1;
        for (let col = 0; col < names.length; col++) {
          if (norm(names[col]) !== target) continue;
          const number = COLUMN_PATTERNS[col]?.[weekday];
          if (number) out.push(makeDuty(profile, iso, number, out.length + 1));
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return out;
  }

  function makeDuty(profile, date, number, index) {
    const jsDay = new Date(date + 'T12:00:00').getDay();
    const time = (jsDay === 5 && FRIDAY_TIMES[number]) ? FRIDAY_TIMES[number] : TIMES[number];
    return { id:`${profile}-${String(index).padStart(3,'0')}-${date}-${number}`, date, number, start:time ? time[0] : '', end:time ? time[1] : '', breaks:'', drivingBlocks:'', lineMode:'linie50', stopDistance:'lte3', pauseRule:'auto', tariffEight:false };
  }

  function profileToPlanName(profile) {
    const map = { yasar:'yasar', bumhoffer:'bumhoffer', entrup:'entrup', schweppe:'schweppe', janzen:'janzen', alomar:'alomar', 'al-sayek':'alsayek', szczepanik:'szczepanik', seidensticker:'seidensticker', kocdemir:'kocdemir', wuellner:'wullner', wittwer:'wittwer', gerding:'gerding', runke:'runke', lommel:'lhommel', malko:'malko', murad:'murad', kurta:'kurta', wiemann:'wiemann' };
    return map[profile] || profile;
  }
  function norm(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, ''); }
  function parseIso(iso) { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); }
  function formatIso(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0'); }
  function getExistingCustomCatalog() { try { const s = JSON.parse(localStorage.getItem('lenkRuhezeitenRunke20260413') || '{}'); return s.customCatalog && typeof s.customCatalog === 'object' ? s.customCatalog : {}; } catch { return {}; } }
  function loadMainState() { try { return JSON.parse(localStorage.getItem('lenkRuhezeitenRunke20260413') || 'null'); } catch { return null; } }
  function activeProfileFromLocal() { try { const s = JSON.parse(localStorage.getItem('lenkRuhezeitenRunke20260413') || '{}'); return s.appSettings && s.appSettings.activeProfile; } catch { return null; } }
  function loadNamedPlan(profile) { try { return JSON.parse(localStorage.getItem('lrz-plan-' + profile) || 'null'); } catch { return null; } }
  function kollegeName(profile) { const f = KOLLEGEN.find(([id]) => id === profile); return f ? f[1] : profile; }
  function setKollegenTitel(profile) { const t = document.getElementById(PROFILE_TITLE_ID); const n = kollegeName(profile); if (t) { t.textContent = 'Dienstplan ' + n; t.classList.remove('empty'); } document.title = 'Dienstplan ' + n + ' · DienstPilot'; }
  function updateKollegenTitelOnly() { const active = activeProfileFromLocal(); if (active) setKollegenTitel(active); }

  function ensurePrintButton() {
    if (document.getElementById(PRINT_BUTTON_ID)) return;
    const clearBtn = document.getElementById('clearDuties');
    const toggleSundays = document.getElementById('toggleSundays')?.closest('label');
    const toolbarGroup = clearBtn?.closest('.toolbar-group') || toggleSundays?.closest('.toolbar-group');
    if (!toolbarGroup) return;
    const printBtn = document.createElement('button');
    printBtn.type = 'button'; printBtn.className = 'btn-secondary'; printBtn.id = PRINT_BUTTON_ID; printBtn.textContent = '🖨 Dienstplan drucken';
    if (toggleSundays) toolbarGroup.insertBefore(printBtn, toggleSundays); else if (clearBtn) clearBtn.insertAdjacentElement('afterend', printBtn); else toolbarGroup.appendChild(printBtn);
  }

  function printDutyPlan() {
    const dutiesContainer = document.getElementById(DUTIES_CONTAINER_ID);
    const profileTitle = document.getElementById(PROFILE_TITLE_ID)?.textContent?.trim() || 'Dienstplan';
    if (!dutiesContainer || !dutiesContainer.innerHTML.trim()) { alert('Kein Dienstplan zum Drucken vorhanden.'); return; }
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) { alert('Druckfenster konnte nicht geöffnet werden. Bitte Pop-ups erlauben.'); return; }
    const today = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
    const printableContent = preparePrintableContent(dutiesContainer);
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(profileTitle)} drucken</title><style>body{margin:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;line-height:1.35}h1{margin:0 0 4px;font-size:24px}.print-meta{margin:0 0 24px;color:#6b7280;font-size:14px}button,input,select,textarea,.toolbar,.btn-primary,.btn-secondary,.tab,.tabs,.hidden{display:none!important}.card,.duty-card,.day-card,.duty,.day,article,section>div{break-inside:avoid;page-break-inside:avoid}.card,.duty-card,.day-card{border:1px solid #d1d5db;border-radius:10px;padding:12px;margin-bottom:12px;background:#fff}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top;font-size:13px}th{background:#f3f4f6;font-weight:700}.muted,small{color:#6b7280}img{max-width:100%}@page{size:A4 portrait;margin:12mm}@media print{body{margin:0}}</style></head><body><h1>DienstPilot · Dienstplan</h1><div class="print-meta">${escapeHtml(profileTitle)} · gedruckt am ${escapeHtml(today)}</div><main>${printableContent}</main><script>window.addEventListener('load',()=>{window.focus();window.print();});window.addEventListener('afterprint',()=>{window.close();});<\/script></body></html>`);
    printWindow.document.close();
  }
  function preparePrintableContent(container) { const clone = container.cloneNode(true); clone.querySelectorAll('button,input,select,textarea,script').forEach(el => { const r = document.createElement('span'); const v = getControlText(el); if (v) r.textContent = v; el.replaceWith(r); }); clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.removeAttribute('contenteditable')); return clone.innerHTML; }
  function getControlText(element) { if (element.matches('input[type="checkbox"],input[type="radio"]')) return element.checked ? '✓' : ''; if (element.matches('input,textarea,select')) return element.value || element.getAttribute('value') || ''; return element.textContent?.trim() || ''; }
  function escapeHtml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function escapeAttr(value) { return escapeHtml(value).replaceAll('`','&#096;'); }
})();

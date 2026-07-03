(() => {
  'use strict';

  const PRINT_BUTTON_ID = 'printDutyPlan';
  const DUTIES_CONTAINER_ID = 'dutiesContainer';
  const PROFILE_TITLE_ID = 'profileTitle';

  const KOLLEGEN = [
    ['yasar', 'Yasar'], ['bumhoffer', 'Bumhoffer'], ['entrup', 'Entrup'], ['schweppe', 'Schweppe'],
    ['janzen', 'Janzen'], ['alomar', 'Alomar'], ['al-sayek', 'Al Sayek'], ['szczepanik', 'Szczepanik'],
    ['seidensticker', 'Seidensticker'], ['kocdemir', 'Kocdemir'], ['wuellner', 'Wüllner'], ['wittwer', 'Wittwer'],
    ['biermann', 'Biermann'], ['gerding', 'Gerding'], ['runke', 'Runke'], ['lommel', 'Lommel'],
    ['malko', 'Malko'], ['murad', 'Murad'], ['kurta', 'Kurta'], ['wiemann', 'Wiemann']
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
    {0:'3023',1:'3023',2:'3023',3:'3023',4:'3023'},
    {0:'3005',1:'3005',2:'3005',3:'3005'},
    {0:'3003',1:'3003',2:'3003',3:'3003',4:'3003'},
    {1:'3016',2:'3016',3:'3016',4:'3016'},
    {1:'3014',2:'3014',3:'3006',4:'3005'},
    {0:'3006',1:'3006',2:'3006',4:'3006'},
    {0:'3007',1:'3007',2:'3007',3:'3009',4:'3009'},
    {0:'3019',2:'3019',3:'3019',4:'3019'},
    {0:'3025',1:'3025',2:'3025',3:'3025',4:'3025'},
    {0:'3011',1:'3011',3:'3014',4:'3014'},
    {0:'3013',1:'3013',2:'3001',3:'3001',4:'3001'},
    {0:'3012',1:'3012',3:'3012',4:'3012'},
    {0:'3024',1:'3024',2:'3024',3:'3024',4:'3024'},
    {0:'3001',1:'3001',2:'3013',3:'3013',4:'3013'},
    {0:'3014',2:'3011',3:'3011',4:'3011'},
    {0:'3016',1:'3019',2:'3012',4:'3095'},
    {0:'3022',1:'3022',2:'3022',3:'3022',4:'3022'},
    {0:'3009',1:'3009',2:'3009',3:'3007',4:'3007'}
  ];

  const TIMES = {
    '3001':['05:03','12:12'], '3003':['05:47','14:10'], '3005':['05:51','15:49'], '3006':['06:00','16:20'],
    '3007':['06:03','14:19'], '3009':['06:04','16:25'], '3011':['06:23','17:00'], '3012':['06:31','16:50'],
    '3013':['06:35','17:05'], '3014':['06:35','15:39'], '3016':['06:43','18:06'], '3019':['06:49','17:28'],
    '3022':['12:03','19:21'], '3023':['12:03','20:21'], '3024':['12:20','21:05'], '3025':['13:10','21:50'], '3095':['20:20','04:05']
  };

  const FRIDAY_TIMES = {'3005':['05:51','15:49'], '3006':['06:00','14:21'], '3007':['06:03','14:19'], '3009':['06:04','15:30'], '3011':['06:23','14:34'], '3019':['06:49','15:50']};
  const MONTHS_TO_SHOW = ['2026-04','2026-05','2026-06','2026-07'];

  ready(() => {
    cleanupOldGlobalVacation();
    installExtraStyles();
    removeOldUrlaubswunschButton();
    ensurePrintButton();
    ensureKollegenAuswahl();
    updateKollegenTitelOnly();

    document.addEventListener('click', (event) => {
      const loadBtn = event.target.closest?.('#loadKollege');
      if (loadBtn) {
        event.preventDefault();
        event.stopPropagation();
        loadSelectedKollege();
        return;
      }
      const printBtn = event.target.closest?.('#' + PRINT_BUTTON_ID);
      if (printBtn) {
        event.preventDefault();
        printDutyPlan();
      }
    }, true);

    document.addEventListener('change', (event) => {
      if (event.target && event.target.id === 'kollegeSelect') loadSelectedKollege();
    }, true);

    const observer = new MutationObserver(() => {
      window.clearTimeout(observer._timer);
      observer._timer = window.setTimeout(() => {
        removeOldUrlaubswunschButton();
        ensurePrintButton();
        ensureKollegenAuswahl();
        updateKollegenTitelOnly();
      }, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  function ready(callback) { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', callback, {once:true}) : callback(); }

  function cleanupOldGlobalVacation() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('dienstpilot_urlaubswunsch_')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  function removeOldUrlaubswunschButton() {
    const old = document.getElementById('openUrlaubswunsch');
    if (old) old.remove();
    const modal = document.getElementById('urlaubswunschBackdrop');
    if (modal) modal.remove();
  }

  function installExtraStyles() {
    if (document.getElementById('dienstpilotKollegenStyles')) return;
    const style = document.createElement('style');
    style.id = 'dienstpilotKollegenStyles';
    style.textContent = '.kollegen-panel{display:inline-flex;align-items:center;gap:8px;padding:4px;border-radius:14px}.kollegen-panel span{font-weight:800;font-size:14px}.kollegen-panel select{min-width:170px;padding:10px 12px;border-radius:14px;border:1px solid #cbd5e1;background:#fff;font-weight:800;color:#020617}.kollegen-hinweis{font-size:12px;color:#64748b;font-weight:700}';
    document.head.appendChild(style);
  }

  function ensureKollegenAuswahl() {
    const existing = document.getElementById('kollegeSelect');
    if (existing) return;
    const runkeBtn = document.getElementById('loadRunke');
    const syncStatus = document.getElementById('syncStatus');
    const toolbarGroup = runkeBtn?.closest('.toolbar-group') || syncStatus?.closest('.toolbar-group');
    if (!toolbarGroup) return;

    const panel = document.createElement('div');
    panel.className = 'kollegen-panel';
    panel.id = 'kollegenPanel';

    const label = document.createElement('span');
    label.textContent = '👤 Kollege';
    panel.appendChild(label);

    const select = document.createElement('select');
    select.id = 'kollegeSelect';
    select.setAttribute('aria-label', 'Kollege auswählen');
    for (const [id, name] of KOLLEGEN) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      select.appendChild(option);
    }
    const active = activeProfileFromLocal() || localStorage.getItem('dienstpilot_aktiver_kollege') || 'runke';
    if ([...select.options].some(o => o.value === active)) select.value = active;
    panel.appendChild(select);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'loadKollege';
    btn.className = 'btn-secondary';
    btn.textContent = 'Kollege laden';
    panel.appendChild(btn);

    const note = document.createElement('span');
    note.className = 'kollegen-hinweis';
    note.textContent = 'automatisch aus dem Fotoplan';
    panel.appendChild(note);

    toolbarGroup.insertBefore(panel, runkeBtn || syncStatus || toolbarGroup.firstChild);
  }

  function loadSelectedKollege() {
    const select = document.getElementById('kollegeSelect');
    const profile = select?.value || 'runke';
    const duties = buildPlanForProfile(profile);

    const state = {
      duties,
      customCatalog: getExistingCustomCatalog(),
      appSettings: { activeProfile: profile, shownMonths: MONTHS_TO_SHOW, hideSundays: false }
    };
    const namedPlan = { duties, vacations: [], vacationEntitlement: 30, bundeslaender: null, hideSundays: false, savedAt: new Date().toISOString() };

    localStorage.setItem('dienstpilot_aktiver_kollege', profile);
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
      const d = parseIso(start);
      const last = parseIso(end);
      while (d <= last) {
        const iso = formatIso(d);
        const weekday = d.getDay() === 0 ? 6 : d.getDay() - 1;
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
  function activeProfileFromLocal() { try { const s = JSON.parse(localStorage.getItem('lenkRuhezeitenRunke20260413') || '{}'); return s.appSettings && s.appSettings.activeProfile; } catch { return null; } }
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
    printBtn.type = 'button';
    printBtn.className = 'btn-secondary';
    printBtn.id = PRINT_BUTTON_ID;
    printBtn.textContent = '🖨 Dienstplan drucken';
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
})();

(() => {
  'use strict';

  const PRINT_BUTTON_ID = 'printDutyPlan';
  const DUTIES_CONTAINER_ID = 'dutiesContainer';
  const PROFILE_TITLE_ID = 'profileTitle';

  const KOLLEGEN = [["yasar", "Yasar"], ["bumhoffer", "Bumhoffer"], ["entrup", "Entrup"], ["schweppe", "Schweppe"], ["janzen", "Janzen"], ["alomar", "Alomar"], ["al-sayek", "Al Sayek"], ["szczepanik", "Szczepanik"], ["kocdemir", "Kocdemir"], ["wuellner", "Wüllner"], ["wittwer", "Wittwer"], ["biermann", "Biermann"], ["seidensticker", "Seidensticker"], ["gerding", "Gerding"], ["runke", "Runke"], ["lommel", "Lommel"], ["malko", "Malko"], ["murad", "Murad"], ["kurta", "Kurta"], ["wiemann", "Wiemann"]];
  const DIENSTPLAN_ROWS = [["2026-04-13", "2026-04-17", ["Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Seidensticker", "Kocdemir", "Wüllner", "Wittwer", "Wiemann", "Gerding", "Runke", "Lhommel", "Malko", "Murad"]], ["2026-04-20", "2026-04-24", ["Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Seidensticker", "Kocdemir", "Wüllner", "Wittwer", "Wiemann", "Gerding", "Runke", "Lhommel", "Malko"]], ["2026-04-27", "2026-04-30", ["Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Seidensticker", "Kocdemir", "Wüllner", "Wittwer", "Wiemann", "Gerding", "Runke", "Lhommel"]], ["2026-05-04", "2026-05-08", ["Lhommel", "Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Kurta", "Kocdemir", "Wüllner", "Wittwer", "Wiemann", "Gerding", "Runke"]], ["2026-05-11", "2026-05-13", ["Runke", "Lhommel", "Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Kurta", "Kocdemir", "Wüllner", "Wittwer", "Wiemann", "Gerding"]], ["2026-05-18", "2026-05-22", ["Gerding", "Runke", "Lhommel", "Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Kurta", "Kocdemir", "Wüllner", "Wittwer", "Wiemann"]], ["2026-05-27", "2026-05-29", ["Wiemann", "Gerding", "Runke", "Lhommel", "Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Kurta", "Kocdemir", "Wüllner", "Wittwer"]], ["2026-06-01", "2026-06-05", ["Wittwer", "Wiemann", "Gerding", "Runke", "Lhommel", "Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Kurta", "Kocdemir", "Wüllner"]], ["2026-06-08", "2026-06-12", ["Wüllner", "Wittwer", "Wiemann", "Gerding", "Runke", "Lhommel", "Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Kurta", "Kocdemir"]], ["2026-06-15", "2026-06-19", ["Kocdemir", "Wüllner", "Wittwer", "Wiemann", "Gerding", "Runke", "Lhommel", "Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik", "Kurta"]], ["2026-06-22", "2026-06-26", ["Kurta", "Kocdemir", "Wüllner", "Wittwer", "Wiemann", "Gerding", "Runke", "Lhommel", "Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek", "Szczepanik"]], ["2026-06-29", "2026-07-01", ["Szczepanik", "Kurta", "Kocdemir", "Wüllner", "Wittwer", "Wiemann", "Gerding", "Runke", "Lhommel", "Malko", "Murad", "Yasar", "Bumhoffer", "Entrup", "Schweppe", "Janzen", "Alomar", "Al Sayek"]]];
  const DIENSTPLAN_PATTERNS = [{"0": "3023", "1": "3023", "2": "3023", "3": "3023", "4": "3023"}, {"0": "3005", "1": "3005", "2": "3005", "3": "3005"}, {"0": "3003", "1": "3003", "2": "3003", "3": "3003", "4": "3003"}, {"1": "3016", "2": "3016", "3": "3016", "4": "3016"}, {"1": "3014", "2": "3014", "3": "3006", "4": "3005"}, {"0": "3006", "1": "3006", "2": "3006", "4": "3006"}, {"0": "3007", "1": "3007", "2": "3007", "3": "3009", "4": "3009"}, {"0": "3019", "2": "3019", "3": "3019", "4": "3019"}, {"0": "3025", "1": "3025", "2": "3025", "3": "3025", "4": "3025"}, {"0": "3011", "1": "3011", "3": "3014", "4": "3014"}, {"0": "3013", "1": "3013", "2": "3001", "3": "3001", "4": "3001"}, {"0": "3012", "1": "3012", "3": "3012", "4": "3012"}, {"0": "3024", "1": "3024", "2": "3024", "3": "3024", "4": "3024"}, {"0": "3001", "1": "3001", "2": "3013", "3": "3013", "4": "3013"}, {"0": "3014", "2": "3011", "3": "3011", "4": "3011"}, {"0": "3016", "1": "3019", "2": "3012", "4": "3095"}, {"0": "3022", "1": "3022", "2": "3022", "3": "3022", "4": "3022"}, {"0": "3009", "1": "3009", "2": "3009", "3": "3007", "4": "3007"}];
  const DIENST_TIMES = {"3001": ["05:03", "12:12"], "3003": ["05:47", "14:10"], "3005": ["05:51", "15:49"], "3006": ["06:00", "16:20"], "3007": ["06:03", "14:19"], "3009": ["06:04", "16:25"], "3011": ["06:23", "17:00"], "3012": ["06:31", "16:50"], "3013": ["06:35", "17:06"], "3014": ["06:35", "15:39"], "3016": ["06:43", "18:06"], "3019": ["06:49", "17:28"], "3022": ["12:03", "19:21"], "3023": ["12:03", "20:21"], "3024": ["12:20", "21:05"], "3025": ["13:10", "21:50"], "3095": ["20:20", "04:05"]};
  const FRIDAY_TIMES = {"3006": ["06:00", "14:21"], "3009": ["06:04", "15:30"], "3011": ["06:23", "14:34"], "3019": ["06:49", "15:50"], "3007": ["06:03", "14:19"], "3005": ["05:51", "15:49"]};
  const SHOWN_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07'];

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  ready(() => {
    installExtraStyles();
    ensurePrintButton();
    ensureKollegenAuswahl();
    refreshJahresurlaub();

    document.addEventListener('click', (event) => {
      const kollegeBtn = event.target.closest?.('#loadKollege');
      if (kollegeBtn) {
        event.preventDefault();
        event.stopImmediatePropagation();
        loadSelectedKollege();
        return;
      }

      const printBtn = event.target.closest?.('#' + PRINT_BUTTON_ID);
      if (printBtn) {
        event.preventDefault();
        printDutyPlan();
        return;
      }

      if (event.target.closest?.('#openUrlaubswunsch, #openJahresurlaub, .urlaubswunsch-day, #urlaubswunschClear, #urlaubswunschPrev, #urlaubswunschNext')) {
        setTimeout(refreshJahresurlaub, 50);
        setTimeout(refreshJahresurlaub, 250);
      }
    }, true);

    const observer = new MutationObserver(() => {
      window.clearTimeout(observer._timer);
      observer._timer = window.setTimeout(() => {
        ensurePrintButton();
        ensureKollegenAuswahl();
        refreshJahresurlaub();
        updateKollegenTitel();
      }, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => { ensureKollegenAuswahl(); refreshJahresurlaub(); updateKollegenTitel(); }, 800);
    setTimeout(() => { ensureKollegenAuswahl(); refreshJahresurlaub(); updateKollegenTitel(); }, 1800);
  });

  function installExtraStyles() {
    if (document.getElementById('dienstpilotExtraStyles')) return;
    const style = document.createElement('style');
    style.id = 'dienstpilotExtraStyles';
    style.textContent = `
      .kollegen-picker select {
        margin-left: 8px;
        min-width: 150px;
        border: 0;
        background: transparent;
        font-weight: 800;
        color: inherit;
        outline: none;
      }
      .jahresurlaub-dienstplan-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 6px;
        white-space: nowrap;
      }
      .day-group.jahresurlaub-day > summary {
        box-shadow: inset 4px 0 0 #16a34a;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureKollegenAuswahl() {
    if (document.getElementById('kollegeSelect')) return;

    const runkeBtn = document.getElementById('loadRunke');
    const syncStatus = document.getElementById('syncStatus');
    const toolbarGroup = runkeBtn?.closest('.toolbar-group') || syncStatus?.closest('.toolbar-group');
    if (!toolbarGroup) return;

    const picker = document.createElement('label');
    picker.className = 'toolbar-pick kollegen-picker';
    picker.title = 'Kollege auswählen';

    const text = document.createElement('span');
    text.textContent = '👤 Kollege';
    picker.appendChild(text);

    const select = document.createElement('select');
    select.id = 'kollegeSelect';
    select.setAttribute('aria-label', 'Kollege auswählen');
    for (const [id, name] of KOLLEGEN) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      select.appendChild(option);
    }
    select.value = localStorage.getItem('dienstpilot_aktiver_kollege') || activeProfileFromLocal() || 'runke';
    picker.appendChild(select);

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.id = 'loadKollege';
    loadBtn.className = 'btn-secondary';
    loadBtn.textContent = 'Kollege laden';

    toolbarGroup.insertBefore(picker, runkeBtn || syncStatus || toolbarGroup.firstChild);
    toolbarGroup.insertBefore(loadBtn, runkeBtn || syncStatus || toolbarGroup.firstChild);
  }

  function loadSelectedKollege() {
    const select = document.getElementById('kollegeSelect');
    const profile = select?.value || 'runke';
    const label = kollegeName(profile);
    const duties = buildPlanForProfile(profile);

    if (duties.length === 0 && profile === 'biermann') {
      alert('Für Biermann ist im Foto kein eigener Dienstplan erkennbar. Der Name bleibt auswählbar, der Plan startet leer.');
    }

    const envelope = {
      duties,
      vacations: [],
      vacationEntitlement: 30,
      bundeslaender: null,
      hideSundays: false,
      savedAt: new Date().toISOString()
    };
    const appState = {
      duties,
      customCatalog: loadCustomCatalogFromLocal(),
      appSettings: {
        activeProfile: profile,
        shownMonths: SHOWN_MONTHS,
        hideSundays: false
      }
    };

    try {
      localStorage.setItem('dienstpilot_aktiver_kollege', profile);
      localStorage.setItem('lrz-plan-' + profile, JSON.stringify(envelope));
      localStorage.setItem('lenkRuhezeitenRunke20260413', JSON.stringify(appState));
    } catch (e) {
      alert('Der Dienstplan konnte nicht im Browser gespeichert werden: ' + e.message);
      return;
    }

    setKollegenTitel(profile);
    alert('Dienstplan für ' + label + ' wurde eingetragen. Die Seite wird jetzt neu geladen.');
    location.reload();
  }

  function buildPlanForProfile(profile) {
    const target = profileToRowName(profile);
    if (!target) return [];
    const duties = [];
    for (const [startIso, endIso, names] of DIENSTPLAN_ROWS) {
      let cur = parseIsoDate(startIso);
      const end = parseIsoDate(endIso);
      while (cur <= end) {
        const weekday = cur.getDay() === 0 ? 6 : cur.getDay() - 1;
        const iso = formatIsoDate(cur);
        for (let col = 0; col < names.length; col++) {
          if (normalizeName(names[col]) !== target) continue;
          const number = DIENSTPLAN_PATTERNS[col]?.[weekday];
          if (!number) continue;
          duties.push(makeDuty(profile, iso, number, duties.length + 1));
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    return duties;
  }

  function makeDuty(profile, iso, number, index) {
    const day = new Date(iso + 'T12:00:00').getDay();
    const times = (day === 5 && FRIDAY_TIMES[number]) ? FRIDAY_TIMES[number] : DIENST_TIMES[number];
    return {
      id: profile + '-' + String(index).padStart(3, '0') + '-' + iso + '-' + number,
      date: iso,
      number: String(number),
      start: times ? times[0] : '',
      end: times ? times[1] : '',
      breaks: '',
      drivingBlocks: '',
      lineMode: 'linie50',
      stopDistance: 'lte3',
      pauseRule: 'auto',
      tariffEight: false
    };
  }

  function profileToRowName(profile) {
    const aliases = {
      yasar: 'yasar',
      bumhoffer: 'bumhoffer',
      entrup: 'entrup',
      schweppe: 'schweppe',
      janzen: 'janzen',
      alomar: 'alomar',
      'al-sayek': 'alsayek',
      szczepanik: 'szczepanik',
      kocdemir: 'kocdemir',
      wuellner: 'wullner',
      wittwer: 'wittwer',
      biermann: 'biermann',
      seidensticker: 'seidensticker',
      gerding: 'gerding',
      runke: 'runke',
      lommel: 'lhommel',
      malko: 'malko',
      murad: 'murad',
      kurta: 'kurta',
      wiemann: 'wiemann'
    };
    return aliases[profile] || profile;
  }

  function normalizeName(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '');
  }

  function kollegeName(profile) {
    const entry = KOLLEGEN.find(([id]) => id === profile);
    return entry ? entry[1] : profile;
  }

  function setKollegenTitel(profile) {
    const name = kollegeName(profile);
    const title = document.getElementById(PROFILE_TITLE_ID);
    if (title) {
      title.textContent = 'Dienstplan ' + name;
      title.classList.remove('empty');
    }
    document.title = 'Dienstplan ' + name + ' · DienstPilot';
  }

  function updateKollegenTitel() {
    const active = activeProfileFromLocal();
    if (!active) return;
    const select = document.getElementById('kollegeSelect');
    if (select && [...select.options].some(o => o.value === active)) select.value = active;
    setKollegenTitel(active);
  }

  function activeProfileFromLocal() {
    try {
      const raw = localStorage.getItem('lenkRuhezeitenRunke20260413');
      const state = raw ? JSON.parse(raw) : null;
      return state?.appSettings?.activeProfile || null;
    } catch {
      return null;
    }
  }

  function loadCustomCatalogFromLocal() {
    try {
      const raw = localStorage.getItem('lenkRuhezeitenRunke20260413');
      const state = raw ? JSON.parse(raw) : null;
      return state?.customCatalog && typeof state.customCatalog === 'object' ? state.customCatalog : {};
    } catch {
      return {};
    }
  }

  function parseIsoDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  function formatIsoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

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

    if (toggleSundays) toolbarGroup.insertBefore(printBtn, toggleSundays);
    else if (clearBtn) clearBtn.insertAdjacentElement('afterend', printBtn);
    else toolbarGroup.appendChild(printBtn);
  }

  function getAllJahresurlaubDates() {
    const selected = new Set();
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('dienstpilot_urlaubswunsch_')) continue;
      try {
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(arr)) arr.forEach((date) => selected.add(date));
      } catch {
      }
    }
    return selected;
  }

  function applyJahresurlaubToDienstplan() {
    const selected = getAllJahresurlaubDates();

    document.querySelectorAll('details.day-group[data-day]').forEach((dayEl) => {
      const date = dayEl.getAttribute('data-day');
      const summary = dayEl.querySelector(':scope > summary');
      if (!summary || !date) return;

      let badge = summary.querySelector('.jahresurlaub-dienstplan-badge');
      if (selected.has(date)) {
        dayEl.classList.add('jahresurlaub-day', 'vacation');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'vacation-badge jahresurlaub-dienstplan-badge';
          badge.textContent = '🌴 Jahresurlaub';
          const beforeDuty = summary.querySelector('.summary-duty');
          if (beforeDuty) summary.insertBefore(badge, beforeDuty);
          else summary.appendChild(badge);
        }
      } else {
        dayEl.classList.remove('jahresurlaub-day');
        if (badge) badge.remove();
      }
    });
  }

  function renameUrlaubswunschUi() {
    const oldBtn = document.getElementById('openUrlaubswunsch');
    const newBtn = document.getElementById('openJahresurlaub');
    [oldBtn, newBtn].filter(Boolean).forEach((btn) => {
      btn.textContent = '🌴 Jahresurlaub';
      btn.title = 'Jahresurlaub öffnen';
    });

    document.querySelectorAll('.urlaubswunsch-head h2').forEach((title) => {
      title.textContent = '🌴 Jahresurlaub';
    });
    document.querySelectorAll('.urlaubswunsch-head p').forEach((text) => {
      text.textContent = 'Jahreskalender: Tage anklicken, um Jahresurlaub zu markieren oder wieder zu entfernen.';
    });
    document.querySelectorAll('#urlaubswunschInfo').forEach((info) => {
      info.innerHTML = info.innerHTML
        .replaceAll('Urlaubswunsch-Tag', 'Jahresurlaub-Tag')
        .replaceAll('Urlaubswunsch-Tage', 'Jahresurlaub-Tage');
    });
  }

  function refreshJahresurlaub() {
    renameUrlaubswunschUi();
    applyJahresurlaubToDienstplan();
  }

  function printDutyPlan() {
    const dutiesContainer = document.getElementById(DUTIES_CONTAINER_ID);
    const profileTitle = document.getElementById(PROFILE_TITLE_ID)?.textContent?.trim() || 'Dienstplan';
    if (!dutiesContainer || !dutiesContainer.innerHTML.trim()) {
      alert('Kein Dienstplan zum Drucken vorhanden.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert('Druckfenster konnte nicht geöffnet werden. Bitte Pop-ups erlauben.');
      return;
    }

    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const printableContent = preparePrintableContent(dutiesContainer);

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(profileTitle)} drucken</title><style>
      body{margin:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;line-height:1.35}
      h1{margin:0 0 4px;font-size:24px}.print-meta{margin:0 0 24px;color:#6b7280;font-size:14px}
      button,input,select,textarea,.toolbar,.btn-primary,.btn-secondary,.tab,.tabs,.hidden{display:none!important}
      .card,.duty-card,.day-card,.duty,.day,article,section>div{break-inside:avoid;page-break-inside:avoid}
      .card,.duty-card,.day-card{border:1px solid #d1d5db;border-radius:10px;padding:12px;margin-bottom:12px;background:#fff}
      table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top;font-size:13px}th{background:#f3f4f6;font-weight:700}.muted,small{color:#6b7280}img{max-width:100%}@page{size:A4 portrait;margin:12mm}@media print{body{margin:0}}
    </style></head><body><h1>DienstPilot · Dienstplan</h1><div class="print-meta">${escapeHtml(profileTitle)} · gedruckt am ${escapeHtml(today)}</div><main>${printableContent}</main><script>window.addEventListener('load',()=>{window.focus();window.print();});window.addEventListener('afterprint',()=>{window.close();});<\/script></body></html>`);
    printWindow.document.close();
  }

  function preparePrintableContent(container) {
    const clone = container.cloneNode(true);
    clone.querySelectorAll('button, input, select, textarea, script').forEach((element) => {
      const replacement = document.createElement('span');
      const value = getControlText(element);
      if (value) replacement.textContent = value;
      element.replaceWith(replacement);
    });
    clone.querySelectorAll('[contenteditable="true"]').forEach((element) => element.removeAttribute('contenteditable'));
    return clone.innerHTML;
  }

  function getControlText(element) {
    if (element.matches('input[type="checkbox"], input[type="radio"]')) return element.checked ? '✓' : '';
    if (element.matches('input, textarea, select')) return element.value || element.getAttribute('value') || '';
    return element.textContent?.trim() || '';
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();

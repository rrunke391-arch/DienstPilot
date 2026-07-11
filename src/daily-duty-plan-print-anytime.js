(() => {
  'use strict';

  const LOCAL_KEY = 'dienstpilot_daily_duty_plans_v1';
  const DATE_ID = 'dpDailyPlanDate';
  const WEEKDAY_BUTTON = 'dpDailyPrintWeekday';
  const WEEKEND_BUTTON = 'dpDailyPrintWeekend';

  const WEEKDAY_ASSIGNMENTS = [
    ['3001', 'I.Janzen', 'OS-LK 621', '05:03', '12:12', '05:20', 'Wellingholzhausen, Schule'],
    ['3003', 'R.Runke', 'OS-TG 324', '05:47', '14:10', '06:12', 'Neuenkirchen, Schulzentrum'],
    ['3004', 'A.Muth', 'OS-GZ 123', '05:50', '15:40', '06:15', 'Melle, ZOB'],
    ['3005', 'A.Gerding', 'OS-LF 223', '05:51', '15:49', '06:18', 'Westerhausen, Vinkenaue'],
    ['3006', 'M.Entrup', 'OS-RE 224', '06:00', '16:20', '06:33', 'Buer, Kampingring'],
    ['3007', 'Y.Yasar', 'OS-NP 617', '06:03', '14:19', '06:28', 'Neuenkirchen, Schulzentrum'],
    ['3008', 'S.Suleimani', 'OS-JY 122', '06:03', '17:21', '06:20', 'Wellingholzhausen, Schule'],
    ['3009', 'J.Faber', 'OS-SU 722', '06:04', '16:25', '06:35', 'Ellerbeck, Ellerbecker Str.'],
    ['3010', 'A.Hergerdt', 'OS-GO 717', '06:20', '16:56', '06:45', 'Melle, ZOB'],
    ['3011', 'S.Kurta', 'OS-KX 220', '06:23', '17:00', '06:40', 'Wellingholzhausen, Schule'],
    ['3012', 'M.Schweppe', 'OS-OP 622', '06:31', '16:50', '06:48', 'Wellingholzhausen, Surbrock'],
    ['3013', 'A.Szczepanik', 'OS-ZT 626', '06:35', '17:05', '07:00', 'Neuenkirchen, Schulzentrum'],
    ['3014', 'M.Malko', 'OS-KF 526', '06:35', '15:39', '07:00', 'Melle, ZOB'],
    ['3015', 'N.Ghulami', 'OS-YG 120', '06:36', '16:57', '07:00', 'Wennigsen, Alt Wiewen'],
    ['3016', 'P.Lhommel', 'OS-XB 925', '06:43', '18:06', '07:18', 'Bissendorf, Friedensweg'],
    ['3017', 'A.Hasan', 'OS-WP 918', '06:44', '17:35', '07:05', 'Laer, Dornkampsweg'],
    ['3018', 'N.Awdullahi', 'OS-EV 118', '06:44', '19:41', '07:02', 'Kerssenbrock, Brandhorstweg'],
    ['3019', 'K.Giotis', 'OS-BU 816', '06:49', '17:28', '07:07', 'Nüven, Obernüven'],
    ['3020', 'A.Alrobaie', 'OS-PK 216', '06:49', '18:04', '07:09', 'Peingdorf, Königsbach'],
    ['3021', 'W.Blaz', 'OS-RS 725', '06:50', '19:33', '07:15', 'Melle, ZOB'],
    ['3022', 'W.Wüllner', 'OS-DZ 116', '12:03', '19:21', '12:20', 'Wellingholzhausen, Schule'],
    ['3023', 'T.Wiemann', 'OS-UL 818', '12:03', '20:21', '12:20', 'Wellingholzhausen, Schule'],
    ['3024', 'D.Knigge', 'OS-JF 215', '12:20', '21:05', '12:45', 'Melle, ZOB'],
    ['3025', 'N.Murad', 'OS-HD 124', '13:10', '21:50', '13:35', 'Melle, ZOB'],
    ['1341', 'M.Al Dabbah / A.Al Arsan', 'OS-FN 919', '', '', '', ''],
    ['1941', 'S.Yasatemur / M.Eggern', 'OS-AX 716', '', '', '', ''],
    ['3002', 'B.Hasan / C.Strotmann', 'OS-MR 825', '', '', '', ''],
    ['Einsatzwagen', 'Einsatzwagen', 'OS-DZ 116', '', '', '', '']
  ];

  const SATURDAY_ASSIGNMENTS = [
    ['3050', 'F.Biermann', 'OS-KX 220', '06:03', '14:21', '06:20', 'Wellingholzhausen, Schule'],
    ['3051', 'S.Kelgorn', 'OS-YG 120', '06:42', '15:21', '07:15', 'Bruchmühlen, Schule'],
    ['3052', 'H.J.Husmann', 'OS-LF 223', '06:43', '14:41', '07:16', 'Buer, Schulzentrum'],
    ['3053', 'A.Kocdemir', 'OS-VH 721', '06:47', '14:39', '07:12', 'Neuenkirchen, Schulzentrum'],
    ['3054', 'W.Blaz', 'OS-BS 725', '06:51', '19:21', '07:18', 'Westerhausen, Vinkenaue'],
    ['3055', 'S.Wittwer', 'OS-SU 722', '07:03', '17:04', '07:20', 'Wellingholzhausen, Schule'],
    ['3056', 'N.Awdullahi', 'OS-EV 118', '07:07', '16:04', '07:31', 'Gesmold, Schimmweg'],
    ['3057', 'M.Entrup', 'OS-RE 224', '09:20', '18:21', '09:55', 'Werther, ZOB'],
    ['1340', 'M.Eggern', 'OS-CL 916', '05:13', '19:44', '', ''],
    ['Einsatzwagen', 'Einsatzwagen', 'OS-LQ 114', '', '', '', '']
  ];

  const SUNDAY_ASSIGNMENTS = [
    ['3061', 'S.Sulejmani', 'OS-LK 621', '12:03', '19:46', '12:20', 'Wellingholzhausen, Schule'],
    ['3062', 'N.Murad', 'OS-HD 124', '11:47', '19:38', '12:12', 'Neuenkirchen, Schulzentrum'],
    ['1943', 'A.Al Arsan', 'OS-FN 919', '06:48', '14:04', '', ''],
    ['1943', 'C.Strotmann', 'OS-FN 919', '13:44', '21:47', '', 'Umlauf 1943']
  ];

  function rowsFromAssignments(assignments) {
    return assignments.map(([duty, name, bus, start, end, departure, stop], index) => ({
      id: `print-${duty}-${index}`,
      duty, name, bus, start, end, departure, stop
    }));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parseDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date();
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }

  function isoDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function addDays(date, days) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    result.setDate(result.getDate() + days);
    return result;
  }

  function mondayOfWeek(date) {
    const day = date.getDay() || 7;
    return addDays(date, 1 - day);
  }

  function currentDate() {
    const value = String(document.getElementById(DATE_ID)?.value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : isoDate(new Date());
  }

  function germanDate(iso) {
    const [year, month, day] = iso.split('-');
    return `${day}.${month}.${year}`;
  }

  function weekdayName(iso) {
    return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(parseDate(iso));
  }

  function isoWeek(iso) {
    const date = parseDate(iso);
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  }

  function normalizeRow(row) {
    const value = row && typeof row === 'object' ? row : {};
    return {
      id: String(value.id || ''),
      name: String(value.name || ''),
      duty: String(value.duty || ''),
      bus: String(value.bus || ''),
      start: String(value.start || ''),
      end: String(value.end || ''),
      departure: String(value.departure || ''),
      stop: String(value.stop || '')
    };
  }

  function readPlans() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      return raw && typeof raw === 'object' ? (raw.plans || raw) : {};
    } catch {
      return {};
    }
  }

  function visibleRows() {
    return [...document.querySelectorAll('#dpDailyPlanRows tr[data-row-id]')].map((row) => {
      const field = (name) => String(row.querySelector(`[data-field="${name}"]`)?.value || '');
      return normalizeRow({
        id: row.dataset.rowId,
        name: field('name'),
        duty: field('duty'),
        bus: field('bus'),
        start: field('start'),
        end: field('end'),
        departure: field('departure'),
        stop: field('stop')
      });
    }).filter((row) => Object.values(row).some((value) => String(value || '').trim()));
  }

  function savedRows(date) {
    const plan = readPlans()[date];
    return plan && Array.isArray(plan.rows) ? plan.rows.map(normalizeRow) : [];
  }

  function rowsForDate(date, fallbackRows) {
    if (date === currentDate()) {
      const visible = visibleRows();
      if (visible.length) return visible;
    }
    const stored = savedRows(date);
    return stored.length ? stored : fallbackRows.map(normalizeRow);
  }

  function weekdayReferenceDate() {
    const selected = parseDate(currentDate());
    const day = selected.getDay();
    if (day >= 1 && day <= 5) return isoDate(selected);
    return isoDate(mondayOfWeek(selected));
  }

  function weekendDates() {
    const monday = mondayOfWeek(parseDate(currentDate()));
    return {
      saturday: isoDate(addDays(monday, 5)),
      sunday: isoDate(addDays(monday, 6))
    };
  }

  function printDeparture(value) {
    if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return '';
    const [hours, minutes] = value.split(':');
    return `${Number(hours)}.${minutes}`;
  }

  function headerHtml(date) {
    return `<div class="print-head"><div>Dienstplan für ${escapeHtml(weekdayName(date))}, den</div><div>${escapeHtml(germanDate(date))}</div><div class="kw">Kalenderwoche&nbsp;&nbsp; ${isoWeek(date)}</div><div class="stop-title">Abfahrzeit ab 1. Haltestelle</div></div>`;
  }

  function rowHtml(row) {
    const duty = row.duty && row.duty.toLowerCase() !== 'einsatzwagen' ? `Dienst ${escapeHtml(row.duty)}` : (row.duty ? escapeHtml(row.duty) : '');
    const bus = row.bus ? `/ ${escapeHtml(row.bus)}` : '';
    const times = row.start || row.end ? `/ ${escapeHtml(row.start || '--:--')} - ${escapeHtml(row.end || '--:--')} Uhr` : '';
    const departure = row.departure ? `${escapeHtml(printDeparture(row.departure))} Uhr` : '';
    const right = [departure, escapeHtml(row.stop)].filter(Boolean).join(' ');
    return `<div class="print-row"><div class="left"><strong>${escapeHtml(row.name) || '&nbsp;'}</strong><span>${duty || '&nbsp;'}</span></div><div class="middle"><strong>${bus || '&nbsp;'}</strong><span>${times || '&nbsp;'}</span></div><div class="right">${right || '&nbsp;'}</div></div>`;
  }

  function sectionHtml(date, rows, compact = false) {
    return `<section class="plan-section${compact ? ' compact' : ''}">${headerHtml(date)}<div class="print-rows">${rows.map(rowHtml).join('')}</div></section>`;
  }

  function openPrint(html, title) {
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
      return;
    }

    doc.open();
    doc.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
      @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;max-width:100%}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:9.6pt}.plan-section{width:100%;max-width:100%;break-inside:avoid}.plan-section+.plan-section{margin-top:9mm;padding-top:6mm;border-top:1px solid #d1d5db}.print-head{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.75fr) minmax(0,1fr);column-gap:3mm;row-gap:1mm;width:100%;font-size:11.2pt;font-weight:800;margin-bottom:5mm}.print-head>*{min-width:0;overflow-wrap:anywhere}.print-head .kw{text-align:right}.stop-title{grid-column:3;font-size:10.2pt;text-align:left}.print-rows{width:100%}.print-row{display:grid;grid-template-columns:minmax(0,23fr) minmax(0,31fr) minmax(0,46fr);column-gap:3mm;width:100%;min-height:14.2mm;break-inside:avoid;page-break-inside:avoid}.compact .print-row{min-height:11.2mm}.left,.middle{display:flex;flex-direction:column;line-height:1.2;min-width:0}.print-row strong{font-size:10.2pt;overflow-wrap:anywhere}.print-row span,.print-row .right{font-size:9.3pt;line-height:1.22;overflow-wrap:anywhere}.print-row .right{padding-top:4.8mm}.compact .print-row .right{padding-top:3.5mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>${html}</body></html>`);
    doc.close();

    window.setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        window.setTimeout(() => frame.remove(), 1800);
      }
    }, 300);
  }

  function setStatus(text, kind = 'ok') {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = `dp-daily-status ${kind}`;
  }

  function printWeekday() {
    const date = weekdayReferenceDate();
    const rows = rowsForDate(date, rowsFromAssignments(WEEKDAY_ASSIGNMENTS));
    if (!rows.length) {
      setStatus('Es ist kein Werktagsdienstplan vorhanden.', 'error');
      return;
    }
    const chunks = [];
    for (let index = 0; index < rows.length; index += 17) chunks.push(rows.slice(index, index + 17));
    const html = chunks.map((chunk, index) => `<div style="${index ? 'break-before:page;' : ''}">${sectionHtml(date, chunk)}</div>`).join('');
    openPrint(html, 'Dienstplan Montag bis Freitag');
    setStatus('Der Dienstplan Montag bis Freitag wurde für den Druck geöffnet.');
  }

  function printWeekend() {
    const dates = weekendDates();
    const saturdayRows = rowsForDate(dates.saturday, rowsFromAssignments(SATURDAY_ASSIGNMENTS));
    const sundayRows = rowsForDate(dates.sunday, rowsFromAssignments(SUNDAY_ASSIGNMENTS));
    const html = sectionHtml(dates.saturday, saturdayRows, true) + sectionHtml(dates.sunday, sundayRows, true);
    openPrint(html, 'Dienstplan Samstag und Sonntag');
    setStatus(`Der Dienstplan für Samstag ${germanDate(dates.saturday)} und Sonntag ${germanDate(dates.sunday)} wurde für den Druck geöffnet.`);
  }

  function refreshLabels() {
    window.dienstpilotPrintAnytimeReady = true;
    const weekday = document.getElementById(WEEKDAY_BUTTON);
    const weekend = document.getElementById(WEEKEND_BUTTON);
    if (weekday) {
      weekday.title = 'Den Dienstplan Montag bis Freitag jederzeit drucken';
      weekday.classList.add('dp-active-plan');
    }
    if (weekend) {
      weekend.title = 'Die Dienstpläne für Samstag und Sonntag jederzeit gemeinsam drucken';
      weekend.classList.add('dp-active-plan');
    }
    const label = document.getElementById('dpDailyPlanModeLabel');
    if (label) {
      label.className = 'dp-daily-plan-mode-label';
      label.textContent = 'Beide Druckschalter sind jederzeit verfügbar. Werktags- und Wochenenddienste bleiben strikt getrennt.';
    }
  }

  document.addEventListener('click', (event) => {
    const weekday = event.target.closest?.(`#${WEEKDAY_BUTTON}`);
    const weekend = event.target.closest?.(`#${WEEKEND_BUTTON}`);
    if (!weekday && !weekend) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (weekday) printWeekday();
    else printWeekend();
  }, true);

  [0, 150, 500, 1200, 2500].forEach((delay) => window.setTimeout(refreshLabels, delay));
  window.addEventListener('focus', refreshLabels);
  window.addEventListener('pageshow', refreshLabels);
  window.setInterval(refreshLabels, 1500);
})();
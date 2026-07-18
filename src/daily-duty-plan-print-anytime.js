(() => {
  'use strict';

  if (window.__dienstpilotDailyPrintAnytimeV4) return;
  window.__dienstpilotDailyPrintAnytimeV4 = true;

  const LOCAL_KEY = 'dienstpilot_daily_duty_plans_v1';
  const DATE_ID = 'dpDailyPlanDate';
  const WEEKDAY_BUTTON = 'dpDailyPrintWeekday';
  const WEEKEND_BUTTON = 'dpDailyPrintWeekend';
  const WEEKEND_EDIT_BUTTON = 'dpDailyEditWeekend';

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
    ['3016', 'P.Lommel', 'OS-XB 925', '06:43', '18:06', '07:18', 'Bissendorf, Friedensweg'],
    ['3017', 'A.Hasan', 'OS-WP 918', '06:44', '17:35', '07:05', 'Laer, Dornkampsweg'],
    ['3018', 'N.Awdullahi', 'OS-EV 118', '06:44', '19:41', '07:02', 'Kerssenbrock, Brandhorstweg'],
    ['3019', 'K.Giotis', 'OS-BU 816', '06:49', '17:28', '07:07', 'Nüven, Obernüven'],
    ['3020', 'A.Alrobaie', 'OS-PK 216', '06:49', '18:04', '07:09', 'Peingdorf, Königsbach'],
    ['3021', 'W.Blaz', 'OS-RS 725', '06:50', '19:33', '07:15', 'Melle, ZOB'],
    ['3022', 'W.Wüllner', 'OS-DZ 116', '12:03', '19:21', '12:20', 'Wellingholzhausen, Schule'],
    ['3023', 'T.Wiemann', 'OS-UL 818', '12:03', '20:21', '12:20', 'Wellingholzhausen, Schule'],
    ['3024', 'D.Knigge', 'OS-IF 215', '12:20', '21:05', '12:45', 'Melle, ZOB'],
    ['3025', 'N.Murad', 'OS-HD 124', '13:10', '21:50', '13:35', 'Melle, ZOB'],
    ['1341', 'M.Al Dabbah / A.Al Arsan', 'OS-FN 919', '', '', '', ''],
    ['1941', 'S.Yasatemur / M.Eggern', 'OS-AX 716', '', '', '', ''],
    ['3002', 'B.Hasan / C.Strotmann', 'OS-MR 825', '', '', '', ''],
    ['Einsatzwagen', 'Einsatzwagen', 'OS-DZ 116', '', '', '', '']
  ];

  const SATURDAY_ASSIGNMENTS = [
    ['3050', 'F.Biermann', 'OS-SU 722', '06:03', '14:21', '06:20', 'Wellingholzhausen, Schule'],
    ['3051', 'S.Kelgorn', 'OS-YG 120', '06:42', '15:21', '07:15', 'Bruchmühlen, Schule'],
    ['3052', 'H.J.Husmann', 'OS-LF 223', '06:43', '14:41', '07:16', 'Buer, Schulzentrum'],
    ['3053', 'P.Lommel', 'OS-XB 925', '06:47', '14:39', '07:12', 'Neuenkirchen, Schulzentrum'],
    ['3054', 'W.Blaz', 'OS-BS 725', '06:51', '19:21', '07:18', 'Westerhausen, Vinkenaue'],
    ['3055', 'M.Alsaba', 'OS-DZ 116', '07:03', '17:04', '07:20', 'Wellingholzhausen, Schule'],
    ['3056', 'N.Awdullahi', 'OS-EV 118', '07:07', '16:04', '07:31', 'Gesmold, Schimmweg'],
    ['3057', 'K.Alomar', 'OS-ZT 626', '09:20', '18:21', '09:55', 'Werther, ZOB'],
    ['1340', 'F.Biermann', 'OS-MR 825', '05:13', '14:14', '', ''],
    ['11541', 'C.Strotmann', 'OS-MR 825', '14:22', '00:20', '', ''],
    ['Einsatzwagen', 'Einsatzwagen', 'OS-IF 215', '', '', '', '']
  ];

  const SUNDAY_ASSIGNMENTS = [
    ['3061', 'Y.Yasar', 'OS-QS 519', '12:03', '19:46', '12:20', 'Wellingholzhausen, Schule'],
    ['3062', 'N.Murad', 'OS-HD 124', '11:47', '19:38', '12:12', 'Neuenkirchen, Schulzentrum'],
    ['1943', 'A.Al Arsan', '', '06:56', '14:04', '', ''],
    ['1943', 'N.Ghulami', 'OS-FN 919', '13:44', '21:47', '', '']
  ];

  const SATURDAY_ORDER = [...new Set(SATURDAY_ASSIGNMENTS.map((item) => item[0].toLowerCase()))];
  const SUNDAY_ORDER = [...new Set(SUNDAY_ASSIGNMENTS.map((item) => item[0].toLowerCase()))];
  const WEEKDAY_ORDER = [...new Set(WEEKDAY_ASSIGNMENTS.map((item) => item[0].toLowerCase()))];
  const WEEKDAY_ALLOWED = new Set(WEEKDAY_ORDER);
  const SATURDAY_ALLOWED = new Set(SATURDAY_ORDER);
  const SUNDAY_ALLOWED = new Set(SUNDAY_ORDER);

  function rowsFromAssignments(assignments) {
    return assignments.map(([duty, name, bus, start, end, departure, stop], index) => ({
      id: `print-${duty}-${index}`, duty, name, bus, start, end, departure, stop
    }));
  }

  function normalizeRow(row) {
    const value = row && typeof row === 'object' ? row : {};
    return {
      id: String(value.id || ''),
      name: String(value.name || ''),
      duty: String(value.duty || ''),
      bus: String(value.bus || '').replace(/^OS-JF 215$/i, 'OS-IF 215'),
      start: String(value.start || ''),
      end: String(value.end || ''),
      departure: String(value.departure || ''),
      stop: String(value.stop || '')
    };
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
        name: field('name'), duty: field('duty'), bus: field('bus'), start: field('start'),
        end: field('end'), departure: field('departure'), stop: field('stop')
      });
    }).filter((row) => Object.values(row).some((value) => String(value || '').trim()));
  }

  function savedRows(date) {
    const plan = readPlans()[date];
    return plan && Array.isArray(plan.rows) ? plan.rows.map(normalizeRow) : [];
  }

  function sourceRows(date) {
    const combined = window.dienstpilotWeekendCombinedRows?.[date];
    if (Array.isArray(combined) && combined.length) return combined.map(normalizeRow);
    if (date === currentDate()) {
      const visible = visibleRows();
      if (visible.length) return visible;
    }
    return savedRows(date);
  }

  function strictRows(date, assignments, allowed, order) {
    const source = sourceRows(date).filter((row) => allowed.has(String(row.duty || '').trim().toLowerCase()));
    const fallback = rowsFromAssignments(assignments);
    const result = [];

    order.forEach((duty) => {
      const candidates = source.filter((row) => String(row.duty || '').trim().toLowerCase() === duty);
      const fallbacks = fallback.filter((row) => String(row.duty || '').trim().toLowerCase() === duty);
      for (let index = 0; index < fallbacks.length; index += 1) result.push(normalizeRow(candidates[index] || fallbacks[index]));
    });

    return result;
  }

  function weekdayReferenceDate() {
    const selected = parseDate(currentDate());
    const day = selected.getDay();
    if (day >= 1 && day <= 5) return isoDate(selected);
    return isoDate(mondayOfWeek(selected));
  }

  function weekendDates() {
    const monday = mondayOfWeek(parseDate(currentDate()));
    return { saturday: isoDate(addDays(monday, 5)), sunday: isoDate(addDays(monday, 6)) };
  }

  function printDeparture(value) {
    if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return '';
    const [hours, minutes] = value.split(':');
    return `${Number(hours)}.${minutes}`;
  }

  function headerHtml(date) {
    return `<div class="print-head"><div>Dienstplan für ${escapeHtml(weekdayName(date))}, den</div><div>${escapeHtml(germanDate(date))}</div><div class="kw">Kalenderwoche&nbsp;&nbsp; ${isoWeek(date)}</div><div class="stop-title">Abfahrzeit ab 1. Haltestelle</div></div>`;
  }

  function normalRowHtml(row) {
    const duty = row.duty && row.duty.toLowerCase() !== 'einsatzwagen' ? `Dienst ${escapeHtml(row.duty)}` : (row.duty ? escapeHtml(row.duty) : '');
    const bus = row.bus ? `/ ${escapeHtml(row.bus)}` : '';
    const times = row.start || row.end ? `/ ${escapeHtml(row.start || '--:--')} - ${escapeHtml(row.end || '--:--')} Uhr` : '';
    const departure = row.departure ? `${escapeHtml(printDeparture(row.departure))} Uhr` : '';
    const right = [departure, escapeHtml(row.stop)].filter(Boolean).join(' ');
    return `<div class="print-row"><div class="left"><strong>${escapeHtml(row.name) || '&nbsp;'}</strong><span>${duty || '&nbsp;'}</span></div><div class="middle"><strong>${bus || '&nbsp;'}</strong><span>${times || '&nbsp;'}</span></div><div class="right">${right || '&nbsp;'}</div></div>`;
  }

  function saturdayRowsHtml(rows) {
    const regular = rows.filter((row) => !['1340', '11541'].includes(String(row.duty).trim()) && String(row.duty).trim().toLowerCase() !== 'einsatzwagen');
    const early = rows.find((row) => String(row.duty).trim() === '1340') || {};
    const late = rows.find((row) => String(row.duty).trim() === '11541') || {};
    const wagon = rows.find((row) => String(row.duty).trim().toLowerCase() === 'einsatzwagen');
    let html = regular.map(normalRowHtml).join('');

    if (early.duty || late.duty) {
      const earlyTimes = early.start || early.end ? `${escapeHtml(early.start || '--:--')} - ${escapeHtml(early.end || '--:--')}` : '';
      const lateTimes = late.start || late.end ? `/ ${escapeHtml(late.start || '--:--')} - ${escapeHtml(late.end || '--:--')} Uhr` : '';
      const bus = late.bus || early.bus;
      html += `<div class="print-row split-duty"><div class="left"><strong>${escapeHtml(early.name) || '&nbsp;'}</strong><span>${earlyTimes || '&nbsp;'}</span></div><div class="middle"><strong>/ ${escapeHtml(late.name) || '&nbsp;'} &nbsp; / &nbsp; ${escapeHtml(bus) || '&nbsp;'}</strong><span>${lateTimes} / Dienst 1340 / Dienst 11541</span></div><div class="right">&nbsp;</div></div>`;
    }

    if (wagon) html += normalRowHtml(wagon);
    return html;
  }

  function sundayRowsHtml(rows) {
    const regular = rows.filter((row) => String(row.duty).trim() !== '1943');
    const split = rows.filter((row) => String(row.duty).trim() === '1943');
    const html = regular.map(normalRowHtml).join('');
    if (!split.length) return html;

    const first = split[0] || {};
    const second = split[1] || {};
    const firstTimes = first.start || first.end ? `${escapeHtml(first.start || '--:--')} - ${escapeHtml(first.end || '--:--')}` : '';
    const secondTimes = second.start || second.end ? `/ ${escapeHtml(second.start || '--:--')} - ${escapeHtml(second.end || '--:--')} Uhr / Dienst 1943` : '/ Dienst 1943';
    const bus = second.bus || first.bus;
    return html + `<div class="print-row split-duty"><div class="left"><strong>${escapeHtml(first.name) || '&nbsp;'}</strong><span>${firstTimes || '&nbsp;'}</span></div><div class="middle"><strong>/ ${escapeHtml(second.name) || '&nbsp;'} &nbsp; / &nbsp; ${escapeHtml(bus) || '&nbsp;'}</strong><span>${secondTimes}</span></div><div class="right">&nbsp;</div></div>`;
  }

  function sectionHtml(date, rows, type) {
    const body = type === 'saturday' ? saturdayRowsHtml(rows) : type === 'sunday' ? sundayRowsHtml(rows) : rows.map(normalRowHtml).join('');
    return `<section class="plan-section ${type}">${headerHtml(date)}<div class="print-rows">${body}</div></section>`;
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
      @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;max-width:100%}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:9.7pt}.plan-section{width:100%;max-width:100%;break-inside:avoid}.plan-section+.plan-section{margin-top:18mm;padding-top:4mm}.print-head{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.75fr) minmax(0,1fr);column-gap:3mm;row-gap:1mm;width:100%;font-size:11.3pt;font-weight:800;margin-bottom:4.5mm}.print-head>*{min-width:0;overflow-wrap:anywhere}.print-head .kw{text-align:right}.stop-title{grid-column:3;font-size:10.3pt;text-align:left}.print-rows{width:100%}.print-row{display:grid;grid-template-columns:minmax(0,23fr) minmax(0,31fr) minmax(0,46fr);column-gap:3mm;width:100%;min-height:11.4mm;break-inside:avoid;page-break-inside:avoid}.left,.middle{display:flex;flex-direction:column;line-height:1.2;min-width:0}.print-row strong{font-size:10.3pt;overflow-wrap:anywhere}.print-row span,.print-row .right{font-size:9.4pt;line-height:1.22;overflow-wrap:anywhere}.print-row .right{padding-top:3.6mm}.split-duty{min-height:14mm}.split-duty .right{padding-top:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
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
    const rows = strictRows(date, WEEKDAY_ASSIGNMENTS, WEEKDAY_ALLOWED, WEEKDAY_ORDER);
    const chunks = [];
    for (let index = 0; index < rows.length; index += 17) chunks.push(rows.slice(index, index + 17));
    const html = chunks.map((chunk, index) => `<div style="${index ? 'break-before:page;' : ''}">${sectionHtml(date, chunk, 'weekday')}</div>`).join('');
    openPrint(html, 'Dienstplan Montag bis Freitag');
    setStatus('Der Dienstplan Montag bis Freitag wurde für den Druck geöffnet.');
  }

  function printWeekend() {
    const dates = weekendDates();
    const saturdayRows = strictRows(dates.saturday, SATURDAY_ASSIGNMENTS, SATURDAY_ALLOWED, SATURDAY_ORDER);
    const sundayRows = strictRows(dates.sunday, SUNDAY_ASSIGNMENTS, SUNDAY_ALLOWED, SUNDAY_ORDER);
    const html = sectionHtml(dates.saturday, saturdayRows, 'saturday') + sectionHtml(dates.sunday, sundayRows, 'sunday');
    openPrint(html, 'Dienstplan Samstag und Sonntag');
    setStatus(`Samstag ${germanDate(dates.saturday)} und Sonntag ${germanDate(dates.sunday)} wurden gemeinsam für den Druck geöffnet.`);
  }

  window.dienstpilotPrintWeekendPlans = printWeekend;

  function installEditButton() {
    const wrapper = document.querySelector('.dp-daily-plan-print-separation');
    if (!wrapper) return;

    document.querySelectorAll('#dpDailyEditSaturday,#dpDailyEditSunday').forEach((button) => button.remove());
    let editRow = document.querySelector('.dp-weekend-edit-buttons');
    if (!editRow) {
      editRow = document.createElement('div');
      editRow.className = 'dp-weekend-edit-buttons';
      editRow.style.display = 'grid';
      editRow.style.gridTemplateColumns = '1fr';
      editRow.style.gap = '10px';
      editRow.style.marginTop = '8px';
      wrapper.insertAdjacentElement('afterend', editRow);
    }

    let button = document.getElementById(WEEKEND_EDIT_BUTTON);
    if (!button) {
      button = document.createElement('button');
      button.id = WEEKEND_EDIT_BUTTON;
      button.type = 'button';
      button.className = 'dp-daily-secondary dp-daily-edit-only';
      button.addEventListener('click', () => {
        if (typeof window.dienstpilotOpenWeekendCombinedEditor === 'function') {
          window.dienstpilotOpenWeekendCombinedEditor();
        } else {
          window.setTimeout(() => window.dienstpilotOpenWeekendCombinedEditor?.(), 250);
        }
      });
      editRow.appendChild(button);
    }
    button.textContent = 'Samstag und Sonntag gemeinsam bearbeiten';
    button.title = 'Beide Wochenendtage gleichzeitig öffnen, bearbeiten und gemeinsam speichern';
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
      weekend.textContent = 'Dienstplan Samstag und Sonntag gemeinsam drucken';
      weekend.title = 'Samstags- und Sonntagsdienste gemeinsam auf einer Seite drucken';
      weekend.classList.add('dp-active-plan');
    }
    const label = document.getElementById('dpDailyPlanModeLabel');
    if (label) {
      label.className = 'dp-daily-plan-mode-label';
      label.textContent = 'Samstag und Sonntag werden gemeinsam bearbeitet, gemeinsam gespeichert und auf einer Seite gedruckt.';
    }
    installEditButton();
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
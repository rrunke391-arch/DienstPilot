(() => {
  'use strict';

  if (window.__dienstpilotDriverCurrentWeekPrint) return;
  window.__dienstpilotDriverCurrentWeekPrint = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const STATE_KEY = 'lenkRuhezeitenRunke20260413';
  const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function profileKey(value) {
    return normalize(value).replace(/[^a-z0-9_-]+/g, '_');
  }

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function isDriver() {
    return normalize(currentUser()?.role || sessionStorage.getItem(ROLE_KEY)) === 'fahrer';
  }

  function profileName() {
    const user = currentUser() || {};
    return profileKey(user.driverProfile || user.username || user.displayName || '');
  }

  function displayName() {
    const user = currentUser() || {};
    return String(user.displayName || user.username || 'Fahrer').trim();
  }

  function localIso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function parseIso(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date();
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }

  function addDays(iso, amount) {
    const date = parseIso(iso);
    date.setDate(date.getDate() + amount);
    return localIso(date);
  }

  function mondayOfCurrentWeek() {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    const weekday = date.getDay() || 7;
    date.setDate(date.getDate() - weekday + 1);
    return localIso(date);
  }

  function formatDate(iso) {
    const date = parseIso(iso);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isFree(row) {
    return normalize(row?.type) === 'frei' || normalize(row?.number) === 'frei';
  }

  function localDuties() {
    const profile = profileName();
    const keys = [
      `lrz-plan-${profile}`,
      `dienstpilot-plan-${profile}`,
      STATE_KEY
    ];

    const sources = [];
    keys.forEach((key) => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (Array.isArray(value)) sources.push(value);
        else if (Array.isArray(value?.duties)) sources.push(value.duties);
      } catch {}
    });

    return sources.sort((a, b) => b.length - a.length)[0] || [];
  }

  async function loadDuties() {
    const profile = profileName();
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (profile) {
      try {
        const response = await fetch(`${API_BASE}/api/plan/${encodeURIComponent(profile)}`, {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(data?.duties)) return data.duties;
      } catch {}
    }
    return localDuties();
  }

  function rowsForDate(duties, iso) {
    return duties
      .filter((row) => row && String(row.date || '') === iso)
      .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
  }

  function dayRowsHtml(duties, iso) {
    const date = parseIso(iso);
    const rows = rowsForDate(duties, iso);
    const weekday = DAY_NAMES[date.getDay()];

    if (!rows.length) {
      return `<tr><td>${escapeHtml(weekday)}</td><td>${escapeHtml(formatDate(iso))}</td><td colspan="3" class="empty">Kein Dienst eingetragen</td></tr>`;
    }

    return rows.map((row, index) => {
      const free = isFree(row);
      return `<tr>
        ${index === 0 ? `<td rowspan="${rows.length}">${escapeHtml(weekday)}</td><td rowspan="${rows.length}">${escapeHtml(formatDate(iso))}</td>` : ''}
        <td class="duty">${free ? 'Frei' : `Dienst ${escapeHtml(row.number || '—')}`}</td>
        <td>${free ? '—' : escapeHtml(row.start || '--:--')}</td>
        <td>${free ? '—' : escapeHtml(row.end || '--:--')}</td>
      </tr>`;
    }).join('');
  }

  function printHtml(duties) {
    const monday = mondayOfCurrentWeek();
    const sunday = addDays(monday, 6);
    const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
    const generated = new Date().toLocaleString('de-DE');

    return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Aktuelle Woche – ${escapeHtml(displayName())}</title>
  <style>
    @page{size:A4 portrait;margin:13mm}
    *{box-sizing:border-box}
    body{margin:0;color:#0f172a;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:12px;border-bottom:3px solid #0f172a}
    h1{margin:0;font-size:25px;line-height:1.1}
    .driver{margin-top:5px;font-size:15px;font-weight:700}
    .range{text-align:right;font-weight:700;line-height:1.5}
    .range strong{display:block;font-size:17px}
    table{width:100%;margin-top:16px;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid #94a3b8;padding:10px 8px;text-align:left;vertical-align:middle}
    th{background:#e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
    th:nth-child(1){width:18%}th:nth-child(2){width:19%}th:nth-child(3){width:29%}th:nth-child(4),th:nth-child(5){width:17%}
    td.duty{font-weight:700}.empty{color:#64748b;font-style:italic}
    .foot{margin-top:12px;color:#64748b;font-size:10px;text-align:right}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style>
</head>
<body>
  <header class="head">
    <div>
      <h1>Aktuelle Woche</h1>
      <div class="driver">Dienstplan ${escapeHtml(displayName())}</div>
    </div>
    <div class="range">
      <strong>${escapeHtml(formatDate(monday))} – ${escapeHtml(formatDate(sunday))}</strong>
      Montag bis Sonntag
    </div>
  </header>
  <table>
    <thead><tr><th>Tag</th><th>Datum</th><th>Dienst</th><th>Beginn</th><th>Ende</th></tr></thead>
    <tbody>${days.map((iso) => dayRowsHtml(duties, iso)).join('')}</tbody>
  </table>
  <div class="foot">Erstellt am ${escapeHtml(generated)}</div>
  <script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),180)});<\/script>
</body>
</html>`;
  }

  async function printCurrentWeek() {
    const printWindow = window.open('', 'dienstpilotFahrerDruck');
    if (!printWindow) {
      window.alert('Die Druckvorschau wurde vom Browser blockiert. Bitte Pop-ups für DienstPilot erlauben.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Druck wird vorbereitet</title></head><body style="font-family:Arial;padding:30px">Aktuelle Woche wird geladen …</body></html>');
    printWindow.document.close();

    const duties = await loadDuties();
    printWindow.document.open();
    printWindow.document.write(printHtml(duties));
    printWindow.document.close();
    printWindow.focus();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#dpDriverHome [data-home-action="print"]');
    if (!button || !isDriver()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void printCurrentWeek();
  }, true);
})();
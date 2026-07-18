(() => {
  'use strict';

  if (window.__dienstpilotRunkePlan20260813To20261009V5) return;
  window.__dienstpilotRunkePlan20260813To20261009V5 = true;

  const API_URL = 'https://api.dienstpilot-runke.de/api/data/plan_runke';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const LOCAL_PLAN_KEY = 'lrz-plan-runke';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const LOCAL_DONE_KEY = 'dienstpilot_runke_plan_2026_08_13_10_09_v5';
  const SERVER_MARKER = 'runkePlan20260813To20261009V5';
  const OLD_SERVER_MARKERS = [
    'runkePlan20260813To20261009V1',
    'runkePlan20260813To20261009V3',
    'runkePlan20260813To20261009V4'
  ];
  const BACKUP_KEY = 'runkePlanBefore20260813To20271231V5';
  const SOURCE_TEXT = 'Hochgeladener Dienstplan Runke, Stand 14.07.2026';
  const DISPLAY_NAME = 'Ralf Runke Fahrer';
  const NOTICE_ID = 'dpRunkePlanImportNotice';
  const REPLACE_FROM = '2026-08-13';
  const REPLACE_TO = '2026-10-09';
  const CLEAR_FROM = '2026-10-10';
  const CLEAR_TO = '2027-12-31';

  // Exakt aus Seite 1 der hochgeladenen Dienstplantabelle, Spalte "Runke".
  const ENTRIES = [
    ['2026-08-13','3025','13:10','21:50'],
    ['2026-08-14','3025','13:10','21:50'],

    ['2026-08-17','3011','06:23','17:00'],
    ['2026-08-18','3011','06:23','17:00'],
    ['2026-08-19','Frei','',''],
    ['2026-08-20','3014','06:35','15:39'],
    ['2026-08-21','3014','06:35','15:39'],

    ['2026-08-24','3013','06:35','17:05'],
    ['2026-08-25','3013','06:35','17:05'],
    ['2026-08-26','3001','05:03','12:12'],
    ['2026-08-27','3001','05:03','12:12'],
    ['2026-08-28','3001','05:03','12:12'],

    ['2026-08-31','3012','06:31','16:50'],
    ['2026-09-01','3012','06:31','16:50'],
    ['2026-09-02','Frei','',''],
    ['2026-09-03','3012','06:31','16:50'],
    ['2026-09-04','3012','06:31','16:50'],

    ['2026-09-07','3024','12:20','21:05'],
    ['2026-09-08','3024','12:20','21:05'],
    ['2026-09-09','3024','12:20','21:05'],
    ['2026-09-10','3024','12:20','21:05'],
    ['2026-09-11','3024','12:20','21:05'],

    ['2026-09-14','3001','05:03','12:12'],
    ['2026-09-15','3001','05:03','12:12'],
    ['2026-09-16','3013','06:35','17:05'],
    ['2026-09-17','3013','06:35','17:05'],
    ['2026-09-18','3013','06:35','17:05'],

    ['2026-09-21','3014','06:35','15:39'],
    ['2026-09-22','Frei','',''],
    ['2026-09-23','3011','06:23','17:00'],
    ['2026-09-24','3011','06:23','17:00'],
    ['2026-09-25','3011','06:23','16:10'],

    ['2026-09-28','3016','06:43','18:06'],
    ['2026-09-29','3019','06:49','17:28'],
    ['2026-09-30','3012','06:31','16:50'],
    ['2026-10-01','Frei','',''],
    ['2026-10-02','3095','20:20','04:05'],

    ['2026-10-05','3022','12:03','19:21'],
    ['2026-10-06','3022','12:03','19:21'],
    ['2026-10-07','3022','12:03','19:21'],
    ['2026-10-08','3022','12:03','19:21'],
    ['2026-10-09','3022','12:03','19:21']
  ];

  const EXPECTED_BY_DATE = new Map(ENTRIES.map(([date, number, start, end]) => [date, {
    date,
    number,
    start,
    end,
    type: number === 'Frei' ? 'frei' : 'dienst'
  }]));

  let running = false;
  let completed = false;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {};
    } catch {
      return {};
    }
  }

  function mayImport() {
    const user = currentUser();
    const role = normalize(user.role || sessionStorage.getItem(ROLE_KEY));
    return role === 'administrator'
      || role === 'admin'
      || role === 'geschaftsleitung'
      || role === 'geschaeftsleitung';
  }

  function headers(extra = {}) {
    const result = new Headers(extra);
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', `Bearer ${token}`);
    return result;
  }

  function unwrap(wrapper) {
    return wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data')
      ? (wrapper.data || {})
      : (wrapper || {});
  }

  function inRange(date, from, to) {
    const value = String(date || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= from && value <= to;
  }

  function sameRow(actual, expected) {
    return String(actual?.date || '') === expected.date
      && String(actual?.number || '') === expected.number
      && String(actual?.start || '') === expected.start
      && String(actual?.end || '') === expected.end
      && String(actual?.type || (expected.number === 'Frei' ? 'frei' : 'dienst')) === expected.type;
  }

  function planIsExact(plan) {
    const duties = Array.isArray(plan?.duties) ? plan.duties : [];
    const targetRows = duties.filter((row) => inRange(row?.date, REPLACE_FROM, REPLACE_TO));
    if (targetRows.length !== ENTRIES.length) return false;

    const grouped = new Map();
    targetRows.forEach((row) => {
      const date = String(row?.date || '');
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date).push(row);
    });

    for (const [date, expected] of EXPECTED_BY_DATE) {
      const rows = grouped.get(date) || [];
      if (rows.length !== 1 || !sameRow(rows[0], expected)) return false;
    }

    return !duties.some((row) => inRange(row?.date, CLEAR_FROM, CLEAR_TO));
  }

  function importedRows(now, assignedBy) {
    return ENTRIES.map(([date, number, start, end]) => {
      const free = number === 'Frei';
      return {
        id: `runke-week-plan-${date}`,
        date,
        number,
        start,
        end,
        type: free ? 'frei' : 'dienst',
        assignedBy,
        assignedAt: now,
        source: SOURCE_TEXT,
        assignment: { assignedBy, assignedAt: now }
      };
    });
  }

  function ensureVisibleMonths(plan) {
    const months = Array.isArray(plan?.shownMonths) ? [...plan.shownMonths] : [];
    ['2026-08','2026-09','2026-10'].forEach((month) => {
      if (!months.includes(month)) months.push(month);
    });
    return months.sort();
  }

  function updateLocalPlan(plan) {
    localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(plan));
    localStorage.setItem(ACTIVE_DRIVER_KEY, 'runke');
    localStorage.setItem(LOCAL_DONE_KEY, '1');

    let main = {};
    try {
      main = JSON.parse(localStorage.getItem(MAIN_KEY) || '{}') || {};
    } catch {}

    localStorage.setItem(MAIN_KEY, JSON.stringify({
      ...main,
      duties: Array.isArray(plan.duties) ? plan.duties : [],
      appSettings: {
        ...(main.appSettings || {}),
        activeProfile: 'runke',
        shownMonths: ensureVisibleMonths(plan),
        bundeslaender: plan.bundeslaender || main.appSettings?.bundeslaender || { ferien: ['NI'], feiertage: ['NI'] },
        hideSundays: !!plan.hideSundays
      }
    }));
  }

  function showNotice(text, ok = true) {
    document.getElementById(NOTICE_ID)?.remove();
    const notice = document.createElement('div');
    notice.id = NOTICE_ID;
    notice.textContent = text;
    notice.style.cssText = [
      'position:fixed','left:50%','top:18px','transform:translateX(-50%)','z-index:100000',
      'max-width:min(860px,calc(100vw - 28px))','padding:13px 17px','border-radius:13px',
      `border:1px solid ${ok ? '#86efac' : '#fecaca'}`,
      `background:${ok ? '#f0fdf4' : '#fff1f2'}`,
      `color:${ok ? '#166534' : '#b91c1c'}`,
      'font-weight:900','box-shadow:0 12px 30px rgba(15,23,42,.18)','text-align:center'
    ].join(';');
    document.body.appendChild(notice);
    window.setTimeout(() => notice.remove(), 12000);
  }

  async function readServerPlan() {
    const response = await fetch(API_URL, {
      cache: 'no-store',
      headers: headers()
    });
    const wrapper = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 404) throw new Error(wrapper.error || `Serverstatus ${response.status}`);
    return response.status === 404 ? { duties: [] } : unwrap(wrapper);
  }

  async function importPlan() {
    if (running || completed || !mayImport()) return;
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;

    running = true;
    try {
      const current = await readServerPlan();

      if (planIsExact(current) && current?.imports?.[SERVER_MARKER]) {
        completed = true;
        updateLocalPlan(current);
        return;
      }

      const currentDuties = Array.isArray(current.duties) ? current.duties : [];
      const removedForReplacement = currentDuties.filter((row) => inRange(row?.date, REPLACE_FROM, REPLACE_TO));
      const removedForEmptyFuture = currentDuties.filter((row) => inRange(row?.date, CLEAR_FROM, CLEAR_TO));
      const preserved = currentDuties.filter((row) => (
        !inRange(row?.date, REPLACE_FROM, REPLACE_TO)
        && !inRange(row?.date, CLEAR_FROM, CLEAR_TO)
      ));

      const now = new Date().toISOString();
      const user = currentUser();
      const assignedBy = user.displayName || user.username || 'Administrator';
      const duties = [...preserved, ...importedRows(now, assignedBy)]
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.start || '').localeCompare(String(b.start || '')));

      const imports = { ...(current.imports || {}) };
      OLD_SERVER_MARKERS.forEach((marker) => delete imports[marker]);
      imports[SERVER_MARKER] = now;

      const importBackups = { ...(current.importBackups || {}) };
      if (!importBackups[BACKUP_KEY]) {
        importBackups[BACKUP_KEY] = {
          savedAt: now,
          replacedRange: { from: REPLACE_FROM, to: REPLACE_TO, rows: removedForReplacement },
          clearedRange: { from: CLEAR_FROM, to: CLEAR_TO, rows: removedForEmptyFuture }
        };
      }

      const plan = {
        ...current,
        profile: 'runke',
        displayName: DISPLAY_NAME,
        profileType: 'Fahrer',
        duties,
        shownMonths: ensureVisibleMonths(current),
        startDate: current.startDate || '2026-08-01',
        savedAt: now,
        assignedBy,
        imports,
        importBackups
      };

      const putResponse = await fetch(API_URL, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(plan)
      });
      const putData = await putResponse.json().catch(() => ({}));
      if (!putResponse.ok) throw new Error(putData.error || `Serverstatus ${putResponse.status}`);

      const verified = await readServerPlan();
      if (!planIsExact(verified)) {
        throw new Error('Die Serverprüfung hat nicht alle 42 erwarteten Einträge bestätigt.');
      }

      updateLocalPlan(verified);
      completed = true;
      showNotice('Ralf Runke Fahrer: 42 Einträge vom 13.08. bis 09.10.2026 wurden gespeichert und auf dem Server geprüft. Ab 10.10.2026 bis Ende 2027 bleiben die Dienste leer.');
      window.dispatchEvent(new Event('pageshow'));
    } catch (error) {
      console.warn('Ralf-Runke-Fahrerplan konnte noch nicht eingetragen werden:', error);
      showNotice(error.message || 'Der Fahrerplan Ralf Runke konnte nicht auf dem Server gespeichert werden.', false);
    } finally {
      running = false;
    }
  }

  function scheduleImport() {
    [0, 300, 900, 1800, 3500].forEach((delay) => window.setTimeout(importPlan, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#loadRunke,#loadKollege,#loadSelectedProfile,.tab[data-tab="eingabe"]')) {
      scheduleImport();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleImport, { once: true });
  else scheduleImport();

  window.addEventListener('pageshow', scheduleImport);
  window.addEventListener('focus', scheduleImport);
})();
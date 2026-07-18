(() => {
  'use strict';

  if (window.__dienstpilotRalfRunkePlan20260813To20261009V6) return;
  window.__dienstpilotRalfRunkePlan20260813To20261009V6 = true;

  const API_BASE = 'https://api.dienstpilot-runke.de/api/data/';
  const TARGET_PROFILE = 'ralf_runke';
  const TARGET_API_URL = `${API_BASE}plan_${TARGET_PROFILE}`;
  const WRONG_ADMIN_API_URL = `${API_BASE}plan_runke`;
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const LOCAL_PLAN_KEY = `lrz-plan-${TARGET_PROFILE}`;
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const LOCAL_DONE_KEY = 'dienstpilot_ralf_runke_plan_2026_08_13_10_09_v6';
  const SERVER_MARKER = 'ralfRunkePlan20260813To20261009V6';
  const OLD_SERVER_MARKERS = [
    'runkePlan20260813To20261009V1',
    'runkePlan20260813To20261009V3',
    'runkePlan20260813To20261009V4',
    'runkePlan20260813To20261009V5'
  ];
  const BACKUP_KEY = 'ralfRunkePlanBefore20260813To20271231V6';
  const WRONG_BACKUP_KEYS = [
    'runkePlanBefore20260813To20271231V4',
    'runkePlanBefore20260813To20271231V5'
  ];
  const SOURCE_TEXT = 'Hochgeladener Dienstplan Runke, Stand 14.07.2026';
  const DISPLAY_NAME = 'Ralf Runke';
  const NOTICE_ID = 'dpRunkePlanImportNotice';
  const REPLACE_FROM = '2026-08-13';
  const REPLACE_TO = '2026-10-09';
  const CLEAR_FROM = '2026-10-10';
  const CLEAR_TO = '2027-12-31';

  // Exakt aus Seite 1 der hochgeladenen Dienstplantabelle, jeweils aus der Spalte "Runke".
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

  function profileKey(value) {
    return normalize(value)
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {};
    } catch {
      return {};
    }
  }

  function currentRole() {
    const user = currentUser();
    return normalize(user.role || sessionStorage.getItem(ROLE_KEY));
  }

  function currentSessionProfile() {
    const user = currentUser();
    return profileKey(user.driverProfile || user.username || '');
  }

  function isManagement() {
    const role = currentRole();
    return role === 'administrator'
      || role === 'admin'
      || role === 'geschaftsleitung'
      || role === 'geschaeftsleitung';
  }

  function mayImport() {
    return isManagement()
      || (currentRole() === 'fahrer' && currentSessionProfile() === TARGET_PROFILE);
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
        id: `ralf-runke-week-plan-${date}`,
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

  function shouldActivateTargetLocally() {
    if (currentSessionProfile() === TARGET_PROFILE) return true;
    if (profileKey(localStorage.getItem(ACTIVE_DRIVER_KEY)) === TARGET_PROFILE) return true;
    try {
      const main = JSON.parse(localStorage.getItem(MAIN_KEY) || '{}') || {};
      return profileKey(main?.appSettings?.activeProfile) === TARGET_PROFILE;
    } catch {
      return false;
    }
  }

  function updateLocalPlan(plan) {
    localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(plan));
    localStorage.setItem(LOCAL_DONE_KEY, '1');
    if (!shouldActivateTargetLocally()) return;

    localStorage.setItem(ACTIVE_DRIVER_KEY, TARGET_PROFILE);
    let main = {};
    try {
      main = JSON.parse(localStorage.getItem(MAIN_KEY) || '{}') || {};
    } catch {}

    localStorage.setItem(MAIN_KEY, JSON.stringify({
      ...main,
      duties: Array.isArray(plan.duties) ? plan.duties : [],
      vacations: Array.isArray(plan.vacations) ? plan.vacations : [],
      vacationEntitlement: Number.isFinite(plan.vacationEntitlement) ? plan.vacationEntitlement : 30,
      appSettings: {
        ...(main.appSettings || {}),
        activeProfile: TARGET_PROFILE,
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
      'max-width:min(900px,calc(100vw - 28px))','padding:13px 17px','border-radius:13px',
      `border:1px solid ${ok ? '#86efac' : '#fecaca'}`,
      `background:${ok ? '#f0fdf4' : '#fff1f2'}`,
      `color:${ok ? '#166534' : '#b91c1c'}`,
      'font-weight:900','box-shadow:0 12px 30px rgba(15,23,42,.18)','text-align:center'
    ].join(';');
    document.body.appendChild(notice);
    window.setTimeout(() => notice.remove(), 12000);
  }

  async function readPlan(url) {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: headers()
    });
    const wrapper = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 404) throw new Error(wrapper.error || `Serverstatus ${response.status}`);
    return response.status === 404 ? { duties: [] } : unwrap(wrapper);
  }

  async function writePlan(url, plan) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(plan)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Serverstatus ${response.status}`);
  }

  function isWrongImportedRow(row) {
    const id = String(row?.id || '');
    const source = String(row?.source || '');
    return id.startsWith('runke-week-plan-')
      || source === 'Dienstplan Runke 13.08.–09.10.2026'
      || source === SOURCE_TEXT;
  }

  async function restoreAdministratorPlanIfNeeded() {
    if (!isManagement()) return;

    try {
      const wrong = await readPlan(WRONG_ADMIN_API_URL);
      const duties = Array.isArray(wrong.duties) ? wrong.duties : [];
      const backup = WRONG_BACKUP_KEYS
        .map((key) => wrong?.importBackups?.[key])
        .find((entry) => entry && typeof entry === 'object');
      const hasWrongRows = duties.some((row) => isWrongImportedRow(row));
      const hasOldMarker = OLD_SERVER_MARKERS.some((marker) => wrong?.imports?.[marker]);
      if (!hasWrongRows && !hasOldMarker) return;

      let restoredDuties;
      if (backup) {
        const restoredRange = Array.isArray(backup?.replacedRange?.rows) ? backup.replacedRange.rows : [];
        const restoredFuture = Array.isArray(backup?.clearedRange?.rows) ? backup.clearedRange.rows : [];
        const outside = duties.filter((row) => (
          !inRange(row?.date, REPLACE_FROM, REPLACE_TO)
          && !inRange(row?.date, CLEAR_FROM, CLEAR_TO)
        ));
        restoredDuties = [...outside, ...restoredRange, ...restoredFuture];
      } else {
        restoredDuties = duties.filter((row) => !isWrongImportedRow(row));
      }

      const imports = { ...(wrong.imports || {}) };
      OLD_SERVER_MARKERS.forEach((marker) => delete imports[marker]);
      const corrected = {
        ...wrong,
        duties: restoredDuties.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.start || '').localeCompare(String(b.start || ''))),
        imports,
        correctedAt: new Date().toISOString(),
        correctedReason: 'Runke-Import gehörte zum Fahrerprofil ralf_runke.'
      };
      await writePlan(WRONG_ADMIN_API_URL, corrected);
    } catch (error) {
      console.warn('Falsch zugeordnete Runke-Einträge konnten nicht automatisch bereinigt werden:', error);
    }
  }

  async function importPlan() {
    if (running || completed || !mayImport()) return;
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;

    running = true;
    try {
      const current = await readPlan(TARGET_API_URL);

      if (planIsExact(current) && current?.imports?.[SERVER_MARKER]) {
        updateLocalPlan(current);
        completed = true;
        await restoreAdministratorPlanIfNeeded();
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
        profile: TARGET_PROFILE,
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

      await writePlan(TARGET_API_URL, plan);
      const verified = await readPlan(TARGET_API_URL);
      if (!planIsExact(verified)) {
        throw new Error('Die Serverprüfung für plan_ralf_runke hat nicht alle 42 erwarteten Einträge bestätigt.');
      }

      updateLocalPlan(verified);
      completed = true;
      await restoreAdministratorPlanIfNeeded();
      showNotice('Ralf Runke · Fahrer: 42 Einträge vom 13.08. bis 09.10.2026 wurden im richtigen Fahrerprofil gespeichert und geprüft. Ab 10.10.2026 bis Ende 2027 bleiben die Dienste leer.');
      window.dispatchEvent(new Event('pageshow'));
    } catch (error) {
      console.warn('Fahrerplan ralf_runke konnte noch nicht eingetragen werden:', error);
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
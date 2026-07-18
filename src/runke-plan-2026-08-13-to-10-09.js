(() => {
  'use strict';

  if (window.__dienstpilotRunkePlan20260813To20261009V1) return;
  window.__dienstpilotRunkePlan20260813To20261009V1 = true;

  const API_URL = 'https://api.dienstpilot-runke.de/api/data/plan_runke';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const LOCAL_PLAN_KEY = 'lrz-plan-runke';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const LOCAL_DONE_KEY = 'dienstpilot_runke_plan_2026_08_13_10_09_v1';
  const SERVER_MARKER = 'runkePlan20260813To20261009V1';
  const NOTICE_ID = 'dpRunkePlanImportNotice';

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

  function expectedRows(now, assignedBy) {
    return ENTRIES.map(([date, number, start, end]) => {
      const free = number === 'Frei';
      return {
        id: `runke-rotation-${date}`,
        date,
        number,
        start,
        end,
        type: free ? 'frei' : 'dienst',
        assignedBy,
        assignedAt: now,
        source: 'Wochenplan 13.08.–09.10.2026',
        assignment: { assignedBy, assignedAt: now }
      };
    });
  }

  function ensureMonths(plan) {
    const months = Array.isArray(plan.shownMonths) ? [...plan.shownMonths] : [];
    ['2026-08','2026-09','2026-10'].forEach((month) => {
      if (!months.includes(month)) months.push(month);
    });
    return months.sort();
  }

  function updateLocalPlan(plan) {
    localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(plan));
    localStorage.setItem(ACTIVE_DRIVER_KEY, 'runke');

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
        shownMonths: ensureMonths(plan),
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
      'max-width:min(760px,calc(100vw - 28px))','padding:13px 17px','border-radius:13px',
      `border:1px solid ${ok ? '#86efac' : '#fecaca'}`,
      `background:${ok ? '#f0fdf4' : '#fff1f2'}`,
      `color:${ok ? '#166534' : '#b91c1c'}`,
      'font-weight:900','box-shadow:0 12px 30px rgba(15,23,42,.18)','text-align:center'
    ].join(';');
    document.body.appendChild(notice);
    window.setTimeout(() => notice.remove(), 10000);
  }

  async function importPlan() {
    if (running || completed || !mayImport()) return;
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return;

    running = true;
    try {
      const getResponse = await fetch(API_URL, {
        cache: 'no-store',
        headers: headers()
      });
      const wrapper = await getResponse.json().catch(() => ({}));
      if (!getResponse.ok && getResponse.status !== 404) throw new Error(wrapper.error || `Serverstatus ${getResponse.status}`);

      const current = getResponse.status === 404
        ? {}
        : (Object.prototype.hasOwnProperty.call(wrapper, 'data') ? (wrapper.data || {}) : wrapper);

      if (current?.imports?.[SERVER_MARKER]) {
        completed = true;
        localStorage.setItem(LOCAL_DONE_KEY, '1');
        updateLocalPlan(current);
        return;
      }

      const now = new Date().toISOString();
      const user = currentUser();
      const assignedBy = user.displayName || user.username || 'Administrator';
      const dateSet = new Set(ENTRIES.map(([date]) => date));
      const preserved = (Array.isArray(current.duties) ? current.duties : [])
        .filter((row) => !dateSet.has(String(row?.date || '')));
      const duties = [...preserved, ...expectedRows(now, assignedBy)]
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.start || '').localeCompare(String(b.start || '')));

      const plan = {
        ...current,
        profile: 'runke',
        duties,
        shownMonths: ensureMonths(current),
        startDate: current.startDate || '2026-08-01',
        savedAt: now,
        assignedBy,
        imports: {
          ...(current.imports || {}),
          [SERVER_MARKER]: now
        }
      };

      const putResponse = await fetch(API_URL, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(plan)
      });
      const putData = await putResponse.json().catch(() => ({}));
      if (!putResponse.ok) throw new Error(putData.error || `Serverstatus ${putResponse.status}`);

      updateLocalPlan(plan);
      localStorage.setItem(LOCAL_DONE_KEY, '1');
      completed = true;
      showNotice('Dienstplan Ralf Runke vom 13.08. bis 09.10.2026 wurde mit 42 Tagen eingetragen.');
      window.dispatchEvent(new Event('pageshow'));
    } catch (error) {
      console.warn('Ralf-Runke-Dienstplan konnte noch nicht eingetragen werden:', error);
      showNotice('Der Dienstplan für Ralf Runke konnte noch nicht auf dem Server gespeichert werden.', false);
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
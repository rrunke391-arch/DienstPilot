(() => {
  'use strict';

  if (window.__dienstpilotRunkePlanRollback20260813To20261009V2) return;
  window.__dienstpilotRunkePlanRollback20260813To20261009V2 = true;

  const API_URL = 'https://api.dienstpilot-runke.de/api/data/plan_runke';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const LOCAL_PLAN_KEY = 'lrz-plan-runke';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const LOCAL_DONE_KEY = 'dienstpilot_runke_plan_2026_08_13_10_09_v1';
  const SERVER_MARKER = 'runkePlan20260813To20261009V1';
  const SOURCE_TEXT = 'Wochenplan 13.08.–09.10.2026';
  const NOTICE_ID = 'dpRunkePlanRollbackNotice';

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

  function mayRollback() {
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

  function isImportedRow(row) {
    const id = String(row?.id || '');
    const source = String(row?.source || '');
    return id.startsWith('runke-rotation-') || source === SOURCE_TEXT;
  }

  function updateLocalPlan(plan) {
    localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(plan));
    localStorage.setItem(ACTIVE_DRIVER_KEY, 'runke');
    localStorage.removeItem(LOCAL_DONE_KEY);

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
        shownMonths: Array.isArray(plan.shownMonths) ? plan.shownMonths : (main.appSettings?.shownMonths || ['2026-08']),
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

  async function rollbackPlan() {
    if (running || completed || !mayRollback()) return;
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
        ? { duties: [] }
        : (Object.prototype.hasOwnProperty.call(wrapper, 'data') ? (wrapper.data || {}) : wrapper);
      const duties = Array.isArray(current.duties) ? current.duties : [];
      const removedCount = duties.filter(isImportedRow).length;
      const markerPresent = Boolean(current?.imports?.[SERVER_MARKER]);

      if (!removedCount && !markerPresent) {
        completed = true;
        localStorage.removeItem(LOCAL_DONE_KEY);
        updateLocalPlan(current);
        return;
      }

      const imports = { ...(current.imports || {}) };
      delete imports[SERVER_MARKER];
      const now = new Date().toISOString();
      const plan = {
        ...current,
        duties: duties.filter((row) => !isImportedRow(row)),
        imports,
        savedAt: now
      };

      const putResponse = await fetch(API_URL, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(plan)
      });
      const putData = await putResponse.json().catch(() => ({}));
      if (!putResponse.ok) throw new Error(putData.error || `Serverstatus ${putResponse.status}`);

      updateLocalPlan(plan);
      completed = true;
      showNotice(`${removedCount} automatisch eingetragene Runke-Dienste wurden wieder entfernt.`);
      window.dispatchEvent(new Event('pageshow'));
    } catch (error) {
      console.warn('Rücknahme des Runke-Dienstplans fehlgeschlagen:', error);
      showNotice('Die automatische Eintragung konnte noch nicht vom Server entfernt werden.', false);
    } finally {
      running = false;
    }
  }

  function scheduleRollback() {
    [0, 300, 900, 1800, 3500].forEach((delay) => window.setTimeout(rollbackPlan, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#loadRunke,#loadKollege,#loadSelectedProfile,.tab[data-tab="eingabe"]')) {
      scheduleRollback();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleRollback, { once: true });
  else scheduleRollback();

  window.addEventListener('pageshow', scheduleRollback);
  window.addEventListener('focus', scheduleRollback);
})();
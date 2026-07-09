(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const START_DATE = '2026-08-01';
  const START_MONTH = '2026-08';

  let lastSent = '';
  let saveTimer = null;
  let saving = false;

  function normalize(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  }

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function activeProfile() {
    const main = readJson(MAIN_KEY) || {};
    const fromMain = main?.appSettings?.activeProfile;
    const fromLocal = localStorage.getItem(ACTIVE_DRIVER_KEY);
    const fromSelect = document.getElementById('profileSelect')?.value || document.getElementById('kollegeSelect')?.value;
    const status = String(document.getElementById('syncStatus')?.textContent || '');
    const match = status.match(/Aktiv:\s*([^·]+)/i);
    return normalize(fromMain || fromLocal || fromSelect || (match && match[1]) || 'runke');
  }

  function shownMonthsFromDuties(duties) {
    const months = new Set([START_MONTH]);
    for (const duty of duties || []) {
      const date = String(duty?.date || '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) months.add(date.slice(0, 7));
    }
    return [...months].sort();
  }

  function collectPlan(profile) {
    const p = normalize(profile || activeProfile());
    const main = readJson(MAIN_KEY) || {};
    const named = readJson('lrz-plan-' + p) || {};
    const appSettings = main.appSettings || {};

    const mainDuties = Array.isArray(main.duties) ? main.duties : [];
    const namedDuties = Array.isArray(named.duties) ? named.duties : [];
    const duties = mainDuties.length || main?.appSettings?.activeProfile === p ? mainDuties : namedDuties;

    const months = Array.isArray(appSettings.shownMonths) && appSettings.shownMonths.length
      ? appSettings.shownMonths
      : (Array.isArray(named.shownMonths) && named.shownMonths.length ? named.shownMonths : shownMonthsFromDuties(duties));

    return {
      ...named,
      duties,
      vacations: Array.isArray(named.vacations) ? named.vacations : [],
      vacationEntitlement: Number.isFinite(named.vacationEntitlement) ? named.vacationEntitlement : 30,
      bundeslaender: appSettings.bundeslaender || named.bundeslaender || { ferien: ['NI'], feiertage: ['NI'] },
      hideSundays: Boolean(appSettings.hideSundays ?? named.hideSundays),
      shownMonths: months.length ? months : [START_MONTH],
      startDate: named.startDate || START_DATE,
      profile: p,
      savedAt: new Date().toISOString()
    };
  }

  function setText(text, ok) {
    const el = document.getElementById('dpManualServerSaveStatus');
    if (el) {
      el.textContent = text;
      el.style.color = ok ? '#047857' : '#b45309';
    }
  }

  function setMainSyncText(profile, state) {
    const el = document.getElementById('syncStatus');
    if (!el || !profile) return;
    const name = profile.charAt(0).toUpperCase() + profile.slice(1);
    el.textContent = 'Aktiv: ' + name + ' · ' + state;
    el.className = 'sync-status ' + (state.includes('gespeichert') || state.includes('synchronisiert') ? 'synced' : 'saving');
  }

  function signature(profile, body) {
    return JSON.stringify({
      profile,
      duties: body.duties || [],
      vacations: body.vacations || [],
      vacationEntitlement: body.vacationEntitlement,
      bundeslaender: body.bundeslaender,
      hideSundays: body.hideSundays,
      shownMonths: body.shownMonths,
      startDate: body.startDate
    });
  }

  async function saveNow(reason) {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      setText('Kein Server-Token. Bitte neu anmelden.', false);
      return false;
    }

    const profile = activeProfile();
    const body = collectPlan(profile);
    const sig = signature(profile, body);

    if (!profile) return false;
    if (reason !== 'button' && sig === lastSent) return true;

    if (saving) return false;
    saving = true;
    setText('Speichere ' + profile + ' mit ' + body.duties.length + ' Diensten ...', false);
    setMainSyncText(profile, 'speichere auf Server...');

    try {
      const res = await fetch(API_BASE + '/api/data/plan_' + encodeURIComponent(profile), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(body)
      });
      const text = await res.text().catch(() => '');
      if (res.ok) {
        lastSent = sig;
        setText('Server gespeichert: ' + profile + ' · ' + body.duties.length + ' Dienste', true);
        setMainSyncText(profile, 'auf Server gespeichert');
        return true;
      }
      setText('Serverfehler ' + res.status + ': ' + text, false);
      setMainSyncText(profile, 'Serverfehler');
      return false;
    } catch (error) {
      setText('Server nicht erreichbar: ' + (error && error.message ? error.message : error), false);
      setMainSyncText(profile, 'offline');
      return false;
    } finally {
      saving = false;
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveNow('auto');
    }, 1200);
  }

  function installButton() {
    if (document.getElementById('dpManualServerSave')) return;
    const toolbar = document.querySelector('.profile-toolbar') || document.querySelector('.toolbar');
    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.id = 'dpManualServerSave';
    btn.type = 'button';
    btn.className = 'btn-secondary';
    btn.textContent = '☁ Server speichern';
    btn.addEventListener('click', () => saveNow('button'));

    const status = document.createElement('span');
    status.id = 'dpManualServerSaveStatus';
    status.className = 'muted';
    status.style.marginLeft = '8px';
    status.style.fontWeight = '700';

    toolbar.appendChild(btn);
    toolbar.appendChild(status);
  }

  document.addEventListener('input', scheduleSave, true);
  document.addEventListener('change', scheduleSave, true);
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || !target.closest) return;
    if (target.closest('button,input,select,textarea,.day-card,.duty-card')) scheduleSave();
  }, true);

  setInterval(scheduleSave, 5000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installButton, { once: true });
  } else {
    installButton();
  }

  new MutationObserver(installButton).observe(document.documentElement, { childList: true, subtree: true });
})();

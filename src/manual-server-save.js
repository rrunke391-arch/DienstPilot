(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const START_DATE = '2026-08-01';
  const START_MONTH = '2026-08';

  function loadFinalMonthSelector() {
    if (document.getElementById('dpMonthSelectorFinalDirect')) return;
    const script = document.createElement('script');
    script.id = 'dpMonthSelectorFinalDirect';
    script.src = 'src/month-selector-final.js?v=20260712-1';
    script.async = false;
    document.head.appendChild(script);
  }

  loadFinalMonthSelector();

  function installIsoWeekFix() {
    window.isoWeekKey = function fixedIsoWeekKey(dateString) {
      const iso = String(dateString || '').match(/^\d{4}-\d{2}-\d{2}$/) ? String(dateString) : new Date().toISOString().slice(0, 10);
      const parts = iso.split('-').map(Number);
      const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      const day = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - day);
      const isoYear = date.getUTCFullYear();
      const yearStart = new Date(Date.UTC(isoYear, 0, 1));
      const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
      return isoYear + '-KW' + String(week).padStart(2, '0');
    };

    window.mondayOfWeekKey = function fixedMondayOfWeekKey(weekKey) {
      const m = String(weekKey || '').match(/^(\d{4})-KW(\d+)/);
      if (!m) return null;
      const year = Number(m[1]);
      const week = Number(m[2]);
      const jan4 = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
      const jan4Day = jan4.getUTCDay() || 7;
      const monday = new Date(jan4);
      monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
      return monday;
    };
  }

  installIsoWeekFix();

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
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? '#047857' : '#b45309';
  }

  async function saveNow() {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      setText('Kein Server-Token. Bitte neu anmelden.', false);
      return;
    }

    const profile = activeProfile();
    const body = collectPlan(profile);

    if (!Array.isArray(body.duties)) {
      setText('Nicht gespeichert: Plan nicht lesbar.', false);
      return;
    }

    setText('Speichere ' + profile + ' mit ' + body.duties.length + ' Einträgen ...', false);

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
        setText('Server gespeichert: ' + profile + ' · ' + body.duties.length + ' Einträge', true);
      } else {
        setText('Serverfehler ' + res.status + ': ' + text, false);
      }
    } catch (error) {
      setText('Server nicht erreichbar: ' + (error && error.message ? error.message : error), false);
    }
  }

  function installButton() {
    installIsoWeekFix();
    loadFinalMonthSelector();
    if (document.getElementById('dpManualServerSave')) return;
    const toolbar = document.querySelector('.profile-toolbar') || document.querySelector('.toolbar');
    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.id = 'dpManualServerSave';
    btn.type = 'button';
    btn.className = 'btn-secondary';
    btn.textContent = '☁ Server speichern';
    btn.addEventListener('click', saveNow);

    const status = document.createElement('span');
    status.id = 'dpManualServerSaveStatus';
    status.className = 'muted';
    status.style.marginLeft = '8px';
    status.style.fontWeight = '700';

    toolbar.appendChild(btn);
    toolbar.appendChild(status);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installButton, { once: true });
  } else {
    installButton();
  }

  window.setTimeout(installButton, 1000);
})();
(() => {
  'use strict';

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';

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

  function collectPlan(profile) {
    const p = normalize(profile || activeProfile());
    const main = readJson(MAIN_KEY) || {};
    const named = readJson('lrz-plan-' + p) || {};
    const appSettings = main.appSettings || {};

    const mainDuties = Array.isArray(main.duties) ? main.duties : [];
    const namedDuties = Array.isArray(named.duties) ? named.duties : [];
    const duties = mainDuties.length ? mainDuties : namedDuties;

    const shownMonths = Array.isArray(appSettings.shownMonths) && appSettings.shownMonths.length
      ? appSettings.shownMonths
      : (Array.isArray(named.shownMonths) && named.shownMonths.length ? named.shownMonths : ['2026-08']);

    return {
      ...named,
      duties,
      vacations: Array.isArray(named.vacations) ? named.vacations : [],
      vacationEntitlement: Number.isFinite(named.vacationEntitlement) ? named.vacationEntitlement : 30,
      bundeslaender: appSettings.bundeslaender || named.bundeslaender || { ferien: ['NI'], feiertage: ['NI'] },
      hideSundays: Boolean(appSettings.hideSundays ?? named.hideSundays),
      shownMonths,
      startDate: named.startDate || '2026-08-01',
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

    if (!Array.isArray(body.duties) || body.duties.length === 0) {
      setText('Nicht gespeichert: Dieser Plan hat lokal 0 Dienste.', false);
      return;
    }

    setText('Speichere ' + profile + ' mit ' + body.duties.length + ' Diensten ...', false);

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
        setText('Server gespeichert: ' + profile + ' · ' + body.duties.length + ' Dienste', true);
      } else {
        setText('Serverfehler ' + res.status + ': ' + text, false);
      }
    } catch (error) {
      setText('Server nicht erreichbar: ' + (error && error.message ? error.message : error), false);
    }
  }

  function installButton() {
    if (document.getElementById('dpManualServerSave')) return;
    const toolbar = document.querySelector('.profile-toolbar') || document.querySelector('.toolbar');
    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.id = 'dpManualServerSave';
    btn.type = 'button';
    btn.className = 'btn-secondary';
    btn.textContent = '☁ Jetzt auf Server speichern';
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

  new MutationObserver(installButton).observe(document.documentElement, { childList: true, subtree: true });
})();

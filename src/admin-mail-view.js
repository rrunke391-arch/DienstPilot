(() => {
  'use strict';

  const MAIN_KEY = 'lenkRuhezeitenRunke20260413';

  function clearOldStatus() {
    const status = document.querySelector('#dpUserAdminStatus');
    const rows = document.querySelectorAll('#dpUserAdminRows tr');
    if (!status || rows.length === 0) return;
    if (status.textContent.trim() === 'Keine Administratorrechte') {
      status.textContent = '';
    }
  }

  function cleanVacationButtons() {
    const buttons = [...document.querySelectorAll('button')].filter((button) => {
      const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
      return text.includes('Jahresurlaub') && button.closest('.toolbar');
    });

    if (buttons.length <= 1) return;

    const fixed = buttons.find((button) => button.id === 'openJahresurlaubFix');
    if (fixed) {
      buttons.forEach((button) => {
        if (button !== fixed) button.remove();
      });
      return;
    }

    buttons.slice(0, -1).forEach((button) => button.remove());
  }

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function hasDuties(plan) {
    return Boolean(plan && Array.isArray(plan.duties) && plan.duties.length > 0);
  }

  function activeProfile() {
    const main = readJson(MAIN_KEY) || {};
    return String(main?.appSettings?.activeProfile || localStorage.getItem('dienstpilot_aktiver_kollege') || '').trim().toLowerCase();
  }

  function localPlan(profile) {
    const p = String(profile || '').trim().toLowerCase();
    const named = readJson('lrz-plan-' + p) || {};
    const main = readJson(MAIN_KEY) || {};
    const vacation = readJson('dienstpilot-vacations-' + p) || {};
    const plan = { ...named };

    if (!hasDuties(plan) && String(main?.appSettings?.activeProfile || '').toLowerCase() === p && Array.isArray(main.duties)) {
      plan.duties = main.duties;
    }

    if (Array.isArray(vacation.vacations)) plan.vacations = vacation.vacations;
    if (Number.isFinite(vacation.vacationEntitlement)) plan.vacationEntitlement = vacation.vacationEntitlement;
    if (!Array.isArray(plan.vacations)) plan.vacations = [];
    if (!Number.isFinite(plan.vacationEntitlement)) plan.vacationEntitlement = 30;
    return plan;
  }

  async function protectVacationSave() {
    const profile = activeProfile();
    if (!profile) return;

    const local = localPlan(profile);
    if (!hasDuties(local)) return;

    let server = {};
    try {
      const res = await fetch('/api/plan/' + encodeURIComponent(profile), { cache: 'no-store' });
      if (res.ok) server = await res.json();
    } catch {}

    const merged = { ...server };
    merged.duties = hasDuties(server) ? server.duties : local.duties;
    merged.vacations = Array.isArray(local.vacations) ? local.vacations : (Array.isArray(server.vacations) ? server.vacations : []);
    merged.vacationEntitlement = Number.isFinite(local.vacationEntitlement) ? local.vacationEntitlement : (Number.isFinite(server.vacationEntitlement) ? server.vacationEntitlement : 30);
    merged.bundeslaender = server.bundeslaender || local.bundeslaender || null;
    merged.hideSundays = typeof server.hideSundays === 'boolean' ? server.hideSundays : !!local.hideSundays;
    merged.savedAt = new Date().toISOString();

    localStorage.setItem('lrz-plan-' + profile, JSON.stringify(merged));

    try {
      await fetch('/api/plan/' + encodeURIComponent(profile), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      });
    } catch {}
  }

  function installVacationSaveGuard() {
    document.addEventListener('click', (event) => {
      if (!event.target.closest?.('#dpVacSave')) return;
      setTimeout(protectVacationSave, 120);
    }, true);
  }

  function refresh() {
    clearOldStatus();
    cleanVacationButtons();
  }

  function start() {
    refresh();
    installVacationSaveGuard();
    document.addEventListener('click', () => setTimeout(refresh, 250), true);
    new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

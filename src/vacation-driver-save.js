(() => {
  'use strict';

  const MAIN = 'lenkRuhezeitenRunke20260413';
  const VAC = 'dienstpilot-vacations-';

  function user() { try { return JSON.parse(sessionStorage.getItem('dienstpilot_user') || 'null'); } catch { return null; } }
  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function get(k) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } }
  function set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function profile() {
    const u = user();
    if (u && u.role === 'Fahrer') return norm(u.driverProfile || u.username);
    return norm(localStorage.getItem('dienstpilot_aktiver_kollege'));
  }

  function setProfile() {
    const p = profile();
    if (!p) return '';
    localStorage.setItem('dienstpilot_aktiver_kollege', p);
    const main = get(MAIN) || {};
    set(MAIN, { ...main, appSettings: { ...(main.appSettings || {}), activeProfile: p } });
    return p;
  }

  function currentVacations(p) {
    const a = get(VAC + p) || {};
    const b = get('lrz-plan-' + p) || {};
    return Array.isArray(a.vacations) ? a.vacations : (Array.isArray(b.vacations) ? b.vacations : []);
  }

  function saveOne() {
    const p = setProfile();
    if (!p) return;
    const start = document.getElementById('dpVacStart')?.value || '';
    const end = document.getElementById('dpVacEnd')?.value || start;
    if (!start || !end || end < start) return;
    const label = document.getElementById('dpVacLabel')?.value || 'Urlaub';
    const vacationEntitlement = Number(document.getElementById('dpVacEntitlement')?.value) || 30;
    const old = currentVacations(p).filter(v => !(v.start === start && v.end === end));
    const vacations = [...old, { id: 'vac-' + Date.now(), label, emoji: '🌴', start, end }];
    const savedAt = new Date().toISOString();
    set(VAC + p, { vacations, vacationEntitlement, savedAt });
    const named = get('lrz-plan-' + p) || {};
    set('lrz-plan-' + p, { ...named, vacations, vacationEntitlement, savedAt });
  }

  function start() {
    setProfile();
    document.addEventListener('click', e => {
      if (e.target.closest?.('#openJahresurlaubFix')) setProfile();
      if (e.target.closest?.('#dpVacAdd,#dpVacSave')) saveOne();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

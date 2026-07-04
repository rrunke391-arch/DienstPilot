(() => {
  'use strict';

  const STORE_MAIN = 'lenkRuhezeitenRunke20260413';
  const VAC_PREFIX = 'dienstpilot-vacations-';
  const BUTTON_ID = 'openJahresurlaubFix';
  const OLD_BUTTON_ID = 'openJahresurlaub';
  const CONTAINER_ID = 'dutiesContainer';
  const MODAL_ID = 'dienstpilotVacationModal';
  const BASE_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07'];

  const KOLLEGEN = [
    ['yasar','Yasar'], ['bumhoffer','Bumhoffer'], ['entrup','Entrup'], ['schweppe','Schweppe'],
    ['janzen','Janzen'], ['alomar','Alomar'], ['al-sayek','Al Sayek'], ['szczepanik','Szczepanik'],
    ['seidensticker','Seidensticker'], ['kocdemir','Kocdemir'], ['wuellner','Wüllner'], ['wittwer','Wittwer'],
    ['biermann','Biermann'], ['gerding','Gerding'], ['runke','Runke'], ['lommel','Lommel'],
    ['malko','Malko'], ['murad','Murad'], ['kurta','Kurta'], ['wiemann','Wiemann']
  ];

  ready(() => {
    installStyles();
    refreshUi();
    document.addEventListener('click', handleClick, true);
    window.addEventListener('focus', refreshUi);
    window.addEventListener('storage', refreshUi);
    new MutationObserver(() => {
      clearTimeout(window.__dienstpilotVacationFixTimer);
      window.__dienstpilotVacationFixTimer = setTimeout(refreshUi, 120);
    }).observe(document.body, { childList: true, subtree: true });
  });

  function ready(fn) {
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn();
  }

  function refreshUi() {
    removeLenkUndRuhezeiten();
    hideSettingsVacationSection();
    removeCatalogProblems();
    replaceOldVacationButton();
    normalizeVacationBadges();
  }

  function installStyles() {
    if (document.getElementById('dienstpilotVacationFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'dienstpilotVacationFixStyles';
    style.textContent = `
      .tab[data-tab="tests"], #tab-tests, #tab-einstellungen .vacation-section { display: none !important; }
      #catalogReviewStats .crs-errors, #catalogReviewStats .crs-open,
      .catalog-card .badge.problem, .catalog-card-review, .cat-review-note, .cat-review-note-edit,
      .catalog-card.cat-has-problem::before, .catalog-card.cat-review-errors::before { display: none !important; }
      .catalog-card.cat-has-problem, .catalog-card.cat-review-errors { border-color:#e2e8f0 !important; box-shadow:none !important; background:#fff !important; }
      #openJahresurlaubFix { min-height:48px !important; padding:12px 18px !important; font-size:15px !important; font-weight:900 !important; border-radius:14px !important; white-space:nowrap !important; }
      details.day-group.vacation-fixed > summary { background:#dcfce7 !important; box-shadow:inset 6px 0 0 #16a34a !important; border-color:#86efac !important; }
      .dp-vacation-fixed-badge { display:inline-flex !important; align-items:center; justify-content:center; justify-self:end; grid-column:4; gap:5px; border-radius:999px; padding:4px 11px; background:#bbf7d0; border:1px solid #86efac; color:#166534; font-weight:900; font-size:12px; white-space:nowrap; }
      .dp-vacation-modal { position:fixed; inset:0; z-index:999999; background:#f8fafc; color:#0f172a; overflow:auto; -webkit-overflow-scrolling:touch; }
      .dp-vacation-shell { width:min(760px, 100%); margin:0 auto; padding:16px; }
      .dp-vac-card { background:#fff; border:1px solid #e2e8f0; border-radius:18px; padding:16px; margin:12px 0; box-shadow:0 10px 30px rgba(15,23,42,.08); }
      .dp-vac-title-row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
      .dp-vac-title-row h1 { margin:0 0 4px; font-size:26px; line-height:1.1; }
      .dp-vac-muted { color:#64748b; font-weight:700; }
      .dp-vac-close-x { border:0; border-radius:999px; background:#e2e8f0; color:#0f172a; min-width:44px; min-height:44px; font-size:24px; font-weight:900; }
      .dp-vac-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .dp-vac-field { display:flex; flex-direction:column; gap:6px; font-size:13px; font-weight:900; }
      .dp-vac-field input { width:100%; border:1px solid #cbd5e1; border-radius:14px; padding:13px 12px; font-size:16px; background:#fff; color:#0f172a; }
      .dp-vac-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; align-items:center; }
      .dp-vac-actions button, .dp-vac-row button { border:0; border-radius:14px; padding:12px 15px; font-size:15px; font-weight:900; }
      .dp-vac-primary { background:#2563eb; color:#fff; }
      .dp-vac-secondary { background:#e2e8f0; color:#0f172a; }
      .dp-vac-danger { background:#fee2e2; color:#991b1b; }
      .dp-vac-status { font-weight:900; color:#166534; }
      .dp-vac-status.error { color:#991b1b; }
      .dp-vac-row { display:flex; justify-content:space-between; align-items:center; gap:10px; border:1px solid #e2e8f0; border-radius:14px; padding:12px; margin:8px 0; background:#fff; }
      body.dp-vacation-open { overflow:hidden !important; }
      @media (max-width:720px) {
        #openJahresurlaubFix, button#openJahresurlaubFix.btn-secondary { width:100% !important; min-width:100% !important; min-height:64px !important; padding:18px 20px !important; font-size:19px !important; line-height:1.2 !important; display:flex !important; align-items:center !important; justify-content:center !important; box-sizing:border-box !important; margin:8px 0 !important; flex:1 0 100% !important; }
        .dp-vacation-shell { width:100%; max-width:none; padding:10px; }
        .dp-vac-card { border-radius:16px; padding:14px; margin:10px 0; }
        .dp-vac-title-row h1 { font-size:24px; }
        .dp-vac-grid { grid-template-columns:1fr; }
        .dp-vac-actions { display:grid; grid-template-columns:1fr; }
        .dp-vac-actions button { width:100%; min-height:56px; font-size:16px; }
        .dp-vac-row { align-items:flex-start; }
        .dp-vacation-modal { padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
        .dp-vacation-fixed-badge, .dp-vacation-badge { grid-column:1 / -1; justify-self:start; }
      }
    `;
    document.head.appendChild(style);
  }

  function removeLenkUndRuhezeiten() {
    document.querySelectorAll('.tab[data-tab="tests"], #tab-tests').forEach((el) => el.remove());
  }

  function hideSettingsVacationSection() {
    document.querySelectorAll('#tab-einstellungen .vacation-section').forEach((el) => {
      el.hidden = true;
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function removeCatalogProblems() {
    document.querySelectorAll('#catalogReviewStats .crs-errors, #catalogReviewStats .crs-open').forEach((el) => el.remove());
    document.querySelectorAll('.catalog-card .badge.problem, .catalog-card-review, .cat-review-note').forEach((el) => el.remove());
    document.querySelectorAll('.catalog-card.cat-has-problem, .catalog-card.cat-review-errors').forEach((el) => el.classList.remove('cat-has-problem', 'cat-review-errors'));
  }

  function handleClick(event) {
    const button = event.target.closest?.('#' + BUTTON_ID);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openVacationModal();
  }

  function replaceOldVacationButton() {
    document.querySelectorAll('#' + OLD_BUTTON_ID).forEach((button) => button.remove());
    const buttons = [...document.querySelectorAll('#' + BUTTON_ID)];
    buttons.slice(1).forEach((button) => button.remove());
    if (buttons[0]) return;

    const printButton = document.getElementById('printDutyPlan');
    const clearButton = document.getElementById('clearDuties');
    const group = printButton?.closest('.toolbar-group') || clearButton?.closest('.toolbar-group');
    if (!group) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'btn-secondary';
    button.textContent = '🌴 Jahresurlaub';
    if (printButton) group.insertBefore(button, printButton);
    else group.appendChild(button);
  }

  function activeProfile() {
    const main = readJson(STORE_MAIN) || {};
    return main.appSettings?.activeProfile || localStorage.getItem('dienstpilot_aktiver_kollege') || 'runke';
  }

  function readVacationProfile(profile) {
    const stable = readJson(VAC_PREFIX + profile) || {};
    const named = readJson('lrz-plan-' + profile) || {};
    return {
      vacations: Array.isArray(stable.vacations) ? stable.vacations : (Array.isArray(named.vacations) ? named.vacations : []),
      vacationEntitlement: Number.isFinite(stable.vacationEntitlement) ? stable.vacationEntitlement : (Number.isFinite(named.vacationEntitlement) ? named.vacationEntitlement : 30)
    };
  }

  function persistVacationProfile(profile, vacations, entitlement) {
    const clean = (Array.isArray(vacations) ? vacations : []).filter((v) => v && v.start && v.end && v.end >= v.start);
    localStorage.setItem(VAC_PREFIX + profile, JSON.stringify({ vacations: clean, vacationEntitlement: entitlement, savedAt: new Date().toISOString() }));

    const main = readJson(STORE_MAIN) || {};
    const appSettings = { ...(main.appSettings || {}), activeProfile: profile };
    const shownMonths = new Set([...(appSettings.shownMonths || []), ...BASE_MONTHS]);
    clean.forEach((v) => monthsCovered(v.start, v.end).forEach((m) => shownMonths.add(m)));
    appSettings.shownMonths = [...shownMonths].sort();
    localStorage.setItem(STORE_MAIN, JSON.stringify({ ...main, appSettings }));

    const named = readJson('lrz-plan-' + profile) || {};
    localStorage.setItem('lrz-plan-' + profile, JSON.stringify({ ...named, vacations: clean, vacationEntitlement: entitlement, savedAt: new Date().toISOString() }));
  }

  function openVacationModal() {
    document.getElementById(MODAL_ID)?.remove();
    const profile = activeProfile();
    const stored = readVacationProfile(profile);
    let vacations = Array.isArray(stored.vacations) ? stored.vacations.slice() : [];

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'dp-vacation-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="dp-vacation-shell">
        <div class="dp-vac-card">
          <div class="dp-vac-title-row">
            <div><h1>🌴 Jahresurlaub</h1><div class="dp-vac-muted">${escapeHtml(profileLabel(profile))} · Urlaub wird getrennt pro Kollege gespeichert.</div></div>
            <button type="button" class="dp-vac-close-x" id="dpVacCloseTop" aria-label="Schließen">×</button>
          </div>
        </div>
        <div class="dp-vac-card">
          <div class="dp-vac-grid">
            <label class="dp-vac-field">Bezeichnung<input id="dpVacLabel" value="Urlaub"></label>
            <label class="dp-vac-field">Anspruch Tage/Jahr<input id="dpVacEntitlement" type="number" min="0" max="99" value="${escapeHtml(stored.vacationEntitlement || 30)}"></label>
            <label class="dp-vac-field">Von<input id="dpVacStart" type="date"></label>
            <label class="dp-vac-field">Bis<input id="dpVacEnd" type="date"></label>
          </div>
          <div class="dp-vac-actions">
            <button type="button" class="dp-vac-primary" id="dpVacAdd">Urlaub hinzufügen</button>
            <button type="button" class="dp-vac-primary" id="dpVacSave">💾 Jahresurlaub speichern</button>
            <button type="button" class="dp-vac-secondary" id="dpVacClose">Fenster schließen</button>
            <span class="dp-vac-status" id="dpVacStatus"></span>
          </div>
        </div>
        <div class="dp-vac-card">
          <strong>Gespeicherte Urlaube</strong>
          <div id="dpVacList"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.body.classList.add('dp-vacation-open');

    const $ = (id) => modal.querySelector('#' + id);
    const close = () => { modal.remove(); document.body.classList.remove('dp-vacation-open'); };
    const setStatus = (text, error = false) => { $('dpVacStatus').textContent = text; $('dpVacStatus').className = error ? 'dp-vac-status error' : 'dp-vac-status'; };
    const render = () => {
      const list = $('dpVacList');
      list.innerHTML = vacations.length ? vacations.map((v, i) => `<div class="dp-vac-row"><div><strong>${escapeHtml(v.label || 'Urlaub')}</strong><br><span class="dp-vac-muted">${formatDateDE(v.start)} bis ${formatDateDE(v.end)}</span></div><button type="button" class="dp-vac-danger" data-del="${i}">Löschen</button></div>`).join('') : '<p class="dp-vac-muted">Noch kein Urlaub eingetragen.</p>';
      list.querySelectorAll('[data-del]').forEach((button) => button.addEventListener('click', () => { vacations.splice(Number(button.dataset.del), 1); render(); }));
    };
    const addFromFields = () => {
      const start = $('dpVacStart').value;
      const end = $('dpVacEnd').value || start;
      if (!start) return false;
      if (end < start) { setStatus('Das Bis-Datum liegt vor dem Von-Datum. Bitte das Datum prüfen.', true); return null; }
      vacations.push({ id: 'vac-' + Date.now() + '-' + Math.random().toString(16).slice(2), label: $('dpVacLabel').value || 'Urlaub', emoji: '🌴', start, end });
      $('dpVacStart').value = '';
      $('dpVacEnd').value = '';
      setStatus('Urlaub wurde zur Liste hinzugefügt.');
      render();
      return true;
    };
    const save = () => {
      const added = addFromFields();
      if (added === null) return;
      if (!vacations.length) { setStatus('Bitte erst ein Von-Datum eintragen oder Urlaub hinzufügen.', true); return; }
      persistVacationProfile(profile, vacations, Number($('dpVacEntitlement').value) || 30);
      setStatus('Gespeichert. Ansicht wird aktualisiert.');
      normalizeVacationBadges();
      setTimeout(() => { close(); location.reload(); }, 350);
    };

    $('dpVacAdd').addEventListener('click', addFromFields);
    $('dpVacSave').addEventListener('click', save);
    $('dpVacClose').addEventListener('click', close);
    $('dpVacCloseTop').addEventListener('click', close);
    render();
    $('dpVacStart')?.focus();
  }

  function normalizeVacationBadges() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    const profile = activeProfile();
    const vacations = readVacationProfile(profile).vacations;
    container.querySelectorAll('details.day-group > summary .vacation-badge, .dp-vacation-fixed-badge, .dp-vacation-badge').forEach((el) => el.remove());
    container.querySelectorAll('details.day-group').forEach((day) => day.classList.remove('vacation-fixed'));
    if (!vacations.length) return;
    container.querySelectorAll('details.day-group[data-day]').forEach((day) => {
      const iso = day.dataset.day;
      const vacation = vacations.find((v) => v && v.start && v.end && iso >= v.start && iso <= v.end);
      if (!vacation) return;
      const summary = day.querySelector(':scope > summary');
      if (!summary) return;
      const badge = document.createElement('span');
      badge.className = 'vacation-badge dp-vacation-fixed-badge';
      badge.textContent = (vacation.emoji || '🌴') + ' ' + (vacation.label || 'Urlaub');
      summary.appendChild(badge);
      day.classList.add('vacation-fixed', 'compact-vacation');
    });
  }

  function monthsCovered(start, end) {
    const out = new Set();
    let current = start;
    let guard = 0;
    while (/^\d{4}-\d{2}-\d{2}$/.test(current) && current <= end && guard++ < 400) {
      out.add(current.slice(0, 7));
      current = addDays(current, 1);
    }
    return [...out];
  }

  function addDays(iso, days) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function formatDateDE(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return String(iso || '');
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function readJson(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function profileLabel(profile) {
    const found = KOLLEGEN.find(([id]) => id === profile);
    return found ? found[1] : profile;
  }

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }
})();

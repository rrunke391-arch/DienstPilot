(() => {
  'use strict';

  const STORE_MAIN = 'lenkRuhezeitenRunke20260413';
  const VAC_PREFIX = 'dienstpilot-vacations-';
  const BUTTON_ID = 'openJahresurlaubFix';
  const OLD_BUTTON_ID = 'openJahresurlaub';
  const CONTAINER_ID = 'dutiesContainer';
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
    removeLenkUndRuhezeiten();
    hideSettingsVacationSection();
    removeCatalogProblems();
    replaceOldVacationButton();
    normalizeVacationBadges();

    document.addEventListener('click', handleClick, true);
    window.addEventListener('focus', refreshUi);
    window.addEventListener('storage', refreshUi);

    new MutationObserver(() => {
      clearTimeout(window.__dienstpilotVacationFixTimer);
      window.__dienstpilotVacationFixTimer = setTimeout(refreshUi, 120);
    }).observe(document.body, { childList: true, subtree: true });
  });

  function refreshUi() {
    removeLenkUndRuhezeiten();
    hideSettingsVacationSection();
    removeCatalogProblems();
    replaceOldVacationButton();
    normalizeVacationBadges();
  }

  function ready(fn) {
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn();
  }

  function installStyles() {
    if (document.getElementById('dienstpilotVacationFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'dienstpilotVacationFixStyles';
    style.textContent = `
      .tab[data-tab="tests"],
      #tab-tests,
      #tab-einstellungen .vacation-section {
        display: none !important;
      }
      #openJahresurlaubFix {
        min-height: 44px !important;
        padding: 10px 16px !important;
        font-size: 14px !important;
        font-weight: 900 !important;
        border-radius: 14px !important;
        white-space: nowrap !important;
      }
      #catalogReviewStats .crs-errors,
      #catalogReviewStats .crs-open,
      .catalog-card .badge.problem,
      .catalog-card-review,
      .cat-review-note,
      .cat-review-note-edit,
      .catalog-card.cat-has-problem::before,
      .catalog-card.cat-review-errors::before {
        display: none !important;
      }
      .catalog-card.cat-has-problem,
      .catalog-card.cat-review-errors {
        border-color: #e2e8f0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
      }
      details.day-group.vacation-fixed > summary {
        background: #dcfce7 !important;
        box-shadow: inset 6px 0 0 #16a34a !important;
        border-color: #86efac !important;
      }
      .dp-vacation-fixed-badge {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        justify-self: end;
        grid-column: 4;
        gap: 5px;
        border-radius: 999px;
        padding: 4px 11px;
        background: #bbf7d0;
        border: 1px solid #86efac;
        color: #166534;
        font-weight: 900;
        font-size: 12px;
        white-space: nowrap;
      }
      @media (max-width: 720px) {
        #openJahresurlaubFix {
          width: 100% !important;
          min-height: 56px !important;
          padding: 15px 18px !important;
          font-size: 17px !important;
          line-height: 1.2 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          margin: 6px 0 !important;
        }
        .dp-vacation-fixed-badge { grid-column: 1 / -1; justify-self: start; }
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
    document.querySelectorAll('.catalog-card.cat-has-problem, .catalog-card.cat-review-errors').forEach((el) => {
      el.classList.remove('cat-has-problem', 'cat-review-errors');
    });
  }

  function handleClick(event) {
    const button = event.target.closest?.('#' + BUTTON_ID);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openVacationWindow();
  }

  function replaceOldVacationButton() {
    document.querySelectorAll('#' + OLD_BUTTON_ID).forEach((button) => button.remove());

    const existingButtons = [...document.querySelectorAll('#' + BUTTON_ID)];
    existingButtons.slice(1).forEach((button) => button.remove());
    if (existingButtons[0]) return;

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

  function openVacationWindow() {
    const profile = activeProfile();
    const stored = readVacationProfile(profile);
    let vacations = Array.isArray(stored.vacations) ? stored.vacations.slice() : [];

    const win = window.open('', 'DienstPilotJahresurlaub', 'width=820,height=760,scrollbars=yes,resizable=yes');
    if (!win) {
      alert('Das Jahresurlaub-Fenster konnte nicht geöffnet werden. Bitte Pop-ups erlauben.');
      return;
    }

    win.document.open();
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>DienstPilot · Jahresurlaub</title><style>
      body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#0f172a}.wrap{max-width:760px;margin:0 auto;padding:20px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;margin:12px 0;box-shadow:0 10px 30px rgba(15,23,42,.08)}h1{margin:0 0 4px;font-size:24px}.muted{color:#64748b;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}label{display:flex;flex-direction:column;font-weight:800;font-size:13px;gap:5px}input{padding:10px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px}button{border:0;border-radius:12px;padding:10px 14px;font-weight:900;cursor:pointer}.primary{background:#2563eb;color:white}.secondary{background:#e2e8f0;color:#0f172a}.danger{background:#fee2e2;color:#991b1b}.row{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #e2e8f0;border-radius:14px;padding:10px;margin:8px 0;background:#fff}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.status{font-weight:900;color:#166534;margin-left:8px}.error{color:#991b1b}@media(max-width:640px){.grid{grid-template-columns:1fr}}
    </style></head><body><div class="wrap"><div class="card"><h1>🌴 Jahresurlaub</h1><div class="muted">${escapeHtml(profileLabel(profile))} · Urlaub wird getrennt pro Kollege gespeichert.</div></div><div class="card"><div class="grid"><label>Bezeichnung<input id="vacLabel" value="Urlaub"></label><label>Anspruch Tage/Jahr<input id="vacEntitlement" type="number" min="0" max="99" value="${escapeHtml(stored.vacationEntitlement || 30)}"></label><label>Von<input id="vacStart" type="date"></label><label>Bis<input id="vacEnd" type="date"></label></div><div class="actions"><button class="primary" id="addVac">Urlaub hinzufügen</button><button class="primary" id="saveVac">💾 Jahresurlaub speichern</button><button class="secondary" id="closeVac">Fenster schließen</button><span class="status" id="status"></span></div></div><div class="card"><strong>Gespeicherte Urlaube</strong><div id="vacList"></div></div></div></body></html>`);
    win.document.close();

    const $ = (id) => win.document.getElementById(id);
    const setStatus = (text, error = false) => { $('status').textContent = text; $('status').className = error ? 'status error' : 'status'; };
    const render = () => {
      const list = $('vacList');
      list.innerHTML = vacations.length ? vacations.map((v, i) => `<div class="row"><div><strong>${escapeHtml(v.label || 'Urlaub')}</strong><br><span class="muted">${formatDateDE(v.start)} bis ${formatDateDE(v.end)}</span></div><button class="danger" data-del="${i}">Löschen</button></div>`).join('') : '<p class="muted">Noch kein Urlaub eingetragen.</p>';
      list.querySelectorAll('[data-del]').forEach((button) => button.addEventListener('click', () => { vacations.splice(Number(button.dataset.del), 1); render(); }));
    };
    const addFromFields = () => {
      const start = $('vacStart').value;
      const end = $('vacEnd').value || start;
      if (!start) return false;
      if (end < start) { setStatus('Das Bis-Datum liegt vor dem Von-Datum. Bitte das Datum prüfen.', true); return null; }
      vacations.push({ id: 'vac-' + Date.now() + '-' + Math.random().toString(16).slice(2), label: $('vacLabel').value || 'Urlaub', emoji: '🌴', start, end });
      $('vacStart').value = '';
      $('vacEnd').value = '';
      setStatus('Urlaub wurde zur Liste hinzugefügt.');
      render();
      return true;
    };
    const save = () => {
      const added = addFromFields();
      if (added === null) return;
      if (!vacations.length) { setStatus('Bitte erst ein Von-Datum eintragen oder Urlaub hinzufügen.', true); return; }
      persistVacationProfile(profile, vacations, Number($('vacEntitlement').value) || 30);
      setStatus('Gespeichert. Fenster wird geschlossen.');
      normalizeVacationBadges();
      setTimeout(() => {
        try { win.close(); } catch {}
        try { window.location.reload(); } catch {}
      }, 450);
    };

    $('addVac').addEventListener('click', () => { addFromFields(); });
    $('saveVac').addEventListener('click', save);
    $('closeVac').addEventListener('click', () => { try { win.close(); } catch {} });
    render();
    win.focus();
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

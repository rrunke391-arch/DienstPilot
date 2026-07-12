(() => {
  'use strict';

  if (window.__dienstpilotDriverQuickOverview) return;
  window.__dienstpilotDriverQuickOverview = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const STATE_KEY = 'lenkRuhezeitenRunke20260413';
  const SELECTED_DATE_KEY = 'dienstpilot_driver_quick_date';
  const PANEL_ID = 'dpDriverQuickOverview';
  const STYLE_ID = 'dpDriverQuickOverviewStyle';
  const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const LONG_DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  let selectedDate = '';
  let weekOffset = 0;
  let renderHookInstalled = false;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function currentRole() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
      return normalize(user?.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalize(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function isDriver() {
    return currentRole() === 'fahrer';
  }

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      return state && typeof state === 'object' ? state : {};
    } catch {
      return {};
    }
  }

  function duties() {
    const state = readState();
    return Array.isArray(state.duties) ? state.duties.filter((duty) => duty && typeof duty === 'object') : [];
  }

  function localIso(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function dateObject(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date();
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }

  function addDays(iso, amount) {
    const date = dateObject(iso);
    date.setDate(date.getDate() + amount);
    return localIso(date);
  }

  function mondayOf(iso) {
    const date = dateObject(iso);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return localIso(date);
  }

  function formatShortDate(iso) {
    const date = dateObject(iso);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
  }

  function formatLongDate(iso) {
    const date = dateObject(iso);
    return `${LONG_DAY_NAMES[date.getDay()]}, ${date.getDate()}. ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function rowsForDate(iso) {
    return duties()
      .filter((duty) => String(duty.date || '') === iso)
      .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
  }

  function isFree(row) {
    return normalize(row?.type) === 'frei' || normalize(row?.number) === 'frei';
  }

  function workingRows(iso) {
    return rowsForDate(iso).filter((row) => !isFree(row));
  }

  function durationText(start, end) {
    const startMatch = String(start || '').match(/^(\d{1,2}):(\d{2})$/);
    const endMatch = String(end || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!startMatch || !endMatch) return '';
    let startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
    let endMinutes = Number(endMatch[1]) * 60 + Number(endMatch[2]);
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    const minutes = endMinutes - startMinutes;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} Std.${rest ? ` ${rest} Min.` : ''}`;
  }

  function nextDutyDate(fromIso, includeToday = true) {
    const dates = [...new Set(duties()
      .filter((row) => !isFree(row) && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')))
      .map((row) => String(row.date)))]
      .filter((date) => includeToday ? date >= fromIso : date > fromIso)
      .sort();
    return dates[0] || '';
  }

  function loadSelectedDate() {
    if (selectedDate) return selectedDate;
    try {
      const stored = sessionStorage.getItem(SELECTED_DATE_KEY) || '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) selectedDate = stored;
    } catch {}
    if (!selectedDate) selectedDate = nextDutyDate(localIso(), true) || localIso();
    return selectedDate;
  }

  function saveSelectedDate(iso) {
    selectedDate = iso;
    try { sessionStorage.setItem(SELECTED_DATE_KEY, iso); } catch {}
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.dp-driver-quick-active #tab-eingabe>.toolbar,
      body.dp-driver-quick-active #tab-eingabe>.dp-ui-toolbar-grid,
      body.dp-driver-quick-active #tab-eingabe>.dp-ui-period,
      body.dp-driver-quick-active #tab-eingabe>.dp-ui-profile,
      body.dp-driver-quick-active #tab-eingabe>.dp-ui-actions,
      body.dp-driver-quick-active #manualServerSave,
      body.dp-driver-quick-active #dpDirectMonthSelector{display:none!important}
      body.dp-driver-quick-active:not(.dp-driver-calendar-open) #dutiesContainer{display:none!important}
      body.dp-driver-quick-active.dp-driver-calendar-open #dutiesContainer{display:block!important}
      body.dp-driver-quick-active.dp-driver-calendar-open #dpDirectMonthSelector{display:block!important}
      #${PANEL_ID}{width:100%;max-width:980px;margin:12px auto 16px;display:grid;gap:13px}
      #${PANEL_ID} .dp-driver-quick-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:17px 18px;border:1px solid #dbe4ee;border-radius:18px;background:linear-gradient(135deg,#020617,#172554);color:#fff;box-shadow:0 12px 28px rgba(15,23,42,.13)}
      #${PANEL_ID} .dp-driver-quick-title{font-size:25px;font-weight:950;line-height:1.05}
      #${PANEL_ID} .dp-driver-quick-subtitle{margin-top:6px;color:#cbd5e1;font-size:13px;font-weight:700}
      #${PANEL_ID} .dp-driver-quick-actions{display:flex;gap:7px;flex-wrap:wrap}
      #${PANEL_ID} button{min-height:40px;border-radius:11px;padding:9px 12px;font-weight:900;cursor:pointer}
      #${PANEL_ID} .dp-driver-light{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);color:#fff}
      #${PANEL_ID} .dp-driver-white{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${PANEL_ID} .dp-driver-week{padding:14px;border:1px solid #dbe4ee;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.055)}
      #${PANEL_ID} .dp-driver-week-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px}
      #${PANEL_ID} .dp-driver-week-title{font-weight:950;color:#334155}
      #${PANEL_ID} .dp-driver-week-nav{display:flex;gap:6px}
      #${PANEL_ID} .dp-driver-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}
      #${PANEL_ID} .dp-driver-day{display:grid;gap:3px;align-content:start;min-width:0;padding:10px 5px;border:1px solid #dbe4ee;background:#f8fafc;color:#0f172a;text-align:center}
      #${PANEL_ID} .dp-driver-day:hover{border-color:#93c5fd;background:#eff6ff}
      #${PANEL_ID} .dp-driver-day.active{border-color:#0f172a;background:#0f172a;color:#fff}
      #${PANEL_ID} .dp-driver-day.today:not(.active){border-color:#2563eb;background:#eff6ff;color:#1d4ed8}
      #${PANEL_ID} .dp-driver-day-name{font-size:12px;font-weight:950}
      #${PANEL_ID} .dp-driver-day-date{font-size:11px;font-weight:750;opacity:.78}
      #${PANEL_ID} .dp-driver-day-duty{min-width:0;font-size:12px;font-weight:950;overflow-wrap:anywhere}
      #${PANEL_ID} .dp-driver-service{padding:19px;border:1px solid #dbe4ee;border-radius:20px;background:#fff;box-shadow:0 10px 26px rgba(15,23,42,.07)}
      #${PANEL_ID} .dp-driver-service-date{color:#475569;font-size:14px;font-weight:900}
      #${PANEL_ID} .dp-driver-service-list{display:grid;gap:10px;margin-top:13px}
      #${PANEL_ID} .dp-driver-service-card{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto;gap:12px;align-items:center;padding:16px;border:1px solid #dbe4ee;border-radius:16px;background:linear-gradient(90deg,#f8fafc,#fff)}
      #${PANEL_ID} .dp-driver-service-number{font-size:29px;font-weight:950;letter-spacing:-.02em;color:#020617}
      #${PANEL_ID} .dp-driver-service-label{margin-bottom:3px;color:#64748b;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
      #${PANEL_ID} .dp-driver-service-time{font-size:20px;font-weight:950;color:#0f172a}
      #${PANEL_ID} .dp-driver-service-duration{padding:8px 10px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:12px;font-weight:950;white-space:nowrap}
      #${PANEL_ID} .dp-driver-empty{padding:24px 16px;border:1px dashed #cbd5e1;border-radius:16px;background:#f8fafc;text-align:center;color:#475569;font-weight:850}
      @media(max-width:760px){
        #${PANEL_ID}{margin-top:8px}
        #${PANEL_ID} .dp-driver-quick-head{padding:15px 13px}
        #${PANEL_ID} .dp-driver-quick-title{font-size:22px}
        #${PANEL_ID} .dp-driver-quick-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}
        #${PANEL_ID} .dp-driver-quick-actions button{width:100%}
        #${PANEL_ID} .dp-driver-days{grid-template-columns:repeat(4,minmax(0,1fr))}
        #${PANEL_ID} .dp-driver-service-card{grid-template-columns:1fr 1fr}
        #${PANEL_ID} .dp-driver-service-duration{grid-column:1/-1;justify-self:start}
      }
      @media(max-width:390px){
        #${PANEL_ID} .dp-driver-days{grid-template-columns:repeat(2,minmax(0,1fr))}
        #${PANEL_ID} .dp-driver-service-card{grid-template-columns:1fr}
        #${PANEL_ID} .dp-driver-service-duration{grid-column:auto}
      }
    `;
    document.head.appendChild(style);
  }

  function dayDutyLabel(iso) {
    const rows = rowsForDate(iso);
    const work = rows.filter((row) => !isFree(row));
    if (work.length) return work.map((row) => row.number || 'Dienst').join(', ');
    if (rows.some(isFree)) return 'Frei';
    return '—';
  }

  function serviceHtml(iso) {
    const rows = rowsForDate(iso);
    const work = rows.filter((row) => !isFree(row));
    if (!work.length) {
      const text = rows.some(isFree) ? 'Für diesen Tag ist Frei eingetragen.' : 'Für diesen Tag ist kein Dienst eingetragen.';
      return `<div class="dp-driver-empty">${escapeHtml(text)}</div>`;
    }

    return `<div class="dp-driver-service-list">${work.map((row) => {
      const number = row.number || '—';
      const start = row.start || '--:--';
      const end = row.end || '--:--';
      const duration = durationText(row.start, row.end);
      return `<div class="dp-driver-service-card">
        <div><div class="dp-driver-service-label">Dein Dienst</div><div class="dp-driver-service-number">Dienst ${escapeHtml(number)}</div></div>
        <div><div class="dp-driver-service-label">Dienstzeit</div><div class="dp-driver-service-time">${escapeHtml(start)} – ${escapeHtml(end)}</div></div>
        ${duration ? `<div class="dp-driver-service-duration">${escapeHtml(duration)}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  function panelHtml() {
    const today = localIso();
    const chosen = loadSelectedDate();
    const baseMonday = mondayOf(addDays(today, weekOffset * 7));
    const weekDays = Array.from({ length: 7 }, (_, index) => addDays(baseMonday, index));
    const weekEnd = weekDays[6];

    return `
      <div class="dp-driver-quick-head">
        <div><div class="dp-driver-quick-title">Mein Dienstplan</div><div class="dp-driver-quick-subtitle">Dienst direkt auswählen – ohne Monat und Kalenderwoche zu öffnen.</div></div>
        <div class="dp-driver-quick-actions">
          <button type="button" class="dp-driver-light" data-quick-action="today">Heute</button>
          <button type="button" class="dp-driver-light" data-quick-action="tomorrow">Morgen</button>
          <button type="button" class="dp-driver-light" data-quick-action="next">Nächster Dienst</button>
          <button type="button" class="dp-driver-white" data-quick-action="print">Drucken</button>
          <button type="button" class="dp-driver-white" data-quick-action="calendar">Kalender anzeigen</button>
        </div>
      </div>
      <div class="dp-driver-week">
        <div class="dp-driver-week-head">
          <div class="dp-driver-week-title">${escapeHtml(formatShortDate(baseMonday))} – ${escapeHtml(formatShortDate(weekEnd))}</div>
          <div class="dp-driver-week-nav">
            <button type="button" class="dp-driver-white" data-week-nav="prev" aria-label="Vorherige Woche">‹</button>
            <button type="button" class="dp-driver-white" data-week-nav="current">Diese Woche</button>
            <button type="button" class="dp-driver-white" data-week-nav="next" aria-label="Nächste Woche">›</button>
          </div>
        </div>
        <div class="dp-driver-days">
          ${weekDays.map((iso) => {
            const date = dateObject(iso);
            const classes = ['dp-driver-day', iso === chosen ? 'active' : '', iso === today ? 'today' : ''].filter(Boolean).join(' ');
            return `<button type="button" class="${classes}" data-driver-date="${escapeHtml(iso)}">
              <span class="dp-driver-day-name">${escapeHtml(DAY_NAMES[date.getDay()])}</span>
              <span class="dp-driver-day-date">${escapeHtml(formatShortDate(iso))}</span>
              <span class="dp-driver-day-duty">${escapeHtml(dayDutyLabel(iso))}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
      <div class="dp-driver-service">
        <div class="dp-driver-service-date">${escapeHtml(formatLongDate(chosen))}</div>
        ${serviceHtml(chosen)}
      </div>`;
  }

  function bindPanel(panel) {
    panel.querySelectorAll('[data-driver-date]').forEach((button) => {
      button.addEventListener('click', () => {
        const iso = button.dataset.driverDate;
        if (!iso) return;
        saveSelectedDate(iso);
        renderPanel();
      });
    });

    panel.querySelectorAll('[data-week-nav]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.weekNav;
        if (action === 'prev') weekOffset -= 1;
        else if (action === 'next') weekOffset += 1;
        else weekOffset = 0;
        const monday = mondayOf(addDays(localIso(), weekOffset * 7));
        saveSelectedDate(monday);
        renderPanel();
      });
    });

    panel.querySelectorAll('[data-quick-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.quickAction;
        if (action === 'today') {
          weekOffset = 0;
          saveSelectedDate(localIso());
          renderPanel();
        } else if (action === 'tomorrow') {
          const tomorrow = addDays(localIso(), 1);
          weekOffset = 0;
          saveSelectedDate(tomorrow);
          renderPanel();
        } else if (action === 'next') {
          const next = nextDutyDate(localIso(), true);
          if (!next) return;
          const todayMonday = dateObject(mondayOf(localIso()));
          const nextMonday = dateObject(mondayOf(next));
          weekOffset = Math.round((nextMonday - todayMonday) / (7 * 86400000));
          saveSelectedDate(next);
          renderPanel();
        } else if (action === 'print') {
          document.getElementById('printDutyPlan')?.click();
        } else if (action === 'calendar') {
          document.body.classList.toggle('dp-driver-calendar-open');
          button.textContent = document.body.classList.contains('dp-driver-calendar-open') ? 'Kalender schließen' : 'Kalender anzeigen';
        }
      });
    });
  }

  function renderPanel() {
    if (!isDriver()) return false;
    addStyle();
    document.body.classList.add('dp-driver-quick-active');
    const section = document.getElementById('tab-eingabe');
    const dutiesContainer = document.getElementById('dutiesContainer');
    if (!section || !dutiesContainer) return false;

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      dutiesContainer.insertAdjacentElement('beforebegin', panel);
    }
    panel.innerHTML = panelHtml();
    bindPanel(panel);
    return true;
  }

  function removePanelForOtherRoles() {
    if (isDriver()) return;
    document.body.classList.remove('dp-driver-quick-active', 'dp-driver-calendar-open');
    document.getElementById(PANEL_ID)?.remove();
  }

  function wrapRenderAll() {
    if (renderHookInstalled) return;
    const original = window.renderAll;
    if (typeof original !== 'function' || original.__dpDriverQuickWrapped) return;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(() => {
        if (isDriver()) renderPanel();
        else removePanelForOtherRoles();
      });
      return result;
    };
    wrapped.__dpDriverQuickWrapped = true;
    window.renderAll = wrapped;
    renderHookInstalled = true;
  }

  function install() {
    wrapRenderAll();
    if (isDriver()) renderPanel();
    else removePanelForOtherRoles();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="eingabe"],#loadKollege,#loadRunke,#dpSignoutButton')) {
      [0, 120, 450].forEach((delay) => window.setTimeout(install, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target.closest?.('#tab-eingabe')) window.setTimeout(install, 80);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  [150, 500, 1200, 2200].forEach((delay) => window.setTimeout(install, delay));
  window.addEventListener('pageshow', install);
})();
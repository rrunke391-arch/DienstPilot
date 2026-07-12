(() => {
  'use strict';

  if (window.__dienstpilotDriverHomeV1) return;
  window.__dienstpilotDriverHomeV1 = true;

  const PANEL_ID = 'dpDriverHome';
  const STYLE_ID = 'dpDriverHomeStyle';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const STATE_KEY = 'lenkRuhezeitenRunke20260413';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const API_BASE = 'https://api.dienstpilot-runke.de';
  const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const LONG_DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  let selectedDate = '';
  let weekOffset = 0;
  let remoteDuties = null;
  let remoteRequested = false;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }

  function isDriver() {
    const user = currentUser();
    const role = normalize(user?.role || sessionStorage.getItem(ROLE_KEY));
    return role === 'fahrer';
  }

  function profileName() {
    const user = currentUser();
    return normalize(user?.driverProfile || user?.username || user?.displayName || '');
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.role-fahrer #tab-eingabe,
      body.dp-driver-home-active #tab-eingabe{display:block!important;visibility:visible!important;min-height:420px!important}
      body.dp-driver-home-active #tab-eingabe>#${PANEL_ID}{display:grid!important;visibility:visible!important;opacity:1!important}
      body.dp-driver-home-active #tab-eingabe>.toolbar,
      body.dp-driver-home-active #tab-eingabe>.dp-ui-toolbar-grid,
      body.dp-driver-home-active #tab-eingabe>.dp-ui-period,
      body.dp-driver-home-active #tab-eingabe>.dp-ui-profile,
      body.dp-driver-home-active #tab-eingabe>.dp-ui-actions,
      body.dp-driver-home-active #tab-eingabe>#manualServerSave,
      body.dp-driver-home-active #tab-eingabe>#dpDirectMonthSelector,
      body.dp-driver-home-active #tab-eingabe>#dutiesContainer,
      body.dp-driver-home-active #tab-eingabe>#dpDriverQuickOverview{display:none!important}
      #${PANEL_ID}{width:min(100%,980px);margin:18px auto 28px;gap:14px;box-sizing:border-box}
      #${PANEL_ID} *{box-sizing:border-box}
      #${PANEL_ID} .dp-home-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:20px;border-radius:22px;background:linear-gradient(135deg,#020617,#172554);color:#fff;box-shadow:0 14px 30px rgba(15,23,42,.16)}
      #${PANEL_ID} .dp-home-title{font-size:28px;font-weight:950;line-height:1.05}
      #${PANEL_ID} .dp-home-subtitle{margin-top:6px;color:#cbd5e1;font-size:14px;font-weight:750}
      #${PANEL_ID} .dp-home-actions{display:flex;gap:8px;flex-wrap:wrap}
      #${PANEL_ID} button{min-height:42px;padding:9px 13px;border-radius:12px;font:inherit;font-weight:900;cursor:pointer}
      #${PANEL_ID} .dp-home-dark-button{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff}
      #${PANEL_ID} .dp-home-light-button{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${PANEL_ID} .dp-home-week{padding:16px;border:1px solid #dbe4ee;border-radius:20px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.06)}
      #${PANEL_ID} .dp-home-week-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap}
      #${PANEL_ID} .dp-home-week-title{color:#334155;font-size:15px;font-weight:950}
      #${PANEL_ID} .dp-home-week-nav{display:flex;gap:7px}
      #${PANEL_ID} .dp-home-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
      #${PANEL_ID} .dp-home-day{display:grid;gap:4px;min-width:0;padding:11px 6px;border:1px solid #dbe4ee;background:#f8fafc;color:#0f172a;text-align:center}
      #${PANEL_ID} .dp-home-day.active{border-color:#0f172a;background:#0f172a;color:#fff}
      #${PANEL_ID} .dp-home-day.today:not(.active){border-color:#2563eb;background:#eff6ff;color:#1d4ed8}
      #${PANEL_ID} .dp-home-day-name{font-size:12px;font-weight:950}
      #${PANEL_ID} .dp-home-day-date{font-size:11px;font-weight:800;opacity:.8}
      #${PANEL_ID} .dp-home-day-duty{font-size:12px;font-weight:950;overflow-wrap:anywhere}
      #${PANEL_ID} .dp-home-service{padding:20px;border:1px solid #dbe4ee;border-radius:22px;background:#fff;box-shadow:0 10px 25px rgba(15,23,42,.07)}
      #${PANEL_ID} .dp-home-service-date{margin-bottom:13px;color:#475569;font-size:15px;font-weight:950}
      #${PANEL_ID} .dp-home-card{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto;gap:14px;align-items:center;padding:18px;border:1px solid #dbe4ee;border-radius:17px;background:linear-gradient(90deg,#f8fafc,#fff)}
      #${PANEL_ID} .dp-home-label{margin-bottom:3px;color:#64748b;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
      #${PANEL_ID} .dp-home-number{color:#020617;font-size:31px;font-weight:950}
      #${PANEL_ID} .dp-home-time{color:#0f172a;font-size:21px;font-weight:950}
      #${PANEL_ID} .dp-home-duration{padding:9px 11px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:12px;font-weight:950;white-space:nowrap}
      #${PANEL_ID} .dp-home-empty{padding:28px 18px;border:1px dashed #cbd5e1;border-radius:17px;background:#f8fafc;color:#475569;text-align:center;font-weight:850}
      #${PANEL_ID} .dp-home-empty strong{display:block;margin-bottom:6px;color:#0f172a;font-size:18px}
      @media(max-width:760px){
        #${PANEL_ID}{margin:10px auto 20px;padding:0 8px}
        #${PANEL_ID} .dp-home-head{padding:16px 14px}
        #${PANEL_ID} .dp-home-title{font-size:23px}
        #${PANEL_ID} .dp-home-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}
        #${PANEL_ID} .dp-home-actions button{width:100%}
        #${PANEL_ID} .dp-home-days{grid-template-columns:repeat(4,minmax(0,1fr))}
        #${PANEL_ID} .dp-home-card{grid-template-columns:1fr 1fr}
        #${PANEL_ID} .dp-home-duration{grid-column:1/-1;justify-self:start}
      }
      @media(max-width:420px){
        #${PANEL_ID} .dp-home-days{grid-template-columns:repeat(2,minmax(0,1fr))}
        #${PANEL_ID} .dp-home-card{grid-template-columns:1fr}
        #${PANEL_ID} .dp-home-duration{grid-column:auto}
      }
    `;
    document.head.appendChild(style);
  }

  function localIso(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

  function formatShort(iso) {
    const date = dateObject(iso);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
  }

  function formatLong(iso) {
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

  function localDutySources() {
    const sources = [];
    const keys = [STATE_KEY];
    const profile = profileName();
    if (profile) keys.push(`lrz-plan-${profile}`, `dienstpilot-plan-${profile}`);

    keys.forEach((key) => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (Array.isArray(value)) sources.push(value);
        else if (Array.isArray(value?.duties)) sources.push(value.duties);
      } catch {}
    });
    return sources;
  }

  function dutyRows() {
    if (Array.isArray(remoteDuties)) return remoteDuties;
    const sources = localDutySources();
    return sources.sort((a, b) => b.length - a.length)[0] || [];
  }

  function isFree(row) {
    return normalize(row?.type) === 'frei' || normalize(row?.number) === 'frei';
  }

  function rowsForDate(iso) {
    return dutyRows()
      .filter((row) => row && String(row.date || '') === iso)
      .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
  }

  function durationText(start, end) {
    const a = String(start || '').match(/^(\d{1,2}):(\d{2})$/);
    const b = String(end || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!a || !b) return '';
    const startMinutes = Number(a[1]) * 60 + Number(a[2]);
    let endMinutes = Number(b[1]) * 60 + Number(b[2]);
    if (endMinutes < startMinutes) endMinutes += 1440;
    const total = endMinutes - startMinutes;
    return `${Math.floor(total / 60)} Std.${total % 60 ? ` ${total % 60} Min.` : ''}`;
  }

  function nextDutyDate(fromIso) {
    return [...new Set(dutyRows()
      .filter((row) => row && !isFree(row) && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')))
      .map((row) => String(row.date)))]
      .filter((date) => date >= fromIso)
      .sort()[0] || '';
  }

  async function requestRemotePlan() {
    if (remoteRequested || !isDriver()) return;
    remoteRequested = true;
    const profile = profileName();
    if (!profile) return;

    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    try {
      const response = await fetch(`${API_BASE}/api/plan/${encodeURIComponent(profile)}`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data?.duties)) {
        remoteDuties = data.duties;
        render();
      }
    } catch {}
  }

  function dayLabel(iso) {
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
      const text = rows.some(isFree)
        ? 'Für diesen Tag ist Frei eingetragen.'
        : (dutyRows().length ? 'Für diesen Tag ist kein Dienst eingetragen.' : 'Für diesen Fahrer ist noch kein Dienstplan geladen.');
      return `<div class="dp-home-empty"><strong>${rows.some(isFree) ? 'Frei' : 'Kein Dienst'}</strong>${escapeHtml(text)}</div>`;
    }

    return work.map((row) => {
      const number = row.number || '—';
      const start = row.start || '--:--';
      const end = row.end || '--:--';
      const duration = durationText(row.start, row.end);
      return `<div class="dp-home-card">
        <div><div class="dp-home-label">Dein Dienst</div><div class="dp-home-number">Dienst ${escapeHtml(number)}</div></div>
        <div><div class="dp-home-label">Dienstzeit</div><div class="dp-home-time">${escapeHtml(start)} – ${escapeHtml(end)}</div></div>
        ${duration ? `<div class="dp-home-duration">${escapeHtml(duration)}</div>` : ''}
      </div>`;
    }).join('');
  }

  function panelHtml() {
    const today = localIso();
    if (!selectedDate) selectedDate = nextDutyDate(today) || today;
    const monday = mondayOf(addDays(today, weekOffset * 7));
    const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));

    return `
      <div class="dp-home-head">
        <div><div class="dp-home-title">Mein Dienstplan</div><div class="dp-home-subtitle">Dienst direkt auswählen – ohne Monat und Kalenderwoche.</div></div>
        <div class="dp-home-actions">
          <button type="button" class="dp-home-dark-button" data-home-action="today">Heute</button>
          <button type="button" class="dp-home-dark-button" data-home-action="tomorrow">Morgen</button>
          <button type="button" class="dp-home-dark-button" data-home-action="next">Nächster Dienst</button>
          <button type="button" class="dp-home-light-button" data-home-action="print">Drucken</button>
        </div>
      </div>
      <div class="dp-home-week">
        <div class="dp-home-week-head">
          <div class="dp-home-week-title">${escapeHtml(formatShort(days[0]))} – ${escapeHtml(formatShort(days[6]))}</div>
          <div class="dp-home-week-nav">
            <button type="button" class="dp-home-light-button" data-week="prev">‹</button>
            <button type="button" class="dp-home-light-button" data-week="current">Diese Woche</button>
            <button type="button" class="dp-home-light-button" data-week="next">›</button>
          </div>
        </div>
        <div class="dp-home-days">
          ${days.map((iso) => {
            const date = dateObject(iso);
            const classes = ['dp-home-day', iso === selectedDate ? 'active' : '', iso === today ? 'today' : ''].filter(Boolean).join(' ');
            return `<button type="button" class="${classes}" data-date="${escapeHtml(iso)}">
              <span class="dp-home-day-name">${escapeHtml(DAY_NAMES[date.getDay()])}</span>
              <span class="dp-home-day-date">${escapeHtml(formatShort(iso))}</span>
              <span class="dp-home-day-duty">${escapeHtml(dayLabel(iso))}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
      <div class="dp-home-service">
        <div class="dp-home-service-date">${escapeHtml(formatLong(selectedDate))}</div>
        ${serviceHtml(selectedDate)}
      </div>`;
  }

  function forceOverviewVisible() {
    const overviewTab = document.querySelector('.tab[data-tab="eingabe"]');
    const section = document.getElementById('tab-eingabe');
    if (!section) return null;

    document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab === overviewTab));
    document.querySelectorAll('main > section').forEach((candidate) => {
      const visible = candidate === section;
      candidate.classList.toggle('hidden', !visible);
      if (visible) candidate.style.setProperty('display', 'block', 'important');
      else candidate.style.removeProperty('display');
    });
    return section;
  }

  function bind(panel) {
    panel.querySelectorAll('[data-date]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedDate = button.dataset.date || selectedDate;
        render();
      });
    });

    panel.querySelectorAll('[data-week]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.week;
        if (action === 'prev') weekOffset -= 1;
        else if (action === 'next') weekOffset += 1;
        else weekOffset = 0;
        selectedDate = mondayOf(addDays(localIso(), weekOffset * 7));
        render();
      });
    });

    panel.querySelectorAll('[data-home-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.homeAction;
        if (action === 'today') {
          weekOffset = 0;
          selectedDate = localIso();
          render();
        } else if (action === 'tomorrow') {
          weekOffset = 0;
          selectedDate = addDays(localIso(), 1);
          render();
        } else if (action === 'next') {
          const next = nextDutyDate(localIso());
          if (next) selectedDate = next;
          render();
        } else if (action === 'print') {
          document.getElementById('printDutyPlan')?.click();
        }
      });
    });
  }

  function render() {
    if (!isDriver()) {
      document.body.classList.remove('dp-driver-home-active');
      document.getElementById(PANEL_ID)?.remove();
      return false;
    }

    addStyle();
    const section = forceOverviewVisible();
    if (!section) return false;

    document.body.classList.add('role-fahrer', 'dp-driver-home-active');
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
    }
    if (section.firstElementChild !== panel) section.insertBefore(panel, section.firstChild);
    panel.style.setProperty('display', 'grid', 'important');
    panel.innerHTML = panelHtml();
    bind(panel);
    requestRemotePlan();
    return true;
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="eingabe"],#dpSignoutButton')) {
      [0, 100, 350, 900].forEach((delay) => setTimeout(render, delay));
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();

  [100, 350, 900, 1800].forEach((delay) => setTimeout(render, delay));
  window.addEventListener('pageshow', render);
})();
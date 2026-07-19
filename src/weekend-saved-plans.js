(() => {
  'use strict';

  if (window.__dienstpilotWeekendSavedPlansV1) return;
  window.__dienstpilotWeekendSavedPlansV1 = true;

  const API_URL = 'https://api.dienstpilot-runke.de/api/data/daily_duty_plans';
  const LOCAL_KEY = 'dienstpilot_daily_duty_plans_v1';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const DATE_ID = 'dpDailyPlanDate';
  const PANEL_ID = 'dpWeekendCombinedEditor';
  const BUTTON_ID = 'dpWeekendSavedPlansButton';
  const OVERLAY_ID = 'dpWeekendSavedPlansOverlay';
  const LIST_ID = 'dpWeekendSavedPlansList';
  const STATUS_ID = 'dpWeekendSavedPlansStatus';
  const STYLE_ID = 'dpWeekendSavedPlansStyle';

  let loading = false;
  let refreshTimer = 0;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function currentRole() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {};
      return normalize(user.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalize(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function hasAccess() {
    return [
      'administrator', 'admin',
      'geschaftsleitung', 'geschaeftsleitung',
      'disposition', 'disponent', 'disponentin'
    ].includes(currentRole());
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parseDate(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }

  function isoDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function addDays(date, days) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    result.setDate(result.getDate() + days);
    return result;
  }

  function formatDate(iso) {
    const date = parseDate(iso);
    if (!date) return iso;
    return new Intl.DateTimeFormat('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
  }

  function formatSavedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Speicherzeit nicht vorhanden';
    return `Zuletzt gespeichert: ${new Intl.DateTimeFormat('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date)}`;
  }

  function normalizeStore(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawPlans = source.plans && typeof source.plans === 'object' ? source.plans : source;
    const plans = {};
    Object.entries(rawPlans || {}).forEach(([date, plan]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !plan || typeof plan !== 'object') return;
      plans[date] = {
        date,
        rows: Array.isArray(plan.rows) ? plan.rows : [],
        savedAt: String(plan.savedAt || '')
      };
    });
    return { plans };
  }

  function readLocalStore() {
    try {
      return normalizeStore(JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'));
    } catch {
      return { plans: {} };
    }
  }

  async function loadStore() {
    const local = readLocalStore();
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return local;

    try {
      const response = await fetch(API_URL, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Serverstatus ${response.status}`);
      const wrapper = await response.json().catch(() => ({}));
      const remote = normalizeStore(wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data') ? wrapper.data : wrapper);
      const merged = { plans: { ...local.plans, ...remote.plans } };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
      return merged;
    } catch {
      setStatus('Server nicht erreichbar. Es werden die lokal gespeicherten Wochenenddienste angezeigt.', 'error');
      return local;
    }
  }

  function weekendPairs(store) {
    const plans = store?.plans || {};
    const saturdays = new Set();

    Object.keys(plans).forEach((iso) => {
      const date = parseDate(iso);
      if (!date) return;
      const day = date.getDay();
      if (day === 6) saturdays.add(iso);
      if (day === 0) saturdays.add(isoDate(addDays(date, -1)));
    });

    return [...saturdays]
      .map((saturday) => {
        const sunday = isoDate(addDays(parseDate(saturday), 1));
        const saturdayPlan = plans[saturday] || null;
        const sundayPlan = plans[sunday] || null;
        const savedAt = [saturdayPlan?.savedAt, sundayPlan?.savedAt]
          .filter(Boolean)
          .sort()
          .at(-1) || '';
        return {
          saturday,
          sunday,
          saturdayRows: saturdayPlan?.rows || [],
          sundayRows: sundayPlan?.rows || [],
          savedAt
        };
      })
      .filter((pair) => pair.saturdayRows.length || pair.sundayRows.length)
      .sort((a, b) => b.saturday.localeCompare(a.saturday));
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{border:1px solid #d97706!important;background:#fffbeb!important;color:#92400e!important}
      #${OVERLAY_ID}{position:fixed;inset:0;z-index:100001;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.7)}
      #${OVERLAY_ID}[hidden]{display:none!important}
      #${OVERLAY_ID} .dp-weekend-saved-dialog{width:min(940px,96vw);max-height:88vh;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;border:2px solid #d97706;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.4)}
      #${OVERLAY_ID} .dp-weekend-saved-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #fde68a;background:#fffbeb}
      #${OVERLAY_ID} .dp-weekend-saved-head h2{margin:0 0 4px;color:#78350f}
      #${OVERLAY_ID} .dp-weekend-saved-close{width:42px;height:42px;border:1px solid #d97706;border-radius:10px;background:#fff;color:#92400e;font-size:24px;font-weight:900;cursor:pointer}
      #${STATUS_ID}{min-height:22px;padding:10px 20px;font-size:13px;font-weight:850;color:#475569}
      #${STATUS_ID}.error{color:#b91c1c}
      #${LIST_ID}{overflow:auto;padding:0 20px 20px;display:grid;gap:10px}
      #${OVERLAY_ID} .dp-weekend-saved-item{display:grid;grid-template-columns:minmax(300px,1fr) minmax(220px,.75fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid #e2e8f0;border-radius:13px;background:#fff}
      #${OVERLAY_ID} .dp-weekend-saved-date{font-size:15px;font-weight:950;color:#0f172a}
      #${OVERLAY_ID} .dp-weekend-saved-meta{margin-top:4px;font-size:12px;font-weight:750;color:#64748b}
      #${OVERLAY_ID} .dp-weekend-saved-count{font-size:13px;font-weight:900;color:#475569;line-height:1.5}
      #${OVERLAY_ID} .dp-weekend-saved-open{padding:10px 15px;border:1px solid #1d4ed8;border-radius:10px;background:#2563eb;color:#fff;font:inherit;font-weight:950;cursor:pointer;white-space:nowrap}
      #${OVERLAY_ID} .dp-weekend-saved-empty{padding:28px;border:1px dashed #cbd5e1;border-radius:13px;background:#f8fafc;text-align:center;color:#475569;font-weight:850}
      @media(max-width:760px){#${OVERLAY_ID} .dp-weekend-saved-item{grid-template-columns:1fr}#${OVERLAY_ID} .dp-weekend-saved-open{width:100%}}
      @media print{#${OVERLAY_ID},#${BUTTON_ID}{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="dp-weekend-saved-dialog" role="dialog" aria-modal="true" aria-labelledby="dpWeekendSavedPlansTitle">
        <div class="dp-weekend-saved-head">
          <div><h2 id="dpWeekendSavedPlansTitle">📁 Gespeicherte Samstags- und Sonntagsdienste</h2><div class="muted">Ein gespeichertes Wochenende auswählen und beide Tagespläne wieder gemeinsam öffnen.</div></div>
          <button type="button" class="dp-weekend-saved-close" aria-label="Ordner schließen">×</button>
        </div>
        <div id="${STATUS_ID}" role="status" aria-live="polite"></div>
        <div id="${LIST_ID}"></div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.dp-weekend-saved-close')?.addEventListener('click', closeFolder);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeFolder();
    });
    return overlay;
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;
    status.textContent = text;
    status.className = kind;
  }

  function renderPairs(store) {
    const list = document.getElementById(LIST_ID);
    if (!list) return;
    const pairs = weekendPairs(store);

    if (!pairs.length) {
      list.innerHTML = '<div class="dp-weekend-saved-empty">Es sind noch keine Samstags- und Sonntagsdienste gespeichert.</div>';
      setStatus('0 gespeicherte Wochenenden');
      return;
    }

    list.innerHTML = pairs.map((pair) => `
      <div class="dp-weekend-saved-item">
        <div>
          <div class="dp-weekend-saved-date">${escapeHtml(formatDate(pair.saturday))}<br>${escapeHtml(formatDate(pair.sunday))}</div>
          <div class="dp-weekend-saved-meta">${escapeHtml(formatSavedAt(pair.savedAt))}</div>
        </div>
        <div class="dp-weekend-saved-count">Samstag: ${pair.saturdayRows.length} Dienste<br>Sonntag: ${pair.sundayRows.length} Dienste</div>
        <button type="button" class="dp-weekend-saved-open" data-open-weekend="${escapeHtml(pair.saturday)}">Beide Tage öffnen</button>
      </div>`).join('');

    list.querySelectorAll('[data-open-weekend]').forEach((button) => {
      button.addEventListener('click', () => openWeekend(button.dataset.openWeekend));
    });
    setStatus(`${pairs.length} gespeicherte ${pairs.length === 1 ? 'Wochenende' : 'Wochenenden'}`);
  }

  async function openFolder() {
    if (!hasAccess() || loading) return;
    loading = true;
    addStyle();
    const overlay = ensureOverlay();
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setStatus('Gespeicherte Wochenenddienste werden geladen …');
    const list = document.getElementById(LIST_ID);
    if (list) list.innerHTML = '<div class="dp-weekend-saved-empty">Bitte einen Moment warten.</div>';
    try {
      renderPairs(await loadStore());
    } finally {
      loading = false;
    }
  }

  function closeFolder() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  }

  async function openWeekend(rawSaturday) {
    const saturday = String(rawSaturday || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saturday)) return;
    closeFolder();

    const input = document.getElementById(DATE_ID);
    if (input) {
      input.value = saturday;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (typeof window.dienstpilotOpenWeekendCombinedEditor === 'function') {
        await Promise.resolve(window.dienstpilotOpenWeekendCombinedEditor());
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
  }

  function ensureButton() {
    addStyle();
    if (!hasAccess()) {
      document.getElementById(BUTTON_ID)?.remove();
      return false;
    }

    const actions = document.querySelector(`#${PANEL_ID} .dp-weekend-actions`);
    if (!actions) return false;

    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = '📁 Gespeicherte Dienste wieder öffnen';
      button.title = 'Gespeicherte Samstags- und Sonntagsdienste auswählen und gemeinsam öffnen';
      button.addEventListener('click', openFolder);
      const closeButton = document.getElementById('dpWeekendCombinedClose');
      actions.insertBefore(button, closeButton || null);
    }
    return true;
  }

  function scheduleRefresh(delay = 50) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(ensureButton, delay);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.getElementById(OVERLAY_ID)?.hidden) closeFolder();
  });

  const start = () => {
    ensureButton();
    const observer = new MutationObserver(() => scheduleRefresh(30));
    observer.observe(document.body, { childList: true, subtree: true });
    [100, 300, 800, 1600].forEach((delay) => window.setTimeout(ensureButton, delay));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', ensureButton);
  window.addEventListener('focus', ensureButton);
})();
(() => {
  'use strict';

  if (window.__dienstpilotSavedDutyPlansFolderV1) return;
  window.__dienstpilotSavedDutyPlansFolderV1 = true;

  const API = 'https://api.dienstpilot-runke.de/api/data/daily_duty_plans';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const LOCAL_KEY = 'dienstpilot_daily_duty_plans_v1';
  const LAST_DATE_KEY = 'dienstpilot_daily_duty_plan_date';
  const AUTO_OPEN_KEY = 'dienstpilot_open_saved_daily_plan';
  const BUTTON_ID = 'dpSavedDutyPlansFolderButton';
  const OVERLAY_ID = 'dpSavedDutyPlansFolderOverlay';
  const LIST_ID = 'dpSavedDutyPlansFolderList';
  const STATUS_ID = 'dpSavedDutyPlansFolderStatus';
  const STYLE_ID = 'dpSavedDutyPlansFolderStyle';
  const DAILY_TAB_ID = 'dpDailyDutyPlanTab';
  const DATE_INPUT_ID = 'dpDailyPlanDate';

  let loading = false;

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
    const role = currentRole();
    return role === 'geschaftsleitung' || role === 'geschaeftsleitung' || role === 'disposition';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function readJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizePlan(date, plan) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || !plan || typeof plan !== 'object') return null;
    return {
      date: String(date),
      rows: Array.isArray(plan.rows) ? plan.rows : [],
      savedAt: String(plan.savedAt || '')
    };
  }

  function normalizeStore(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawPlans = source.plans && typeof source.plans === 'object' ? source.plans : source;
    const plans = {};
    Object.entries(rawPlans || {}).forEach(([date, plan]) => {
      const normalized = normalizePlan(date, plan);
      if (normalized) plans[date] = normalized;
    });
    return { plans };
  }

  function mergeStores(localStore, remoteStore) {
    return {
      plans: {
        ...(localStore?.plans || {}),
        ...(remoteStore?.plans || {})
      }
    };
  }

  async function loadPlans() {
    const local = normalizeStore(readJson(localStorage, LOCAL_KEY, { plans: {} }));
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return local;

    try {
      const response = await fetch(API, {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Serverstatus ${response.status}`);
      const wrapper = await response.json().catch(() => ({}));
      const remote = normalizeStore(wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'data') ? wrapper.data : wrapper);
      const merged = mergeStores(local, remote);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
      return merged;
    } catch (error) {
      setStatus('Server konnte nicht erreicht werden. Es werden die lokal gespeicherten Pläne angezeigt.', 'error');
      return local;
    }
  }

  function formatDate(iso) {
    const date = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(date);
    const day = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    return `${weekday}, ${day}`;
  }

  function formatSavedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Speicherzeit nicht vorhanden';
    return `Gespeichert am ${new Intl.DateTimeFormat('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date)}`;
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{border:1px solid #d97706;background:#fffbeb;color:#92400e}
      #${OVERLAY_ID}{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.68)}
      #${OVERLAY_ID}[hidden]{display:none!important}
      #${OVERLAY_ID} .dp-saved-folder{width:min(900px,96vw);max-height:88vh;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;border:2px solid #d97706;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.38)}
      #${OVERLAY_ID} .dp-saved-folder-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid #fde68a;background:#fffbeb}
      #${OVERLAY_ID} .dp-saved-folder-head h2{margin:0 0 4px;color:#78350f}
      #${OVERLAY_ID} .dp-saved-folder-close{width:42px;height:42px;border:1px solid #d97706;border-radius:10px;background:#fff;color:#92400e;font-size:24px;font-weight:900;cursor:pointer}
      #${STATUS_ID}{min-height:20px;padding:10px 20px;font-size:13px;font-weight:850;color:#475569}
      #${STATUS_ID}.error{color:#b91c1c}
      #${LIST_ID}{overflow:auto;padding:0 20px 20px;display:grid;gap:10px}
      #${OVERLAY_ID} .dp-saved-plan{display:grid;grid-template-columns:minmax(230px,1fr) minmax(170px,.7fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid #e2e8f0;border-radius:13px;background:#fff}
      #${OVERLAY_ID} .dp-saved-plan-date{font-size:16px;font-weight:950;color:#0f172a;text-transform:none}
      #${OVERLAY_ID} .dp-saved-plan-meta{margin-top:4px;font-size:12px;font-weight:750;color:#64748b}
      #${OVERLAY_ID} .dp-saved-plan-count{font-size:13px;font-weight:900;color:#475569}
      #${OVERLAY_ID} .dp-saved-plan-open{padding:10px 15px;border:1px solid #1d4ed8;border-radius:10px;background:#2563eb;color:#fff;font:inherit;font-weight:950;cursor:pointer;white-space:nowrap}
      #${OVERLAY_ID} .dp-saved-empty{padding:28px;border:1px dashed #cbd5e1;border-radius:13px;background:#f8fafc;text-align:center;color:#475569;font-weight:850}
      @media(max-width:720px){#${OVERLAY_ID} .dp-saved-plan{grid-template-columns:1fr}#${OVERLAY_ID} .dp-saved-plan-open{width:100%}}
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
      <div class="dp-saved-folder" role="dialog" aria-modal="true" aria-labelledby="dpSavedDutyPlansFolderTitle">
        <div class="dp-saved-folder-head">
          <div><h2 id="dpSavedDutyPlansFolderTitle">📁 Gespeicherte Dienstpläne</h2><div class="muted">Gespeicherte Tagesdienstpläne auswählen und wieder öffnen.</div></div>
          <button type="button" class="dp-saved-folder-close" aria-label="Ordner schließen">×</button>
        </div>
        <div id="${STATUS_ID}" role="status" aria-live="polite"></div>
        <div id="${LIST_ID}"></div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.dp-saved-folder-close')?.addEventListener('click', closeFolder);
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

  function renderPlans(store) {
    const list = document.getElementById(LIST_ID);
    if (!list) return;
    const plans = Object.values(store?.plans || {})
      .filter((plan) => plan && /^\d{4}-\d{2}-\d{2}$/.test(plan.date))
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!plans.length) {
      list.innerHTML = '<div class="dp-saved-empty">Es sind noch keine Dienstpläne gespeichert.</div>';
      setStatus('0 gespeicherte Dienstpläne');
      return;
    }

    list.innerHTML = plans.map((plan) => `
      <div class="dp-saved-plan">
        <div>
          <div class="dp-saved-plan-date">${escapeHtml(formatDate(plan.date))}</div>
          <div class="dp-saved-plan-meta">${escapeHtml(formatSavedAt(plan.savedAt))}</div>
        </div>
        <div class="dp-saved-plan-count">${plan.rows.length} ${plan.rows.length === 1 ? 'Eintrag' : 'Einträge'}</div>
        <button type="button" class="dp-saved-plan-open" data-open-saved-plan="${escapeHtml(plan.date)}">Dienstplan öffnen</button>
      </div>`).join('');

    list.querySelectorAll('[data-open-saved-plan]').forEach((button) => {
      button.addEventListener('click', () => openPlan(button.dataset.openSavedPlan));
    });
    setStatus(`${plans.length} gespeicherte ${plans.length === 1 ? 'Dienstplan' : 'Dienstpläne'}`);
  }

  async function openFolder() {
    if (!hasAccess() || loading) return;
    loading = true;
    addStyle();
    const overlay = ensureOverlay();
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setStatus('Gespeicherte Dienstpläne werden geladen …');
    const list = document.getElementById(LIST_ID);
    if (list) list.innerHTML = '<div class="dp-saved-empty">Bitte einen Moment warten.</div>';
    try {
      renderPlans(await loadPlans());
    } finally {
      loading = false;
    }
  }

  function closeFolder() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  }

  function openPlan(rawDate) {
    const date = String(rawDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    localStorage.setItem(LAST_DATE_KEY, date);
    sessionStorage.setItem(AUTO_OPEN_KEY, date);
    closeFolder();
    window.location.reload();
  }

  function ensureButton() {
    if (!hasAccess()) {
      document.getElementById(BUTTON_ID)?.remove();
      return false;
    }
    const actions = document.querySelector('#tab-daily-duty-plan .dp-daily-actions');
    if (!actions) return false;
    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.className = 'dp-daily-secondary';
      button.textContent = '📁 Gespeicherte Dienstpläne';
      button.title = 'Ordner mit gespeicherten Dienstplänen öffnen';
      button.addEventListener('click', openFolder);
      const printButton = document.getElementById('dpDailyPrintA4') || document.getElementById('dpDailyPrint');
      actions.insertBefore(button, printButton || actions.lastElementChild);
    }
    return true;
  }

  function autoOpenSavedPlan() {
    const date = sessionStorage.getItem(AUTO_OPEN_KEY) || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !hasAccess()) return;

    let attempts = 0;
    const tryOpen = () => {
      attempts += 1;
      const tab = document.getElementById(DAILY_TAB_ID);
      const input = document.getElementById(DATE_INPUT_ID);
      if (tab && input) {
        sessionStorage.removeItem(AUTO_OPEN_KEY);
        tab.click();
        window.setTimeout(() => {
          input.value = date;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, 180);
        return;
      }
      if (attempts < 12) window.setTimeout(tryOpen, 350);
    };
    window.setTimeout(tryOpen, 350);
  }

  function refresh() {
    addStyle();
    [0, 150, 450, 1000].forEach((delay) => window.setTimeout(ensureButton, delay));
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.getElementById(OVERLAY_ID)?.hidden) closeFolder();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#dpDailyDutyPlanTab,.tab[data-tab="einstellungen"],.tab[data-tab="eingabe"]')) refresh();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      refresh();
      autoOpenSavedPlan();
    }, { once: true });
  } else {
    refresh();
    autoOpenSavedPlan();
  }

  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
})();
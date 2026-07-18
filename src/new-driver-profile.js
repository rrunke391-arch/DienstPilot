(() => {
  'use strict';

  if (window.__dienstpilotNewDriverProfileV1) return;
  window.__dienstpilotNewDriverProfileV1 = true;

  const API_BASE = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const ACTIVE_DRIVER_KEY = 'dienstpilot_aktiver_kollege';
  const REGISTRY_KEY = 'dienstpilot_driver_profiles_v1';
  const SERVER_REGISTRY_KEY = 'driver_profiles';
  const BUTTON_ID = 'dpAddNewDriverButton';
  const OVERLAY_ID = 'dpAddNewDriverOverlay';
  const INPUT_ID = 'dpAddNewDriverName';
  const STATUS_ID = 'dpAddNewDriverStatus';
  const STYLE_ID = 'dpAddNewDriverStyle';

  let profiles = [];
  let loading = false;
  let saving = false;

  function normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function profileKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
      .slice(0, 60);
  }

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null') || {};
    } catch {
      return {};
    }
  }

  function currentRole() {
    const user = currentUser();
    return normalizeRole(user.role || sessionStorage.getItem(ROLE_KEY));
  }

  function mayAddDriver() {
    const role = currentRole();
    return role === 'administrator'
      || role === 'admin'
      || role === 'geschaftsleitung'
      || role === 'geschaeftsleitung';
  }

  function maySeeDriverProfiles() {
    const role = currentRole();
    return mayAddDriver() || role === 'disposition';
  }

  function headers(extra = {}) {
    const result = new Headers(extra);
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', `Bearer ${token}`);
    return result;
  }

  function readLocalProfiles() {
    try {
      const value = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function normalizeProfiles(value) {
    const source = Array.isArray(value)
      ? value
      : (Array.isArray(value?.profiles) ? value.profiles : []);
    const found = new Map();

    source.forEach((entry) => {
      const name = String(entry?.name || entry?.displayName || '').trim();
      const profile = profileKey(entry?.profile || entry?.key || name);
      if (!name || !profile) return;
      found.set(profile, {
        profile,
        name: name.slice(0, 80),
        createdAt: String(entry?.createdAt || ''),
        createdBy: String(entry?.createdBy || '')
      });
    });

    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  function mergeProfiles(...lists) {
    const found = new Map();
    lists.flat().forEach((entry) => {
      const profile = profileKey(entry?.profile || entry?.name);
      const name = String(entry?.name || '').trim();
      if (!profile || !name) return;
      found.set(profile, { ...entry, profile, name });
    });
    return normalizeProfiles([...found.values()]);
  }

  async function loadRegistry() {
    if (loading || !maySeeDriverProfiles()) return profiles;
    loading = true;
    const local = normalizeProfiles(readLocalProfiles());

    try {
      const response = await fetch(`${API_BASE}/api/data/${encodeURIComponent(SERVER_REGISTRY_KEY)}`, {
        cache: 'no-store',
        headers: headers()
      });
      const wrapper = await response.json().catch(() => ({}));
      const remoteValue = Object.prototype.hasOwnProperty.call(wrapper, 'data') ? wrapper.data : wrapper;
      profiles = response.ok ? mergeProfiles(local, normalizeProfiles(remoteValue)) : local;
    } catch {
      profiles = local;
    } finally {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(profiles));
      loading = false;
    }

    refreshProfileOptions();
    return profiles;
  }

  async function saveRegistry(nextProfiles) {
    profiles = normalizeProfiles(nextProfiles);
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(profiles));

    const response = await fetch(`${API_BASE}/api/data/${encodeURIComponent(SERVER_REGISTRY_KEY)}`, {
      method: 'PUT',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ profiles, savedAt: new Date().toISOString() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Die Fahrerliste konnte nicht auf dem Server gespeichert werden.');
  }

  async function ensureEmptyPlan(profile, name) {
    const url = `${API_BASE}/api/data/${encodeURIComponent(`plan_${profile}`)}`;
    const currentResponse = await fetch(url, { cache: 'no-store', headers: headers() });
    if (currentResponse.ok) return;
    if (currentResponse.status !== 404) {
      const data = await currentResponse.json().catch(() => ({}));
      throw new Error(data.error || 'Der neue Fahrerplan konnte nicht geprüft werden.');
    }

    const now = new Date().toISOString();
    const emptyPlan = {
      profile,
      displayName: name,
      duties: [],
      vacations: [],
      vacationEntitlement: 30,
      bundeslaender: { ferien: ['NI'], feiertage: ['NI'] },
      hideSundays: false,
      shownMonths: ['2026-08'],
      startDate: '2026-08-01',
      savedAt: now
    };

    const saveResponse = await fetch(url, {
      method: 'PUT',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(emptyPlan)
    });
    const data = await saveResponse.json().catch(() => ({}));
    if (!saveResponse.ok) throw new Error(data.error || 'Der neue Fahrerplan konnte nicht angelegt werden.');
    localStorage.setItem(`lrz-plan-${profile}`, JSON.stringify(emptyPlan));
  }

  function optionExists(select, profile) {
    return [...select.options].some((option) => profileKey(option.value || option.textContent) === profile);
  }

  function addOption(select, entry) {
    if (!select || optionExists(select, entry.profile)) return;
    const option = document.createElement('option');
    option.value = entry.profile;
    option.textContent = entry.name;
    option.dataset.dpCustomDriver = '1';
    select.appendChild(option);
  }

  function refreshProfileOptions() {
    if (!maySeeDriverProfiles()) return;

    document.querySelectorAll('#kollegeSelect,#profileSelect').forEach((select) => {
      profiles.forEach((entry) => addOption(select, entry));
    });

    const assignmentList = document.getElementById('dpAssignDriversV2');
    if (assignmentList) {
      profiles.forEach((entry) => {
        const exists = [...assignmentList.options].some((option) => profileKey(option.value || option.label) === entry.profile);
        if (exists) return;
        const option = document.createElement('option');
        option.value = entry.profile;
        option.label = entry.name;
        option.dataset.dpCustomDriver = '1';
        assignmentList.appendChild(option);
      });
    }
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{border:1px solid #2563eb;background:#eff6ff;color:#1d4ed8}
      #${OVERLAY_ID}{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.68)}
      #${OVERLAY_ID}[hidden]{display:none!important}
      #${OVERLAY_ID} .dp-new-driver-dialog{width:min(520px,96vw);border:2px solid #2563eb;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.38);overflow:hidden}
      #${OVERLAY_ID} .dp-new-driver-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #dbeafe;background:#eff6ff}
      #${OVERLAY_ID} h2{margin:0 0 5px;color:#172554}
      #${OVERLAY_ID} .dp-new-driver-close{width:42px;height:42px;border:1px solid #93c5fd;border-radius:10px;background:#fff;color:#1d4ed8;font-size:24px;font-weight:900;cursor:pointer}
      #${OVERLAY_ID} .dp-new-driver-body{padding:20px}
      #${OVERLAY_ID} label{display:grid;gap:7px;color:#334155;font-size:13px;font-weight:900}
      #${INPUT_ID}{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font:inherit;background:#fff;color:#0f172a}
      #${STATUS_ID}{min-height:21px;margin-top:10px;font-size:13px;font-weight:850;color:#475569}
      #${STATUS_ID}.error{color:#b91c1c}
      #${STATUS_ID}.ok{color:#166534}
      #${OVERLAY_ID} .dp-new-driver-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:16px}
      #${OVERLAY_ID} .dp-new-driver-actions button{min-height:42px;border-radius:11px;padding:10px 15px;font:inherit;font-weight:900;cursor:pointer}
      #${OVERLAY_ID} .dp-new-driver-cancel{border:1px solid #cbd5e1;background:#fff;color:#0f172a}
      #${OVERLAY_ID} .dp-new-driver-save{border:1px solid #1d4ed8;background:#2563eb;color:#fff}
      @media(max-width:620px){#${OVERLAY_ID} .dp-new-driver-actions{display:grid}#${OVERLAY_ID} .dp-new-driver-actions button{width:100%}}
      @media print{#${BUTTON_ID},#${OVERLAY_ID}{display:none!important}}
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
      <div class="dp-new-driver-dialog" role="dialog" aria-modal="true" aria-labelledby="dpAddNewDriverTitle">
        <div class="dp-new-driver-head">
          <div><h2 id="dpAddNewDriverTitle">Neuen Fahrer hinzufügen</h2><div class="muted">Einen beliebigen Fahrernamen eingeben. Für den Fahrer wird ein eigener leerer Dienstplan angelegt.</div></div>
          <button type="button" class="dp-new-driver-close" aria-label="Fenster schließen">×</button>
        </div>
        <div class="dp-new-driver-body">
          <label>Fahrername<input id="${INPUT_ID}" type="text" maxlength="80" autocomplete="off" placeholder="z. B. Max Mustermann"></label>
          <div id="${STATUS_ID}" role="status" aria-live="polite"></div>
          <div class="dp-new-driver-actions">
            <button type="button" class="dp-new-driver-cancel">Abbrechen</button>
            <button type="button" class="dp-new-driver-save">Fahrer anlegen</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.dp-new-driver-close')?.addEventListener('click', closeDialog);
    overlay.querySelector('.dp-new-driver-cancel')?.addEventListener('click', closeDialog);
    overlay.querySelector('.dp-new-driver-save')?.addEventListener('click', createDriver);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeDialog();
    });
    overlay.querySelector(`#${INPUT_ID}`)?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        createDriver();
      }
    });
    return overlay;
  }

  function setStatus(text, kind = '') {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;
    status.textContent = text;
    status.className = kind;
  }

  function openDialog() {
    if (!mayAddDriver()) return;
    addStyle();
    const overlay = ensureOverlay();
    const input = overlay.querySelector(`#${INPUT_ID}`);
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setStatus('');
    if (input) {
      input.value = '';
      window.setTimeout(() => input.focus(), 30);
    }
  }

  function closeDialog() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  }

  async function createDriver() {
    if (!mayAddDriver() || saving) return;
    const input = document.getElementById(INPUT_ID);
    const name = String(input?.value || '').replace(/\s+/g, ' ').trim();
    const profile = profileKey(name);

    if (name.length < 2) {
      setStatus('Bitte einen Fahrernamen mit mindestens zwei Zeichen eingeben.', 'error');
      return;
    }
    if (!profile) {
      setStatus('Aus diesem Namen kann kein Fahrerprofil angelegt werden.', 'error');
      return;
    }

    await loadRegistry();
    const duplicate = profiles.find((entry) => entry.profile === profile || entry.name.localeCompare(name, 'de', { sensitivity: 'base' }) === 0);
    const existingSelect = [...document.querySelectorAll('#kollegeSelect option,#profileSelect option')]
      .some((option) => profileKey(option.value || option.textContent) === profile);
    if (duplicate || existingSelect) {
      setStatus(`Der Fahrer „${duplicate?.name || name}“ ist bereits vorhanden.`, 'error');
      return;
    }

    saving = true;
    setStatus('Fahrerprofil und leerer Dienstplan werden angelegt …');
    const saveButton = document.querySelector(`#${OVERLAY_ID} .dp-new-driver-save`);
    if (saveButton) saveButton.disabled = true;

    try {
      await ensureEmptyPlan(profile, name);
      const user = currentUser();
      const entry = {
        profile,
        name,
        createdAt: new Date().toISOString(),
        createdBy: String(user.displayName || user.username || 'DienstPilot')
      };
      await saveRegistry([...profiles, entry]);
      refreshProfileOptions();
      localStorage.setItem(ACTIVE_DRIVER_KEY, profile);

      const select = document.getElementById('kollegeSelect') || document.getElementById('profileSelect');
      if (select) select.value = profile;
      setStatus(`Fahrer „${name}“ wurde angelegt. Der leere Fahrerplan wird geöffnet.`, 'ok');

      window.setTimeout(() => {
        closeDialog();
        const loadButton = document.getElementById('loadKollege') || document.getElementById('loadSelectedProfile');
        if (loadButton && select) loadButton.click();
        else window.location.reload();
      }, 650);
    } catch (error) {
      setStatus(error.message || 'Der Fahrer konnte nicht angelegt werden.', 'error');
    } finally {
      saving = false;
      if (saveButton) saveButton.disabled = false;
    }
  }

  function findProfileGroup() {
    const select = document.getElementById('kollegeSelect') || document.getElementById('profileSelect');
    if (select) return select.closest('.toolbar-group,.dp-ui-profile,.kollegen-panel') || select.parentElement;

    return [...document.querySelectorAll('#tab-eingabe .toolbar-group,#tab-eingabe .dp-ui-profile')]
      .find((group) => /kollege|fahrer und vorlage|runke laden/i.test(String(group.textContent || ''))) || null;
  }

  function ensureButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (!mayAddDriver()) {
      existing?.remove();
      return false;
    }

    addStyle();
    const group = findProfileGroup();
    if (!group) return false;
    let button = existing;
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.className = 'btn-secondary';
      button.textContent = '＋ Neuen Fahrer hinzufügen';
      button.title = 'Ein neues Fahrerprofil mit eigenem Dienstplan anlegen';
      button.addEventListener('click', openDialog);
      group.appendChild(button);
    } else if (button.parentElement !== group) {
      group.appendChild(button);
    }
    return true;
  }

  function refresh() {
    refreshProfileOptions();
    ensureButton();
  }

  function scheduleRefresh() {
    [0, 120, 350, 800, 1600].forEach((delay) => window.setTimeout(refresh, delay));
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.getElementById(OVERLAY_ID)?.hidden) closeDialog();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="eingabe"],#loadRunke,#loadKollege,#loadSelectedProfile,#dpAssignLoadV2')) {
      scheduleRefresh();
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'kollegeSelect' || event.target?.id === 'profileSelect') scheduleRefresh();
  }, true);

  const start = () => {
    addStyle();
    loadRegistry().finally(scheduleRefresh);
    const observer = new MutationObserver(() => {
      refreshProfileOptions();
      ensureButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', scheduleRefresh);
  window.addEventListener('focus', scheduleRefresh);
})();
(() => {
  'use strict';

  if (window.__dienstpilotAssignmentFreeOptionV1) return;
  window.__dienstpilotAssignmentFreeOptionV1 = true;

  const API = 'https://api.dienstpilot-runke.de';
  const TOKEN_KEY = 'dienstpilot_api_token';
  const USER_KEY = 'dienstpilot_user';

  function normalize(value) {
    return String(value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_');
  }

  function resolveProfile(value) {
    const normalized = normalize(value);
    const match = normalized.match(/^[a-z]_([a-z0-9_-]+)$/);
    if (!match) return normalized;
    const surname = match[1];
    const exists = [...document.querySelectorAll('#kollegeSelect option')]
      .some((option) => normalize(option.value || option.textContent) === surname);
    return exists ? surname : normalized;
  }

  function headers(extra) {
    const result = new Headers(extra || {});
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (token) result.set('Authorization', 'Bearer ' + token);
    return result;
  }

  function userName() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
      return user?.displayName || user?.username || 'DienstPilot';
    } catch {
      return 'DienstPilot';
    }
  }

  function setStatus(text, ok = true) {
    const node = document.querySelector('#dpDutyAssignmentV2 .dp-a-status');
    if (!node) return;
    node.textContent = text;
    node.className = `dp-a-status ${ok ? 'ok' : 'error'}`;
  }

  function installOption() {
    const list = document.getElementById('dpAssignDutiesV2');
    if (!list || list.querySelector('option[value="Frei"]')) return;
    const option = document.createElement('option');
    option.value = 'Frei';
    option.label = 'Frei';
    list.insertBefore(option, list.firstChild);
  }

  function syncFreeFields() {
    const duty = document.getElementById('dpAssignDutyV2');
    const start = document.getElementById('dpAssignStartV2');
    const end = document.getElementById('dpAssignEndV2');
    if (!duty || !start || !end) return;
    const isFree = duty.value.trim().toLowerCase() === 'frei';
    if (isFree) {
      start.value = '';
      end.value = '';
    }
    start.disabled = isFree;
    end.disabled = isFree;
    start.title = isFree ? 'Bei Frei ist keine Beginnzeit erforderlich.' : '';
    end.title = isFree ? 'Bei Frei ist keine Endzeit erforderlich.' : '';
  }

  async function assignFree() {
    const driverInput = document.getElementById('dpAssignDriverV2');
    const dateInput = document.getElementById('dpAssignDateV2');
    const dutyInput = document.getElementById('dpAssignDutyV2');
    const target = resolveProfile(driverInput?.value);
    const date = dateInput?.value || '';

    if (!target || !date) throw new Error('Fahrer und Datum müssen ausgewählt sein.');

    const url = API + '/api/data/' + encodeURIComponent('plan_' + target);
    const response = await fetch(url, { cache: 'no-store', headers: headers() });
    const wrapper = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 404) {
      throw new Error(wrapper.error || 'Fahrerplan konnte nicht geladen werden.');
    }

    const plan = response.status === 404
      ? { duties: [] }
      : (Object.prototype.hasOwnProperty.call(wrapper, 'data') ? (wrapper.data || {}) : wrapper);
    const duties = Array.isArray(plan.duties) ? plan.duties : [];
    const existing = duties.find((entry) => entry?.date === date);
    if (existing && !window.confirm(`Am ${date.split('-').reverse().join('.')} ist bereits ${existing.number || 'ein Eintrag'} gespeichert. Soll er durch Frei ersetzt werden?`)) return;

    const now = new Date().toISOString();
    const by = userName();
    const next = duties.filter((entry) => entry?.date !== date);
    next.push({
      id: `free-${target}-${date}-${Date.now()}`,
      date,
      number: 'Frei',
      start: '',
      end: '',
      type: 'frei',
      assignedBy: by,
      assignedAt: now,
      assignment: { assignedBy: by, assignedAt: now }
    });

    const put = await fetch(url, {
      method: 'PUT',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...plan, duties: next, savedAt: now, assignedBy: by })
    });
    const result = await put.json().catch(() => ({}));
    if (!put.ok) throw new Error(result.error || 'Frei konnte nicht gespeichert werden.');

    localStorage.setItem('lrz-plan-' + target, JSON.stringify({ ...plan, duties: next, savedAt: now, assignedBy: by }));
    dutyInput.value = '';
    syncFreeFields();
    setStatus(`Frei wurde für ${date.split('-').reverse().join('.')} gespeichert.`);
    window.setTimeout(() => window.location.reload(), 300);
  }

  document.addEventListener('input', (event) => {
    if (event.target?.id === 'dpAssignDutyV2') syncFreeFields();
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpAssignDutyV2') syncFreeFields();
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('#dpAssignSaveV2');
    if (!button) return;
    const value = document.getElementById('dpAssignDutyV2')?.value.trim().toLowerCase();
    if (value !== 'frei') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    assignFree().catch((error) => setStatus(error.message || 'Frei konnte nicht gespeichert werden.', false));
  }, true);

  const observer = new MutationObserver(() => {
    installOption();
    syncFreeFields();
  });

  function install() {
    installOption();
    syncFreeFields();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
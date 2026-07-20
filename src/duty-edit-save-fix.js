(() => {
  'use strict';

  if (window.__dienstpilotDutyEditSaveFixV3) return;
  window.__dienstpilotDutyEditSaveFixV3 = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const STATE_KEY = 'lenkRuhezeitenRunke20260413';
  const ALLOWED_ROLES = new Set(['administrator', 'geschaftsleitung', 'geschaeftsleitung', 'disposition']);
  let saveTimer = null;
  let saving = false;

  function normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '');
  }

  function mayEdit() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
      return ALLOWED_ROLES.has(normalizeRole(user?.role || sessionStorage.getItem(ROLE_KEY)));
    } catch {
      return ALLOWED_ROLES.has(normalizeRole(sessionStorage.getItem(ROLE_KEY)));
    }
  }

  function activeProfile() {
    try {
      const state = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
      const profile = state?.appSettings?.activeProfile;
      if (profile) return String(profile).trim().toLowerCase();
    } catch {
      // Fallback auf sichtbaren Synchronisationsstatus.
    }

    const text = document.getElementById('syncStatus')?.textContent || '';
    const match = text.match(/Aktiv:\s*([^·]+)/i);
    return match ? match[1].trim().toLowerCase() : '';
  }

  function setStatus(text, state) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const profile = activeProfile();
    const name = profile ? profile.charAt(0).toUpperCase() + profile.slice(1) : '';
    el.textContent = name ? `Aktiv: ${name} · ${text}` : text;
    el.className = `sync-status ${state || ''}`.trim();
  }

  async function persistChange(change) {
    if (saving || !mayEdit()) return;
    const profile = activeProfile();
    if (!profile) {
      setStatus('kein Fahrerplan geladen', 'offline');
      return;
    }

    saving = true;
    setStatus('speichere…', 'saving');

    try {
      const url = `/api/plan/${encodeURIComponent(profile)}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Plan konnte nicht geladen werden (${response.status})`);

      const plan = await response.json();
      const duties = Array.isArray(plan?.duties) ? plan.duties : [];
      let found = false;

      const nextDuties = duties.map((entry) => {
        if (String(entry?.id) !== String(change.id)) return entry;
        found = true;
        return { ...entry, [change.field]: change.value };
      });

      if (!found) throw new Error('Der bearbeitete Dienst wurde im Serverplan nicht gefunden.');

      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...plan,
          duties: nextDuties,
          savedAt: new Date().toISOString()
        })
      });

      if (!put.ok) throw new Error(`Änderung konnte nicht gespeichert werden (${put.status})`);

      setStatus('synchronisiert', 'synced');
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      console.error('Dienständerung konnte nicht gespeichert werden:', error);
      setStatus('Speichern fehlgeschlagen', 'offline');
      window.alert(error.message || 'Die Änderung konnte nicht gespeichert werden.');
    } finally {
      saving = false;
    }
  }

  function queueField(input) {
    if (!mayEdit()) return;
    const card = input.closest('[data-duty]');
    const id = card?.dataset?.duty;
    const field = input.dataset.field;
    if (!id || !['date', 'number', 'start', 'end'].includes(field)) return;

    const value = field === 'number'
      ? String(input.value || '').replace(/\D/g, '').slice(0, 4)
      : String(input.value || '');

    if (field === 'number') input.value = value;
    if (!value) return;

    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      persistChange({ id, field, value });
    }, field === 'number' ? 50 : 350);
  }

  // Dienstnummer: alten Katalog-Change-Handler nicht mehr bis zur Bubble-Phase
  // durchlassen, weil er die gerade eingegebene Nummer erneut überschreibt.
  document.addEventListener('change', (event) => {
    const input = event.target?.closest?.('[data-duty] [data-field]');
    if (!input) return;
    if (input.dataset.field === 'number') {
      event.stopPropagation();
      queueField(input);
      return;
    }
    queueField(input);
  }, true);

  document.addEventListener('blur', (event) => {
    const input = event.target?.closest?.('[data-duty] [data-field="number"]');
    if (input) queueField(input);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const input = event.target?.closest?.('[data-duty] [data-field]');
    if (!input) return;
    event.preventDefault();
    if (input.dataset.field === 'number') event.stopPropagation();
    queueField(input);
  }, true);
})();
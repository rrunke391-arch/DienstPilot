(() => {
  'use strict';

  if (window.__dienstpilotDutyEditSaveFixV1) return;
  window.__dienstpilotDutyEditSaveFixV1 = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const ALLOWED_ROLES = new Set(['administrator', 'geschaftsleitung', 'geschaeftsleitung', 'disposition']);

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

  function saveField(input) {
    if (!mayEdit()) return;

    const card = input.closest('[data-duty]');
    const id = card?.dataset?.duty;
    const field = input.dataset.field;
    if (!id || !field || !['date', 'number', 'start', 'end'].includes(field)) return;

    try {
      const value = field === 'number'
        ? String(input.value || '').replace(/\D/g, '').slice(0, 4)
        : String(input.value || '');

      duties = duties.map((entry) => {
        if (String(entry.id) !== String(id)) return entry;
        return { ...entry, [field]: value };
      });

      // renderAll speichert lokal und stößt über saveLocalState den Server-PUT an.
      renderAll();
    } catch (error) {
      console.error('Dienständerung konnte nicht gespeichert werden:', error);
    }
  }

  document.addEventListener('change', (event) => {
    const input = event.target?.closest?.('[data-duty] [data-field]');
    if (input) saveField(input);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const input = event.target?.closest?.('[data-duty] [data-field]');
    if (!input) return;
    event.preventDefault();
    saveField(input);
  }, true);
})();
(() => {
  'use strict';

  if (window.__dienstpilotDutyEditPermissionFixV1) return;
  window.__dienstpilotDutyEditPermissionFixV1 = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';

  function normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '');
  }

  function currentRole() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
      return normalizeRole(user?.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalizeRole(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function mayEdit() {
    return ['administrator', 'geschaftsleitung', 'geschaeftsleitung', 'disposition'].includes(currentRole());
  }

  function unlockDutyFields() {
    if (!mayEdit()) return;

    document.querySelectorAll('[data-duty] [data-field]').forEach((field) => {
      field.disabled = false;
      field.readOnly = false;
      field.removeAttribute('disabled');
      field.removeAttribute('readonly');
      field.removeAttribute('aria-disabled');
      field.style.pointerEvents = 'auto';
      field.style.userSelect = 'auto';
    });

    document.querySelectorAll('[data-duty]').forEach((card) => {
      card.style.pointerEvents = 'auto';
      card.querySelectorAll('input, select, textarea, button').forEach((element) => {
        if (!element.classList.contains('driver-readonly')) {
          element.style.pointerEvents = 'auto';
        }
      });
    });
  }

  const observer = new MutationObserver(() => unlockDutyFields());

  function install() {
    unlockDutyFields();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'readonly', 'class', 'style'] });
    [100, 300, 700, 1500, 3000].forEach((delay) => setTimeout(unlockDutyFields, delay));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.tab, #loadKollege, #loadRunke, .week-group, [data-day]')) {
      [0, 100, 300].forEach((delay) => setTimeout(unlockDutyFields, delay));
    }
  }, true);
})();
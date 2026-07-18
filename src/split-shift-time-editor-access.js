(() => {
  'use strict';

  if (window.__dienstpilotSplitShiftTimeEditorAccessV1) return;
  window.__dienstpilotSplitShiftTimeEditorAccessV1 = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const BODY_CLASS = 'dp-split-time-edit-restricted';
  const STYLE_ID = 'dpSplitShiftTimeEditorAccessStyle';
  const EDITOR_SELECTOR = '#dpStableSplitShiftPanel .dp-split-time-editor';

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

  function mayEditTimes() {
    const role = currentRole();
    return role === 'administrator'
      || role === 'admin'
      || role === 'geschaftsleitung'
      || role === 'geschaeftsleitung';
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.${BODY_CLASS} ${EDITOR_SELECTOR}{display:none!important;visibility:hidden!important;pointer-events:none!important}
    `;
    document.head.appendChild(style);
  }

  function applyAccess() {
    addStyle();
    if (!document.body) return;
    const allowed = mayEditTimes();
    document.body.classList.toggle(BODY_CLASS, !allowed);
    document.querySelectorAll(`${EDITOR_SELECTOR} input,${EDITOR_SELECTOR} button`).forEach((control) => {
      control.disabled = !allowed;
      control.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    });
  }

  function blockUnauthorizedEdit(event) {
    if (mayEditTimes()) return;
    const target = event.target.closest?.(`${EDITOR_SELECTOR},[data-save-split-times]`);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  document.addEventListener('click', blockUnauthorizedEdit, true);
  document.addEventListener('input', blockUnauthorizedEdit, true);
  document.addEventListener('change', blockUnauthorizedEdit, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#dpSignoutButton,#dpDailyDutyPlanTab,.tab')) {
      [0, 120, 400, 900].forEach((delay) => window.setTimeout(applyAccess, delay));
    }
  }, true);

  const start = () => {
    applyAccess();
    const observer = new MutationObserver(() => applyAccess());
    observer.observe(document.body, { childList: true, subtree: true });
    [150, 500, 1200, 2500].forEach((delay) => window.setTimeout(applyAccess, delay));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', applyAccess);
  window.addEventListener('focus', applyAccess);
})();
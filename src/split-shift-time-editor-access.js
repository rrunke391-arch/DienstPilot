(() => {
  'use strict';

  if (window.__dienstpilotDutyTimeEditorAccessV3) return;
  window.__dienstpilotDutyTimeEditorAccessV3 = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const BODY_CLASS = 'dp-duty-time-edit-restricted';
  const STYLE_ID = 'dpDutyTimeEditorAccessStyleV3';
  const SPLIT_EDITOR_SELECTOR = '#dpStableSplitShiftPanel .dp-split-time-editor';
  const DAILY_TIME_SELECTOR = '#dpDailyPlanRows input[data-field="start"],#dpDailyPlanRows input[data-field="end"],#dpDailyPlanRows input[data-field="departure"]';
  const LOCK_MARKER = 'dpTimeAccessLocked';
  const LOCK_TITLE = 'Beginn, Ende und Abfahrt 1. Haltestelle können nur Administrator und Geschäftsleitung bearbeiten.';

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
      body.${BODY_CLASS} ${SPLIT_EDITOR_SELECTOR}{display:none!important;visibility:hidden!important;pointer-events:none!important}
      body.${BODY_CLASS} ${DAILY_TIME_SELECTOR}{background:#f1f5f9!important;color:#475569!important;cursor:not-allowed!important;border-color:#cbd5e1!important}
    `;
    document.head.appendChild(style);
  }

  function lockControl(control, locked) {
    if (!control) return;
    if (locked) {
      if (control.dataset[LOCK_MARKER] !== '1') {
        control.dataset[LOCK_MARKER] = '1';
        control.disabled = true;
        control.setAttribute('aria-disabled', 'true');
        control.title = LOCK_TITLE;
      }
      return;
    }

    if (control.dataset[LOCK_MARKER] === '1') {
      delete control.dataset[LOCK_MARKER];
      control.disabled = false;
      control.removeAttribute('aria-disabled');
      if (control.title === LOCK_TITLE || control.title === 'Beginn und Ende können nur Administrator und Geschäftsleitung bearbeiten.') control.removeAttribute('title');
    }
  }

  function applyAccess() {
    addStyle();
    if (!document.body) return;
    const allowed = mayEditTimes();
    document.body.classList.toggle(BODY_CLASS, !allowed);

    document.querySelectorAll(DAILY_TIME_SELECTOR).forEach((control) => lockControl(control, !allowed));
    document.querySelectorAll(`${SPLIT_EDITOR_SELECTOR} input,${SPLIT_EDITOR_SELECTOR} button`).forEach((control) => lockControl(control, !allowed));
  }

  function blockUnauthorizedEdit(event) {
    if (mayEditTimes()) return;
    const target = event.target.closest?.(`${DAILY_TIME_SELECTOR},${SPLIT_EDITOR_SELECTOR},[data-save-split-times]`);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  document.addEventListener('click', blockUnauthorizedEdit, true);
  document.addEventListener('input', blockUnauthorizedEdit, true);
  document.addEventListener('change', blockUnauthorizedEdit, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#dpSignoutButton,#dpDailyDutyPlanTab,#dpDailyInsertDefaults,#dpDailyAddRow,#dpDailySave,.tab')) {
      [0, 80, 220, 600, 1200].forEach((delay) => window.setTimeout(applyAccess, delay));
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'dpDailyPlanDate' || event.target?.matches?.('#dpDailyPlanRows input[data-field="duty"]')) {
      [0, 80, 250, 700].forEach((delay) => window.setTimeout(applyAccess, delay));
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
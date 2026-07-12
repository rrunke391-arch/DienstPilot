(() => {
  'use strict';

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const TAB_ID = 'dpDailyDutyPlanTab';
  const SECTION_ID = 'tab-daily-duty-plan';
  const STYLE_ID = 'dpDailyDutyRoleAccessStyle';
  const DENIED_CLASS = 'dp-daily-duty-denied';

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function currentRole() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
      return normalize(user?.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalize(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function hasAccess() {
    const role = currentRole();
    return role === 'geschaftsleitung'
      || role === 'geschaeftsleitung'
      || role === 'disposition';
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.${DENIED_CLASS} #${TAB_ID},
      body.${DENIED_CLASS} #${SECTION_ID} {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function openOverview() {
    const overview = document.querySelector('.tab[data-tab="eingabe"]');
    if (overview) overview.click();
  }

  function closeDeniedSection(section) {
    if (!section) return;
    section.classList.add('hidden');
    section.setAttribute('aria-hidden', 'true');
    section.hidden = true;
    section.style.setProperty('display', 'none', 'important');
    section.style.setProperty('visibility', 'hidden', 'important');
    section.querySelectorAll('button,input,select,textarea,a').forEach((control) => {
      if ('disabled' in control) control.disabled = true;
      control.tabIndex = -1;
    });
  }

  function openAllowedSection(section) {
    if (!section) return;
    section.hidden = false;
    section.removeAttribute('aria-hidden');
    section.style.removeProperty('display');
    section.style.removeProperty('visibility');
    section.querySelectorAll('button,input,select,textarea,a').forEach((control) => {
      if ('disabled' in control) control.disabled = false;
      control.removeAttribute('tabindex');
    });
  }

  function applyAccess() {
    addStyle();
    const allowed = hasAccess();
    const tab = document.getElementById(TAB_ID);
    const section = document.getElementById(SECTION_ID);

    document.body.classList.toggle(DENIED_CLASS, !allowed);

    if (tab) {
      tab.hidden = !allowed;
      tab.setAttribute('aria-hidden', allowed ? 'false' : 'true');
      tab.tabIndex = allowed ? 0 : -1;
      tab.disabled = !allowed;
      if (allowed) {
        tab.style.removeProperty('display');
        tab.style.removeProperty('visibility');
      } else {
        tab.classList.remove('active');
        tab.style.setProperty('display', 'none', 'important');
        tab.style.setProperty('visibility', 'hidden', 'important');
      }
    }

    if (allowed) openAllowedSection(section);
    else closeDeniedSection(section);

    if (!allowed && (tab?.classList.contains('active') || !document.getElementById('tab-eingabe')?.classList.contains('hidden'))) {
      openOverview();
    }
    return allowed;
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.(`#${TAB_ID},#${SECTION_ID}`);
    if (!target || hasAccess()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    applyAccess();
    openOverview();
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#dpSignoutButton,.tab')) {
      [0, 120, 400, 900].forEach((delay) => window.setTimeout(applyAccess, delay));
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAccess, { once: true });
  } else {
    applyAccess();
  }

  [100, 350, 900, 1800].forEach((delay) => window.setTimeout(applyAccess, delay));
  window.addEventListener('pageshow', applyAccess);
  window.addEventListener('focus', applyAccess);
})();
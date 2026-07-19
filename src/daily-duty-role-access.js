(() => {
  'use strict';

  if (!document.getElementById('dpStabilityNormalizationV1')) {
    const script = document.createElement('script');
    script.id = 'dpStabilityNormalizationV1';
    script.src = 'src/stability-normalization.js?v=20260719-1';
    script.async = false;
    document.head.appendChild(script);
  }

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
    return role === 'administrator'
      || role === 'admin'
      || role === 'geschaftsleitung'
      || role === 'geschaeftsleitung'
      || role === 'disposition'
      || role === 'disponent'
      || role === 'disponentin';
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
    if (overview && !overview.classList.contains('active')) overview.click();
  }

  function deny(tab, section) {
    if (tab) {
      tab.hidden = true;
      tab.disabled = true;
      tab.tabIndex = -1;
      tab.classList.remove('active');
      tab.setAttribute('aria-hidden', 'true');
      tab.style.setProperty('display', 'none', 'important');
      tab.style.setProperty('visibility', 'hidden', 'important');
    }
    if (section) {
      section.hidden = true;
      section.classList.add('hidden');
      section.setAttribute('aria-hidden', 'true');
      section.style.setProperty('display', 'none', 'important');
      section.style.setProperty('visibility', 'hidden', 'important');
    }
  }

  function allow(tab, section) {
    if (tab) {
      tab.hidden = false;
      tab.disabled = false;
      tab.tabIndex = 0;
      tab.removeAttribute('aria-hidden');
      tab.style.removeProperty('display');
      tab.style.removeProperty('visibility');
    }
    if (section) {
      section.hidden = false;
      section.removeAttribute('aria-hidden');
      section.style.removeProperty('visibility');
      if (section.classList.contains('hidden')) section.style.removeProperty('display');
    }
  }

  function applyAccess() {
    addStyle();
    const allowed = hasAccess();
    const tab = document.getElementById(TAB_ID);
    const section = document.getElementById(SECTION_ID);
    const deniedWasActive = Boolean(tab?.classList.contains('active'))
      || Boolean(section && !section.classList.contains('hidden') && !section.hidden);

    document.body.classList.toggle(DENIED_CLASS, !allowed);
    if (allowed) allow(tab, section);
    else {
      deny(tab, section);
      if (deniedWasActive) openOverview();
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
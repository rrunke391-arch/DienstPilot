(() => {
  'use strict';

  const STYLE_ID = 'dpDriverVacationAccessStyle';
  const BACK_ID = 'dpDriverVacationBack';
  const OPEN_CLASS = 'dp-driver-vacation-open';
  const ACTIVE_TAB_KEY = 'lrz-active-tab';

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem('dienstpilot_user') || 'null');
    } catch {
      return null;
    }
  }

  function isDriver() {
    return readUser()?.role === 'Fahrer';
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.${OPEN_CLASS} main > section {
        display: none !important;
      }
      body.${OPEN_CLASS} #tab-einstellungen {
        display: block !important;
      }
      body.${OPEN_CLASS} #tab-einstellungen > .card:not(.vacation-section),
      body.${OPEN_CLASS} #tab-einstellungen .user-admin-card,
      body.${OPEN_CLASS} #tab-einstellungen [id^="dpUserAdmin"] {
        display: none !important;
      }
      body.${OPEN_CLASS} #tab-einstellungen .vacation-section {
        display: block !important;
        margin-top: 0 !important;
      }
      body.${OPEN_CLASS} #tab-einstellungen .vacation-content,
      body.${OPEN_CLASS} #tab-einstellungen #vacationContent {
        display: block !important;
      }
      body.${OPEN_CLASS} #tab-einstellungen #vacationNoProfile {
        display: none !important;
      }
      #${BACK_ID} {
        display: none;
        margin: 0 0 16px;
      }
      body.${OPEN_CLASS} #${BACK_ID} {
        display: inline-flex !important;
      }
    `;
    document.head.appendChild(style);
  }

  function closeDriverVacation() {
    document.body.classList.remove(OPEN_CLASS);

    const overviewSection = document.getElementById('tab-eingabe');
    const settingsSection = document.getElementById('tab-einstellungen');
    const overviewTab = document.querySelector('.tab[data-tab="eingabe"]');

    document.querySelectorAll('main > section[id^="tab-"]').forEach((section) => {
      const isOverview = section === overviewSection;
      section.classList.toggle('hidden', !isOverview);
      section.style.removeProperty('display');
      if (isOverview) section.removeAttribute('hidden');
    });

    if (overviewSection) {
      overviewSection.classList.remove('hidden');
      overviewSection.removeAttribute('hidden');
      overviewSection.style.display = '';
    }
    if (settingsSection) {
      settingsSection.classList.add('hidden');
      settingsSection.style.display = '';
    }

    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    overviewTab?.classList.add('active');

    try {
      localStorage.setItem(ACTIVE_TAB_KEY, 'eingabe');
    } catch {}

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function ensureBackButton() {
    const section = document.querySelector('#tab-einstellungen .vacation-section');
    if (!section) return null;
    let button = document.getElementById(BACK_ID);
    if (button) return button;

    button = document.createElement('button');
    button.type = 'button';
    button.id = BACK_ID;
    button.className = 'btn-secondary';
    button.textContent = '← Zur Übersicht';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeDriverVacation();
    });
    section.insertBefore(button, section.firstChild);
    return button;
  }

  async function openDriverVacation() {
    addStyles();
    ensureBackButton();
    document.body.classList.add(OPEN_CLASS);

    const settings = document.getElementById('tab-einstellungen');
    const section = settings?.querySelector('.vacation-section');
    const content = document.getElementById('vacationContent');

    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    settings?.classList.remove('hidden');
    settings?.removeAttribute('hidden');
    section?.classList.remove('hidden');
    section?.removeAttribute('hidden');
    content?.classList.remove('hidden');
    content?.removeAttribute('hidden');

    try {
      await window.dienstpilotVacationPersistence?.load?.();
    } catch (error) {
      console.warn('Urlaub konnte beim Öffnen nicht neu geladen werden:', error);
    }

    try {
      if (typeof renderVacationSection === 'function') renderVacationSection();
    } catch {}

    window.setTimeout(() => {
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('vacationAddBtn')?.focus({ preventScroll: true });
    }, 50);
  }

  function matchesVacationButton(target) {
    const button = target?.closest?.('button');
    if (!button) return false;
    if (button.id === 'openJahresurlaubFix') return true;
    return /jahresurlaub/i.test(String(button.textContent || ''));
  }

  function install() {
    addStyles();
    ensureBackButton();

    document.addEventListener('click', (event) => {
      if (!isDriver()) return;

      const overviewTab = event.target.closest?.('.tab[data-tab="eingabe"]');
      if (overviewTab && document.body.classList.contains(OPEN_CLASS)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeDriverVacation();
        return;
      }

      if (!matchesVacationButton(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      void openDriverVacation();
    }, true);

    window.setTimeout(ensureBackButton, 500);
    window.setTimeout(ensureBackButton, 1500);
  }

  window.dienstpilotCloseDriverVacation = closeDriverVacation;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
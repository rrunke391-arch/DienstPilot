(() => {
  'use strict';

  function user() {
    try { return JSON.parse(sessionStorage.getItem('dienstpilot_user') || 'null'); }
    catch { return null; }
  }

  function isDriver() {
    const u = user();
    return u && u.role === 'Fahrer';
  }

  function css() {
    if (document.getElementById('dpDriverReadonlyStyle')) return;
    const s = document.createElement('style');
    s.id = 'dpDriverReadonlyStyle';
    s.textContent = `
      body.role-fahrer .tab[data-tab="statistik"],
      body.role-fahrer .tab[data-tab="einstellungen"],
      body.role-fahrer .tab[data-tab="auswertung"],
      body.role-fahrer .tab[data-tab="tests"],
      body.role-fahrer #loadRunke,
      body.role-fahrer #loadLady,
      body.role-fahrer #clearDuties,
      body.role-fahrer .toolbar-pick,
      body.role-fahrer .toolbar-toggle,
      body.role-fahrer #tab-eingabe button:not(#printDutyPlan),
      body.role-fahrer #tab-eingabe select,
      body.role-fahrer #tab-eingabe [data-profile],
      body.role-fahrer #tab-eingabe [data-driver],
      body.role-fahrer #tab-eingabe [data-kollege],
      body.role-fahrer .delete-duty,
      body.role-fahrer .convert-to-duty,
      body.role-fahrer .refresh-from-catalog,
      body.role-fahrer .open-catalog-link,
      body.role-fahrer .catalog-settings,
      body.role-fahrer .catalog-card-review,
      body.role-fahrer .delete-template,
      body.role-fahrer .cat-review-note-edit {
        display: none !important;
      }
      body.role-fahrer #tab-eingabe input,
      body.role-fahrer #tab-eingabe textarea,
      body.role-fahrer #tab-katalog input,
      body.role-fahrer #tab-katalog select,
      body.role-fahrer #tab-katalog textarea {
        pointer-events: none !important;
        background: #f8fafc !important;
        color: #475569 !important;
      }
    `;
    document.head.appendChild(s);
  }

  function apply() {
    document.body.classList.toggle('role-fahrer', isDriver());
    if (!isDriver()) return;

    const forbiddenActive = document.querySelector('.tab.active[data-tab="statistik"], .tab.active[data-tab="einstellungen"], .tab.active[data-tab="auswertung"], .tab.active[data-tab="tests"]');
    if (forbiddenActive) document.querySelector('.tab[data-tab="eingabe"]')?.click();

    document.querySelectorAll('#tab-eingabe button:not(#printDutyPlan), #tab-eingabe select, #loadRunke, #loadLady, #clearDuties, .delete-duty, .convert-to-duty, .refresh-from-catalog, .open-catalog-link, .delete-template, .review-btn, .cat-review-note-edit').forEach(el => {
      el.style.display = 'none';
      if ('disabled' in el) el.disabled = true;
    });

    document.querySelectorAll('#tab-eingabe input, #tab-eingabe textarea, #tab-katalog input, #tab-katalog select, #tab-katalog textarea').forEach(el => {
      if ('readOnly' in el) el.readOnly = true;
      if ('disabled' in el) el.disabled = true;
    });
  }

  function allowed(target) {
    return target.closest('#printDutyPlan, #dpSignoutButton, .tab[data-tab="eingabe"], .tab[data-tab="katalog"], summary, .duty-timeline, .show-catalog-details, .tl-modal-close');
  }

  function install() {
    css();
    apply();
    document.addEventListener('click', e => {
      if (!isDriver()) return;
      if (!e.target.closest('.app')) return;
      if (allowed(e.target)) return;
      if (!e.target.closest('button,a,input,select,textarea,label,[role="button"]')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      apply();
    }, true);
    document.addEventListener('change', e => {
      if (!isDriver()) return;
      if (!e.target.closest('.app')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      apply();
    }, true);
    new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

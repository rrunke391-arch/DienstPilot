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
      body.role-fahrer #loadKollege,
      body.role-fahrer #reloadKollegeTemplate,
      body.role-fahrer #kollegeSelect,
      body.role-fahrer .kollegen-panel,
      body.role-fahrer #clearDuties,
      body.role-fahrer .toolbar-toggle,
      body.role-fahrer #uploadDienstkarteCatalog,
      body.role-fahrer #dienstkarteFilesCatalog,
      body.role-fahrer #uploadStatusCatalog,
      body.role-fahrer .open-catalog-link,
      body.role-fahrer .catalog-settings,
      body.role-fahrer .catalog-card-review,
      body.role-fahrer .delete-template,
      body.role-fahrer .cat-review-note-edit {
        display: none !important;
      }

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

    document.querySelectorAll('#loadRunke,#loadLady,#loadKollege,#reloadKollegeTemplate,#kollegeSelect,.kollegen-panel,#clearDuties,#uploadDienstkarteCatalog,.open-catalog-link,.delete-template,.review-btn,.cat-review-note-edit,.catalog-settings,.catalog-card-review').forEach(el => {
      el.style.display = 'none';
      if ('disabled' in el) el.disabled = true;
    });

    document.querySelectorAll('#tab-katalog input,#tab-katalog select,#tab-katalog textarea').forEach(el => {
      if ('readOnly' in el) el.readOnly = true;
      if ('disabled' in el) el.disabled = true;
    });
  }

  function shouldBlock(target) {
    return target.closest('#loadRunke,#loadLady,#loadKollege,#reloadKollegeTemplate,#kollegeSelect,.kollegen-panel,#clearDuties,#uploadDienstkarteCatalog,.tab[data-tab="statistik"],.tab[data-tab="einstellungen"],.tab[data-tab="auswertung"],.tab[data-tab="tests"],.open-catalog-link,.delete-template,.review-btn,.cat-review-note-edit,.catalog-settings');
  }

  function install() {
    css();
    apply();

    document.addEventListener('click', e => {
      if (!isDriver()) return;
      if (!e.target.closest('.app')) return;
      if (!shouldBlock(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      apply();
    }, true);

    document.addEventListener('change', e => {
      if (!isDriver()) return;
      if (!e.target.closest('#kollegeSelect,.catalog-card,#blSettingsBody')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      apply();
    }, true);

    new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

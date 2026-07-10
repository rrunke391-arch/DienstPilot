(() => {
  'use strict';

  const USER_KEY = 'dienstpilot_user';
  const ACTIVE_TAB_KEY = 'lrz-active-tab';
  const INSTALL_MARK = 'dienstpilotCatalogRestoreInstalled';
  const REVIEW_STYLE_ID = 'dienstpilotCatalogReviewCleanupStyles';

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function isAdministrator() {
    const user = readUser();
    return Boolean(user && user.role === 'Administrator');
  }

  function installReviewCleanupStyles() {
    if (document.getElementById(REVIEW_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = REVIEW_STYLE_ID;
    style.textContent = `
      #tab-katalog #catalogReviewStats,
      #tab-katalog .catalog-review-stats,
      #tab-katalog .catalog-card-review,
      #tab-katalog .cat-review-note,
      #tab-katalog .cat-review-note-edit,
      #tab-katalog .review-btn,
      #tab-katalog .badge.problem,
      #tab-katalog .problem-badge,
      #tab-katalog [data-review-status],
      #tab-katalog [class*="review-status"] {
        display: none !important;
      }

      #tab-katalog .catalog-card.cat-has-problem,
      #tab-katalog .catalog-card.cat-review-errors,
      #tab-katalog .catalog-card.problem,
      #tab-katalog .catalog-card.error {
        border-color: var(--slate-200, #e2e8f0) !important;
        outline: none !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function cleanCatalogReviewArtifacts() {
    const section = document.getElementById('tab-katalog');
    if (!section) return;

    section.querySelectorAll(
      '#catalogReviewStats, .catalog-review-stats, .catalog-card-review, ' +
      '.cat-review-note, .cat-review-note-edit, .review-btn, .badge.problem, ' +
      '.problem-badge, [data-review-status], [class*="review-status"]'
    ).forEach((element) => element.remove());

    section.querySelectorAll(
      '.catalog-card.cat-has-problem, .catalog-card.cat-review-errors, ' +
      '.catalog-card.problem, .catalog-card.error'
    ).forEach((card) => {
      card.classList.remove('cat-has-problem', 'cat-review-errors', 'problem', 'error');
      card.style.removeProperty('border-color');
      card.style.removeProperty('outline');
      card.style.removeProperty('box-shadow');
    });
  }

  function buildCatalogSection() {
    const main = document.querySelector('main');
    if (!main) return null;

    const section = document.createElement('section');
    section.id = 'tab-katalog';
    section.className = 'hidden';
    section.innerHTML = `
      <div class="card">
        <h2>Hinterlegter Dienstkatalog</h2>
        <p class="muted">Bei Eingabe einer Dienstnummer werden Beginn und Ende automatisch übernommen. Freitag-Abweichungen werden anhand des Datums gesetzt. Eigene Dienste können hier dauerhaft bearbeitet werden.</p>
        <div class="toolbar" style="margin-top:16px;">
          <div class="toolbar-group">
            <button class="btn-primary" id="uploadDienstkarteCatalog">📷 Dienstkarte hochladen</button>
            <input type="file" id="dienstkarteFilesCatalog" accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic" multiple style="display:none">
          </div>
        </div>
        <div id="uploadStatusCatalog" class="upload-status hidden" role="status" aria-live="polite"></div>
        <div class="catalog-grid" id="catalogGrid"></div>
      </div>
    `;

    const statistics = document.getElementById('tab-statistik');
    if (statistics) main.insertBefore(section, statistics);
    else main.appendChild(section);
    return section;
  }

  function activateCatalog() {
    const button = document.querySelector('.tab[data-tab="katalog"]');
    const section = document.getElementById('tab-katalog');
    if (!button || !section) return;

    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    button.classList.add('active');

    document.querySelectorAll('main > section[id^="tab-"]').forEach((item) => {
      item.classList.toggle('hidden', item !== section);
    });

    try {
      localStorage.setItem(ACTIVE_TAB_KEY, 'katalog');
    } catch {
      // Speicherung ist optional.
    }

    if (typeof window.renderCatalog === 'function') {
      window.renderCatalog();
    }

    window.setTimeout(cleanCatalogReviewArtifacts, 0);
    window.setTimeout(cleanCatalogReviewArtifacts, 120);
  }

  function ensureCatalogForAdministrator() {
    if (!isAdministrator()) return;

    installReviewCleanupStyles();
    document.body.classList.remove('role-fahrer');

    const nav = document.querySelector('nav.tabs, .tabs');
    if (!nav) return;

    let button = nav.querySelector('.tab[data-tab="katalog"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab';
      button.dataset.tab = 'katalog';
      button.textContent = 'Dienstkatalog';

      const statisticsButton = nav.querySelector('.tab[data-tab="statistik"]');
      if (statisticsButton) nav.insertBefore(button, statisticsButton);
      else nav.appendChild(button);
    }

    button.hidden = false;
    button.disabled = false;
    button.removeAttribute('aria-hidden');
    button.style.removeProperty('display');
    button.style.removeProperty('visibility');
    button.style.removeProperty('pointer-events');

    let section = document.getElementById('tab-katalog');
    if (!section) section = buildCatalogSection();
    if (!section) return;

    section.hidden = false;
    section.removeAttribute('aria-hidden');
    section.style.removeProperty('display');
    section.style.removeProperty('visibility');

    section.querySelectorAll('input, select, textarea, button').forEach((element) => {
      element.disabled = false;
      if ('readOnly' in element) element.readOnly = false;
      element.style.removeProperty('display');
      element.style.removeProperty('pointer-events');
    });

    const fileInput = section.querySelector('#dienstkarteFilesCatalog');
    if (fileInput) fileInput.style.display = 'none';

    cleanCatalogReviewArtifacts();

    if (!button.dataset.catalogRestoreHandler) {
      button.dataset.catalogRestoreHandler = 'yes';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        activateCatalog();
      });
    }

    if (localStorage.getItem(ACTIVE_TAB_KEY) === 'katalog') {
      activateCatalog();
    }

    if (typeof window.renderCatalog === 'function') {
      window.renderCatalog();
      window.setTimeout(cleanCatalogReviewArtifacts, 0);
      window.setTimeout(cleanCatalogReviewArtifacts, 120);
    }
  }

  function start() {
    if (window[INSTALL_MARK]) return;
    window[INSTALL_MARK] = true;

    installReviewCleanupStyles();
    ensureCatalogForAdministrator();

    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#loginButton, .tab, #loadRunke, #loadKollege, #loadSelectedProfile')) {
        window.setTimeout(ensureCatalogForAdministrator, 120);
      }
    }, true);

    [250, 800, 1800, 3500].forEach((delay) => {
      window.setTimeout(() => {
        ensureCatalogForAdministrator();
        cleanCatalogReviewArtifacts();
      }, delay);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
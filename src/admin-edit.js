(() => {
  'use strict';

  const USER_KEY = 'dienstpilot_user';
  const ACTIVE_TAB_KEY = 'lrz-active-tab';
  const INSTALL_MARK = 'dienstpilotCatalogRestoreInstalled';

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
        <div id="catalogReviewStats" class="catalog-review-stats hidden"></div>
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
  }

  function ensureCatalogForAdministrator() {
    if (!isAdministrator()) return;

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
    }
  }

  function start() {
    if (window[INSTALL_MARK]) return;
    window[INSTALL_MARK] = true;

    ensureCatalogForAdministrator();

    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#loginButton, .tab, #loadRunke, #loadKollege, #loadSelectedProfile')) {
        window.setTimeout(ensureCatalogForAdministrator, 120);
      }
    }, true);

    [250, 800, 1800, 3500].forEach((delay) => {
      window.setTimeout(ensureCatalogForAdministrator, delay);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
(() => {
  'use strict';

  const STYLE_ID = 'dpCatalogEditorSimplifyStyle';
  const HIDDEN_FIELDS = ['dpCatLine', 'dpCatStop', 'dpCatPause'];

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dpCatalogEditModal .dp-cat-field.dp-cat-hidden-setting {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function simplifyModal() {
    addStyle();
    const modal = document.getElementById('dpCatalogEditModal');
    if (!modal) return false;

    HIDDEN_FIELDS.forEach((id) => {
      const field = modal.querySelector('#' + id);
      const label = field?.closest('.dp-cat-field');
      if (label) {
        label.classList.add('dp-cat-hidden-setting');
        label.setAttribute('aria-hidden', 'true');
      }
    });

    return true;
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.dp-catalog-edit')) return;
    window.setTimeout(simplifyModal, 0);
    window.setTimeout(simplifyModal, 80);
  });

  [0, 250, 800].forEach((delay) => window.setTimeout(simplifyModal, delay));
})();

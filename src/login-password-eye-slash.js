(() => {
  'use strict';

  const icon = (slashed) => `
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
      ${slashed ? '<path d="M4 4 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>' : ''}
    </svg>
  `;

  function install() {
    const input = document.getElementById('appPassword');
    const oldButton = document.getElementById('togglePasswordVisibility');
    if (!input || !oldButton) return false;

    if (oldButton.dataset.loginEyeSlash === '1') return true;

    const button = oldButton.cloneNode(false);
    button.dataset.loginEyeSlash = '1';
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.color = '#0f172a';
    oldButton.replaceWith(button);

    const render = () => {
      const visible = input.type === 'text';
      button.innerHTML = icon(visible);
      button.title = visible ? 'Passwort verbergen' : 'Passwort anzeigen';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', visible ? 'true' : 'false');
    };

    button.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      render();
      input.focus({ preventScroll: true });
    });

    render();
    return true;
  }

  [0, 50, 200, 600, 1500].forEach((delay) => window.setTimeout(install, delay));
  document.addEventListener('DOMContentLoaded', install, { once: true });
})();
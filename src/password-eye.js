(() => {
  'use strict';

  function start() {
    const input = document.getElementById('appPassword');
    if (!input || document.getElementById('togglePasswordVisibility')) return;

    const row = document.createElement('div');
    row.id = 'dienstpilotPasswordRow';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    row.style.width = '100%';

    input.parentElement.insertBefore(row, input);
    row.appendChild(input);
    input.style.flex = '1 1 auto';
    input.style.minWidth = '0';
    input.style.margin = '0';

    const button = document.createElement('button');
    button.id = 'togglePasswordVisibility';
    button.type = 'button';
    button.textContent = '👁';
    button.title = 'Passwort anzeigen';
    button.setAttribute('aria-label', 'Passwort anzeigen');
    button.style.minWidth = '48px';
    button.style.minHeight = '44px';
    button.style.borderRadius = '12px';
    button.style.border = '1px solid #cbd5e1';
    button.style.background = '#ffffff';
    button.style.fontSize = '20px';
    button.style.cursor = 'pointer';
    row.appendChild(button);

    button.addEventListener('click', () => {
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.textContent = visible ? '👁' : '🙈';
      button.title = visible ? 'Passwort anzeigen' : 'Passwort verbergen';
      button.setAttribute('aria-label', button.title);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

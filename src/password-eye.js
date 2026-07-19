(() => {
  'use strict';

  if (window.__dienstpilotPasswordEyeV2) return;
  window.__dienstpilotPasswordEyeV2 = true;

  let dailyDutyInputPatchInstalled = false;

  const eyeIcon = (slashed) => `
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
      ${slashed ? '<path d="M4 4 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>' : ''}
    </svg>`;

  function startPasswordEye() {
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
    button.innerHTML = eyeIcon(false);
    button.title = 'Passwort anzeigen';
    button.setAttribute('aria-label', 'Passwort anzeigen');
    button.setAttribute('aria-pressed', 'false');
    button.style.minWidth = '48px';
    button.style.minHeight = '44px';
    button.style.borderRadius = '12px';
    button.style.border = '1px solid #cbd5e1';
    button.style.background = '#ffffff';
    button.style.color = '#0f172a';
    button.style.cursor = 'pointer';
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    row.appendChild(button);

    button.addEventListener('click', () => {
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.innerHTML = eyeIcon(showPassword);
      button.title = showPassword ? 'Passwort verbergen' : 'Passwort anzeigen';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', showPassword ? 'true' : 'false');
      input.focus({ preventScroll: true });
    });
  }

  function installDailyDutyInputPatch() {
    if (dailyDutyInputPatchInstalled) return;
    dailyDutyInputPatchInstalled = true;

    document.addEventListener('input', (event) => {
      const input = event.target.closest?.('#dpDailyPlanRows input[data-field="duty"]');
      if (!input || input.dataset.dpDutyCommit === '1') return;

      input.dataset.field = 'dutyTyping';
      queueMicrotask(() => {
        if (input.isConnected) input.dataset.field = 'duty';
      });
    }, true);

    document.addEventListener('change', (event) => {
      const input = event.target.closest?.('#dpDailyPlanRows input[data-field="duty"]');
      if (!input) return;
      input.dataset.dpDutyCommit = '1';
      input.dataset.field = 'duty';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      delete input.dataset.dpDutyCommit;
    }, true);
  }

  function start() {
    startPasswordEye();
    installDailyDutyInputPatch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
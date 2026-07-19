(() => {
  'use strict';

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

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  function loadCatalogModules() {
    loadScript('dpMonthSelectorFinalV7', 'src/month-selector-final.js?v=20260712-7');
    loadScript('dpCatalogEditor', 'src/catalog-editor.js?v=20260711-3');
    loadScript('dpSplitShiftCatalogV3', 'src/split-shift-catalog.js?v=20260717-3');
    loadScript('dpCatalogTimeScale', 'src/catalog-time-scale.js?v=20260711-4');
    loadScript('dpCatalogEditorSimplify', 'src/catalog-editor-simplify.js?v=20260711-3');
    loadScript('dpCatalogAddDutyStable', 'src/catalog-add-duty-stable.js?v=20260711-2');
    loadScript('dpDailyDutyPlan', 'src/daily-duty-plan.js?v=20260711-1');
    loadScript('dpHolidayPlan18V5', 'src/holiday-plan-clean-v3.js?v=20260717-5');
    loadScript('dpDailyDutyDriverSelectV4', 'src/daily-duty-driver-select.js?v=20260719-1');
    loadScript('dpDriverMAlsaba', 'src/driver-m-alsaba.js?v=20260717-1');
    loadScript('dpDriverNameCorrectionsV2', 'src/driver-name-corrections.js?v=20260719-2');
    loadScript('dpSaturdaySplitDutyOptionsV1', 'src/saturday-split-duty-options.js?v=20260718-1');
    loadScript('dpVehiclePlateOptions', 'src/vehicle-plate-options.js?v=20260717-2');
    loadScript('dpDailyDutyBusMove', 'src/daily-duty-plan-bus-move.js?v=20260711-1');
    loadScript('dpDailyDutyPhotoDefaults', 'src/daily-duty-plan-photo-defaults.js?v=20260711-2');
    loadScript('dpDailyDutyPhotoAuto', 'src/daily-duty-plan-photo-auto.js?v=20260711-2');
    loadScript('dpDailyEinsatzwagenLastV1', 'src/daily-duty-einsatzwagen-last.js?v=20260718-1');
    loadScript('dpSplitShiftDutiesV5NewTimes', 'src/split-shift-duties-v5.js?v=20260717-2');
    loadScript('dpSplitShiftTimeEditorAccess', 'src/split-shift-time-editor-access.js?v=20260718-2');
    loadScript('dpSplitShiftTimeEditor', 'src/split-shift-time-editor.js?v=20260718-1');
    loadScript('dpWorkshopVehicles', 'src/workshop-vehicles.js?v=20260717-1');
    loadScript('dpSavedDutyPlansFolder', 'src/saved-duty-plans-folder.js?v=20260718-1');
    loadScript('dpWeekendCombinedEditorV1', 'src/weekend-combined-editor.js?v=20260718-1');
    loadScript('dpWeekendSavedPlansV1', 'src/weekend-saved-plans.js?v=20260719-1');
    loadScript('dpDailyDutyPrintA4', 'src/daily-duty-plan-print-a4.js?v=20260717-3');
    loadScript('dpDailyDutySeparationV2', 'src/daily-duty-plan-separation.js?v=20260718-2');
    loadScript('dpWeekendCombinedOpenFixV1', 'src/weekend-combined-open-fix.js?v=20260718-1');
    loadScript('dpDailyDutyPrintAnytimeV4', 'src/daily-duty-plan-print-anytime.js?v=20260718-4');
    loadScript('dpDailyDutyWeekendPhotoV2', 'src/daily-duty-plan-weekend-photo.js?v=20260718-2');
    loadScript('dpDailyDutySeparationGuard', 'src/daily-duty-plan-separation-guard.js?v=20260711-2');
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
    loadCatalogModules();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="katalog"],.tab[data-tab="eingabe"],.tab[data-tab="einstellungen"],#dpDailyDutyPlanTab')) {
      [0, 200, 700].forEach((delay) => window.setTimeout(loadCatalogModules, delay));
    }
  }, true);
})();
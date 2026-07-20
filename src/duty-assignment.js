(() => {
  'use strict';

  document.getElementById('dpDutyAssignment')?.remove();
  document.getElementById('dpDutyAssignmentDiagnosticsV1')?.remove();
  document.getElementById('dpDutyAssignmentDiagnosticsV1Script')?.remove();
  document.getElementById('dpDutyEditPermissionFixV1Script')?.remove();
  document.getElementById('dpDutyEditSaveFixV1Script')?.remove();
  document.getElementById('dpDutyEditSaveFixV2Script')?.remove();
  document.getElementById('dpDutyEditSaveFixV3Script')?.remove();
  document.getElementById('dpDutyEditSaveFixV4Script')?.remove();

  if (!document.getElementById('dpDutyEditControlsV1Script')) {
    const controls = document.createElement('script');
    controls.id = 'dpDutyEditControlsV1Script';
    controls.src = 'src/duty-edit-controls.js?v=20260720-1';
    controls.async = false;
    document.head.appendChild(controls);
  }

  if (!document.getElementById('dpAssignmentFreeOptionV1Script')) {
    const freeOption = document.createElement('script');
    freeOption.id = 'dpAssignmentFreeOptionV1Script';
    freeOption.src = 'src/assignment-free-option.js?v=20260720-1';
    freeOption.async = false;
    document.head.appendChild(freeOption);
  }

  document.getElementById('dpPrintDutyFreeOptionV1Script')?.remove();
  document.getElementById('dpPrintDutyFreeOptionV2Script')?.remove();
  if (!document.getElementById('dpPrintDutyFreeOptionV3Script')) {
    const printFreeOption = document.createElement('script');
    printFreeOption.id = 'dpPrintDutyFreeOptionV3Script';
    printFreeOption.src = 'src/print-duty-free-option.js?v=20260720-3';
    printFreeOption.async = false;
    document.head.appendChild(printFreeOption);
  }

  document.getElementById('dpFreeRowEditControlsV1Script')?.remove();
  if (!document.getElementById('dpFreeRowEditControlsV2Script')) {
    const freeRowControls = document.createElement('script');
    freeRowControls.id = 'dpFreeRowEditControlsV2Script';
    freeRowControls.src = 'src/free-row-edit-controls.js?v=20260720-2';
    freeRowControls.async = false;
    document.head.appendChild(freeRowControls);
  }

  if (!document.getElementById('dpDayPlanUniqueDriverV1Script')) {
    const uniqueDriver = document.createElement('script');
    uniqueDriver.id = 'dpDayPlanUniqueDriverV1Script';
    uniqueDriver.src = 'src/day-plan-unique-driver.js?v=20260720-1';
    uniqueDriver.async = false;
    document.head.appendChild(uniqueDriver);
  }

  document.getElementById('dpLiveDayPreviewSyncV1Script')?.remove();
  if (!document.getElementById('dpLiveDayPreviewSyncV2Script')) {
    const previewSync = document.createElement('script');
    previewSync.id = 'dpLiveDayPreviewSyncV2Script';
    previewSync.src = 'src/live-day-preview-sync.js?v=20260720-2';
    previewSync.async = false;
    document.head.appendChild(previewSync);
  }

  if (!document.getElementById('dpAssignmentInputCanonicalizerV1Script')) {
    const canonicalizer = document.createElement('script');
    canonicalizer.id = 'dpAssignmentInputCanonicalizerV1Script';
    canonicalizer.src = 'src/assignment-input-canonicalizer.js?v=20260720-1';
    canonicalizer.async = false;
    document.head.appendChild(canonicalizer);
  }

  if (!document.getElementById('dpDriverProfileRouteFixV2Script')) {
    document.getElementById('dpDriverProfileRouteFixV1Script')?.remove();
    const routeScript = document.createElement('script');
    routeScript.id = 'dpDriverProfileRouteFixV2Script';
    routeScript.src = 'src/driver-profile-route-fix.js?v=20260720-2';
    routeScript.async = false;
    document.head.appendChild(routeScript);
  }

  if (!document.getElementById('dpAssignedPlanRefreshV1Script')) {
    const refreshScript = document.createElement('script');
    refreshScript.id = 'dpAssignedPlanRefreshV1Script';
    refreshScript.src = 'src/assigned-plan-refresh.js?v=20260720-1';
    refreshScript.async = false;
    document.head.appendChild(refreshScript);
  }

  if (!document.getElementById('dpDriverProfileAliasFixV2Script')) {
    document.getElementById('dpDriverProfileAliasFixV1Script')?.remove();
    const aliasScript = document.createElement('script');
    aliasScript.id = 'dpDriverProfileAliasFixV2Script';
    aliasScript.src = 'src/driver-profile-alias-fix.js?v=20260720-2';
    aliasScript.async = false;
    document.head.appendChild(aliasScript);
  }

  if (!document.getElementById('dpAssignmentMonthFocusV1Script')) {
    const monthScript = document.createElement('script');
    monthScript.id = 'dpAssignmentMonthFocusV1Script';
    monthScript.src = 'src/assignment-month-focus.js?v=20260720-1';
    monthScript.async = false;
    document.head.appendChild(monthScript);
  }

  function loadPutNormalizer() {
    if (document.getElementById('dpAssignedPlanPutNormalizerV1Script')) return;
    const normalizer = document.createElement('script');
    normalizer.id = 'dpAssignedPlanPutNormalizerV1Script';
    normalizer.src = 'src/assigned-plan-put-normalizer.js?v=20260720-1';
    normalizer.async = false;
    document.head.appendChild(normalizer);
  }

  if (document.getElementById('dpDutyAssignmentV2Script')) {
    loadPutNormalizer();
    return;
  }

  const script = document.createElement('script');
  script.id = 'dpDutyAssignmentV2Script';
  script.src = 'src/duty-assignment-v2.js?v=20260712-1';
  script.async = false;
  script.addEventListener('load', loadPutNormalizer, { once: true });
  document.head.appendChild(script);
})();
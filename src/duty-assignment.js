(() => {
  'use strict';

  document.getElementById('dpDutyAssignment')?.remove();

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
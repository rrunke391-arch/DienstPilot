(() => {
  'use strict';

  document.getElementById('dpDutyAssignment')?.remove();

  if (!document.getElementById('dpAssignedPlanRefreshV1Script')) {
    const refreshScript = document.createElement('script');
    refreshScript.id = 'dpAssignedPlanRefreshV1Script';
    refreshScript.src = 'src/assigned-plan-refresh.js?v=20260720-1';
    refreshScript.async = false;
    document.head.appendChild(refreshScript);
  }

  if (!document.getElementById('dpDriverProfileAliasFixV1Script')) {
    const aliasScript = document.createElement('script');
    aliasScript.id = 'dpDriverProfileAliasFixV1Script';
    aliasScript.src = 'src/driver-profile-alias-fix.js?v=20260720-1';
    aliasScript.async = false;
    document.head.appendChild(aliasScript);
  }

  if (document.getElementById('dpDutyAssignmentV2Script')) return;

  const script = document.createElement('script');
  script.id = 'dpDutyAssignmentV2Script';
  script.src = 'src/duty-assignment-v2.js?v=20260712-1';
  script.async = false;
  document.head.appendChild(script);
})();
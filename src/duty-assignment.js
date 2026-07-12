(() => {
  'use strict';

  document.getElementById('dpDutyAssignment')?.remove();
  if (document.getElementById('dpDutyAssignmentV2Script')) return;

  const script = document.createElement('script');
  script.id = 'dpDutyAssignmentV2Script';
  script.src = 'src/duty-assignment-v2.js?v=20260712-1';
  script.async = false;
  document.head.appendChild(script);
})();
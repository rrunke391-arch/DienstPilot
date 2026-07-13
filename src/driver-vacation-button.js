(() => {
  'use strict';

  if (document.getElementById('dpDriverVacationInlineScript')) return;
  const script = document.createElement('script');
  script.id = 'dpDriverVacationInlineScript';
  script.src = 'src/driver-vacation-inline.js?v=20260713-1';
  script.async = false;
  document.head.appendChild(script);
})();
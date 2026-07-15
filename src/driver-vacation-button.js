(() => {
  'use strict';

  function load(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  load('dpDriverVacationInlineScript', 'src/driver-vacation-inline.js?v=20260713-1');
  load('dpDriverVacationStatusLightScript', 'src/driver-vacation-status-light.js?v=20260713-1');
})();
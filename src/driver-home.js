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

  load('dpDriverHomeV2Script', 'src/driver-home-v2.js?v=20260713-1');
  load('dpDriverCurrentWeekPrintScript', 'src/driver-current-week-print.js?v=20260715-1');
})();
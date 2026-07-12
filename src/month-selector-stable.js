(() => {
  'use strict';

  if (document.getElementById('dpMonthSelectorFinalCompat')) return;

  const script = document.createElement('script');
  script.id = 'dpMonthSelectorFinalCompat';
  script.src = 'src/month-selector-final.js?v=20260712-1';
  script.async = false;
  document.head.appendChild(script);
})();
(() => {
  'use strict';

  if (document.getElementById('dpDriverHomeScript')) return;
  const script = document.createElement('script');
  script.id = 'dpDriverHomeScript';
  script.src = 'src/driver-home.js?v=20260712-1';
  script.async = false;
  document.head.appendChild(script);
})();
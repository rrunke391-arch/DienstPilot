(() => {
  'use strict';

  if (document.getElementById('dpDriverHomeV2Script')) return;
  const script = document.createElement('script');
  script.id = 'dpDriverHomeV2Script';
  script.src = 'src/driver-home-v2.js?v=20260713-1';
  script.async = false;
  document.head.appendChild(script);
})();
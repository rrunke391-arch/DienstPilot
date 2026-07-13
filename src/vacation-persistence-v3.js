(() => {
  'use strict';

  if (document.getElementById('dpVacationPersistenceV4Compat')) return;
  const script = document.createElement('script');
  script.id = 'dpVacationPersistenceV4Compat';
  script.src = 'src/vacation-persistence-v4.js?v=20260713-1';
  script.async = false;
  document.head.appendChild(script);
})();
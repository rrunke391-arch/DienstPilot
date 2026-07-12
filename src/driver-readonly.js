(() => {
  'use strict';

  function isDriver() {
    try {
      const user = JSON.parse(sessionStorage.getItem('dienstpilot_user') || 'null');
      return user?.role === 'Fahrer';
    } catch {
      return sessionStorage.getItem('dienstpilot_role') === 'Fahrer';
    }
  }

  function loadDriverHome() {
    if (!isDriver() || document.getElementById('dpDriverHomeScript')) return;
    const script = document.createElement('script');
    script.id = 'dpDriverHomeScript';
    script.src = 'src/driver-home.js?v=20260712-2';
    script.async = false;
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDriverHome, { once: true });
  } else {
    loadDriverHome();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,.tab[data-tab="eingabe"]')) {
      [0, 250, 750, 1500, 3000, 5000].forEach((delay) => setTimeout(loadDriverHome, delay));
    }
  }, true);

  window.addEventListener('pageshow', loadDriverHome);
})();
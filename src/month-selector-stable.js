(() => {
  'use strict';

  document.querySelectorAll('#dpMonthSelectorStable,#dpMonthSelectorFallback,[data-dp-old-month-bar="1"]').forEach((node) => {
    if (node.tagName !== 'SCRIPT') node.remove();
  });

  if (document.getElementById('dpMonthSelectorFinalCompatV7')) return;
  const script = document.createElement('script');
  script.id = 'dpMonthSelectorFinalCompatV7';
  script.src = 'src/month-selector-final.js?v=20260712-7';
  script.async = false;
  document.head.appendChild(script);
})();
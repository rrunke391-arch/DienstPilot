(() => {
  'use strict';

  document.querySelectorAll('#dpMonthSelectorStable,#dpMonthSelectorFallback,[data-dp-old-month-bar="1"]').forEach((node) => {
    if (node.tagName !== 'SCRIPT') node.remove();
  });

  if (document.getElementById('dpMonthSelectorFinalCompatV4')) return;
  const script = document.createElement('script');
  script.id = 'dpMonthSelectorFinalCompatV4';
  script.src = 'src/month-selector-final.js?v=20260712-4';
  script.async = false;
  document.head.appendChild(script);
})();
(() => {
  'use strict';

  if (window.__dienstpilotDriverVisiblePagePrint) return;
  window.__dienstpilotDriverVisiblePagePrint = true;

  const FRAME_ID = 'dpDriverVisiblePagePrintFrame';

  function normalize(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem('dienstpilot_user') || 'null'); }
    catch { return null; }
  }

  function isDriver() {
    return normalize(currentUser()?.role || sessionStorage.getItem('dienstpilot_role')) === 'fahrer';
  }

  function printVisibleDriverPage() {
    const source = document.getElementById('dpDriverHome');
    if (!source) {
      window.alert('Die Fahreransicht konnte nicht gedruckt werden.');
      return;
    }

    const clone = source.cloneNode(true);
    clone.querySelectorAll('button,input,select,textarea').forEach((element) => element.remove());
    clone.querySelectorAll('[hidden]').forEach((element) => element.remove());

    const styles = [...document.querySelectorAll('link[rel="stylesheet"],style')]
      .map((element) => element.outerHTML)
      .join('\n');

    document.getElementById(FRAME_ID)?.remove();
    const frame = document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    document.body.appendChild(frame);

    const printDocument = frame.contentDocument || frame.contentWindow?.document;
    if (!printDocument || !frame.contentWindow) {
      frame.remove();
      window.alert('Die Druckvorschau konnte nicht geöffnet werden.');
      return;
    }

    printDocument.open();
    printDocument.write(`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<base href="${location.href}">
<title>Mein Dienstplan</title>
${styles}
<style>
@page{size:A4 portrait;margin:12mm}
html,body{margin:0!important;padding:0!important;background:#fff!important}
body{color:#0f172a!important;font-family:Arial,Helvetica,sans-serif!important}
#dpDriverHome{display:grid!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;gap:12px!important;box-shadow:none!important}
#dpDriverHome .dp-home-head,#dpDriverHome .dp-home-week,#dpDriverHome .dp-home-service,#dpDriverVacationHost{break-inside:avoid;page-break-inside:avoid}
#dpDriverHome .dp-home-head{padding:16px!important}
#dpDriverHome .dp-home-title{font-size:24px!important}
#dpDriverHome .dp-home-actions,#dpDriverHome .dp-home-week-nav{display:none!important}
#dpDriverHome .dp-home-days{grid-template-columns:repeat(7,minmax(0,1fr))!important}
#dpDriverHome .dp-home-day{min-height:70px!important;padding:8px 4px!important}
#dpDriverVacationHost{display:block!important}
#dpDriverVacationHost form,#dpDriverVacationHost .dp-request-form,#dpDriverVacationHost .dp-vacation-form{display:none!important}
button,input,select,textarea{display:none!important}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
</style>
</head>
<body>${clone.outerHTML}</body>
</html>`);
    printDocument.close();

    const cleanup = () => frame.remove();
    frame.contentWindow.addEventListener('afterprint', cleanup, { once: true });
    window.setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        cleanup();
        window.alert('Die Druckvorschau konnte nicht geöffnet werden.');
      }
    }, 300);
    window.setTimeout(cleanup, 60000);
  }

  window.addEventListener('click', (event) => {
    const button = event.target.closest?.('#dpDriverHome [data-home-action="print"]');
    if (!button || !isDriver()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    printVisibleDriverPage();
  }, true);
})();
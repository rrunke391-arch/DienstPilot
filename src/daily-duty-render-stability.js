(() => {
  'use strict';

  if (window.__dienstpilotDailyRenderStabilityV1) return;
  window.__dienstpilotDailyRenderStabilityV1 = true;

  const originalReplaceChildren = Element.prototype.replaceChildren;
  const TARGET_SELECTOR = [
    '#tab-daily-duty-plan select.dp-vehicle-select',
    '#tab-daily-duty-plan select.dp-daily-driver-select',
    '#tab-daily-duty-plan select.dp-daily-duty-select',
    '#tab-daily-duty-plan select.dp-driver-assignment-select',
    '#dpDailyVehiclePlateList'
  ].join(',');

  function optionSignature(elements) {
    return elements.map((option) => [
      String(option.value || ''),
      String(option.textContent || ''),
      option.disabled ? '1' : '0'
    ].join('\u001f')).join('\u001e');
  }

  function proposedOptions(nodes) {
    const options = [];
    const visit = (node) => {
      if (!node) return;
      if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        [...node.childNodes].forEach(visit);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.tagName === 'OPTION') options.push(node);
      else node.querySelectorAll?.('option').forEach((option) => options.push(option));
    };
    nodes.forEach(visit);
    return options;
  }

  Element.prototype.replaceChildren = function (...nodes) {
    if (this.matches?.(TARGET_SELECTOR)) {
      const current = [...this.querySelectorAll(':scope > option')];
      const next = proposedOptions(nodes);
      if (current.length === next.length && optionSignature(current) === optionSignature(next)) return;
    }
    return originalReplaceChildren.apply(this, nodes);
  };

  const style = document.createElement('style');
  style.id = 'dpDailyRenderStabilityStyle';
  style.textContent = `
    #tab-daily-duty-plan .dp-daily-duty-select,
    #tab-daily-duty-plan .dp-daily-driver-select,
    #tab-daily-duty-plan .dp-vehicle-select,
    #tab-daily-duty-plan .dp-driver-assignment-select{
      animation:none!important;
      transition:none!important;
    }
  `;
  document.head.appendChild(style);
})();
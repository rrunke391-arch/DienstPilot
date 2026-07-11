(() => {
  'use strict';

  const MODAL_ID = 'dpCatalogEditModal';
  const STYLE_ID = 'dpCatalogTimeScaleStyle';

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dp-cat-time-source{display:none!important}
      .dp-cat-time-scale{display:grid;gap:8px;padding:10px 11px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc}
      .dp-cat-time-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .dp-cat-time-value{min-width:72px;padding:6px 10px;border-radius:10px;background:#0f172a;color:#fff;text-align:center;font-size:18px;font-weight:900;font-variant-numeric:tabular-nums}
      .dp-cat-time-controls{display:grid;grid-template-columns:42px minmax(0,1fr) 42px;gap:8px;align-items:center}
      .dp-cat-time-controls button{width:42px;height:38px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font-size:21px;font-weight:900;cursor:pointer}
      .dp-cat-time-controls button:active{transform:translateY(1px)}
      .dp-cat-time-range{width:100%!important;padding:0!important;border:0!important;background:transparent!important;accent-color:#0f172a;cursor:pointer}
      .dp-cat-time-marks{display:flex;justify-content:space-between;color:#64748b;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
      .dp-cat-friday-toggle{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:#334155}
      .dp-cat-friday-toggle input{width:auto!important;margin:0}
      .dp-cat-time-scale.is-disabled{opacity:.58}
      .dp-cat-time-scale.is-disabled .dp-cat-time-value{background:#64748b}
      @media(max-width:620px){.dp-cat-time-value{font-size:17px}.dp-cat-time-marks{font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function toMinutes(value) {
    const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return 0;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return 0;
    return hour * 60 + minute;
  }

  function toTime(value) {
    const minutes = Math.max(0, Math.min(1439, Number(value) || 0));
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  }

  function createScale(source, options = {}) {
    if (!source || source.dataset.scaleReady === '1') return;
    source.dataset.scaleReady = '1';
    source.classList.add('dp-cat-time-source');

    const isOptional = options.optional === true;
    const fallbackSource = options.fallbackSource || null;
    const initialEnabled = !isOptional || Boolean(source.value);
    const initialValue = source.value || fallbackSource?.value || '12:00';

    const wrap = document.createElement('div');
    wrap.className = 'dp-cat-time-scale';
    wrap.innerHTML = `
      <div class="dp-cat-time-head">
        <span class="dp-cat-time-hint">Minutengenaue Skala</span>
        <output class="dp-cat-time-value">${initialEnabled ? initialValue : 'keine'}</output>
      </div>
      ${isOptional ? '<label class="dp-cat-friday-toggle"><input type="checkbox" class="dp-cat-time-enabled"> Abweichende Freitag-Endzeit verwenden</label>' : ''}
      <div class="dp-cat-time-controls">
        <button type="button" class="dp-cat-time-minus" aria-label="Eine Minute früher">−</button>
        <input class="dp-cat-time-range" type="range" min="0" max="1439" step="1" value="${toMinutes(initialValue)}" aria-label="Uhrzeit auf Skala einstellen">
        <button type="button" class="dp-cat-time-plus" aria-label="Eine Minute später">+</button>
      </div>
      <div class="dp-cat-time-marks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    `;
    source.insertAdjacentElement('afterend', wrap);

    const range = wrap.querySelector('.dp-cat-time-range');
    const output = wrap.querySelector('.dp-cat-time-value');
    const minus = wrap.querySelector('.dp-cat-time-minus');
    const plus = wrap.querySelector('.dp-cat-time-plus');
    const enabled = wrap.querySelector('.dp-cat-time-enabled');

    function isEnabled() {
      return !enabled || enabled.checked;
    }

    function render() {
      const active = isEnabled();
      range.disabled = !active;
      minus.disabled = !active;
      plus.disabled = !active;
      wrap.classList.toggle('is-disabled', !active);
      if (!active) {
        source.value = '';
        output.textContent = 'keine';
        return;
      }
      const time = toTime(range.value);
      source.value = time;
      output.textContent = time;
    }

    function move(delta) {
      if (!isEnabled()) return;
      range.value = String(Math.max(0, Math.min(1439, Number(range.value) + delta)));
      render();
      range.focus({ preventScroll: true });
    }

    if (enabled) {
      enabled.checked = initialEnabled;
      enabled.addEventListener('change', () => {
        if (enabled.checked && !source.value) {
          range.value = String(toMinutes(fallbackSource?.value || initialValue));
        }
        render();
      });
    }
    range.addEventListener('input', render);
    minus.addEventListener('click', () => move(-1));
    plus.addEventListener('click', () => move(1));
    render();
  }

  function enhanceModal() {
    addStyle();
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return false;
    const start = modal.querySelector('#dpCatStart');
    const end = modal.querySelector('#dpCatEnd');
    const friday = modal.querySelector('#dpCatFriday');
    createScale(start);
    createScale(end);
    createScale(friday, { optional: true, fallbackSource: end });
    return true;
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.dp-catalog-edit,.dp-catalog-add')) return;
    window.setTimeout(enhanceModal, 0);
    window.setTimeout(enhanceModal, 80);
  });

  [0, 250, 800].forEach((delay) => window.setTimeout(enhanceModal, delay));
})();
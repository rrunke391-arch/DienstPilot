(() => {
  'use strict';

  if (window.__dienstpilotSaturdaySplitDutyOptionsV1) return;
  window.__dienstpilotSaturdaySplitDutyOptionsV1 = true;

  const DATE_ID = 'dpDailyPlanDate';
  const LIST_ID = 'dpDailyDutyList';
  const TABLE_ID = 'dpDailyPlanRows';
  const STYLE_ID = 'dpSaturdaySplitDutyOptionsStyle';
  const SPECIAL = {
    '1340': 'Frühschicht',
    '11541': 'Spätschicht'
  };

  let timer = 0;

  function selectedDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function isSaturday(date = selectedDate()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    return new Date(`${date}T12:00:00`).getDay() === 6;
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TABLE_ID} .dp-saturday-shift-label{display:inline-flex;margin:0 0 5px;padding:3px 7px;border:1px solid #93c5fd;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:950;line-height:1}
      #${TABLE_ID} tr[data-dp-saturday-shift] .dp-daily-duty-select{background:#f1f5f9!important;color:#334155!important;cursor:not-allowed!important}
      @media print{#${TABLE_ID} .dp-saturday-shift-label{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureDatalistOptions() {
    const list = document.getElementById(LIST_ID);
    if (!list) return;
    Object.keys(SPECIAL).forEach((duty) => {
      if ([...list.options].some((option) => String(option.value || '') === duty)) return;
      const option = document.createElement('option');
      option.value = duty;
      list.appendChild(option);
    });
  }

  function ensureSelectOption(select, duty, label) {
    if (!select) return;
    let option = [...select.options].find((item) => String(item.value || '') === duty);
    if (!option) {
      option = document.createElement('option');
      option.value = duty;
      select.appendChild(option);
    }
    const text = `Dienst ${duty} – ${label}`;
    if (option.textContent !== text) option.textContent = text;
  }

  function clearRowLabel(row) {
    row.querySelector('.dp-saturday-shift-label')?.remove();
    const select = row.querySelector('.dp-daily-duty-select[data-dp-fixed-saturday-duty="1"]');
    if (select) {
      select.disabled = false;
      delete select.dataset.dpFixedSaturdayDuty;
      select.removeAttribute('aria-disabled');
    }
    const remove = row.querySelector('[data-action="delete"][data-dp-fixed-saturday-duty="1"]');
    if (remove) {
      remove.disabled = false;
      delete remove.dataset.dpFixedSaturdayDuty;
    }
    delete row.dataset.dpSaturdayShift;
  }

  function decorateRows() {
    ensureDatalistOptions();
    const rows = [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
    if (!isSaturday()) {
      rows.forEach(clearRowLabel);
      return;
    }

    const dutySelects = rows
      .map((row) => row.querySelector('.dp-daily-duty-select'))
      .filter(Boolean);

    dutySelects.forEach((select) => {
      Object.entries(SPECIAL).forEach(([duty, label]) => ensureSelectOption(select, duty, label));
    });

    rows.forEach((row) => {
      const input = row.querySelector('input[data-field="duty"]');
      const duty = String(input?.value || '').trim();
      const labelText = SPECIAL[duty];
      if (!labelText) {
        clearRowLabel(row);
        return;
      }

      const cell = input?.closest('td');
      const select = cell?.querySelector('.dp-daily-duty-select');
      if (select) {
        ensureSelectOption(select, duty, labelText);
        if (select.value !== duty) select.value = duty;
        select.classList.remove('invalid');
        select.title = `${labelText}: Dienst ${duty} ist fest vorgegeben.`;
        select.disabled = true;
        select.dataset.dpFixedSaturdayDuty = '1';
        select.setAttribute('aria-disabled', 'true');
      }

      const remove = row.querySelector('[data-action="delete"]');
      if (remove) {
        remove.disabled = true;
        remove.dataset.dpFixedSaturdayDuty = '1';
        remove.title = `${labelText} und Spätschicht müssen im Samstagsplan erhalten bleiben.`;
      }

      if (cell) {
        let label = cell.querySelector('.dp-saturday-shift-label');
        if (!label) {
          label = document.createElement('span');
          label.className = 'dp-saturday-shift-label';
          cell.insertBefore(label, cell.firstChild);
        }
        const text = `${labelText} · Dienst ${duty}`;
        if (label.textContent !== text) label.textContent = text;
      }
      row.dataset.dpSaturdayShift = labelText === 'Frühschicht' ? 'early' : 'late';
    });
  }

  function schedule(delay = 80) {
    window.clearTimeout(timer);
    timer = window.setTimeout(decorateRows, delay);
  }

  function start() {
    addStyle();
    schedule(0);
    const observer = new MutationObserver(() => schedule(60));
    observer.observe(document.body, { childList: true, subtree: true });
    [250, 700, 1500, 3000].forEach((delay) => window.setTimeout(decorateRows, delay));
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID || event.target?.matches?.(`#${TABLE_ID} input[data-field="duty"],#${TABLE_ID} .dp-daily-duty-select`)) {
      schedule(40);
    }
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyDutyPlanTab,#dpDailyEditSaturday,#dpDailyAddRow,#dpDailySave,#loginButton')) {
      schedule(160);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', () => schedule(80));
  window.addEventListener('focus', () => schedule(80));
})();
(() => {
  'use strict';

  if (window.__dpDutySelectV4) return;
  window.__dpDutySelectV4 = true;

  const USER_KEY = 'dienstpilot_user';
  const ROLE_KEY = 'dienstpilot_role';
  const FREE = 'Frei';

  const HOLIDAY_PERIODS = [
    ['2025-10-13', '2025-10-25'], ['2025-12-22', '2026-01-05'],
    ['2026-02-02', '2026-02-03'], ['2026-03-23', '2026-04-07'],
    ['2026-05-15', '2026-05-15'], ['2026-05-26', '2026-05-26'],
    ['2026-07-02', '2026-08-12'], ['2026-10-12', '2026-10-24'],
    ['2026-12-23', '2027-01-09'], ['2027-02-01', '2027-02-02'],
    ['2027-03-22', '2027-04-03'], ['2027-05-07', '2027-05-07'],
    ['2027-05-18', '2027-05-18'], ['2027-07-08', '2027-08-18'],
    ['2027-10-16', '2027-10-30'], ['2027-12-23', '2028-01-08']
  ];

  const SCHOOL_DUTIES = [
    '3001', '3003', '3004', '3005', '3006', '3007', '3008', '3009', '3010',
    '3011', '3012', '3013', '3014', '3015', '3016', '3017', '3018', '3019',
    '3020', '3021', '3022', '3023', '3024', '3025', '3041', '3042', '3095'
  ];

  const HOLIDAY_DUTIES = [
    ['3031', '05:03', '13:21', '05:20', 'Wellingholzhausen, Schule'],
    ['3032', '04:45', '12:04', '05:26', 'Osnabrück, HBF'],
    ['3033', '05:43', '12:21', '06:16', 'Buer, Schulzentrum'],
    ['3034', '05:47', '15:39', '06:12', 'Neuenkirchen, Schulzentrum'],
    ['3035', '05:51', '17:21', '06:18', 'Westerhausen, Vinkenaue'],
    ['3036', '06:03', '18:04', '06:27', 'Gesmold, Schimmweg'],
    ['3037', '06:03', '16:05', '06:20', 'Wellingholzhausen, Schule'],
    ['3038', '06:03', '12:06', '06:28', 'Neuenkirchen, Schulzentrum'],
    ['3039', '06:42', '19:21', '07:15', 'Bruchmühlen, Schule'],
    ['3040', '07:20', '19:33', '07:45', 'Melle, ZOB'],
    ['3041', '08:20', '19:41', '08:45', 'Melle, ZOB'],
    ['3042', '11:20', '21:05', '11:45', 'Melle, ZOB'],
    ['3043', '12:03', '20:21', '12:20', 'Wellingholzhausen, Schule'],
    ['3044', '12:20', '22:03', '12:45', 'Melle, ZOB'],
    ['3045', '13:03', '21:50', '13:20', 'Wellingholzhausen, Schule'],
    ['3095', '20:20', '04:05', '20:45', 'Melle, ZOB'],
    ['1341', '05:13', '23:38', '', ''],
    ['1743', '06:05', '00:50', '', ''],
    ['1941', '05:35', '21:16', '15:24', 'Bissendorf, Werries'],
    ['Einsatzwagen', '', '', '', '']
  ];

  // Die Fotovorlage enthält Dienst 3039 und Dienst 1941 jeweils zweimal.
  const MAX_ASSIGNMENTS = new Map([
    ['3039', 2],
    ['1941', 2]
  ]);

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isFree(value) {
    return normalize(value) === 'frei';
  }

  function maxAssignments(value) {
    return MAX_ASSIGNMENTS.get(String(value || '').trim()) || 1;
  }

  function role() {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
      return normalize(user?.role || sessionStorage.getItem(ROLE_KEY));
    } catch {
      return normalize(sessionStorage.getItem(ROLE_KEY));
    }
  }

  function mayEdit() {
    return [
      'geschaftsleitung', 'geschaeftsleitung',
      'disposition', 'disponent', 'disponentin'
    ].includes(role());
  }

  function selectedDate() {
    return String(document.getElementById('dpDailyPlanDate')?.value || '');
  }

  function mode() {
    const date = selectedDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'school';
    const day = new Date(`${date}T12:00:00`).getDay();
    if (day === 0 || day === 6) return 'weekend';
    return HOLIDAY_PERIODS.some(([start, end]) => date >= start && date <= end)
      ? 'holiday'
      : 'school';
  }

  function addStyle() {
    if (document.getElementById('dpDutySelectV4Style')) return;
    const style = document.createElement('style');
    style.id = 'dpDutySelectV4Style';
    style.textContent = `
      #dpDailyPlanRows .dp-daily-duty-select{width:100%;box-sizing:border-box;padding:8px 30px 8px 9px;border:1px solid #2563eb;border-radius:9px;background:#fff;color:#0f172a;font:inherit;font-weight:800;cursor:pointer}
      #dpDailyPlanRows .dp-daily-duty-select.invalid,#dpDailyPlanRows .dp-daily-duty-select.duplicate{border-color:#dc2626;background:#fff7f7;color:#991b1b}
      #dpDailyPlanRows .dp-daily-duty-source{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function dutyInputs() {
    return [...document.querySelectorAll('#dpDailyPlanRows input[data-field="duty"]')];
  }

  function allOptions() {
    const currentMode = mode();
    if (currentMode === 'holiday') return [FREE, ...HOLIDAY_DUTIES.map((entry) => entry[0])];
    if (currentMode === 'school') return [FREE, ...SCHOOL_DUTIES];

    const values = new Set([FREE, ...SCHOOL_DUTIES, ...HOLIDAY_DUTIES.map((entry) => entry[0])]);
    document.querySelectorAll('#dpDailyDutyList option').forEach((option) => {
      if (option.value) values.add(option.value);
    });
    return [...values];
  }

  function assignmentCount(value, skipInput = null) {
    const wanted = String(value || '').trim();
    return dutyInputs().filter((input) => {
      const current = String(input.value || '').trim();
      return input !== skipInput && current === wanted && !isFree(current);
    }).length;
  }

  function invalidDuplicates() {
    const counts = new Map();
    dutyInputs().forEach((input) => {
      const value = String(input.value || '').trim();
      if (!value || isFree(value)) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [...counts]
      .filter(([value, count]) => count > maxAssignments(value))
      .map(([value]) => value);
  }

  function setStatus(text, error = false) {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = `dp-daily-status ${error ? 'error' : 'ok'}`;
  }

  function setField(row, field, value) {
    const input = row?.querySelector(`input[data-field="${field}"]`);
    if (!input) return;
    input.value = value || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function applyDuty(rowId, value) {
    window.setTimeout(() => {
      const escaped = window.CSS && typeof CSS.escape === 'function' ? CSS.escape(rowId) : rowId;
      const row = document.querySelector(`#dpDailyPlanRows tr[data-row-id="${escaped}"]`);
      if (!row) return;

      if (isFree(value)) {
        ['bus', 'start', 'end', 'departure', 'stop'].forEach((field) => setField(row, field, ''));
        renderFreeSummary();
        return;
      }

      const duty = HOLIDAY_DUTIES.find((entry) => entry[0] === value);
      if (!duty) return;
      setField(row, 'start', duty[1]);
      setField(row, 'end', duty[2]);
      setField(row, 'departure', duty[3]);
      setField(row, 'stop', duty[4]);
    }, 70);
  }

  function freeNames() {
    return dutyInputs()
      .filter((input) => isFree(input.value))
      .map((input) => input.closest('tr')?.querySelector('input[data-field="name"]')?.value.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'de'));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderFreeSummary() {
    const preview = document.getElementById('dpDailyPlanPreview');
    if (!preview) return;
    preview.querySelector('.dp-preview-free-summary')?.remove();

    const inputs = dutyInputs();
    const previewRows = [...preview.querySelectorAll('.dp-preview-row:not(.dp-preview-free-summary)')];
    if (previewRows.length === inputs.length) {
      inputs.forEach((input, index) => {
        if (isFree(input.value)) previewRows[index]?.remove();
      });
    }

    const names = freeNames();
    if (!names.length) return;

    const summary = document.createElement('div');
    summary.className = 'dp-preview-row dp-preview-free-summary';
    summary.style.cssText = 'border-top:2px solid #111;margin-top:3mm;padding-top:3mm;min-height:10mm';
    summary.innerHTML = `<div class="dp-preview-left"><strong>Frei</strong><span>Diese Fahrer haben frei:</span></div><div class="dp-preview-middle" style="grid-column:2 / 4"><strong>${names.map(escapeHtml).join(', ')}</strong></div><div class="dp-preview-right" style="display:none"></div>`;
    preview.appendChild(summary);
  }

  function markDuplicates() {
    const duplicates = new Set(invalidDuplicates());
    dutyInputs().forEach((input) => {
      const select = input.closest('td')?.querySelector('.dp-daily-duty-select');
      const value = String(input.value || '').trim();
      if (!select) return;
      const invalid = value && !isFree(value) && duplicates.has(value);
      select.classList.toggle('duplicate', invalid);
      select.title = invalid ? `Dienst ${value} ist zu oft vergeben.` : '';
    });
    return [...duplicates];
  }

  function installSelect(input) {
    const cell = input.closest('td');
    const row = input.closest('tr[data-row-id]');
    if (!cell || !row) return;

    const current = String(input.value || '').trim();
    const currentMode = mode();
    const options = allOptions();
    const allowed = !current || isFree(current) || options.includes(current);
    const available = options.filter((value) => {
      if (isFree(value) || value === current) return true;
      return assignmentCount(value, input) < maxAssignments(value);
    });

    cell.querySelector('.dp-daily-duty-select')?.remove();
    const select = document.createElement('select');
    select.className = `dp-daily-duty-select${allowed ? '' : ' invalid'}`;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = currentMode === 'holiday'
      ? 'Feriendienst oder Frei auswählen'
      : currentMode === 'school'
        ? 'Schultagsdienst oder Frei auswählen'
        : 'Dienst oder Frei auswählen';
    if (current && !allowed && currentMode !== 'holiday') {
      placeholder.textContent = `Dienst ${current} ungültig – anderen Dienst oder Frei wählen`;
    }
    select.appendChild(placeholder);

    available.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = isFree(value)
        ? 'Frei'
        : normalize(value) === 'einsatzwagen'
          ? 'Einsatzwagen'
          : `Dienst ${value}`;
      select.appendChild(option);
    });

    select.value = allowed ? (isFree(current) ? FREE : current) : '';
    input.classList.add('dp-daily-duty-source');
    input.tabIndex = -1;

    select.addEventListener('change', () => {
      const value = select.value;
      if (!value) return;

      if (!isFree(value) && assignmentCount(value, input) >= maxAssignments(value)) {
        select.value = allowed ? (isFree(current) ? FREE : current) : '';
        setStatus(`Dienst ${value} ist bereits in der zulässigen Anzahl vergeben.`, true);
        return;
      }

      input.value = isFree(value) ? FREE : value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      applyDuty(row.dataset.rowId || '', value);
      setStatus(isFree(value)
        ? 'Frei wurde eingetragen. Der Fahrer erscheint unten in der Freiliste.'
        : `${normalize(value) === 'einsatzwagen' ? 'Einsatzwagen' : `Dienst ${value}`} wurde übernommen.`);
      window.setTimeout(install, 80);
      window.setTimeout(renderFreeSummary, 160);
    });

    cell.insertBefore(select, input);
  }

  function install() {
    if (!mayEdit()) return;
    addStyle();
    const inputs = dutyInputs();
    if (!inputs.length) return;
    inputs.forEach(installSelect);
    const duplicates = markDuplicates();
    if (duplicates.length) setStatus(`Doppelvergabe erkannt: Dienst ${duplicates.join(', ')}.`, true);
    renderFreeSummary();
  }

  function schedule() {
    [0, 100, 300, 800].forEach((delay) => window.setTimeout(install, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyPrintWeekday')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const printButton = document.getElementById('dpDailyPrintA4');
      if (printButton) {
        printButton.click();
        setStatus('Der aktuell bearbeitete Tabellenplan wird gedruckt.');
      } else {
        setStatus('Die aktuelle Druckfunktion wird noch geladen. Bitte den Schalter gleich erneut drücken.', true);
      }
      return;
    }

    if (event.target.closest?.('#dpDailySave')) {
      const duplicates = invalidDuplicates();
      if (duplicates.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setStatus(`Speichern nicht möglich: Dienst ${duplicates.join(', ')} ist zu oft vergeben.`, true);
        markDuplicates();
        return;
      }
    }

    if (event.target.closest?.('#dpDailyPrint,#dpDailyPrintA4')) renderFreeSummary();
    if (event.target.closest?.('#loginButton,#dpDailyDutyPlanTab,#dpDailyAddRow,#dpDailyInsertDefaults,#dpDailyPlanRows [data-action]')) schedule();
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.matches?.('#dpDailyPlanRows input[data-field="name"],#dpDailyPlanRows input[data-field="duty"]')) {
      window.setTimeout(renderFreeSummary, 80);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target.id === 'dpDailyPlanDate') schedule();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  window.addEventListener('pageshow', schedule);
  window.addEventListener('focus', schedule);
})();
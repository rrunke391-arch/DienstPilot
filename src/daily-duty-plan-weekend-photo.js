(() => {
  'use strict';

  if (window.__dienstpilotWeekendPhotoTemplateV2) return;
  window.__dienstpilotWeekendPhotoTemplateV2 = true;

  const DATE_ID = 'dpDailyPlanDate';
  const TABLE_ID = 'dpDailyPlanRows';
  const ADD_ID = 'dpDailyAddRow';
  const MARKER_KEY = 'dienstpilot_weekend_photo_template_20260718_v2';
  let running = false;

  const SATURDAY = [
    { duty: '3050', name: 'F.Biermann', bus: 'OS-SU 722', start: '06:03', end: '14:21', departure: '06:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3051', name: 'S.Kelgorn', bus: 'OS-YG 120', start: '06:42', end: '15:21', departure: '07:15', stop: 'Bruchmühlen, Schule' },
    { duty: '3052', name: 'H.J.Husmann', bus: 'OS-LF 223', start: '06:43', end: '14:41', departure: '07:16', stop: 'Buer, Schulzentrum' },
    { duty: '3053', name: 'P.Lhommel', bus: 'OS-XB 925', start: '06:47', end: '14:39', departure: '07:12', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '3054', name: 'W.Blaz', bus: 'OS-BS 725', start: '06:51', end: '19:21', departure: '07:18', stop: 'Westerhausen, Vinkenaue' },
    { duty: '3055', name: 'M.Alsaba', bus: 'OS-DZ 116', start: '07:03', end: '17:04', departure: '07:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3056', name: 'N.Awdullahi', bus: 'OS-EV 118', start: '07:07', end: '16:04', departure: '07:31', stop: 'Gesmold, Schimmweg' },
    { duty: '3057', name: 'K.Alomar', bus: 'OS-ZT 626', start: '09:20', end: '18:21', departure: '09:55', stop: 'Werther, ZOB' },
    { duty: '1340', name: 'F.Biermann', bus: 'OS-MR 825', start: '05:13', end: '14:14', departure: '', stop: '' },
    { duty: '11541', name: 'C.Strotmann', bus: 'OS-MR 825', start: '14:22', end: '00:20', departure: '', stop: '' },
    { duty: 'Einsatzwagen', name: 'Einsatzwagen', bus: 'OS-TG 324', start: '', end: '', departure: '', stop: '' }
  ];

  const SUNDAY = [
    { duty: '3061', name: 'Y.Yasar', bus: 'OS-QS 519', start: '12:03', end: '19:46', departure: '12:20', stop: 'Wellingholzhausen, Schule' },
    { duty: '3062', name: 'N.Murad', bus: 'OS-HD 124', start: '11:47', end: '19:38', departure: '12:12', stop: 'Neuenkirchen, Schulzentrum' },
    { duty: '1943', occurrence: 0, name: 'A.Al Arsan', bus: '', start: '06:56', end: '14:04', departure: '', stop: '' },
    { duty: '1943', occurrence: 1, name: 'N.Ghulami', bus: 'OS-FN 919', start: '13:44', end: '21:47', departure: '', stop: '' }
  ];

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function currentDate() {
    return String(document.getElementById(DATE_ID)?.value || '').trim();
  }

  function dayOfWeek(date) {
    const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return -1;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0).getDay();
  }

  function templateForDate(date) {
    const day = dayOfWeek(date);
    if (day === 6) return SATURDAY;
    if (day === 0) return SUNDAY;
    return null;
  }

  function readMarkers() {
    try {
      const value = JSON.parse(localStorage.getItem(MARKER_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function marked(date) {
    return Boolean(date && readMarkers()[date]);
  }

  function mark(date) {
    const markers = readMarkers();
    markers[date] = true;
    localStorage.setItem(MARKER_KEY, JSON.stringify(markers));
  }

  function rows() {
    return [...document.querySelectorAll(`#${TABLE_ID} tr[data-row-id]`)];
  }

  function rowDuty(row) {
    return normalize(row?.querySelector('input[data-field="duty"]')?.value);
  }

  function rowsForDuty(duty) {
    const wanted = normalize(duty);
    return rows().filter((row) => rowDuty(row) === wanted);
  }

  function findRow(item) {
    return rowsForDuty(item.duty)[Number(item.occurrence || 0)] || null;
  }

  function dispatchInput(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setField(row, field, value) {
    const input = row?.querySelector(`input[data-field="${field}"]`);
    if (!input) return;
    input.value = String(value ?? '');
    dispatchInput(input);
  }

  async function createRow(item) {
    const add = document.getElementById(ADD_ID);
    if (!add || add.disabled) return null;
    add.click();
    await wait(40);
    const blank = rows().find((row) => !rowDuty(row));
    if (!blank) return null;
    const duty = blank.querySelector('input[data-field="duty"]');
    if (!duty || duty.disabled) return null;
    duty.dataset.dpDutyCommit = '1';
    duty.value = item.duty;
    dispatchInput(duty);
    delete duty.dataset.dpDutyCommit;
    await wait(55);
    return findRow(item);
  }

  async function removeForeignRows(allowed) {
    for (const row of rows()) {
      if (allowed.has(rowDuty(row))) continue;
      const remove = row.querySelector('[data-action="delete"]');
      if (remove && !remove.disabled) {
        remove.click();
        await wait(20);
      }
    }
  }

  async function removeExcessRows(template) {
    const counts = new Map();
    template.forEach((item) => counts.set(normalize(item.duty), (counts.get(normalize(item.duty)) || 0) + 1));
    for (const [duty, allowedCount] of counts) {
      const matching = rowsForDuty(duty);
      for (let index = matching.length - 1; index >= allowedCount; index -= 1) {
        const remove = matching[index]?.querySelector('[data-action="delete"]');
        if (remove && !remove.disabled) {
          remove.click();
          await wait(20);
        }
      }
    }
  }

  function setStatus(text) {
    const status = document.getElementById('dpDailyPlanStatus');
    if (!status) return;
    status.textContent = text;
    status.className = 'dp-daily-status ok';
  }

  async function applyWeekendTemplate(force = false) {
    const date = currentDate();
    const template = templateForDate(date);
    if (!template || running || (!force && marked(date))) return;

    const add = document.getElementById(ADD_ID);
    if (!add || add.disabled) return;

    running = true;
    try {
      const allowed = new Set(template.map((item) => normalize(item.duty)));
      await removeForeignRows(allowed);
      await removeExcessRows(template);

      for (const item of template) {
        let row = findRow(item);
        if (!row) row = await createRow(item);
        if (!row) continue;
        for (const field of ['name', 'bus', 'start', 'end', 'departure', 'stop']) {
          setField(row, field, item[field]);
        }
      }

      mark(date);
      setStatus(dayOfWeek(date) === 6
        ? 'Samstagsdienste geladen: Dienst 1340 als Frühschicht und Dienst 11541 als Spätschicht mit jeweils eigenem Fahrer.'
        : 'Nur die Sonntagsdienste wurden zum Bearbeiten geladen. Alle Kennzeichen bleiben verschiebbar.');
    } finally {
      running = false;
    }
  }

  window.dienstpilotApplyWeekendPhotoTemplate = () => applyWeekendTemplate(true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === DATE_ID) {
      [180, 500, 900].forEach((delay) => window.setTimeout(applyWeekendTemplate, delay));
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#dpDailyEditSaturday,#dpDailyEditSunday,#dpDailyDutyPlanTab')) {
      [250, 600, 1100].forEach((delay) => window.setTimeout(applyWeekendTemplate, delay));
    }
  }, true);

  [500, 1200, 2500].forEach((delay) => window.setTimeout(applyWeekendTemplate, delay));
  window.addEventListener('pageshow', applyWeekendTemplate);
  window.addEventListener('focus', applyWeekendTemplate);
})();
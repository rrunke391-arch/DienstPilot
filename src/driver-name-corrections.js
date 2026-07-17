(() => {
  'use strict';

  if (window.__dienstpilotDriverNameCorrectionsV1) return;
  window.__dienstpilotDriverNameCorrectionsV1 = true;

  const SPLIT_ASSIGNMENT_KEY = 'dienstpilot_split_shift_assignments_v4';

  const REQUIRED_NAMES = [
    'K.Alomar',
    'H.AI Sayek',
    'T.Wiemann',
    'N.Murad',
    'F.Biermann',
    'M.Schweppe',
    'W.Wüllner',
    'A.Szczepanik',
    'P.Lommel',
    'M.Entrup',
    'A.Gerding',
    'A.Kocdemir',
    'S.Kurta'
  ];

  const ALIASES = new Map([
    ['alomar', 'K.Alomar'],
    ['kalomar', 'K.Alomar'],

    ['sayek', 'H.AI Sayek'],
    ['halsayek', 'H.AI Sayek'],
    ['haisayek', 'H.AI Sayek'],

    ['wiemann', 'T.Wiemann'],
    ['twiemann', 'T.Wiemann'],

    ['murad', 'N.Murad'],
    ['nmurad', 'N.Murad'],

    ['biermann', 'F.Biermann'],
    ['fbiermann', 'F.Biermann'],

    ['schweppe', 'M.Schweppe'],
    ['mschweppe', 'M.Schweppe'],

    ['wullner', 'W.Wüllner'],
    ['wwullner', 'W.Wüllner'],

    ['szczepanik', 'A.Szczepanik'],
    ['aszczepanik', 'A.Szczepanik'],

    ['lommel', 'P.Lommel'],
    ['lhommel', 'P.Lommel'],
    ['plommel', 'P.Lommel'],
    ['plhommel', 'P.Lommel'],

    ['entrup', 'M.Entrup'],
    ['mentrup', 'M.Entrup'],

    ['gerding', 'A.Gerding'],
    ['agerding', 'A.Gerding'],

    ['kocdemir', 'A.Kocdemir'],
    ['akocdemir', 'A.Kocdemir'],

    ['kurta', 'S.Kurta'],
    ['skurta', 'S.Kurta']
  ]);

  let running = false;
  let timer = 0;
  let observer = null;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function compact(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, '');
  }

  function canonicalSingle(value) {
    const original = String(value || '').trim();
    if (!original) return '';
    return ALIASES.get(compact(original)) || original;
  }

  function canonicalName(value) {
    const original = String(value || '').trim();
    if (!original) return '';

    if (original.includes('/')) {
      const names = [];
      original.split('/').forEach((part) => {
        const corrected = canonicalSingle(part);
        if (!corrected) return;
        if (!names.some((name) => normalize(name) === normalize(corrected))) names.push(corrected);
      });
      return names.join(' / ');
    }

    return canonicalSingle(original);
  }

  window.dienstpilotCanonicalDriverName = canonicalName;

  function dispatchCorrection(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function correctInputs() {
    document.querySelectorAll([
      '#dpDailyPlanRows input[data-field="name"]',
      '#dpAssignDriverV2',
      'input[data-driver-name]'
    ].join(',')).forEach((input) => {
      const corrected = canonicalName(input.value);
      if (!corrected || corrected === String(input.value || '').trim()) return;
      input.value = corrected;
      dispatchCorrection(input);
    });
  }

  function displayNameForOption(option) {
    const shown = String(option.textContent || option.label || option.value || '').trim();
    return canonicalName(shown);
  }

  function rebuildDriverSelect(select) {
    const selectedOption = select.selectedOptions?.[0] || null;
    const selected = canonicalName(selectedOption?.textContent || select.value);
    const names = [];

    [...select.options].forEach((option) => {
      if (!option.value && !String(option.textContent || '').trim()) return;
      if (!option.value && normalize(option.textContent).includes('fahrer auswahlen')) return;
      const corrected = displayNameForOption(option);
      if (!corrected || normalize(corrected).includes('fahrer auswahlen')) return;
      if (!names.some((name) => normalize(name) === normalize(corrected))) names.push(corrected);
    });

    REQUIRED_NAMES.forEach((name) => {
      if (!names.some((existing) => normalize(existing) === normalize(name))) names.push(name);
    });

    names.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));

    const desired = [''].concat(names);
    const current = [...select.options].map((option) => option.value === '' ? '' : `${option.value}|${option.textContent}`);
    const expected = [''].concat(names.map((name) => `${name}|${name}`));
    const same = current.length === expected.length && current.every((value, index) => value === expected[index]);

    if (!same) {
      const fragment = document.createDocumentFragment();
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Fahrer auswählen';
      fragment.appendChild(blank);

      names.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        fragment.appendChild(option);
      });
      select.replaceChildren(fragment);
    }

    const selectedMatch = names.find((name) => normalize(name) === normalize(selected));
    select.value = selectedMatch || '';
  }

  function correctProfileOptions(select) {
    const selectedValue = select.value;
    const byCanonical = new Map();

    [...select.options].forEach((option) => {
      const corrected = displayNameForOption(option);
      if (!corrected) return;
      const key = normalize(corrected);
      const existing = byCanonical.get(key);

      if (!existing) {
        option.label = corrected;
        option.textContent = corrected;
        byCanonical.set(key, option);
        return;
      }

      const keepCurrent = option.value === selectedValue && existing.value !== selectedValue;
      if (keepCurrent) {
        existing.remove();
        option.label = corrected;
        option.textContent = corrected;
        byCanonical.set(key, option);
      } else {
        option.remove();
      }
    });
  }

  function correctSelects() {
    document.querySelectorAll([
      '#dpDailyPlanRows .dp-daily-driver-select',
      '#dpStableSplitShiftPanel .dp-driver-assignment-select'
    ].join(',')).forEach(rebuildDriverSelect);

    document.querySelectorAll('#kollegeSelect,#dpAssignDriversV2').forEach(correctProfileOptions);
  }

  function migrateSplitAssignments() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SPLIT_ASSIGNMENT_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object') return;
      let changed = false;

      Object.values(parsed).forEach((assignment) => {
        if (!assignment || typeof assignment !== 'object') return;
        ['early', 'late'].forEach((field) => {
          const corrected = canonicalName(assignment[field]);
          if (corrected && corrected !== assignment[field]) {
            assignment[field] = corrected;
            changed = true;
          }
        });
      });

      if (changed) localStorage.setItem(SPLIT_ASSIGNMENT_KEY, JSON.stringify(parsed));
    } catch {}
  }

  function install() {
    if (running) return;
    running = true;
    try {
      migrateSplitAssignments();
      correctInputs();
      correctSelects();
    } finally {
      running = false;
    }
  }

  function schedule(delay = 60) {
    window.clearTimeout(timer);
    timer = window.setTimeout(install, delay);
  }

  function startObserver() {
    if (!document.body || observer) return;
    observer = new MutationObserver(() => schedule(80));
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('change', (event) => {
    if (event.target.matches?.([
      '#dpDailyPlanRows .dp-daily-driver-select',
      '#dpStableSplitShiftPanel .dp-driver-assignment-select',
      '#kollegeSelect',
      '#dpAssignDriverV2'
    ].join(','))) schedule(20);
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#loginButton,#dpDailyDutyPlanTab,#dpDutyAssignmentV2,#dpDailyAddRow,#dpDailyInsertDefaults,.tab[data-tab="eingabe"]')) {
      [0, 150, 500, 1200].forEach((delay) => window.setTimeout(install, delay));
    }
  }, true);

  function start() {
    startObserver();
    install();
    [250, 700, 1600, 3200, 6000].forEach((delay) => window.setTimeout(install, delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', () => schedule(100));
  window.addEventListener('focus', () => schedule(100));
})();
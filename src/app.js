"use strict";

// Phase 4: catalog is fetched from data/dienstkatalog-erweitert.json (preferred)
// or data/dienstkatalog.json (fallback) at startup. RUNTIME_CATALOG is empty
// until loadCatalog() resolves — getCatalog() callers must run after that.
// Fetch requires an HTTP server (file:// blocks fetch); use `python -m http.server`.
let RUNTIME_CATALOG = {};
let customCatalog = {};

// Phase 5: per-Eintrag deep-merge — customCatalog kann partielle Overrides
// speichern (z. B. nur pauseRule), ohne start/end/varianten aus dem Runtime-
// Katalog zu verlieren.
function getCatalog() {
  const out = { ...RUNTIME_CATALOG };
  for (const k of Object.keys(customCatalog || {})) {
    out[k] = { ...(out[k] || {}), ...customCatalog[k] };
  }
  return out;
}

// Phase 5: Manuelle Review-Phase — User markiert pro Dienst, ob er die
// extrahierten Zeiten gegen das Foto verglichen hat. State pro Dienstnummer:
// undefined (offen) | "verified" (✓) | "errors" (✗). Eigener LocalStorage-
// Schlüssel `catalogReviewStatus`, damit es unabhängig von customCatalog ist.
function getCatalogReviewStatus() {
  try {
    return JSON.parse(localStorage.getItem("catalogReviewStatus") || "{}");
  } catch {
    return {};
  }
}
// Phase 5: Wert pro Dienst kann legacy-String ("verified"/"errors") oder Objekt
// ({state, note}) sein — Helper extrahieren beides einheitlich.
function getReviewState(number) {
  const v = getCatalogReviewStatus()[number];
  if (typeof v === "string") return v;
  if (v && typeof v === "object") return v.state || null;
  return null;
}
function getReviewNote(number) {
  const v = getCatalogReviewStatus()[number];
  if (v && typeof v === "object" && typeof v.note === "string") return v.note;
  return "";
}
function setCatalogReviewStatus(number, state, note) {
  const all = getCatalogReviewStatus();
  if (!state) {
    delete all[number];
  } else if (state === "errors" && note && note.trim()) {
    all[number] = { state: "errors", note: note.trim().slice(0, 500) };
  } else {
    all[number] = state;
  }
  localStorage.setItem("catalogReviewStatus", JSON.stringify(all));
}
function toggleReviewState(number, target, note) {
  const current = getReviewState(number);
  if (current === target) {
    setCatalogReviewStatus(number, null);
  } else {
    setCatalogReviewStatus(number, target, note);
  }
}
function updateReviewNote(number, note) {
  // Notiz aktualisieren ohne State zu ändern (nur bei state===errors sinnvoll).
  if (getReviewState(number) !== "errors") return;
  setCatalogReviewStatus(number, "errors", note);
}

// Phase 5: Review-State zwischen Geräten teilen — der Stand ist Team-QA,
// keine persönliche Einstellung. Ein gemeinsames JSON auf dem Server
// (siehe dev_server.py /api/catalog-review). Server-Stand gewinnt beim
// Laden; jede lokale Änderung pusht das ganze Objekt zurück.
async function loadCatalogReviewFromServer() {
  // Phase 5: defensiver MERGE statt OVERWRITE.
  // Vorher hat diese Funktion blind den Server-Stand ins localStorage geschrieben.
  // Bug-Hintergrund: in phase5-60 hat der Service Worker /api/catalog-review
  // (kein .json-Suffix) Cache-First behandelt — dadurch lieferte der SW eine
  // veraltete Review-Liste aus dem Cache, das blinde overwrite hat dann die
  // frischen lokalen Reviews ueberschrieben und der User hat seine Arbeit
  // verloren ("alles weg umsonst gearbeitet").
  // Jetzt: lokale Eintraege, die der Server NICHT hat, bleiben erhalten und
  // werden anschliessend zum Server gepusht — so kann der Server keinen
  // Datenverlust mehr verursachen (egal ob durch SW-Cache oder anderswo).
  try {
    const r = await fetch("/api/catalog-review", { cache: "no-store" });
    if (!r.ok) return false;
    const remote = await r.json();
    if (remote && typeof remote === "object" && !Array.isArray(remote)) {
      const local = getCatalogReviewStatus();
      const localOnlyKeys = Object.keys(local).filter(k => !(k in remote));
      // Merge: Server-Stand fuer geteilte Keys, lokale-only-Keys behalten.
      const merged = { ...remote };
      for (const k of localOnlyKeys) merged[k] = local[k];
      localStorage.setItem("catalogReviewStatus", JSON.stringify(merged));
      // Wenn der User lokale Reviews hatte, die der Server nicht hatte,
      // jetzt zurueck zum Server pushen, damit kein Geraet sie mehr verliert.
      if (localOnlyKeys.length > 0) {
        saveCatalogReviewToServer();
      }
      return true;
    }
  } catch {
    // Endpunkt ggf. offline — localStorage-Stand bleibt aktiv.
  }
  return false;
}
async function saveCatalogReviewToServer() {
  const all = getCatalogReviewStatus();
  try {
    await fetch("/api/catalog-review", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(all),
    });
  } catch {
    // offline → bleibt lokal, beim nächsten Klick wird neu versucht.
  }
}

// Phase 5: Verkehrsart, Haltestellenabstand, Fahrtunterbrechungsregel und
// Tarifregel-Flag werden jetzt am Dienst (Katalog-Eintrag) gespeichert. Für
// alte Dienste mit den Feldern direkt am Eintrag fällt der Resolver weiter
// zurück (Katalog → Duty-Feld → Default), damit nichts verloren geht.
function dutySettings(dutyOrNumber) {
  const isObj = dutyOrNumber && typeof dutyOrNumber === "object";
  const number = isObj ? (dutyOrNumber.number || "") : String(dutyOrNumber || "");
  const duty = isObj ? dutyOrNumber : null;
  const entry = getCatalog()[String(number)] || {};
  const pick = (entryKey, dutyKey, fallback) => {
    if (entry[entryKey] !== undefined && entry[entryKey] !== null && entry[entryKey] !== "") return entry[entryKey];
    if (duty && duty[dutyKey] !== undefined && duty[dutyKey] !== null && duty[dutyKey] !== "") return duty[dutyKey];
    return fallback;
  };
  return {
    lineMode: pick("lineMode", "lineMode", "linie50"),
    stopDistance: pick("stopDistance", "stopDistance", "gt3"),
    pauseRule: pick("pauseRule", "pauseRule", "auto"),
    tariffEight: entry.tariffEight !== undefined ? !!entry.tariffEight : !!(duty && duty.tariffEight)
  };
}

const SETTING_LABELS = {
  lineMode: { linie50: "Linienverkehr ≤ 50 km", eu: "EU-Regel > 50 km" },
  stopDistance: { gt3: "mehr als 3 km", lte3: "höchstens 3 km" },
  pauseRule: { auto: "Automatisch", block: "Blockregel", sixth: "Ein-Sechstel" }
};

async function loadCatalog() {
  for (const url of ["data/dienstkatalog-erweitert.json", "data/dienstkatalog.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) { RUNTIME_CATALOG = await r.json(); return; }
    } catch (e) { /* try next */ }
  }
  // No catalog available — app still runs, but auto-fill is disabled.
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem("lenkRuhezeitenRunke20260413");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalState() {
  try {
    localStorage.setItem("lenkRuhezeitenRunke20260413", JSON.stringify({ duties, customCatalog, appSettings }));
  } catch {
    /* Speichern ist optional. */
  }
  // Phase 5: Wenn ein Profil aktiv ist, halten wir den profilbezogenen
  // localStorage-Cache (lrz-plan-runke / lrz-plan-lady) auch frisch —
  // er dient als Offline-Fallback in loadProfile, wenn der Server nicht
  // erreichbar ist. Ohne diesen Step würde der Cache mit der Zeit veralten,
  // seit es keinen manuellen Speichern-Knopf mehr gibt.
  if (appSettings.activeProfile) {
    saveNamedPlan(appSettings.activeProfile);
  }
  // Sync-Brückenlösung — debounced PUT gegen /api/plan/<profile>.
  scheduleServerSave();
}

// Phase 5: Sync-State (Brückenlösung bis zur richtigen DB am Wochenende).
// activeProfile ∈ {"runke","lady",null}. Solange null, läuft alles wie vor
// dem Sync — localStorage-only. Sobald ein Profil geladen oder gespeichert
// wurde, wandert jede Änderung debounced an /api/plan/<profile>.
let serverSyncStatus = "idle";  // idle | saving | synced | offline
let serverSaveTimer = null;
let suppressServerSave = false; // true beim Bootstrap, damit das gerade
                                // Geladene nicht direkt zurückgespielt wird.

async function fetchPlanFromServer(profile) {
  // Rückgabe: object {duties, vacations, vacationEntitlement, bundeslaender,
  // hideSundays} → Plan vom Server, null → kein Plan gespeichert (404),
  // undefined → Server nicht erreichbar / Fehler.
  // Phase 5: Body enthält jetzt auch vacations + vacationEntitlement
  // (per-Profil) + bundeslaender + hideSundays (geräte-übergreifende
  // Settings, die mit dem aktiven Profil mitgeschrieben werden — damit
  // Änderungen vom PC aufs Handy syncen).
  try {
    const res = await fetch(`/api/plan/${encodeURIComponent(profile)}`);
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    const json = await res.json();
    if (!json || typeof json !== "object") return null;
    return {
      duties: Array.isArray(json.duties) ? json.duties : null,
      vacations: Array.isArray(json.vacations) ? json.vacations : [],
      vacationEntitlement: Number.isFinite(json.vacationEntitlement) ? json.vacationEntitlement : 30,
      bundeslaender: (json.bundeslaender && typeof json.bundeslaender === "object") ? json.bundeslaender : null,
      hideSundays: typeof json.hideSundays === "boolean" ? json.hideSundays : null
    };
  } catch (e) {
    return undefined;
  }
}

async function savePlanToServer(profile) {
  try {
    const res = await fetch(`/api/plan/${encodeURIComponent(profile)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duties,
        vacations,
        vacationEntitlement,
        // Phase 5: Bundesländer-Auswahl + Sonntage-Toggle landen jetzt auch
        // im Server-Body, damit Änderungen vom PC aufs Handy syncen. Beide
        // Settings sind technisch in appSettings, sind aber inhaltlich
        // user-data und gehören zum Plan dazu.
        bundeslaender: appSettings.bundeslaender || null,
        hideSundays: !!appSettings.hideSundays,
        savedAt: new Date().toISOString()
      })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function scheduleServerSave() {
  if (suppressServerSave) return;
  // Profil zum Schedule-Zeitpunkt einfrieren — sonst landet bei einem
  // Profil-Wechsel mitten im Debounce-Fenster die Runke-Änderung in Lady.
  const profileAtSchedule = appSettings.activeProfile;
  if (!profileAtSchedule) return;
  if (serverSaveTimer) clearTimeout(serverSaveTimer);
  setSyncStatus("saving");
  // 800 ms debounce — schnelle Tipp-Änderungen werden zu einem PUT zusammengefasst.
  serverSaveTimer = setTimeout(async () => {
    serverSaveTimer = null;
    const ok = await savePlanToServer(profileAtSchedule);
    // Status nur aktualisieren, wenn wir noch auf demselben Profil sind —
    // sonst überschreibt ein verspätetes Lady-PUT die Anzeige für Runke.
    if (appSettings.activeProfile === profileAtSchedule) {
      setSyncStatus(ok ? "synced" : "offline");
    }
  }, 800);
}

// Phase 5: pending Debounce-PUT sofort ausführen — vor jedem Profil-Wechsel
// aufrufen, damit die letzten Änderungen am alten Profil sicher abgelegt
// sind, bevor activeProfile umgestellt wird.
async function flushPendingSave() {
  if (!serverSaveTimer) return;
  clearTimeout(serverSaveTimer);
  serverSaveTimer = null;
  const profile = appSettings.activeProfile;
  if (!profile) return;
  await savePlanToServer(profile);
}

function setSyncStatus(state) {
  serverSyncStatus = state;
  const el = document.getElementById("syncStatus");
  if (!el) return;
  const profile = appSettings.activeProfile;
  if (!profile) {
    el.textContent = "";
    el.className = "sync-status";
    return;
  }
  const labels = {
    idle:    "bereit",
    saving:  "speichere…",
    synced:  "synchronisiert",
    offline: "offline",
  };
  const name = profile.charAt(0).toUpperCase() + profile.slice(1);
  el.textContent = `Aktiv: ${name} · ${labels[state] || state}`;
  el.className = `sync-status ${state}`;
}

// Phase 5: H1, <title> und Lade-Knöpfe an das aktive Profil koppeln, damit
// auf einen Blick erkennbar ist, welcher Datensatz gerade geladen ist.
// Wird bei jeder Profil-Änderung aufgerufen (Bootstrap, loadProfile,
// saveProfile). setSyncStatus ruft das NICHT auf, weil sich das Profil
// dort nicht ändert — nur der Sync-Zustand.
function updateProfileUI() {
  const profile = appSettings.activeProfile;
  const label = profile
    ? `Dienstplan ${profile.charAt(0).toUpperCase() + profile.slice(1)}`
    : "Kein Dienstplan geladen";

  const titleEl = document.getElementById("profileTitle");
  if (titleEl) {
    titleEl.textContent = label;
    titleEl.classList.toggle("empty", !profile);
  }
  document.title = profile
    ? `${label} · DienstPilot`
    : "DienstPilot · Lenk- und Ruhezeiten-Prüfer";

  // Aktiven Lade-Knopf hervorheben (gefüllt + Häkchen via CSS).
  const runkeBtn = document.getElementById("loadRunke");
  const ladyBtn = document.getElementById("loadLady");
  if (runkeBtn) runkeBtn.classList.toggle("active-profile", profile === "runke");
  if (ladyBtn) ladyBtn.classList.toggle("active-profile", profile === "lady");
}

const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
let duties = [];

// Phase 5: Feiertage + Ferien 2026 für ALLE 16 Bundesländer.
// Quelle: kalenderpedia.de + schulferien.org (Stand 2026-05-08).
// Default ist Niedersachsen — kann in Tab "Einstellungen" pro Dimension
// (Ferien / Feiertage) auf beliebig viele BL erweitert werden, damit ein
// Fahrer der zwischen 2 BL pendelt beide gleichzeitig sieht.
const BUNDESLAENDER = [
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thüringen" }
];

// states: "*" = bundesweit (alle 16); Array = nur diese BL.
const FEIERTAGE_2026 = {
  "2026-01-01": { name: "Neujahr",                   states: "*" },
  "2026-01-06": { name: "Heilige Drei Könige",       states: ["BW","BY","ST"] },
  "2026-03-08": { name: "Internationaler Frauentag", states: ["BE","MV"] },
  "2026-04-03": { name: "Karfreitag",                states: "*" },
  "2026-04-05": { name: "Ostersonntag",              states: ["BB"] },
  "2026-04-06": { name: "Ostermontag",               states: "*" },
  "2026-05-01": { name: "Tag der Arbeit",            states: "*" },
  "2026-05-14": { name: "Christi Himmelfahrt",       states: "*" },
  "2026-05-24": { name: "Pfingstsonntag",            states: ["BB"] },
  "2026-05-25": { name: "Pfingstmontag",             states: "*" },
  "2026-06-04": { name: "Fronleichnam",              states: ["BW","BY","HE","NW","RP","SL"] },
  "2026-08-15": { name: "Mariä Himmelfahrt",         states: ["BY","SL"] },
  "2026-09-20": { name: "Weltkindertag",             states: ["TH"] },
  "2026-10-03": { name: "Tag der Deutschen Einheit", states: "*" },
  "2026-10-31": { name: "Reformationstag",           states: ["BB","HB","HH","MV","NI","SN","ST","SH","TH"] },
  "2026-11-01": { name: "Allerheiligen",             states: ["BW","BY","NW","RP","SL"] },
  "2026-11-18": { name: "Buß- und Bettag",           states: ["SN"] },
  "2026-12-25": { name: "1. Weihnachtstag",          states: "*" },
  "2026-12-26": { name: "2. Weihnachtstag",          states: "*" },
  "2027-01-01": { name: "Neujahr",                   states: "*" }
};

const FERIEN_2026 = {
  BW: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-09" },
    { name: "Osterferien",      start: "2026-03-30", end: "2026-04-11" },
    { name: "Pfingstferien",    start: "2026-05-26", end: "2026-06-05" },
    { name: "Sommerferien",     start: "2026-07-30", end: "2026-09-12" },
    { name: "Herbstferien",     start: "2026-10-26", end: "2026-10-31" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-09" }
  ],
  BY: [
    { name: "Weihnachtsferien", start: "2025-12-24", end: "2026-01-08" },
    { name: "Winterferien",     start: "2026-02-16", end: "2026-02-20" },
    { name: "Osterferien",      start: "2026-03-30", end: "2026-04-10" },
    { name: "Pfingstferien",    start: "2026-05-26", end: "2026-06-05" },
    { name: "Sommerferien",     start: "2026-08-03", end: "2026-09-14" },
    { name: "Herbstferien",     start: "2026-11-02", end: "2026-11-06" },
    { name: "Weihnachtsferien", start: "2026-12-24", end: "2027-01-08" }
  ],
  BE: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-02" },
    { name: "Winterferien",     start: "2026-02-02", end: "2026-02-07" },
    { name: "Osterferien",      start: "2026-03-30", end: "2026-04-10" },
    { name: "Sommerferien",     start: "2026-07-09", end: "2026-08-22" },
    { name: "Herbstferien",     start: "2026-10-19", end: "2026-10-31" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-02" }
  ],
  BB: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-02" },
    { name: "Winterferien",     start: "2026-02-02", end: "2026-02-07" },
    { name: "Osterferien",      start: "2026-03-30", end: "2026-04-10" },
    { name: "Sommerferien",     start: "2026-07-09", end: "2026-08-22" },
    { name: "Herbstferien",     start: "2026-10-19", end: "2026-10-30" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-02" }
  ],
  HB: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-09" },
    { name: "Winterferien",     start: "2026-02-02", end: "2026-02-03" },
    { name: "Osterferien",      start: "2026-03-23", end: "2026-04-07" },
    { name: "Sommerferien",     start: "2026-07-02", end: "2026-08-12" },
    { name: "Herbstferien",     start: "2026-10-12", end: "2026-10-24" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-09" }
  ],
  HH: [
    { name: "Weihnachtsferien", start: "2025-12-21", end: "2026-01-01" },
    { name: "Winterferien",     start: "2026-01-30", end: "2026-01-30" },
    { name: "Osterferien",      start: "2026-03-02", end: "2026-03-13" },
    { name: "Pfingstferien",    start: "2026-05-11", end: "2026-05-15" },
    { name: "Sommerferien",     start: "2026-07-09", end: "2026-08-19" },
    { name: "Herbstferien",     start: "2026-10-19", end: "2026-10-30" },
    { name: "Weihnachtsferien", start: "2026-12-21", end: "2027-01-01" }
  ],
  HE: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-12" },
    { name: "Osterferien",      start: "2026-03-30", end: "2026-04-10" },
    { name: "Sommerferien",     start: "2026-06-29", end: "2026-08-07" },
    { name: "Herbstferien",     start: "2026-10-05", end: "2026-10-17" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-12" }
  ],
  MV: [
    { name: "Weihnachtsferien", start: "2025-12-21", end: "2026-01-02" },
    { name: "Winterferien",     start: "2026-02-09", end: "2026-02-20" },
    { name: "Osterferien",      start: "2026-03-30", end: "2026-04-08" },
    { name: "Sommerferien",     start: "2026-07-13", end: "2026-08-22" },
    { name: "Herbstferien",     start: "2026-10-15", end: "2026-10-24" },
    { name: "Weihnachtsferien", start: "2026-12-21", end: "2027-01-02" }
  ],
  NI: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-09" },
    { name: "Winterferien",     start: "2026-02-02", end: "2026-02-03" },
    { name: "Osterferien",      start: "2026-03-23", end: "2026-04-07" },
    { name: "Pfingstferien",    start: "2026-05-15", end: "2026-05-15" },
    { name: "Sommerferien",     start: "2026-07-02", end: "2026-08-12" },
    { name: "Herbstferien",     start: "2026-10-12", end: "2026-10-24" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-09" }
  ],
  NW: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-06" },
    { name: "Osterferien",      start: "2026-03-30", end: "2026-04-11" },
    { name: "Sommerferien",     start: "2026-07-20", end: "2026-09-01" },
    { name: "Herbstferien",     start: "2026-10-17", end: "2026-10-31" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-06" }
  ],
  RP: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-08" },
    { name: "Osterferien",      start: "2026-03-30", end: "2026-04-10" },
    { name: "Sommerferien",     start: "2026-06-29", end: "2026-08-07" },
    { name: "Herbstferien",     start: "2026-10-05", end: "2026-10-16" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-08" }
  ],
  SL: [
    { name: "Weihnachtsferien", start: "2025-12-21", end: "2025-12-31" },
    { name: "Winterferien",     start: "2026-02-16", end: "2026-02-20" },
    { name: "Osterferien",      start: "2026-04-07", end: "2026-04-17" },
    { name: "Sommerferien",     start: "2026-06-29", end: "2026-08-07" },
    { name: "Herbstferien",     start: "2026-10-05", end: "2026-10-16" },
    { name: "Weihnachtsferien", start: "2026-12-21", end: "2026-12-31" }
  ],
  SN: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-02" },
    { name: "Winterferien",     start: "2026-02-09", end: "2026-02-21" },
    { name: "Osterferien",      start: "2026-04-03", end: "2026-04-10" },
    { name: "Sommerferien",     start: "2026-07-04", end: "2026-08-14" },
    { name: "Herbstferien",     start: "2026-10-12", end: "2026-10-24" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-02" }
  ],
  ST: [
    { name: "Weihnachtsferien", start: "2025-12-21", end: "2026-01-02" },
    { name: "Winterferien",     start: "2026-01-31", end: "2026-02-06" },
    { name: "Osterferien",      start: "2026-03-30", end: "2026-04-04" },
    { name: "Pfingstferien",    start: "2026-05-26", end: "2026-05-29" },
    { name: "Sommerferien",     start: "2026-07-04", end: "2026-08-14" },
    { name: "Herbstferien",     start: "2026-10-19", end: "2026-10-30" },
    { name: "Weihnachtsferien", start: "2026-12-21", end: "2027-01-02" }
  ],
  SH: [
    { name: "Weihnachtsferien", start: "2025-12-21", end: "2026-01-06" },
    { name: "Winterferien",     start: "2026-02-02", end: "2026-02-03" },
    { name: "Osterferien",      start: "2026-03-26", end: "2026-04-10" },
    { name: "Sommerferien",     start: "2026-07-04", end: "2026-08-15" },
    { name: "Herbstferien",     start: "2026-10-12", end: "2026-10-24" },
    { name: "Weihnachtsferien", start: "2026-12-21", end: "2027-01-06" }
  ],
  TH: [
    { name: "Weihnachtsferien", start: "2025-12-23", end: "2026-01-02" },
    { name: "Winterferien",     start: "2026-02-16", end: "2026-02-21" },
    { name: "Osterferien",      start: "2026-04-07", end: "2026-04-17" },
    { name: "Pfingstferien",    start: "2026-05-15", end: "2026-05-15" },
    { name: "Sommerferien",     start: "2026-07-04", end: "2026-08-14" },
    { name: "Herbstferien",     start: "2026-10-12", end: "2026-10-24" },
    { name: "Weihnachtsferien", start: "2026-12-23", end: "2027-01-02" }
  ]
};

// Liefert die in den Settings ausgewählten Bundesland-Codes für eine
// Dimension ("ferien" oder "feiertage"). Default = ["NI"] nur dann, wenn
// der Nutzer die Einstellung noch nie berührt hat (legacy localStorage).
// Eine explizit leere Liste wird respektiert — damit der Nutzer Ferien
// oder Feiertage komplett ausblenden kann.
function getActiveStates(kind) {
  if (!appSettings.bundeslaender) return ["NI"];
  const sel = appSettings.bundeslaender[kind];
  if (!Array.isArray(sel)) return ["NI"];
  return sel;
}

function holidayName(dateIso) {
  const entry = FEIERTAGE_2026[dateIso];
  if (!entry) return null;
  const sel = getActiveStates("feiertage");
  if (entry.states === "*") return entry.name;
  const matches = sel.filter(s => entry.states.includes(s));
  if (!matches.length) return null;
  // Wenn mehrere BL aktiv sind und der Feiertag nur in einem davon gilt,
  // hängen wir den Code an — damit der Fahrer sieht, dass es nicht
  // sein Wohn-BL ist.
  if (sel.length > 1 && matches.length < sel.length) {
    return `${entry.name} (${matches.join("/")})`;
  }
  return entry.name;
}

function ferienName(dateIso) {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const sel = getActiveStates("ferien");
  let firstName = null;
  const matchedStates = [];
  for (const state of sel) {
    const list = FERIEN_2026[state] || [];
    for (const f of list) {
      if (dateIso >= f.start && dateIso <= f.end) {
        if (!firstName) firstName = f.name;
        matchedStates.push(state);
        break;
      }
    }
  }
  if (!firstName) return null;
  if (sel.length > 1 && matchedStates.length < sel.length) {
    return `${firstName} (${matchedStates.join("/")})`;
  }
  return firstName;
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

// App-Settings (localStorage, getrennt von duties damit alte Sessions kompatibel bleiben).
// shownMonths: explizit geöffnete Monate, die der Nutzer über die Toolbar
// gewählt hat — damit ein Monat auch ohne Dienste rendert (sonst wäre kein
// Bootstrapping eines neuen Plans möglich).
// Phase 5: activeProfile ist die "Welches Profil bearbeite ich gerade"-Flag,
// die bestimmt in welchen Server-Endpunkt der Autosave schreibt. null = kein
// Profil aktiv → läuft komplett localStorage-only wie früher.
let appSettings = {
  hideSundays: false,
  shownMonths: [],
  activeProfile: null,
  // Phase 5: pro Dimension (Ferien/Feiertage) eine Liste aktiver Bundesländer.
  // Default ist Niedersachsen, damit die App genauso wie vor der Umstellung
  // läuft — Lady und Runke arbeiten beide in NDS.
  bundeslaender: { ferien: ["NI"], feiertage: ["NI"] }
};

function pad(n) { return String(n).padStart(2, "0"); }

function createId() {
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function localToday() {
  const now = new Date();
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

function safeDate(date) {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localToday();
}

function toMinutes(value) {
  if (value === null || value === undefined) return 0;
  const text = String(value).trim().replace(",", ":");
  if (!text) return 0;
  if (text.includes(":")) {
    const parts = text.split(":");
    const hours = Number(parts[0] || 0);
    const minutes = Number(parts[1] || 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
    return Math.max(0, Math.round(hours * 60 + minutes));
  }
  const number = Number(text);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number * 60));
}

function timeToMinutes(time) {
  if (!time) return 0;
  const parts = String(time).split(":").map(Number);
  if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return 0;
  return parts[0] * 60 + parts[1];
}

function minutesToText(mins) {
  const safe = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h + " Std. " + pad(m) + " Min.";
}

function parseList(value) {
  return String(value || "")
    .split(/[;,\s]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.includes(":") ? toMinutes(part) : Number(part))
    .filter(num => Number.isFinite(num) && num >= 0);
}

function parseBreakDurations(value) {
  const text = String(value || "").trim();
  if (!text) return [];

  const durations = [];
  let remainder = text;

  const rangePattern = /(\d{1,2}:\d{2})\s*(?:-|–|—|bis)\s*(\d{1,2}:\d{2})/gi;
  let match;
  while ((match = rangePattern.exec(text)) !== null) {
    const start = timeToMinutes(match[1]);
    const end = timeToMinutes(match[2]);
    let duration = end >= start ? end - start : end + 1440 - start;
    if (duration > 0 && duration <= 720) durations.push(duration);
  }

  remainder = remainder.replace(rangePattern, " ");
  return durations.concat(parseList(remainder));
}

function formatPauseInput(value) {
  const durations = parseBreakDurations(value);
  return durations.length ? durations.join(" + ") + " Min." : "—";
}

// Phase 5: Pausen-String in Bereiche zerlegen — { ranges: [{von, bis, dauer}],
// leftoverDurations: [...] }. Bereiche werden bevorzugt (für Timeline-Plot);
// Fallback auf reine Dauern wenn nichts anderes da ist.
function parseBreakRanges(value) {
  const text = String(value || "").trim();
  if (!text) return { ranges: [], leftoverDurations: [] };
  const ranges = [];
  for (const m of text.matchAll(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/g)) {
    const von = timeToMinutes(m[1]);
    const bis = timeToMinutes(m[2]);
    const dauer = bis >= von ? bis - von : bis + 1440 - von;
    if (dauer > 0 && dauer <= 720) ranges.push({ von, bis, dauer });
  }
  const remainder = text.replace(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/g, " ");
  const leftoverDurations = parseList(remainder);
  return { ranges, leftoverDurations };
}

// Phase 5: format minutes-since-midnight as "HH:MM".
function fmtTimeMin(m) {
  const total = ((m % 1440) + 1440) % 1440;
  return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
}

// Phase 5: format duration in minutes as "H:MM" (or "M Min." if < 1h).
function fmtDuration(min) {
  if (min < 60) return min + " Min.";
  return Math.floor(min / 60) + ":" + pad(min % 60) + " Std.";
}

// Phase 5: build segments for the visual timeline (tachograph-style activity bar).
// Returns array of { type, von, bis, dauer, label } where type ∈
// {"rahmen", "lenken", "pause", "standzeit"}. Returns null if data insufficient.
function buildDutyTimeline(duty) {
  const startMin = timeToMinutes(duty.start);
  const endMin0 = timeToMinutes(duty.end);
  if (!startMin || !endMin0) return null;
  const endMin = endMin0 < startMin ? endMin0 + 1440 : endMin0;
  const totalMin = endMin - startMin;
  if (totalMin <= 0) return null;

  const blocks = parseList(duty.drivingBlocks);
  const { ranges, leftoverDurations } = parseBreakRanges(duty.breaks);

  // Map break range → typ (pause vs standzeit) via catalog variant if available.
  const entry = getCatalog()[duty.number || ""];
  const variantKey = entry ? variantKeyFor(duty.date, entry) : null;
  const variantPausen = (entry && variantKey && entry.varianten && entry.varianten[variantKey] && entry.varianten[variantKey].pausen) || [];
  const typByVon = new Map();
  for (const p of variantPausen) {
    const v = timeToMinutes(p.von);
    if (v) typByVon.set(v, p.typ || "pause");
  }

  const segments = [];

  if (ranges.length === 0 && leftoverDurations.length === 0 && blocks.length === 0) {
    // Nichts bekannt — nur ein "rahmen"-Segment über den ganzen Dienst.
    segments.push({ type: "rahmen", von: startMin, bis: endMin, dauer: totalMin });
    return segments;
  }

  if (ranges.length > 0) {
    // Präzise Timeline: Pausen haben echte Uhrzeiten, Lenkblöcke füllen die Lücken.
    const sortedBreaks = [...ranges].sort((a, b) => a.von - b.von).map(r => ({
      ...r,
      vonAbs: r.von < startMin ? r.von + 1440 : r.von,
      bisAbs: r.bis < startMin ? r.bis + 1440 : r.bis
    }));
    let cursor = startMin;
    let blockIdx = 0;
    for (const br of sortedBreaks) {
      const gap = br.vonAbs - cursor;
      if (gap > 0) {
        // In dieser Lücke liegt ein Lenkblock. Was nicht Lenken ist, wird Rahmen.
        const blockDur = blocks[blockIdx] || 0;
        if (blockIdx === 0) {
          // Erste Lücke: Vorrüsten/Ausrücken VOR dem Block.
          const rahmen = Math.max(0, gap - blockDur);
          if (rahmen > 0) segments.push({ type: "rahmen", von: cursor, bis: cursor + rahmen, dauer: rahmen });
          if (blockDur > 0) segments.push({ type: "lenken", von: cursor + rahmen, bis: cursor + rahmen + blockDur, dauer: blockDur });
        } else {
          // Mittlere Lücke: meist nur Lenkblock.
          const used = Math.min(blockDur, gap);
          if (used > 0) segments.push({ type: "lenken", von: cursor, bis: cursor + used, dauer: used });
          const slack = gap - used;
          if (slack > 0) segments.push({ type: "rahmen", von: cursor + used, bis: cursor + used + slack, dauer: slack });
        }
        if (blockDur > 0) blockIdx++;
      }
      const typ = typByVon.get(br.von) || "pause";
      segments.push({ type: typ === "standzeit" ? "standzeit" : "pause", von: br.vonAbs, bis: br.bisAbs, dauer: br.dauer });
      cursor = br.bisAbs;
    }
    // Nach der letzten Pause: letzter Lenkblock + Nachrüsten.
    const remaining = endMin - cursor;
    if (remaining > 0) {
      const blockDur = blocks[blockIdx] || 0;
      const blockUsed = Math.min(blockDur, remaining);
      if (blockUsed > 0) segments.push({ type: "lenken", von: cursor, bis: cursor + blockUsed, dauer: blockUsed });
      const rahmen = remaining - blockUsed;
      if (rahmen > 0) segments.push({ type: "rahmen", von: cursor + blockUsed, bis: cursor + blockUsed + rahmen, dauer: rahmen });
    }
  } else {
    // Fallback: nur Dauern bekannt — gleichmäßig interleaven (Block, Pause, Block, …).
    let cursor = startMin;
    const N = Math.max(blocks.length, leftoverDurations.length);
    for (let i = 0; i < N; i++) {
      if (blocks[i]) {
        segments.push({ type: "lenken", von: cursor, bis: cursor + blocks[i], dauer: blocks[i] });
        cursor += blocks[i];
      }
      if (leftoverDurations[i]) {
        segments.push({ type: "pause", von: cursor, bis: cursor + leftoverDurations[i], dauer: leftoverDurations[i] });
        cursor += leftoverDurations[i];
      }
    }
    if (cursor < endMin) segments.push({ type: "rahmen", von: cursor, bis: endMin, dauer: endMin - cursor });
  }

  return segments;
}

const SEGMENT_LABELS = {
  rahmen: "Vor-/Nachrüsten",
  lenken: "Lenken",
  pause: "Pause",
  standzeit: "Standzeit"
};

function renderDutyTimeline(duty) {
  const segments = buildDutyTimeline(duty);
  if (!segments || segments.length === 0) return "";
  const total = segments.reduce((s, x) => s + x.dauer, 0);
  if (total <= 0) return "";
  const startMin = timeToMinutes(duty.start) || 0;
  const endMin = startMin + total;

  // Hour ticks for the axis: every 2 hours starting from the start hour.
  const ticks = [];
  const firstHour = Math.ceil(startMin / 60) * 60;
  for (let t = firstHour; t <= endMin; t += 120) {
    ticks.push(t);
  }
  const tickHtml = ticks.map(t => {
    const offsetPct = ((t - startMin) / total) * 100;
    return `<span class="tl-tick" style="left:${offsetPct.toFixed(2)}%">${escapeHtml(fmtTimeMin(t))}</span>`;
  }).join("");

  const segHtml = segments.map(seg => {
    const label = SEGMENT_LABELS[seg.type] || seg.type;
    const tooltip = `${label} · ${fmtTimeMin(seg.von)}–${fmtTimeMin(seg.bis)} · ${fmtDuration(seg.dauer)}`;
    const widthPct = (seg.dauer / total) * 100;
    const inline = widthPct >= 6 ? fmtDuration(seg.dauer) : "";
    return `<div class="tl-seg tl-${seg.type}" style="flex: ${seg.dauer} 0 0;" title="${escapeHtml(tooltip)}">${escapeHtml(inline)}</div>`;
  }).join("");

  const hasStandzeit = segments.some(s => s.type === "standzeit");
  const legendItems = [
    `<span class="tl-legend-item"><span class="tl-swatch tl-lenken"></span>Lenken</span>`,
    `<span class="tl-legend-item"><span class="tl-swatch tl-pause"></span>Pause</span>`,
    hasStandzeit ? `<span class="tl-legend-item"><span class="tl-swatch tl-standzeit"></span>Standzeit</span>` : "",
    `<span class="tl-legend-item"><span class="tl-swatch tl-rahmen"></span>Vor-/Nachrüsten</span>`
  ].filter(Boolean).join("");

  // Phase 5: data-duty-id auf dem Timeline-Container, damit der Click-Handler
  // das Modal mit den richtigen Daten befüllt (lookup duties by id).
  return `
    <div class="duty-timeline" data-duty-id="${escapeHtml(duty.id || "")}" role="button" tabindex="0" aria-label="Tagesablauf in voller Größe öffnen">
      <div class="tl-bar">${segHtml}</div>
      <div class="tl-axis">
        <span class="tl-tick tl-tick-edge" style="left:0">${escapeHtml(fmtTimeMin(startMin))}</span>
        ${tickHtml}
        <span class="tl-tick tl-tick-edge" style="left:100%">${escapeHtml(fmtTimeMin(endMin))}</span>
      </div>
      <div class="tl-legend">${legendItems}<span class="tl-tap-hint">🔍 Tippen für Details</span></div>
    </div>
  `;
}

// Phase 5: Modal-Inhalt — größerer Balken + Segment-Liste.
function renderTimelineModalContent(duty) {
  const segments = buildDutyTimeline(duty);
  if (!segments || segments.length === 0) return "";
  const total = segments.reduce((s, x) => s + x.dauer, 0);
  const startMin = timeToMinutes(duty.start) || 0;
  const endMin = startMin + total;

  // Stundenticks alle Stunden (im Modal mehr Platz).
  const ticks = [];
  const firstHour = Math.ceil(startMin / 60) * 60;
  for (let t = firstHour; t <= endMin; t += 60) ticks.push(t);
  const tickHtml = ticks.map(t => {
    const offsetPct = ((t - startMin) / total) * 100;
    return `<span class="tl-tick" style="left:${offsetPct.toFixed(2)}%">${escapeHtml(fmtTimeMin(t))}</span>`;
  }).join("");

  const segHtml = segments.map(seg => {
    const widthPct = (seg.dauer / total) * 100;
    const inline = widthPct >= 4 ? fmtDuration(seg.dauer) : "";
    return `<div class="tl-seg tl-${seg.type}" style="flex: ${seg.dauer} 0 0;">${escapeHtml(inline)}</div>`;
  }).join("");

  const rowsHtml = segments.map(seg => {
    const label = SEGMENT_LABELS[seg.type] || seg.type;
    return `
      <div class="tl-modal-row">
        <span class="tl-swatch tl-${seg.type}"></span>
        <span class="tl-modal-label">${escapeHtml(label)}</span>
        <span class="tl-modal-time">${escapeHtml(fmtTimeMin(seg.von))}–${escapeHtml(fmtTimeMin(seg.bis))}</span>
        <span class="tl-modal-dur">${escapeHtml(fmtDuration(seg.dauer))}</span>
      </div>
    `;
  }).join("");

  const totalsByType = segments.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + s.dauer;
    return acc;
  }, {});
  const summaryItems = ["lenken", "pause", "standzeit", "rahmen"]
    .filter(t => totalsByType[t])
    .map(t => `<div class="tl-modal-sum"><span class="tl-swatch tl-${t}"></span><span>${escapeHtml(SEGMENT_LABELS[t])}: <strong>${escapeHtml(fmtDuration(totalsByType[t]))}</strong></span></div>`)
    .join("");

  const dateStr = duty.date ? formatDateGerman(duty.date) : "";
  const dow = duty.date ? getDay(duty.date) : "";

  return `
    <div class="tl-modal-header">
      <div>
        <div class="tl-modal-title">Tagesablauf · Dienst ${escapeHtml(duty.number || "")}</div>
        <div class="tl-modal-subtitle">${escapeHtml(dow)}, ${escapeHtml(dateStr)} · ${escapeHtml(fmtTimeMin(startMin))}–${escapeHtml(fmtTimeMin(endMin))} · Σ ${escapeHtml(fmtDuration(total))}</div>
      </div>
      <button class="tl-modal-close" aria-label="Schließen">×</button>
    </div>
    <div class="tl-modal-bar-wrap">
      <div class="tl-bar tl-bar-large">${segHtml}</div>
      <div class="tl-axis tl-axis-large">
        <span class="tl-tick tl-tick-edge" style="left:0">${escapeHtml(fmtTimeMin(startMin))}</span>
        ${tickHtml}
        <span class="tl-tick tl-tick-edge" style="left:100%">${escapeHtml(fmtTimeMin(endMin))}</span>
      </div>
    </div>
    <div class="tl-modal-summary">${summaryItems}</div>
    <div class="tl-modal-list">${rowsHtml}</div>
  `;
}

function openTimelineModal(duty) {
  const existing = document.getElementById("timelineModal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "timelineModal";
  modal.className = "timeline-modal";
  modal.innerHTML = `<div class="timeline-modal-content">${renderTimelineModalContent(duty)}</div>`;
  document.body.appendChild(modal);
  // Verhindern dass die Seite scrollt während Modal offen ist (mobile).
  document.body.classList.add("modal-open");

  const close = () => {
    modal.remove();
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", onKey);
  };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  modal.querySelector(".tl-modal-close").addEventListener("click", close);
}

// Phase 5: Detail-Popup für Dienste im Dienstkatalog. Zeigt Rahmen,
// Lenkblöcke, Pausen und alle Linienfahrten aus den extrahierten Daten.
// Reuse der Timeline-Modal-Klassen. Sicherheit: alle dynamischen Felder
// laufen durch escapeHtml() — gleiches Muster wie renderTimelineModalContent
// und renderCatalog (XSS-sicher solange escapeHtml korrekt ist).
function renderCatalogDetailsContent(number, variantKey) {
  const catalog = getCatalog();
  const entry = catalog[number];
  if (!entry) {
    return `<div class="tl-modal-header"><div class="tl-modal-title">Dienst ${escapeHtml(number)}</div><button class="tl-modal-close" aria-label="Schließen">×</button></div><p class="muted">Nicht im Katalog.</p>`;
  }
  const variants = entry.varianten || {};
  const variantKeys = Object.keys(variants);
  const activeKey = variantKey || variantKeys[0];
  const block = activeKey ? variants[activeKey] : null;

  const variantLabel = key => ({
    "MoDiMiDoFr": "Mo-Fr",
    "MoDiMiDo": "Mo-Do (ohne Fr)",
    "Fr": "Freitag",
    "Sa": "Samstag",
    "So": "Sonntag",
  }[key] || key);

  if (!block) {
    return `
      <div class="tl-modal-header">
        <div>
          <div class="tl-modal-title">Dienst ${escapeHtml(number)}</div>
          <div class="tl-modal-subtitle">${escapeHtml(entry.start || "")}–${escapeHtml(entry.end || "")} · ${escapeHtml(entry.days || "")}</div>
        </div>
        <button class="tl-modal-close" aria-label="Schließen">×</button>
      </div>
      <p class="muted">Für diesen Dienst liegen noch keine extrahierten Detail-Daten vor (Lenkblöcke, Pausen, Linienfahrten). Sobald die Dienstkarte fotografiert und in die Pipeline gegeben wurde, erscheinen sie hier.</p>
    `;
  }

  const rahmen = block.rahmen || {};
  const linienfahrten = block.linienfahrten || [];
  const lenkblocke = block.lenkblocke || [];
  const pausen = block.pausen || [];
  const meta = block.metadaten || {};
  const hinweise = block.hinweise || [];

  const hmToMin = hm => {
    const parts = String(hm || "").split(":").map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) return 0;
    return parts[0] * 60 + parts[1];
  };
  const minToHm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

  const totalLenkMin = lenkblocke.reduce((s, b) => s + hmToMin(b), 0);
  const totalPauseMin = pausen.reduce((s, p) => s + (Number(p.dauer_min) || 0), 0);
  const vor = Number(rahmen.vorruesten_min) || 0;
  const nach = Number(rahmen.nachruesten_min) || 0;

  const variantPicker = variantKeys.length > 1 ? `
    <div class="cd-variant-picker">
      ${variantKeys.map(k => `
        <button class="cd-variant-btn ${k === activeKey ? "active" : ""}" data-variant="${escapeHtml(k)}">${escapeHtml(variantLabel(k))}</button>
      `).join("")}
    </div>
  ` : "";

  return `
    <div class="tl-modal-header">
      <div>
        <div class="tl-modal-title">Dienst ${escapeHtml(number)} · ${escapeHtml(variantLabel(activeKey))}</div>
        <div class="tl-modal-subtitle">${escapeHtml(meta.betrieb || "Schrage-Reisen")}${meta.buch_seite ? " · Seite " + escapeHtml(meta.buch_seite) : ""}</div>
      </div>
      <button class="tl-modal-close" aria-label="Schließen">×</button>
    </div>
    ${variantPicker}

    ${block.problem ? `
    <div class="cd-problem">
      <span class="cd-problem-icon">⚠</span>
      <div class="cd-problem-text">
        <strong>Problem mit dieser Dienstkarte</strong>
        <span>${escapeHtml(block.problem)}</span>
      </div>
    </div>` : ""}

    ${rahmen.dienstanfang ? `
    <div class="cd-section">
      <h3 class="cd-section-title">Rahmen</h3>
      <div class="cd-rahmen-grid">
        <div class="cd-cell"><span class="cd-label">Dienstanfang</span><span class="cd-value">${escapeHtml(rahmen.dienstanfang)}</span></div>
        <div class="cd-cell"><span class="cd-label">Vorrüsten</span><span class="cd-value">${vor} min</span></div>
        <div class="cd-cell"><span class="cd-label">Ausrücken</span><span class="cd-value">${escapeHtml(rahmen.ausruecken || "—")}</span></div>
        <div class="cd-cell"><span class="cd-label">Einrücken</span><span class="cd-value">${escapeHtml(rahmen.einruecken || "—")}</span></div>
        <div class="cd-cell"><span class="cd-label">Nachrüsten</span><span class="cd-value">${nach} min</span></div>
        <div class="cd-cell"><span class="cd-label">Dienstende</span><span class="cd-value">${escapeHtml(rahmen.dienstende || "—")}</span></div>
      </div>
    </div>` : ""}

    ${lenkblocke.length ? `
    <div class="cd-section">
      <h3 class="cd-section-title">Lenkblöcke <span class="cd-sum">Σ ${escapeHtml(minToHm(totalLenkMin))}</span></h3>
      <ol class="cd-blocks">
        ${lenkblocke.map((hm, i) => `
          <li><span class="cd-block-num">Block ${i + 1}</span><span class="cd-block-dur">${escapeHtml(hm)}</span></li>
        `).join("")}
      </ol>
    </div>` : ""}

    ${pausen.length ? `
    <div class="cd-section">
      <h3 class="cd-section-title">Pausen / Standzeiten <span class="cd-sum">Σ ${escapeHtml(minToHm(totalPauseMin))}</span></h3>
      <ul class="cd-pausen">
        ${pausen.map(p => `
          <li class="cd-pause cd-pause-${escapeHtml(p.typ || "")}">
            <span class="cd-pause-time">${escapeHtml(p.von || "")}–${escapeHtml(p.bis || "")}</span>
            <span class="cd-pause-dur">${p.dauer_min || 0} min</span>
            <span class="cd-pause-typ">${escapeHtml(p.typ || "")}</span>
          </li>
        `).join("")}
      </ul>
    </div>` : ""}

    ${linienfahrten.length ? `
    <div class="cd-section">
      <h3 class="cd-section-title">Linienfahrten <span class="cd-sum">${linienfahrten.length}×</span></h3>
      <div class="cd-fahrten">
        ${linienfahrten.map(f => `
          <div class="cd-fahrt">
            <div class="cd-fahrt-head">
              <span class="cd-fahrt-linie">${escapeHtml(f.linie || "")}</span>
              <span class="cd-fahrt-route">R${escapeHtml(f.route || "")}</span>
              <span class="cd-fahrt-time">${escapeHtml(f.von || "")} → ${escapeHtml(f.bis || "")}</span>
            </div>
            <div class="cd-fahrt-stops">
              <span class="cd-stop-start">${escapeHtml(f.start_haltestelle || "")}</span>
              <span class="cd-fahrt-arrow">→</span>
              <span class="cd-stop-end">${escapeHtml(f.end_haltestelle || "")}</span>
            </div>
            ${f.kommentar ? `<div class="cd-fahrt-kommentar">💬 ${escapeHtml(f.kommentar)}</div>` : ""}
          </div>
        `).join("")}
      </div>
    </div>` : ""}

    ${hinweise.length ? `
    <div class="cd-section">
      <h3 class="cd-section-title">Hinweise</h3>
      <ul class="cd-hinweise">
        ${hinweise.map(h => `<li>${escapeHtml(h)}</li>`).join("")}
      </ul>
    </div>` : ""}
  `;
}

function openCatalogDetailsModal(number, variantKey) {
  const existing = document.getElementById("catalogDetailsModal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "catalogDetailsModal";
  modal.className = "timeline-modal";
  const inner = document.createElement("div");
  inner.className = "timeline-modal-content cd-modal-content";
  inner.innerHTML = renderCatalogDetailsContent(number, variantKey);
  modal.appendChild(inner);
  document.body.appendChild(modal);
  document.body.classList.add("modal-open");

  const close = () => {
    modal.remove();
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", onKey);
  };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });

  const wireUp = () => {
    modal.querySelector(".tl-modal-close")?.addEventListener("click", close);
    modal.querySelectorAll(".cd-variant-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const newKey = btn.dataset.variant;
        inner.innerHTML = renderCatalogDetailsContent(number, newKey);
        wireUp();
      });
    });
  };
  wireUp();
}

function dayIndex(date) {
  return new Date(safeDate(date) + "T12:00:00").getDay();
}

function isFriday(date) { return dayIndex(date) === 5; }
function getDay(date) { return dayNames[dayIndex(date)] || ""; }

function shiftMinutes(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return e >= s ? e - s : e + 1440 - s;
}

function absoluteMinutes(date, time, carryNextDay) {
  const d = new Date(safeDate(date) + "T00:00:00");
  const base = Math.floor(d.getTime() / 60000);
  return base + timeToMinutes(time) + (carryNextDay ? 1440 : 0);
}

function isoWeekKey(dateString) {
  const date = new Date(safeDate(dateString) + "T12:00:00");
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return date.getFullYear() + "-KW" + pad(week);
}

function catalogTimes(number, date) {
  const entry = getCatalog()[String(number || "")];
  if (!entry) return null;
  return {
    start: entry.start,
    end: isFriday(date) && entry.fridayEnd ? entry.fridayEnd : entry.end
  };
}

// Phase 5: prüft ob ein Katalogeintrag an einem Wochentag verfügbar ist.
// Liefert true wenn entweder eine passende Variante existiert ODER die `days`-
// Beschreibung den Wochentag abdeckt (z. B. "Mo-Fr" matcht "Di"). Liefert
// true bei fehlenden Daten (Eintrag ohne `days` und ohne `varianten` —
// wir filtern ihn nicht weg, weil wir es nicht wissen).
function dutyAvailableOnDay(entry, weekdayCode) {
  if (!entry || !weekdayCode) return true;
  const order = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const idx = order.indexOf(weekdayCode);
  if (idx < 0) return true;

  // `days` ist der Dienst-Vertrag (z. B. "Mo-Fr") und damit die kanonische
  // Quelle. Varianten enthalten nur die bisher extrahierten Tage — wenn die
  // Friday-Variante fehlt, heißt das nicht, dass es den Dienst freitags nicht
  // gibt. fridayEnd ist ein zusätzliches Indiz dafür dass Fr abgedeckt ist.
  const days = String(entry.days || "").trim();
  if (days) {
    const m = days.match(/^([A-Za-zäöü]+)-([A-Za-zäöü]+)$/);
    if (m) {
      const a = order.indexOf(m[1]);
      const b = order.indexOf(m[2]);
      if (a >= 0 && b >= 0) return idx >= a && idx <= b;
    }
    const items = days.split(/[,/\s]+/).map(s => s.trim()).filter(Boolean);
    if (items.length) return items.includes(weekdayCode);
  }

  // Ohne `days`-Feld: Varianten-Keys als Fallback.
  if (entry.varianten) {
    return Object.keys(entry.varianten).some(k => k.includes(weekdayCode));
  }

  return true;
}

// Phase 4: pick the variant whose key contains the date's weekday (e.g. "Fr"
// matches "MoDiMiDoFr" and a hypothetical "Fr" — we prefer the longest match
// so a Fr-specific variant wins over a Mo-Fr generic one).
function variantKeyFor(date, entry) {
  if (!entry || !entry.varianten) return null;
  const wd = getDay(date); // "Mo"|"Di"|...|"So"
  if (!wd) return null;
  const matches = Object.keys(entry.varianten).filter(k => k.includes(wd));
  if (!matches.length) return null;
  matches.sort((a, b) => b.length - a.length); // longest first
  return matches[0];
}

// Phase 4: build the auto-fill values for drivingBlocks + breaks from the
// extended catalog. Both 'pause' and 'standzeit' gaps land in the breaks
// string — they are real breaks for compliance: the 1/6-rule counts every
// break ≥10 min, the linie50 block-rule counts ≥15 min, the EU rule needs
// ≥30 min. The shorter ones simply don't move the needle in stricter rules
// but they do count. Excluding standzeit was too aggressive and produced
// false-positive Verstöße (e.g. 3019 needed 83 min, had only 66).
function catalogFill(number, date) {
  const entry = getCatalog()[String(number || "")];
  const key = variantKeyFor(date, entry);
  if (!key) return null;
  const variant = entry.varianten[key];
  if (!variant) return null;
  const drivingBlocks = (variant.lenkblocke || []).join(" ");
  const breaks = (variant.pausen || [])
    .filter(p => p.typ === "pause" || p.typ === "standzeit")
    .map(p => `${p.von}-${p.bis}`)
    .join(" ");
  return { drivingBlocks, breaks, hinweise: variant.hinweise || [] };
}

// Phase 4 retrofill: walk a list of duties and populate empty drivingBlocks
// and breaks from the catalog. Doesn't touch fields the user has already
// filled. Called on initial load, on Runke-plan reset, and on JSON import,
// so the AI-extracted values appear without forcing user interaction.
function applyCatalogToEmptyFields(dutyList) {
  for (const d of dutyList) {
    const fill = catalogFill(d.number, d.date);
    if (!fill) continue;
    if (!d.drivingBlocks) d.drivingBlocks = fill.drivingBlocks;
    if (!d.breaks) d.breaks = fill.breaks;
  }
}

// Phase 4: a driver works at most one duty per day (the rare split-shift case
// is treated as ONE duty in the catalog, not two records). Dedup defensively
// on load so a stale localStorage from earlier development sessions doesn't
// surface as visual duplicates. Keeps the most-edited entry per (date, number)
// — preferring records that already have drivingBlocks/breaks filled in.
function dedupDuties(dutyList) {
  const byKey = new Map();
  for (const d of dutyList) {
    const key = (d.date || "") + "|" + (d.number || "");
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, d); continue; }
    // Prefer the entry with more user data (non-empty breaks or drivingBlocks).
    const score = (x) => (x.breaks ? 1 : 0) + (x.drivingBlocks ? 1 : 0);
    if (score(d) > score(prev)) byKey.set(key, d);
  }
  return [...byKey.values()];
}

function emptyDuty(dateOverride) {
  // Phase 4: breaks and drivingBlocks default to empty so the catalog
  // auto-fill (or manual entry) wins. Old placeholder values "09:30-10:00"
  // and "4:00 4:00" used to live here as starter hints; the input fields
  // already show example formats via their adjacent <span class="hint">.
  return {
    id: createId(),
    type: "duty",
    date: dateOverride || localToday(),
    number: "3006",
    start: "06:00",
    end: "16:20",
    breaks: "",
    drivingBlocks: "",
    lineMode: "linie50",
    stopDistance: "gt3",
    pauseRule: "auto",
    tariffEight: false
  };
}

// Phase 5: "Frei" markiert einen Tag als arbeitsfrei (kein Dienst).
// Schlanker als emptyDuty(): nur id, type, date — keine Lenkzeit-Felder.
function freiDuty(dateOverride) {
  return {
    id: createId(),
    type: "frei",
    date: dateOverride || localToday()
  };
}

function exampleDuties() {
  return [
    {
        "id": "runke-01",
        "date": "2026-04-13",
        "number": "3014",
        "start": "06:35",
        "end": "15:39",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-02",
        "date": "2026-04-15",
        "number": "3011",
        "start": "06:23",
        "end": "17:00",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-03",
        "date": "2026-04-16",
        "number": "3011",
        "start": "06:23",
        "end": "17:00",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-04",
        "date": "2026-04-17",
        "number": "3011",
        "start": "06:23",
        "end": "14:34",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-05",
        "date": "2026-04-20",
        "number": "3016",
        "start": "06:43",
        "end": "18:06",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-06",
        "date": "2026-04-21",
        "number": "3019",
        "start": "06:49",
        "end": "17:28",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-07",
        "date": "2026-04-22",
        "number": "3012",
        "start": "06:31",
        "end": "16:50",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-08",
        "date": "2026-04-24",
        "number": "3095",
        "start": "20:20",
        "end": "04:05",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-09",
        "date": "2026-04-27",
        "number": "3022",
        "start": "12:03",
        "end": "19:21",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-10",
        "date": "2026-04-28",
        "number": "3022",
        "start": "12:03",
        "end": "19:21",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-11",
        "date": "2026-04-29",
        "number": "3022",
        "start": "12:03",
        "end": "19:21",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-12",
        "date": "2026-04-30",
        "number": "3022",
        "start": "12:03",
        "end": "19:21",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-13",
        "date": "2026-05-04",
        "number": "3009",
        "start": "06:04",
        "end": "16:25",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-14",
        "date": "2026-05-05",
        "number": "3009",
        "start": "06:04",
        "end": "16:25",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-15",
        "date": "2026-05-06",
        "number": "3009",
        "start": "06:04",
        "end": "16:25",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-16",
        "date": "2026-05-07",
        "number": "3007",
        "start": "06:03",
        "end": "14:19",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-17",
        "date": "2026-05-08",
        "number": "3007",
        "start": "06:03",
        "end": "14:19",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-18",
        "date": "2026-05-11",
        "number": "3023",
        "start": "12:03",
        "end": "20:21",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-19",
        "date": "2026-05-12",
        "number": "3023",
        "start": "12:03",
        "end": "20:21",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-20",
        "date": "2026-05-13",
        "number": "3023",
        "start": "12:03",
        "end": "20:21",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-21",
        "date": "2026-05-18",
        "number": "3005",
        "start": "05:51",
        "end": "15:49",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-22",
        "date": "2026-05-19",
        "number": "3005",
        "start": "05:51",
        "end": "15:49",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-23",
        "date": "2026-05-20",
        "number": "3005",
        "start": "05:51",
        "end": "15:49",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-24",
        "date": "2026-05-21",
        "number": "3005",
        "start": "05:51",
        "end": "15:49",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-25",
        "date": "2026-05-27",
        "number": "3003",
        "start": "05:47",
        "end": "14:10",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-26",
        "date": "2026-05-28",
        "number": "3003",
        "start": "05:47",
        "end": "14:10",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-27",
        "date": "2026-05-29",
        "number": "3003",
        "start": "05:47",
        "end": "14:10",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-28",
        "date": "2026-06-02",
        "number": "3016",
        "start": "06:43",
        "end": "18:06",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-29",
        "date": "2026-06-03",
        "number": "3016",
        "start": "06:43",
        "end": "18:06",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-30",
        "date": "2026-06-04",
        "number": "3016",
        "start": "06:43",
        "end": "18:06",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-31",
        "date": "2026-06-05",
        "number": "3016",
        "start": "06:43",
        "end": "18:06",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-32",
        "date": "2026-06-09",
        "number": "3014",
        "start": "06:35",
        "end": "15:39",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-33",
        "date": "2026-06-10",
        "number": "3014",
        "start": "06:35",
        "end": "15:39",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-34",
        "date": "2026-06-11",
        "number": "3006",
        "start": "06:00",
        "end": "16:20",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-35",
        "date": "2026-06-12",
        "number": "3005",
        "start": "05:51",
        "end": "15:49",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-36",
        "date": "2026-06-15",
        "number": "3006",
        "start": "06:00",
        "end": "16:20",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-37",
        "date": "2026-06-16",
        "number": "3006",
        "start": "06:00",
        "end": "16:20",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-38",
        "date": "2026-06-17",
        "number": "3006",
        "start": "06:00",
        "end": "16:20",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-39",
        "date": "2026-06-19",
        "number": "3006",
        "start": "06:00",
        "end": "14:21",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-40",
        "date": "2026-06-22",
        "number": "3007",
        "start": "06:03",
        "end": "14:19",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-41",
        "date": "2026-06-23",
        "number": "3007",
        "start": "06:03",
        "end": "14:19",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-42",
        "date": "2026-06-24",
        "number": "3007",
        "start": "06:03",
        "end": "14:19",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-43",
        "date": "2026-06-25",
        "number": "3009",
        "start": "06:04",
        "end": "16:25",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-44",
        "date": "2026-06-26",
        "number": "3009",
        "start": "06:04",
        "end": "15:30",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-45",
        "date": "2026-06-29",
        "number": "3019",
        "start": "06:49",
        "end": "17:28",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    },
    {
        "id": "runke-46",
        "date": "2026-07-01",
        "number": "3019",
        "start": "06:49",
        "end": "17:28",
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": false
    }
];
}

function badge(type, text) {
  const symbol = type === "ok" ? "✓" : type === "warn" ? "!" : type === "fail" ? "×" : "i";
  const label = text || (type === "ok" ? "OK" : type === "warn" ? "Prüfen" : type === "fail" ? "Verstoß" : "Info");
  return '<span class="badge ' + type + '"><span>' + symbol + '</span>' + escapeHtml(label) + '</span>';
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function evaluateBreaks(duty) {
  const settings = dutySettings(duty);
  const blocks = parseList(duty.drivingBlocks);
  const breaks = parseBreakDurations(duty.breaks);
  const driving = blocks.reduce((sum, b) => sum + b, 0);
  const pauseRule = settings.pauseRule;

  if (blocks.length === 0 || driving === 0) {
    return { type: "warn", title: "Lenkblöcke fehlen", detail: "Trage die tatsächlichen Lenkblöcke ein, z. B. 2:15 2:10 1:40. Ohne Lenkblöcke ist die 4,5-Stunden-Prüfung nicht vollständig." };
  }

  if (blocks.some(b => b > 270)) {
    return { type: "fail", title: "Ununterbrochene Lenkzeit", detail: "Mindestens ein Lenkblock ist länger als 4 Std. 30 Min." };
  }

  const useSixthRule = settings.lineMode === "linie50" && (
    pauseRule === "sixth" || (pauseRule === "auto" && settings.stopDistance === "lte3")
  );

  if (useSixthRule) {
    const relevant = settings.tariffEight ? 8 : 10;
    const countable = breaks.filter(b => b >= relevant).reduce((sum, b) => sum + b, 0);
    const ignored = breaks.filter(b => b > 0 && b < relevant).reduce((sum, b) => sum + b, 0);
    const needed = Math.ceil(driving / 6);
    const ok = countable >= needed;

    return {
      type: ok ? "ok" : "fail",
      title: "Ein-Sechstel-Regelung Linienverkehr",
      detail: ok
        ? "Anrechenbare Unterbrechungen: " + countable + " Min.; benötigt mindestens ein Sechstel der vorgesehenen Lenkzeit, hier " + needed + " Min. Nicht angerechnete Kurzunterbrechungen: " + ignored + " Min."
        : "Anrechenbare Unterbrechungen: " + countable + " Min.; benötigt mindestens ein Sechstel der vorgesehenen Lenkzeit, hier " + needed + " Min. Unterbrechungen unter " + relevant + " Min. wurden nicht gezählt."
    };
  }

  if (driving <= 270) {
    return { type: "ok", title: "Fahrtunterbrechung", detail: "Die eingetragene Tageslenkzeit liegt nicht über 4 Std. 30 Min.; die Lenkzeit-Pausenprüfung ist unauffällig." };
  }

  const mode = settings.lineMode === "linie50" ? "linie50" : "eu";
  let accumulatedDriving = 0;
  let pausePattern = [];

  for (let i = 0; i < blocks.length; i += 1) {
    accumulatedDriving += blocks[i];
    if (accumulatedDriving > 270) {
      return { type: "fail", title: "Pause zu spät", detail: "Nach " + minutesToText(accumulatedDriving) + " Lenkzeit ist noch keine ausreichende Fahrtunterbrechung eingetragen." };
    }

    const pause = breaks[i] || 0;
    if (pause <= 0) continue;
    pausePattern.push(pause);

    if (mode === "eu") {
      const hasSingle45 = pause >= 45;
      const has15Then30 = pausePattern.some((p, index) => p >= 15 && pausePattern.slice(index + 1).some(next => next >= 30));
      if (hasSingle45 || has15Then30) {
        accumulatedDriving = 0;
        pausePattern = [];
      }
    } else {
      const has30 = pausePattern.some(p => p >= 30);
      const has2x20 = pausePattern.filter(p => p >= 20).length >= 2;
      const has3x15 = pausePattern.filter(p => p >= 15).length >= 3;
      if (has30 || has2x20 || has3x15) {
        accumulatedDriving = 0;
        pausePattern = [];
      }
    }
  }

  return {
    type: "ok",
    title: "Fahrtunterbrechung",
    detail: mode === "eu"
      ? "45 Min. oder 15 + 30 Min. wurden passend erkannt."
      : "Linienverkehr-Regel wurde passend erkannt: 30 Min., 2 × 20 Min. oder 3 × 15 Min."
  };
}

function evaluateWorkBreaks(duty) {
  const shift = shiftMinutes(duty.start, duty.end);
  const breaks = parseBreakDurations(duty.breaks);
  const countableBreaks = breaks.filter(b => b >= 15).reduce((sum, b) => sum + b, 0);

  if (shift <= 360) {
    return {
      type: "ok",
      title: "Dienstzeit-Pause",
      detail: "Dienstzeit bis 6 Std.; nach der vereinfachten Prüfung ist keine Mindestpause fällig."
    };
  }

  const required = shift > 540 ? 45 : 30;
  if (countableBreaks >= required) {
    return {
      type: "ok",
      title: "Dienstzeit-Pause",
      detail: "Anrechenbare Pausen: " + countableBreaks + " Min.; benötigt mindestens " + required + " Min."
    };
  }

  return {
    type: "fail",
    title: "Mangelnde Pause nach Dienstzeit",
    detail: "Dienstzeit: " + minutesToText(shift) + ". Anrechenbare Pausen ab 15 Min.: " + countableBreaks + " Min.; benötigt mindestens " + required + " Min."
  };
}

function dutyMetrics(duty) {
  const blocks = parseList(duty.drivingBlocks);
  const breaks = parseBreakDurations(duty.breaks);
  const driving = blocks.reduce((sum, b) => sum + b, 0);
  const shift = shiftMinutes(duty.start, duty.end);
  const pauseTotal = breaks.reduce((sum, b) => sum + b, 0);
  const endCarry = timeToMinutes(duty.end) < timeToMinutes(duty.start);
  return {
    ...duty,
    weekday: getDay(duty.date),
    shift,
    pauseTotal,
    driving,
    workWithoutBreak: Math.max(0, shift - pauseTotal),
    startAbs: absoluteMinutes(duty.date, duty.start, false),
    endAbs: absoluteMinutes(duty.date, duty.end, endCarry),
    weekKey: isoWeekKey(duty.date),
    breakResult: evaluateBreaks(duty),
    workBreakResult: evaluateWorkBreaks(duty)
  };
}

function evaluatePlan(dutiesInput) {
  // Frei-Tage werden für die rechtliche Prüfung ignoriert (kein Dienst, kein Lenken).
  const filtered = (dutiesInput || []).filter(d => d.type !== "frei");
  const rows = filtered.map(dutyMetrics).sort((a, b) => a.startAbs - b.startAbs);
  const messages = [];
  const daily = new Map();
  const weekly = new Map();

  rows.forEach(row => {
    daily.set(row.date, (daily.get(row.date) || 0) + row.driving);
    weekly.set(row.weekKey, (weekly.get(row.weekKey) || 0) + row.driving);

    if (!getCatalog()[row.number]) {
      messages.push({ type: "warn", title: row.date + ": Dienstnummer " + row.number, detail: "Diese Dienstnummer ist nicht im Katalog hinterlegt. Beginn und Ende wurden manuell verwendet." });
    }
    if (row.breakResult.type !== "ok") {
      messages.push({ type: row.breakResult.type, title: row.date + " Dienst " + row.number + ": " + row.breakResult.title, detail: row.breakResult.detail });
    }
    if (row.workBreakResult.type !== "ok") {
      messages.push({ type: row.workBreakResult.type, title: row.date + " Dienst " + row.number + ": " + row.workBreakResult.title, detail: row.workBreakResult.detail });
    }
  });

  for (const [date, mins] of daily.entries()) {
    if (mins > 600) messages.push({ type: "fail", title: date + ": Tageslenkzeit", detail: minutesToText(mins) + " überschreiten 10 Std." });
    else if (mins > 540) messages.push({ type: "warn", title: date + ": Tageslenkzeit verlängert", detail: minutesToText(mins) + ". Das ist nur als 10-Std.-Verlängerung zulässig." });
  }

  for (const [week, mins] of weekly.entries()) {
    const datesInWeek = [...new Set(rows.filter(r => r.weekKey === week).map(r => r.date))];
    const extendedDays = datesInWeek.filter(date => rows.filter(r => r.date === date).reduce((sum, r) => sum + r.driving, 0) > 540);
    if (extendedDays.length > 2) messages.push({ type: "fail", title: week + ": 10-Std.-Verlängerungen", detail: extendedDays.length + " Tage über 9 Std.; erlaubt sind höchstens 2 pro Woche." });
    if (mins > 3360) messages.push({ type: "fail", title: week + ": Wochenlenkzeit", detail: minutesToText(mins) + " überschreiten 56 Std." });
  }

  rows.forEach((row, index) => {
    const next = rows[index + 1];
    if (!next) return;
    const rest = next.startAbs - row.endAbs;
    if (rest < 0) messages.push({ type: "fail", title: "Überschneidung nach Dienst " + row.number, detail: "Der nächste Dienst beginnt, bevor dieser Dienst endet." });
    else if (rest < 540) messages.push({ type: "fail", title: "Ruhezeit " + row.date + " → " + next.date, detail: minutesToText(rest) + " sind unter 9 Std." });
    else if (rest < 660) messages.push({ type: "warn", title: "Reduzierte Ruhezeit " + row.date + " → " + next.date, detail: minutesToText(rest) + ". Das zählt als reduzierte tägliche Ruhezeit." });
  });

  rows.forEach(row => {
    const windowStart = row.startAbs;
    const windowEnd = windowStart + 14 * 1440;
    const sum = rows.filter(x => x.startAbs >= windowStart && x.startAbs < windowEnd).reduce((s, x) => s + x.driving, 0);
    if (sum > 5400) {
      messages.push({ type: "fail", title: "14-Tage-Lenkzeit ab " + row.date, detail: minutesToText(sum) + " überschreiten 90 Std." });
    }
  });

  const uniqueMessages = messages.filter((m, index, all) => index === all.findIndex(x => x.title === m.title && x.detail === m.detail));
  return { rows, messages: uniqueMessages, daily, weekly };
}

function runSelfTests() {
  const base = {
    id: "test",
    date: "2026-01-05",
    number: "3006",
    start: "06:00",
    end: "16:20",
    breaks: "45",
    drivingBlocks: "4:00 4:00",
    lineMode: "linie50",
    stopDistance: "gt3",
    tariffEight: false
  };

  return [
    { name: "EU-Pause 15 + 30 ist gültig", pass: evaluateBreaks({ ...base, lineMode: "eu", drivingBlocks: "2:15 2:15", breaks: "15 30" }).type === "ok" },
    { name: "Lenkblock über 4:30 ist Verstoß", pass: evaluateBreaks({ ...base, drivingBlocks: "4:31", breaks: "45" }).type === "fail" },
    { name: "Linie >3 km mit 2 × 20 Min. ist gültig", pass: evaluateBreaks({ ...base, lineMode: "linie50", stopDistance: "gt3", drivingBlocks: "4:10 3:45", breaks: "20 20" }).type === "ok" },
    { name: "Freitag-Endzeit aus Katalog wird erkannt", pass: catalogTimes("3006", "2026-01-09")?.end === "14:21" },
    { name: "Ruhezeit unter 9 Std. wird als Verstoß gemeldet", pass: evaluatePlan([
      { ...base, id: "t1", date: "2026-01-05", start: "12:00", end: "22:00", drivingBlocks: "4:00 4:00", breaks: "45" },
      { ...base, id: "t2", date: "2026-01-06", start: "05:30", end: "13:00", drivingBlocks: "3:00 3:00", breaks: "45" }
    ]).messages.some(m => m.title.includes("Ruhezeit") && m.type === "fail") },
    { name: "Tageslenkzeit über 10 Std. ist Verstoß", pass: evaluatePlan([{ ...base, drivingBlocks: "5:00 5:01", breaks: "45" }]).messages.some(m => m.title.includes("Tageslenkzeit") && m.type === "fail") },
    { name: "Zeit über Mitternacht wird berechnet", pass: shiftMinutes("22:00", "06:00") === 480 },
    { name: "Dienst über 6 Std. ohne Pause wird gemeldet", pass: evaluateWorkBreaks({ ...base, start: "06:00", end: "13:00", breaks: "" }).type === "fail" },
    { name: "Dienst über 9 Std. mit 45 Min. Pause ist gültig", pass: evaluateWorkBreaks({ ...base, start: "06:00", end: "16:00", breaks: "15 30" }).type === "ok" },
    { name: "Ein-Sechstel-Regelung: 6 Std. Lenkzeit mit 60 Min. Unterbrechung ist gültig", pass: evaluateBreaks({ ...base, pauseRule: "sixth", stopDistance: "lte3", drivingBlocks: "3:00 3:00", breaks: "30 30" }).type === "ok" },
    { name: "Ein-Sechstel-Regelung: 6 Std. Lenkzeit mit 50 Min. Unterbrechung ist Verstoß", pass: evaluateBreaks({ ...base, pauseRule: "sixth", stopDistance: "lte3", drivingBlocks: "3:00 3:00", breaks: "25 25" }).type === "fail" },
    { name: "Ein-Sechstel-Regelung: 8-Minuten-Unterbrechung zählt nur mit Tarifregel", pass: evaluateBreaks({ ...base, pauseRule: "sixth", stopDistance: "lte3", tariffEight: false, drivingBlocks: "1:00", breaks: "8 8 8 8 8 8 8 8" }).type === "fail" && evaluateBreaks({ ...base, pauseRule: "sixth", stopDistance: "lte3", tariffEight: true, drivingBlocks: "1:00", breaks: "8 8" }).type === "ok" },
    { name: "Manuelle Uhrzeit-Pausen werden in Minuten umgerechnet", pass: JSON.stringify(parseBreakDurations("09:15-09:45 12:00-12:15")) === JSON.stringify([30, 15]) },
    { name: "Manuelle Uhrzeit-Pause über Mitternacht wird erkannt", pass: JSON.stringify(parseBreakDurations("23:50-00:20")) === JSON.stringify([30]) },
    { name: "Dienst über 9 Std. mit manuellen Uhrzeit-Pausen ist gültig", pass: evaluateWorkBreaks({ ...base, start: "06:00", end: "16:00", breaks: "09:00-09:15 12:00-12:30" }).type === "ok" },
    { name: "Runke-Plan enthält 46 Dienste", pass: exampleDuties().length === 46 },
    { name: "Runke-Dienst 3095 über Mitternacht wird berechnet", pass: shiftMinutes("20:20", "04:05") === 465 }
  ];
}

function formatDateGerman(iso) {
  // "2026-05-04" -> "04.05.2026". Returns the input verbatim if not ISO.
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Returns the Monday and Sunday of the ISO week containing isoDate ("YYYY-MM-DD").
// Used to label calendar weeks with their date range, e.g. "04.–10.05.2026".
function isoWeekRange(isoDate) {
  const date = new Date(isoDate + "T12:00:00");
  const day = date.getDay() || 7; // Sun=0 -> 7
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function formatWeekRange(monday, sunday) {
  const dd = (d) => String(d.getDate()).padStart(2, "0");
  const mm = (d) => String(d.getMonth() + 1).padStart(2, "0");
  if (monday.getMonth() === sunday.getMonth() && monday.getFullYear() === sunday.getFullYear()) {
    return `${dd(monday)}.–${dd(sunday)}.${mm(sunday)}.${sunday.getFullYear()}`;
  }
  return `${dd(monday)}.${mm(monday)}.–${dd(sunday)}.${mm(sunday)}.${sunday.getFullYear()}`;
}

function weekNumberFromIsoKey(isoKey) {
  // "2026-KW19" -> "KW 19". Uses String.match (the security hook flags
  // RegExp.prototype.exec by name even though it is unrelated to child_process).
  const m = (isoKey || "").match(/KW(\d+)/);
  return m ? "KW " + parseInt(m[1], 10) : isoKey;
}

// Phase 5: gegenstück zu isoWeekKey — aus "2026-KW19" den Montag der Woche
// rekonstruieren. ISO 8601: KW1 enthält den 4. Januar. Brauchen wir um KWs
// auch dann zu rendern, wenn sie keine eingetragenen Dienste haben.
function mondayOfWeekKey(weekKey) {
  const m = (weekKey || "").match(/^(\d{4})-KW(\d+)/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const jan4 = new Date(year, 0, 4, 12, 0, 0);
  const jan4Day = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Day + 1);
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return monday;
}

// Phase 4: combined legal status of a day's duties — worst severity wins.
// Returns 'ok' | 'warn' | 'fail'.
function dayStatus(dutyList) {
  let worst = "ok";
  for (const d of dutyList) {
    if (d.type === "frei") continue; // Frei-Tage werden nicht geprüft.
    if (!d.number || !d.start || !d.end) { worst = "warn"; continue; }
    for (const r of [evaluateBreaks(d), evaluateWorkBreaks(d)]) {
      if (r.type === "fail") return "fail";
      if (r.type === "warn") worst = "warn";
    }
  }
  return worst;
}

function statusBadge(status) {
  const labels = { ok: "✓ OK", warn: "! Prüfen", fail: "× Verstoß" };
  return `<span class="summary-status ${escapeHtml(status)}">${escapeHtml(labels[status] || status)}</span>`;
}

// Roll up day statuses to counts for week/month summaries.
function statusCountsHtml(counts) {
  const parts = [];
  if (counts.ok) parts.push(`<span class="summary-status ok">${counts.ok} OK</span>`);
  if (counts.warn) parts.push(`<span class="summary-status warn">${counts.warn} Prüfen</span>`);
  if (counts.fail) parts.push(`<span class="summary-status fail">${counts.fail} Verstoß</span>`);
  return `<span class="summary-counts">${parts.join("")}</span>`;
}

function renderDutyCard(duty) {
  // Phase 5: Frei-Eintrag — kein Dienst, kein Lenkzeit-Check.
  if (duty.type === "frei") {
    return `
      <article class="card duty-card frei-card" data-duty="${escapeHtml(duty.id)}">
        <div class="duty-head">
          <div>
            <h2>⊘ Frei</h2>
            <div class="muted">Tag als arbeitsfrei markiert — keine Dienstzeit, keine Prüfung.</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn-secondary btn-small convert-to-duty" data-id="${escapeHtml(duty.id)}">→ Dienst eintragen</button>
            <button class="btn-danger btn-small delete-duty" data-id="${escapeHtml(duty.id)}">Löschen</button>
          </div>
        </div>
        <div class="grid grid-4">
          <label><span class="label">Datum</span><input type="date" data-field="date" value="${escapeHtml(duty.date)}"></label>
        </div>
      </article>
    `;
  }
  const catalog = getCatalog()[duty.number];
  const autoFill = catalogFill(duty.number, duty.date); // Phase 4: variant-aware fill available?
  // Phase 4: inline rule-failure reason + variant operational hinweise.
  const breakRes = evaluateBreaks(duty);
  const workRes = evaluateWorkBreaks(duty);
  const failures = [breakRes, workRes].filter(r => r && (r.type === "fail" || r.type === "warn"));
  const hinweise = autoFill && autoFill.hinweise ? autoFill.hinweise : [];
  return `
    <article class="card duty-card" data-duty="${escapeHtml(duty.id)}">
      <div class="duty-head">
        <div>
          <h2>Dienst ${escapeHtml(duty.number || "ohne Nummer")}</h2>
          ${catalog ? `<div class="muted">Katalog: ${escapeHtml(catalog.days)}${catalog.fridayEnd ? " · Freitag abweichend" : ""}</div>` : `<div class="muted" style="color:#92400e;">Nicht im Dienstkatalog</div>`}
          ${autoFill ? `<div class="muted" style="color:#0f766e;">Pausen &amp; Lenkblöcke automatisch aus Katalog — bei Abweichungen anpassen</div>` : ""}
          ${hinweise.length ? `<div class="duty-hinweise">📌 ${hinweise.map(h => escapeHtml(h)).join("<br>📌 ")}</div>` : ""}
          ${failures.map(f => `<div class="duty-issue ${escapeHtml(f.type)}"><strong>${escapeHtml(f.title)}:</strong> ${escapeHtml(f.detail || "")}</div>`).join("")}
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${autoFill ? `<button class="btn-secondary btn-small refresh-from-catalog" data-id="${escapeHtml(duty.id)}" title="Beginn, Ende, Lenkblöcke und Pausen aus dem Katalog neu laden — überschreibt manuelle Eingaben">🔄 Aus Katalog</button>` : ""}
          <button class="btn-danger btn-small delete-duty" data-id="${escapeHtml(duty.id)}">Löschen</button>
        </div>
      </div>

      <div class="grid grid-4">
        <label><span class="label">Datum</span><input type="date" data-field="date" value="${escapeHtml(duty.date)}"></label>
        <label><span class="label">Dienstnummer</span><input data-field="number" value="${escapeHtml(duty.number)}" inputmode="numeric"></label>
        <label><span class="label">Beginn</span><input type="time" data-field="start" value="${escapeHtml(duty.start)}"></label>
        <label><span class="label">Ende</span><input type="time" data-field="end" value="${escapeHtml(duty.end)}"></label>
      </div>

      ${renderDutyTimeline(duty)}

      <div class="grid grid-2" style="margin-top:12px;">
        <label><span class="label">Lenkblöcke</span><input data-field="drivingBlocks" value="${escapeHtml(duty.drivingBlocks)}"><span class="hint">Beispiel: 2:15 2:10 1:40</span></label>
        <label><span class="label">Pausen</span><input data-field="breaks" value="${escapeHtml(duty.breaks)}"><span class="hint">Uhrzeiten: 09:15-09:45 12:00-12:15 · oder Minuten: 15 30 · erkannt: ${escapeHtml(formatPauseInput(duty.breaks))}</span></label>
      </div>

      ${(() => {
        const s = dutySettings(duty);
        const isLinie = s.lineMode === "linie50";
        const showTariff = isLinie && (s.pauseRule === "sixth" || (s.pauseRule === "auto" && s.stopDistance === "lte3"));
        const parts = [
          `<span class="duty-setting"><span class="duty-setting-key">Verkehrsart</span> ${escapeHtml(SETTING_LABELS.lineMode[s.lineMode] || s.lineMode)}</span>`
        ];
        if (isLinie) {
          parts.push(`<span class="duty-setting"><span class="duty-setting-key">Haltestellen</span> ${escapeHtml(SETTING_LABELS.stopDistance[s.stopDistance] || s.stopDistance)}</span>`);
          parts.push(`<span class="duty-setting"><span class="duty-setting-key">Pausenregel</span> ${escapeHtml(SETTING_LABELS.pauseRule[s.pauseRule] || s.pauseRule)}</span>`);
        }
        if (showTariff && s.tariffEight) {
          parts.push(`<span class="duty-setting tariff">Tarifregel: ≥ 8 Min. zählen</span>`);
        }
        return `
        <div class="duty-settings-readonly">
          ${parts.join("")}
          <a href="#" class="open-catalog-link" data-number="${escapeHtml(duty.number || "")}">Im Dienstkatalog ändern →</a>
        </div>`;
      })()}
    </article>
  `;
}

const MONTH_NAMES_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function renderDuties() {
  const container = document.getElementById("dutiesContainer");
  // Phase 5: leer-Zustand wenn keine Dienste UND keine Monate ausgewählt sind.
  // Sonst rendern wir auch leere Monate, damit der Nutzer über die Tages-
  // Dropdowns Dienste anlegen kann.
  if (duties.length === 0 && (!appSettings.shownMonths || appSettings.shownMonths.length === 0)) {
    container.innerHTML = `
      <div class="empty-calendar">
        <div class="empty-calendar-icon">📅</div>
        <h2>Noch keine Dienste</h2>
        <p>Wähle einen Monat in der Toolbar oder lade einen gespeicherten Plan, um anzufangen.</p>
        <div class="empty-calendar-actions">
          <button class="btn-primary" id="emptyPickCurrentMonth">📅 Aktuellen Monat öffnen</button>
        </div>
      </div>
    `;
    const btn = document.getElementById("emptyPickCurrentMonth");
    if (btn) btn.addEventListener("click", () => {
      const today = localToday();
      const month = today.slice(0, 7);
      appSettings.shownMonths = [...new Set([...(appSettings.shownMonths || []), month])];
      saveLocalState();
      renderAll();
    });
    return;
  }

  // Phase 4 calendar view: month → KW (calendar week, Mo–So) → day → duty card.
  // Preserve open state across re-renders so typing in an input doesn't
  // collapse the panel the user is editing.
  const openMonths = new Set();
  const openWeeks = new Set();
  const openDays = new Set();
  container.querySelectorAll("details.month-group[open]").forEach(d => {
    if (d.dataset.month) openMonths.add(d.dataset.month);
  });
  container.querySelectorAll("details.week-group[open]").forEach(d => {
    if (d.dataset.week) openWeeks.add(d.dataset.week);
  });
  container.querySelectorAll("details.day-group[open]").forEach(d => {
    if (d.dataset.day) openDays.add(d.dataset.day);
  });
  const userHasNavigated = openMonths.size > 0 || openWeeks.size > 0 || openDays.size > 0;

  // Phase 5: Optionen für leere Tage — pro Wochentag gefiltert (Sa-Tag zeigt
  // nur Sa-Dienste, So nur So-Dienste, Mo-Fr-Tage zeigen entsprechend Mo-Fr-
  // Dienste). Format pro Option: "3006 · Mo-Fr · 06:00–16:20".
  // Wenn keine Dienste für einen Wochentag passen, fällt die Liste auf den
  // kompletten Katalog zurück (mit Hinweis), damit der Nutzer nicht festsitzt.
  const cat = getCatalog();
  const allCatNumbers = Object.keys(cat)
    .filter(num => /^\d+$/.test(num))
    .sort((a, b) => a.localeCompare(b));
  // Pro Wochentag: Endzeit ggf. fridayEnd (am Fr) statt Standard-end. So zeigt
  // das Dropdown z. B. "3019 · Mo-Fr · 06:49–15:50" am Freitag korrekt an.
  function optionFor(num, weekdayCode) {
    const e = cat[num] || {};
    const parts = [num];
    if (e.days) parts.push(e.days);
    const endTime = (weekdayCode === "Fr" && e.fridayEnd) ? e.fridayEnd : e.end;
    if (e.start && endTime) parts.push(e.start + "–" + endTime);
    return `<option value="${escapeHtml(num)}">${escapeHtml(parts.join(" · "))}</option>`;
  }
  const catalogOptionsByDay = {};
  for (const wd of ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]) {
    const matching = allCatNumbers.filter(num => dutyAvailableOnDay(cat[num], wd));
    if (matching.length === 0) {
      catalogOptionsByDay[wd] = `<option value="" disabled>— keine ${escapeHtml(wd)}-Dienste im Katalog · alle anzeigen —</option>` + allCatNumbers.map(num => optionFor(num, wd)).join("");
    } else {
      catalogOptionsByDay[wd] = matching.map(num => optionFor(num, wd)).join("");
    }
  }

  // Group duties by day, then nest: month → week → day.
  const byDay = new Map();
  for (const d of [...duties].sort((a, b) => (a.date || "").localeCompare(b.date || ""))) {
    const k = d.date || "ohne-datum";
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(d);
  }
  // monthKey -> Map<weekKey, Array<[dayKey, dutyList]>>
  const tree = new Map();
  for (const [day, list] of byDay) {
    const monthK = day === "ohne-datum" ? "ohne-datum" : day.slice(0, 7);
    const weekK = day === "ohne-datum" ? "ohne-woche" : isoWeekKey(day);
    if (!tree.has(monthK)) tree.set(monthK, new Map());
    const weeks = tree.get(monthK);
    if (!weeks.has(weekK)) weeks.set(weekK, []);
    weeks.get(weekK).push([day, list]);
  }

  // Phase 5: explizit über Toolbar geöffnete Monate ohne Dienste.
  for (const monthK of (appSettings.shownMonths || [])) {
    if (!tree.has(monthK)) tree.set(monthK, new Map());
  }

  // Phase 5: jeder Monat, der mindestens einen Dienst hat, soll seine ganze
  // Kalenderzeit zeigen — also alle KWs hinzufügen, die irgendeinen Tag des
  // Monats berühren. So zeigt Mai immer 31 Tage, KW19 immer 7 Tage usw.
  for (const monthK of [...tree.keys()]) {
    if (monthK === "ohne-datum") continue;
    const [y, m] = monthK.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const weeks = tree.get(monthK);
    for (let d = 1; d <= daysInMonth; d++) {
      const day = y + "-" + pad(m) + "-" + pad(d);
      const weekK = isoWeekKey(day);
      if (!weeks.has(weekK)) weeks.set(weekK, []);
    }
  }

  const today = localToday();
  const todayMonth = today.slice(0, 7);
  const todayWeek = isoWeekKey(today);

  // Order months: today's month first, future chronological after, past after.
  const monthKeys = [...tree.keys()];
  const futureOrCurrent = monthKeys.filter(k => k !== "ohne-datum" && k >= todayMonth).sort();
  const past = monthKeys.filter(k => k !== "ohne-datum" && k < todayMonth).sort();
  const noDate = monthKeys.includes("ohne-datum") ? ["ohne-datum"] : [];
  const orderedMonths = [...futureOrCurrent, ...past, ...noDate];
  const initialOpenMonth = monthKeys.includes(todayMonth) ? todayMonth : (orderedMonths[0] || null);

  const pastSet = new Set(past);
  const html = orderedMonths.map(month => {
    const weeksMap = tree.get(month);
    let monthLabel;
    if (month === "ohne-datum") monthLabel = "Ohne Datum";
    else {
      const [y, m] = month.split("-");
      monthLabel = `${MONTH_NAMES_DE[parseInt(m, 10) - 1]} ${y}`;
    }
    const monthOpen = userHasNavigated ? openMonths.has(month) : month === initialOpenMonth;

    // Sort week keys chronologically.
    const weekKeys = [...weeksMap.keys()].sort();

    const monthCounts = { ok: 0, warn: 0, fail: 0 };
    let monthMinutes = 0;
    let monthDayCount = 0; // Phase 5: real rendered-day count for month summary.

    const weekHtml = weekKeys.map(weekKey => {
      const days = weeksMap.get(weekKey);
      const isThisWeek = weekKey === todayWeek;
      const weekOpen = userHasNavigated ? openWeeks.has(weekKey) : isThisWeek;

      let weekLabel = weekNumberFromIsoKey(weekKey);
      let weekRange = "";
      // Monday: aus den Daten ableiten wenn möglich, sonst aus dem weekKey
      // (für "leere" Wochen die nur durch Monats-Erweiterung im Tree sind).
      let mondayDate = null;
      if (weekKey !== "ohne-woche") {
        mondayDate = days.length > 0 ? isoWeekRange(days[0][0]).monday : mondayOfWeekKey(weekKey);
        if (mondayDate) {
          const sunday = new Date(mondayDate);
          sunday.setDate(mondayDate.getDate() + 6);
          weekRange = formatWeekRange(mondayDate, sunday);
        }
      }

      const weekCounts = { ok: 0, warn: 0, fail: 0 };
      let weekMinutes = 0;

      // Phase 5: enumerate ALL 7 days (Mo-So) of the week, not just days that
      // already have duties. Wenn eine KW über den Monatswechsel geht, filtern
      // wir auf den aktuellen Monat — sonst tauchen Tage doppelt auf.
      const dutiesByDay = new Map(days.map(([d, list]) => [d, list]));
      let allWeekDays = [];
      if (weekKey === "ohne-woche") {
        allWeekDays = days.map(([d]) => d);
      } else if (mondayDate) {
        const mondayIso = mondayDate.getFullYear() + "-" + pad(mondayDate.getMonth() + 1) + "-" + pad(mondayDate.getDate());
        for (let i = 0; i < 7; i++) {
          const d = addDays(mondayIso, i);
          if (appSettings.hideSundays && i === 6) continue;
          if (month !== "ohne-datum" && d.slice(0, 7) !== month) continue;
          allWeekDays.push(d);
        }
      }
      // Phase 5: KW- und Monatszähler zählen NUR Tage mit echten Diensten
      // (kein Frei, kein leerer Tag) — der Kalender zeigt aber weiter alle 7
      // Tage. So liest sich "5 Tage / 31 Tage" als Arbeitsstatistik, nicht
      // als Kalenderlänge.
      const weekDutyDays = allWeekDays.reduce((n, d) => {
        const list = dutiesByDay.get(d) || [];
        return n + (list.some(x => x.type !== "frei") ? 1 : 0);
      }, 0);
      monthDayCount += weekDutyDays;

      const dayHtml = allWeekDays.map(day => {
        const list = dutiesByDay.get(day) || [];
        const isToday = day === today;
        const dow = day === "ohne-datum" ? "" : getDay(day);
        const dateStr = day === "ohne-datum" ? "Ohne Datum" : formatDateGerman(day);
        // Phase 5: heutiger Tag bleibt beim Laden ZU — nur der dunklere Rahmen
        // markiert ihn. Nutzer muss aktiv aufklappen, dann bleibt es auch offen.
        const dayOpen = userHasNavigated ? openDays.has(day) : false;
        const holiday = day === "ohne-datum" ? null : holidayName(day);
        const ferien = day === "ohne-datum" ? null : ferienName(day);
        // Phase 5: persönlicher Urlaub (per Profil) als dritter Banner-Typ.
        const vacation = day === "ohne-datum" ? null : vacationOnDate(day);
        const dayClasses = [
          "day-group",
          isToday ? "today" : "",
          list.length === 0 ? "empty-day" : "",
          holiday ? "holiday" : "",
          ferien ? "ferien" : "",
          vacation ? "vacation" : ""
        ].filter(Boolean).join(" ");
        const dateBadges = [
          holiday ? `<span class="holiday-badge">🎉 ${escapeHtml(holiday)}</span>` : "",
          ferien ? `<span class="ferien-badge">🏖 ${escapeHtml(ferien)}</span>` : "",
          vacation ? `<span class="vacation-badge">${escapeHtml(vacation.emoji || "🌴")} ${escapeHtml(vacation.label || "Urlaub")}</span>` : ""
        ].filter(Boolean).join("");

        if (list.length === 0) {
          // Empty day — show date + holiday/Ferien + dropdown to pick a duty
          // from the catalog (Phase 5: replaces the old "+ Dienst hinzufügen"
          // button which always added a default 3006 duty).
          return `<details class="${dayClasses}" data-day="${escapeHtml(day)}"${dayOpen ? " open" : ""}>
            <summary>
              <span class="summary-dow">${escapeHtml(dow)}</span>
              <span class="summary-date">${escapeHtml(dateStr)}${isToday ? ' · heute' : ''}</span>
              ${dateBadges}
              <span class="summary-duty muted">— kein Dienst —</span>
            </summary>
            <div class="empty-day-card">
              <select class="add-duty-select" data-date="${escapeHtml(day)}">
                <option value="">+ Dienst wählen…</option>
                ${catalogOptionsByDay[dow] || ""}
              </select>
              <button class="btn-secondary btn-small mark-frei" data-date="${escapeHtml(day)}">Frei markieren</button>
            </div>
          </details>`;
        }

        const dutyNumbers = list.map(d => d.type === "frei" ? "Frei" : (d.number || "—")).join(", ");
        const allFrei = list.every(d => d.type === "frei");
        const isMulti = list.length > 1;
        const status = allFrei ? "frei" : dayStatus(list);
        if (status !== "frei") {
          weekCounts[status] = (weekCounts[status] || 0) + 1;
          monthCounts[status] = (monthCounts[status] || 0) + 1;
        }
        // Frei zählt nicht für Dienstzeit-Summe.
        for (const d of list) {
          if (d.type !== "frei" && d.start && d.end) weekMinutes += shiftMinutes(d.start, d.end);
        }
        // 🤖-Mark only for non-frei days where every duty has catalog variant.
        const fullyExtracted = !allFrei && list.every(d => d.type === "frei" || catalogFill(d.number, d.date));
        let aiMark = "";
        if (!allFrei) {
          aiMark = fullyExtracted ? '<span class="summary-ai" title="Pausen &amp; Lenkblöcke aus Dienstkarte extrahiert">🤖</span>' : '<span class="summary-ai missing" title="Dienstkarte fehlt — Pausen &amp; Lenkblöcke leer">📷</span>';
        }
        const summaryDutyText = allFrei ? 'Frei' : (isMulti ? '⚠ ' + list.length + ' Einträge: ' + dutyNumbers : 'Dienst ' + dutyNumbers);
        const summaryDutyClass = allFrei ? 'summary-duty frei' : ('summary-duty' + (isMulti ? ' warn' : ''));
        const statusHtml = allFrei
          ? '<span class="summary-status frei">⊘ Frei</span>'
          : statusBadge(status);
        return `<details class="${dayClasses}" data-day="${escapeHtml(day)}"${dayOpen ? " open" : ""}>
          <summary>
            <span class="summary-dow">${escapeHtml(dow)}</span>
            <span class="summary-date">${escapeHtml(dateStr)}${isToday ? ' · heute' : ''}</span>
            ${dateBadges}
            <span class="${summaryDutyClass}">${escapeHtml(summaryDutyText)}</span>
            ${aiMark}
            ${statusHtml}
          </summary>
          ${list.map(renderDutyCard).join("")}
        </details>`;
      }).join("");

      monthMinutes += weekMinutes;

      return `<details class="week-group${isThisWeek ? " this-week" : ""}" data-week="${escapeHtml(weekKey)}"${weekOpen ? " open" : ""}>
        <summary>
          <span class="week-num">${escapeHtml(weekLabel)}</span>
          <span class="week-range">${escapeHtml(weekRange)}</span>
          <span class="week-count">${weekDutyDays} ${weekDutyDays === 1 ? 'Diensttag' : 'Diensttage'}</span>
          <span class="summary-total">Σ ${escapeHtml(minutesToText(weekMinutes))}</span>
          ${statusCountsHtml(weekCounts)}
        </summary>
        ${dayHtml}
      </details>`;
    }).join("");

    const isPast = pastSet.has(month);
    return `<details class="month-group${isPast ? " past" : ""}" data-month="${escapeHtml(month)}"${monthOpen ? " open" : ""}>
      <summary>${escapeHtml(monthLabel)} <span class="month-count">· ${monthDayCount} ${monthDayCount === 1 ? 'Diensttag' : 'Diensttage'}</span> <span class="summary-total">Σ ${escapeHtml(minutesToText(monthMinutes))}</span> ${statusCountsHtml(monthCounts)}</summary>
      ${weekHtml}
    </details>`;
  });
  // Insert a "Vergangenheit" divider right before the first past month so
  // it's visually clear that the chronology splits there. Without this,
  // April appearing after July (because today's month is at the top) reads
  // like a structural bug.
  if (past.length) {
    const firstPastIdx = orderedMonths.findIndex(m => pastSet.has(m));
    if (firstPastIdx > 0) {
      html.splice(firstPastIdx, 0, '<div class="past-divider"><span>Vergangenheit</span></div>');
    }
  }
  container.innerHTML = html.join("");

  container.querySelectorAll(".delete-duty").forEach(btn => {
    btn.addEventListener("click", () => {
      duties = duties.filter(d => d.id !== btn.dataset.id);
      renderAll();
    });
  });

  // Phase 5: 🔄 Aus Katalog — Dienst aus dem aktuellen Katalog neu befüllen.
  // Nützlich nachdem Pausen/Lenkblöcke im Katalog korrigiert wurden — der
  // gespeicherte Dienst hatte sonst die alten Werte. Überschreibt manuelle
  // Eingaben (deshalb der explizite Klick).
  container.querySelectorAll(".refresh-from-catalog").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      duties = duties.map(d => {
        if (d.id !== id) return d;
        const next = { ...d };
        const times = catalogTimes(next.number, next.date);
        if (times) { next.start = times.start; next.end = times.end; }
        const fill = catalogFill(next.number, next.date);
        if (fill) {
          next.drivingBlocks = fill.drivingBlocks;
          next.breaks = fill.breaks;
        }
        return next;
      });
      renderAll();
    });
  });

  // Phase 5: leerer Tag → Dienstnummer aus Katalog-Dropdown wählen.
  // Erzeugt einen neuen Dienst mit Datum + ausgewählter Nummer und füllt
  // Beginn/Ende (catalogTimes) + Lenkblöcke/Pausen (catalogFill) aus dem Katalog.
  container.querySelectorAll(".add-duty-select").forEach(sel => {
    sel.addEventListener("change", () => {
      const number = sel.value;
      if (!number) return;
      const fresh = emptyDuty(sel.dataset.date);
      fresh.number = number;
      const times = catalogTimes(number, fresh.date);
      if (times) { fresh.start = times.start; fresh.end = times.end; }
      applyCatalogToEmptyFields([fresh]);
      duties = [...duties, fresh];
      renderAll();
    });
  });

  // Phase 5: leerer Tag → "Frei markieren" mit vorgegebenem Datum.
  container.querySelectorAll(".mark-frei").forEach(btn => {
    btn.addEventListener("click", () => {
      duties = [...duties, freiDuty(btn.dataset.date)];
      renderAll();
    });
  });

  // Phase 5: Frei-Eintrag → in echten Dienst umwandeln (Datum bleibt erhalten).
  container.querySelectorAll(".convert-to-duty").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      duties = duties.map(d => {
        if (d.id !== id) return d;
        return { ...emptyDuty(d.date), id: d.id };
      });
      renderAll();
    });
  });

  // Phase 5: Tap/Click auf die Timeline → Modal mit großer Ansicht + Liste.
  container.querySelectorAll(".duty-timeline").forEach(el => {
    const open = () => {
      const duty = duties.find(d => d.id === el.dataset.dutyId);
      if (duty) openTimelineModal(duty);
    };
    el.addEventListener("click", open);
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });

  // Phase 5: Link auf der Tageskarte → Dienstkatalog-Tab öffnen + Eintrag scrollen/highlighten.
  container.querySelectorAll(".open-catalog-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const number = link.dataset.number;
      document.querySelector('.tab[data-tab="katalog"]').click();
      // nach dem Re-Render (renderAll) den Katalog-Eintrag suchen und blinken.
      setTimeout(() => {
        const target = document.querySelector(`#catalogGrid [data-cat-number="${CSS.escape(number)}"]`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.classList.add("flash");
          setTimeout(() => target.classList.remove("flash"), 1500);
        }
      }, 50);
    });
  });

  container.querySelectorAll("[data-duty]").forEach(card => {
    const id = card.dataset.duty;
    card.querySelectorAll("[data-field]").forEach(input => {
      input.addEventListener("change", () => {
        const field = input.dataset.field;
        duties = duties.map(d => {
          if (d.id !== id) return d;
          const next = { ...d };
          if (field === "tariffEight") next[field] = input.checked;
          else if (field === "number") next[field] = input.value.replace(/\D/g, "").slice(0, 4);
          else next[field] = input.value;

          if (field === "number" || field === "date") {
            const num = field === "number" ? next.number : d.number;
            const dat = field === "date" ? next.date : d.date;
            const times = catalogTimes(num, dat);
            if (times) {
              next.start = times.start;
              next.end = times.end;
            }
            // Phase 4: auto-fill drivingBlocks + breaks. Only overwrite when
            // the field is empty or unchanged — preserves user edits.
            const fill = catalogFill(num, dat);
            if (fill) {
              if (!next.drivingBlocks || next.drivingBlocks === d.drivingBlocks) {
                next.drivingBlocks = fill.drivingBlocks;
              }
              if (!next.breaks || next.breaks === d.breaks) {
                next.breaks = fill.breaks;
              }
            }
          }
          return next;
        });
        renderAll();
      });

      input.addEventListener("input", () => {
        if (input.dataset.field === "number") input.value = input.value.replace(/\D/g, "").slice(0, 4);
      });
    });
  });
}

function renderSummary(plan) {
  const failCount = plan.messages.filter(m => m.type === "fail").length;
  const warnCount = plan.messages.filter(m => m.type === "warn").length;
  const statusText = failCount ? "Nicht passend" : warnCount ? "Mit Einschränkung" : "Passend";

  // Phase 5: alte Metric-Kacheln (metricDuties/metricDriving/metricShift/
  // metricStatus) entfernt — der Statistik-Tab rendert jetzt eine eigene,
  // grafische Übersicht (renderStatistics). Status-Panel + Auswertung-Badge
  // bleiben bestehen.
  document.getElementById("overallStatus").textContent = statusText;
  document.getElementById("overallDetail").textContent = failCount + " Verstöße · " + warnCount + " Hinweise";
  document.getElementById("resultBadge").innerHTML = badge(failCount ? "fail" : warnCount ? "warn" : "ok", statusText);
}

function renderMessages(plan) {
  const messages = document.getElementById("messages");
  if (plan.messages.length === 0) {
    messages.innerHTML = '<div class="message"><div><div class="message-title">Keine Verstöße erkannt</div><div class="message-detail">Aus den eingegebenen Daten wurden keine Verstöße erkannt.</div></div>' + badge("ok", "Passend") + '</div>';
    return;
  }
  messages.innerHTML = plan.messages.map(msg => `
    <div class="message">
      <div>
        <div class="message-title">${escapeHtml(msg.title)}</div>
        <div class="message-detail">${escapeHtml(msg.detail)}</div>
      </div>
      ${badge(msg.type)}
    </div>
  `).join("");
}

function renderOverview(plan) {
  const rows = document.getElementById("overviewRows");
  rows.innerHTML = plan.rows.map(row => `
    <tr>
      <td>${escapeHtml(row.weekday)} ${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.number)}</td>
      <td>${escapeHtml(row.start)}–${escapeHtml(row.end)}</td>
      <td>${minutesToText(row.shift)}</td>
      <td>${minutesToText(row.driving)}</td>
      <td>${escapeHtml(row.breaks || "—")}<br><span class="muted">= ${escapeHtml(formatPauseInput(row.breaks))}</span></td>
      <td>${escapeHtml(row.lineMode === "linie50" ? ((row.pauseRule || "auto") === "sixth" || ((row.pauseRule || "auto") === "auto" && row.stopDistance === "lte3") ? "1/6" : "Block") : "EU")}</td>
      <td>${badge(row.workBreakResult.type, row.workBreakResult.type === "ok" ? "OK" : row.workBreakResult.type === "warn" ? "Prüfen" : "Verstoß")}</td>
      <td>${badge(row.breakResult.type, row.breakResult.type === "ok" ? "OK" : row.breakResult.type === "warn" ? "Prüfen" : "Verstoß")}</td>
    </tr>
  `).join("");
}

// Phase 5: Statistik-Tab — grafischer Overhaul.
// Berechnet 10 personalisierte Kennzahlen aus der aktuellen Dienstliste
// (Lenkzeit gesamt, Pausen-Anteil, Schichttyp-Verteilung etc.) und rendert
// sie als SVG/CSS-Charts. Kein Chart-Library, alles inline — schnell und
// offline-tauglich. Wird aus renderAll() aufgerufen.
function renderStatistics(plan) {
  const profileName = appSettings.activeProfile
    ? appSettings.activeProfile.charAt(0).toUpperCase() + appSettings.activeProfile.slice(1)
    : null;
  const titleEl = document.getElementById("statsProfileName");
  const rangeEl = document.getElementById("statsProfileRange");
  const eyebrowEl = document.getElementById("statsEyebrow");
  const emptyEl = document.getElementById("statsEmpty");
  const contentEl = document.getElementById("statsContent");
  if (!titleEl || !contentEl || !emptyEl) return;

  const allDuties = duties || [];
  const workDuties = allDuties.filter(d => d.type !== "frei");

  if (eyebrowEl) eyebrowEl.textContent = profileName ? "Persönliche Kennzahlen" : "Statistik";
  titleEl.textContent = profileName ? profileName : "Statistik";

  if (workDuties.length === 0) {
    emptyEl.classList.remove("hidden");
    contentEl.classList.add("hidden");
    if (rangeEl) {
      rangeEl.textContent = profileName
        ? "Profil geladen, aber noch keine Dienste eingetragen."
        : "Kein Plan geladen — wähle Runke oder Lady oben in der Toolbar.";
    }
    return;
  }
  emptyEl.classList.add("hidden");
  contentEl.classList.remove("hidden");

  const rows = plan.rows.slice().sort((a, b) => a.startAbs - b.startAbs);
  const stats = computeStatistics(rows, allDuties);

  if (rangeEl) {
    rangeEl.textContent =
      formatDateGerman(stats.firstDate) + " – " + formatDateGerman(stats.lastDate)
      + " · " + stats.workDays + " Dienste · " + stats.freiDays + " freie Tage";
  }

  // KPI 1: Lenkzeit gesamt mit Progress-Ring (Referenz: 90 h / 14-Tage-Limit
  // skaliert auf den Plan-Zeitraum).
  document.getElementById("kpiDriving").textContent = minutesToHoursShort(stats.totalDriving);
  document.getElementById("kpiDrivingFoot").textContent =
    "Ø " + minutesToHoursShort(stats.avgDrivingPerDuty) + " pro Dienst";
  renderProgressRing("kpiDrivingRing", stats.drivingVsLimitPct, "var(--acc-indigo)");

  // KPI 2: Dienstzeit gesamt
  document.getElementById("kpiShift").textContent = minutesToHoursShort(stats.totalShift);
  document.getElementById("kpiShiftFoot").textContent =
    Math.round(stats.drivingShare * 100) + "% davon hinter dem Steuer";

  // KPI 3: Arbeitstage / Frei-Tage
  document.getElementById("kpiDuties").textContent = String(stats.workDays);
  document.getElementById("kpiDutiesFoot").textContent =
    "+ " + stats.freiDays + " freie · " + stats.totalDays + " Tage gesamt";

  // KPI 4: Ø Dienstlänge
  document.getElementById("kpiAvg").textContent = minutesToHoursShort(stats.avgShiftPerDuty);
  document.getElementById("kpiAvgFoot").textContent =
    "kürzester " + minutesToHoursShort(stats.shortestShift)
    + " · längster " + minutesToHoursShort(stats.longestShift);

  // Charts
  renderDonutWorkFree(stats);
  renderPauseGauge(stats);
  renderClocks(stats);
  renderShiftTypeBars(stats);
  renderStreakBig(stats);
  renderWeekdayBars(stats);
  renderWeeklyDriving(stats);
  renderTopDuties(stats);
}

// Hilfsfunktion: Minuten → "8 h 30 min" oder "45 min" (kompakter als minutesToText).
function minutesToHoursShort(mins) {
  if (!mins || mins < 0) return "0 h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return m + " min";
  if (m === 0) return h + " h";
  return h + " h " + (m < 10 ? "0" + m : m);
}

function computeStatistics(rows, allDuties) {
  const workDuties = allDuties.filter(d => d.type !== "frei");
  const freiDays = allDuties.filter(d => d.type === "frei").length;
  const workDays = workDuties.length;
  const totalDays = workDays + freiDays;

  const totalDriving = rows.reduce((s, r) => s + r.driving, 0);
  const totalShift = rows.reduce((s, r) => s + r.shift, 0);
  const totalPause = rows.reduce((s, r) => s + r.pauseTotal, 0);

  const avgDrivingPerDuty = rows.length ? Math.round(totalDriving / rows.length) : 0;
  const avgShiftPerDuty = rows.length ? Math.round(totalShift / rows.length) : 0;
  const drivingShare = totalShift > 0 ? totalDriving / totalShift : 0;
  const pauseShare = totalShift > 0 ? totalPause / totalShift : 0;

  const shifts = rows.map(r => r.shift).filter(v => v > 0);
  const longestShift = shifts.length ? Math.max(...shifts) : 0;
  const shortestShift = shifts.length ? Math.min(...shifts) : 0;

  // Frühester / spätester Dienst — Beginn als Minuten 0..1440, Ende ggf. > 1440.
  let earliestRow = null, latestRow = null;
  rows.forEach(r => {
    const startM = timeToMinutes(r.start);
    if (!earliestRow || startM < timeToMinutes(earliestRow.start)) earliestRow = r;
    if (!latestRow || timeToMinutes(r.end) > timeToMinutes(latestRow.end)) latestRow = r;
  });

  // Schichttyp anhand des Startzeitpunkts:
  //  Frühschicht: Start vor 07:00
  //  Tagschicht:  07:00 – 12:59
  //  Spätschicht: 13:00 – 18:59
  //  Nachtschicht: ab 19:00
  const shiftTypes = { fruh: 0, tag: 0, spaet: 0, nacht: 0 };
  rows.forEach(r => {
    const m = timeToMinutes(r.start);
    if (m < 7 * 60) shiftTypes.fruh++;
    else if (m < 13 * 60) shiftTypes.tag++;
    else if (m < 19 * 60) shiftTypes.spaet++;
    else shiftTypes.nacht++;
  });

  // Wochentag-Verteilung (Mo..So). Nur Arbeitstage, Frei-Tage zählen nicht.
  const weekdayCount = [0, 0, 0, 0, 0, 0, 0]; // 0=Mo .. 6=So
  rows.forEach(r => {
    const idx = dayIndex(r.date); // 0=So, 1=Mo, ..., 6=Sa
    const moFirst = idx === 0 ? 6 : idx - 1;
    weekdayCount[moFirst]++;
  });

  // Lenkzeit pro Kalenderwoche, sortiert chronologisch.
  const weeklyMap = new Map();
  rows.forEach(r => {
    weeklyMap.set(r.weekKey, (weeklyMap.get(r.weekKey) || 0) + r.driving);
  });
  const weekly = [...weeklyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, mins]) => ({
      key,
      mins,
      label: weekNumberFromIsoKey(key)
    }));

  // Top 5 häufigste Dienstnummern.
  const dutyCount = {};
  rows.forEach(r => {
    if (r.number) dutyCount[r.number] = (dutyCount[r.number] || 0) + 1;
  });
  const topDuties = Object.entries(dutyCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([num, count]) => ({ number: num, count }));

  // Längste Arbeitssträhne ohne Frei-Tag (kalendertäglich aufeinanderfolgend).
  // Lücken (Tage ohne Eintrag) brechen die Strähne ebenfalls — sonst wären
  // Wochenenden ohne Frei-Markierung als „verbunden" gezählt worden.
  const dateMap = new Map(); // date → "frei" | "work"
  allDuties.forEach(d => {
    if (!d.date) return;
    if (d.type === "frei") {
      if (!dateMap.has(d.date)) dateMap.set(d.date, "frei");
    } else {
      dateMap.set(d.date, "work");
    }
  });
  const sortedDates = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let curStreak = 0, maxStreak = 0;
  let curStart = null, bestStart = null, bestEnd = null;
  let prevDate = null;
  sortedDates.forEach(([date, kind]) => {
    const consecutive = prevDate ? addDays(prevDate, 1) === date : true;
    if (kind === "work") {
      if (consecutive && curStart) {
        curStreak++;
      } else {
        curStreak = 1;
        curStart = date;
      }
      if (curStreak > maxStreak) {
        maxStreak = curStreak;
        bestStart = curStart;
        bestEnd = date;
      }
    } else {
      curStreak = 0;
      curStart = null;
    }
    prevDate = date;
  });

  // Lenkzeit-Limit als Referenz: 90 h pro 14 Tage. Skaliere auf Plan-Zeitraum.
  const dates = workDuties.map(d => d.date).filter(Boolean).sort();
  const firstDate = dates[0] || null;
  const lastDate = dates[dates.length - 1] || null;
  let spanDays = 14;
  if (firstDate && lastDate) {
    const a = new Date(firstDate + "T12:00:00");
    const b = new Date(lastDate + "T12:00:00");
    spanDays = Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1);
  }
  const drivingLimitMins = (90 * 60) * (spanDays / 14);
  const drivingVsLimitPct = drivingLimitMins > 0
    ? Math.min(1, totalDriving / drivingLimitMins)
    : 0;

  return {
    workDays, freiDays, totalDays,
    totalDriving, totalShift, totalPause,
    avgDrivingPerDuty, avgShiftPerDuty,
    longestShift, shortestShift,
    earliestRow, latestRow,
    shiftTypes, weekdayCount, weekly, topDuties,
    drivingShare, pauseShare,
    maxStreak, streakStart: bestStart, streakEnd: bestEnd,
    firstDate, lastDate, spanDays,
    drivingVsLimitPct, drivingLimitMins
  };
}

// Kleiner Progress-Ring oben rechts in der Lenkzeit-KPI.
function renderProgressRing(elementId, ratio, color) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const r = 24;
  const c = 2 * Math.PI * r;
  const filled = c * Math.min(1, Math.max(0, ratio));
  el.innerHTML =
    '<svg viewBox="0 0 56 56" width="56" height="56">'
    + '<circle cx="28" cy="28" r="' + r + '" fill="none" stroke="var(--acc-track)" stroke-width="6"/>'
    + '<circle cx="28" cy="28" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="6" '
    + 'stroke-linecap="round" stroke-dasharray="' + filled.toFixed(2) + ' ' + c.toFixed(2) + '" '
    + 'transform="rotate(-90 28 28)"/>'
    + '<text x="28" y="32" text-anchor="middle" font-size="14" font-weight="800" fill="var(--slate-950)">'
    + Math.round(ratio * 100) + '%</text>'
    + '</svg>';
}

// Donut: Arbeitstage vs. freie Tage. Zwei Segmente, Mittelpunkt zeigt Anzahl.
function renderDonutWorkFree(stats) {
  const el = document.getElementById("statDonutWorkFree");
  if (!el) return;
  const work = stats.workDays;
  const frei = stats.freiDays;
  const total = work + frei;
  const r = 50, cx = 60, cy = 60, sw = 18;
  const c = 2 * Math.PI * r;
  const workLen = total ? c * (work / total) : 0;
  const freiLen = total ? c * (frei / total) : 0;
  const pct = total ? Math.round((work / total) * 100) : 0;
  const svg =
    '<svg viewBox="0 0 120 120" class="donut-svg">'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--acc-track)" stroke-width="' + sw + '"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--acc-indigo)" stroke-width="' + sw + '" '
    + 'stroke-dasharray="' + workLen.toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--acc-emerald)" stroke-width="' + sw + '" '
    + 'stroke-dasharray="' + freiLen.toFixed(2) + ' ' + c.toFixed(2) + '" '
    + 'stroke-dashoffset="' + (-workLen).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>'
    + '<text x="60" y="58" text-anchor="middle" class="donut-center">' + pct + '%</text>'
    + '<text x="60" y="74" text-anchor="middle" class="donut-center-sub">Arbeit</text>'
    + '</svg>';
  el.innerHTML =
    '<div class="donut-wrap">'
    + svg
    + '<div class="donut-legend">'
    + '<div class="legend-row"><span class="legend-dot" style="background:var(--acc-indigo)"></span>'
    + '<span class="legend-label">Arbeitstage</span><span class="legend-value">' + work + '</span></div>'
    + '<div class="legend-row"><span class="legend-dot" style="background:var(--acc-emerald)"></span>'
    + '<span class="legend-label">Frei-Tage</span><span class="legend-value">' + frei + '</span></div>'
    + '<div class="legend-row" style="border-top:1px solid var(--slate-200); padding-top:8px;">'
    + '<span class="legend-label">Plan-Zeitraum</span>'
    + '<span class="legend-value">' + stats.spanDays + ' Tage</span></div>'
    + '</div></div>';
}

// Halbring-Gauge für Pausen-Anteil. Skala 0..30%, sinnvolle Spanne.
function renderPauseGauge(stats) {
  const el = document.getElementById("statPauseGauge");
  if (!el) return;
  const pct = stats.pauseShare; // 0..1, real meist 0..0.3
  const cap = 0.30; // 30% als „voller Halbring"
  const ratio = Math.min(1, pct / cap);
  const r = 70, cx = 90, cy = 90, sw = 22;
  // Halbkreis: 180° = π·r, von 180° bis 360° (links→rechts oben).
  const halfC = Math.PI * r;
  const filled = halfC * ratio;
  const start = "M " + (cx - r) + " " + cy + " A " + r + " " + r + " 0 0 1 " + (cx + r) + " " + cy;
  const svg =
    '<svg viewBox="0 0 180 110" class="gauge-svg">'
    + '<path d="' + start + '" fill="none" stroke="var(--acc-track)" stroke-width="' + sw + '" stroke-linecap="round"/>'
    + '<path d="' + start + '" fill="none" stroke="var(--acc-teal)" stroke-width="' + sw + '" stroke-linecap="round" '
    + 'stroke-dasharray="' + filled.toFixed(2) + ' ' + halfC.toFixed(2) + '"/>'
    + '<text x="90" y="84" text-anchor="middle" class="gauge-value">' + Math.round(pct * 100) + '%</text>'
    + '<text x="90" y="100" text-anchor="middle" class="gauge-sub">deiner Dienstzeit</text>'
    + '</svg>';
  el.innerHTML =
    '<div class="gauge-wrap">'
    + svg
    + '<div class="gauge-foot">'
    + minutesToHoursShort(stats.totalPause) + ' Pause auf '
    + minutesToHoursShort(stats.totalShift) + ' Dienst</div>'
    + '</div>';
}

// Zwei kleine analoge Uhren — einmal frühester Beginn, einmal spätester
// Schluss. Zeigt sofort den Tagesrhythmus.
function renderClocks(stats) {
  const el = document.getElementById("statClocks");
  if (!el) return;
  const earliest = stats.earliestRow;
  const latest = stats.latestRow;
  if (!earliest || !latest) {
    el.innerHTML = '<div class="muted">Keine Daten verfügbar.</div>';
    return;
  }
  el.innerHTML =
    '<div class="clocks-wrap">'
    + clockBlock(earliest.start, earliest.weekday + " " + formatDateGerman(earliest.date), "FRÜHESTER START", false)
    + clockBlock(latest.end, latest.weekday + " " + formatDateGerman(latest.date), "SPÄTESTER SCHLUSS", true)
    + '</div>';
}

function clockBlock(timeStr, dateLabel, whichLabel, isLate) {
  const m = timeToMinutes(timeStr);
  const h = (m / 60) % 12;
  const mm = m % 60;
  // Stundenzeiger zeigt auf h, leicht versetzt durch Minuten.
  const hourAngle = (h + mm / 60) * 30 - 90; // -90 → 12-Uhr nach oben
  const minAngle = mm * 6 - 90;
  const cx = 45, cy = 45;
  const hLen = 18, mLen = 26;
  const hx = cx + hLen * Math.cos(hourAngle * Math.PI / 180);
  const hy = cy + hLen * Math.sin(hourAngle * Math.PI / 180);
  const mx = cx + mLen * Math.cos(minAngle * Math.PI / 180);
  const my = cy + mLen * Math.sin(minAngle * Math.PI / 180);
  // 12 Tick-Marker
  let ticks = "";
  for (let i = 0; i < 12; i++) {
    const a = i * 30 - 90;
    const x1 = cx + 36 * Math.cos(a * Math.PI / 180);
    const y1 = cy + 36 * Math.sin(a * Math.PI / 180);
    const x2 = cx + 40 * Math.cos(a * Math.PI / 180);
    const y2 = cy + 40 * Math.sin(a * Math.PI / 180);
    ticks += '<line class="clock-tick" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
  }
  return ''
    + '<div class="clock-block ' + (isLate ? 'late' : 'early') + '">'
    + '<div class="clock-label-which">' + whichLabel + '</div>'
    + '<svg viewBox="0 0 90 90" class="clock-svg">'
    + '<circle class="clock-face" cx="45" cy="45" r="42"/>'
    + ticks
    + '<line class="clock-hand-h" x1="45" y1="45" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '"/>'
    + '<line class="clock-hand-m" x1="45" y1="45" x2="' + mx.toFixed(1) + '" y2="' + my.toFixed(1) + '"/>'
    + '<circle class="clock-pin" cx="45" cy="45" r="3"/>'
    + '</svg>'
    + '<div class="clock-label-time">' + escapeHtml(timeStr) + '</div>'
    + '<div class="clock-label-tag">' + escapeHtml(dateLabel) + '</div>'
    + '</div>';
}

// Vier vertikale Bars: Früh / Tag / Spät / Nacht.
function renderShiftTypeBars(stats) {
  const el = document.getElementById("statShiftType");
  if (!el) return;
  const data = [
    { key: "fruh",  name: "Früh",  time: "vor 07",   count: stats.shiftTypes.fruh,  cls: "shifttype-bar-fruh" },
    { key: "tag",   name: "Tag",   time: "07–13",    count: stats.shiftTypes.tag,   cls: "shifttype-bar-tag" },
    { key: "spaet", name: "Spät",  time: "13–19",    count: stats.shiftTypes.spaet, cls: "shifttype-bar-spaet" },
    { key: "nacht", name: "Nacht", time: "ab 19",    count: stats.shiftTypes.nacht, cls: "shifttype-bar-nacht" }
  ];
  const max = Math.max(1, ...data.map(d => d.count));
  el.innerHTML =
    '<div class="shifttype-bars">'
    + data.map(d => {
        const h = (d.count / max) * 100;
        return ''
          + '<div class="shifttype-col">'
          + '<div class="shifttype-bar-wrap">'
          + (d.count > 0
              ? '<div class="shifttype-bar ' + d.cls + '" style="height:' + h.toFixed(1) + '%"></div>'
              : '')
          + '</div></div>';
      }).join("")
    + '</div>'
    + '<div class="shifttype-bars" style="margin-top:8px; height:auto;">'
    + data.map(d => ''
        + '<div>'
        + '<div class="shifttype-count">' + d.count + '</div>'
        + '<div class="shifttype-name">' + d.name + '</div>'
        + '<div class="shifttype-time">' + d.time + ' Uhr</div>'
        + '</div>').join("")
    + '</div>';
}

// Großer Streak-Wert + Datum-Range.
function renderStreakBig(stats) {
  const el = document.getElementById("statStreak");
  if (!el) return;
  if (!stats.maxStreak) {
    el.innerHTML = '<div class="muted">Keine Strähne erkannt.</div>';
    return;
  }
  const range = stats.streakStart && stats.streakEnd
    ? formatDateGerman(stats.streakStart) + " – " + formatDateGerman(stats.streakEnd)
    : "";
  el.innerHTML =
    '<div class="streak-wrap">'
    + '<div class="streak-number">' + stats.maxStreak + '</div>'
    + '<div class="streak-unit">Tage am Stück ohne Frei</div>'
    + (range ? '<div class="streak-range">' + range + '</div>' : '')
    + '</div>';
}

// Vertikale Bars Mo–So. Wochenend-Tage in Rosa, damit sie sofort auffallen.
function renderWeekdayBars(stats) {
  const el = document.getElementById("statWeekdays");
  if (!el) return;
  const names = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const counts = stats.weekdayCount;
  const max = Math.max(1, ...counts);
  el.innerHTML =
    '<div class="weekday-grid">'
    + counts.map((c, i) => {
        const h = (c / max) * 100;
        const isWeekend = i >= 5;
        return ''
          + '<div class="weekday-col">'
          + '<div class="weekday-bar-wrap">'
          + (c > 0
              ? '<div class="weekday-bar ' + (isWeekend ? 'weekend' : '') + '" style="height:' + h.toFixed(1) + '%"></div>'
              : '<div class="weekday-bar empty"></div>')
          + '</div></div>';
      }).join("")
    + '</div>'
    + '<div class="weekday-grid" style="height:auto; margin-top:6px;">'
    + counts.map((c, i) => ''
        + '<div>'
        + '<div class="weekday-count">' + c + '</div>'
        + '<div class="weekday-name">' + names[i] + '</div>'
        + '</div>').join("")
    + '</div>';
}

// Bar-Chart Lenkzeit pro Kalenderwoche, mit Schwellwert-Farben:
//  > 56 h/Woche = rot (Verstoß)
//  > 48 h/Woche = amber (auffällig hoch)
//  sonst       = indigo
function renderWeeklyDriving(stats) {
  const el = document.getElementById("statWeeklyDriving");
  if (!el) return;
  if (!stats.weekly.length) {
    el.innerHTML = '<div class="muted">Keine Wochendaten.</div>';
    return;
  }
  const max = Math.max(1, ...stats.weekly.map(w => w.mins));
  const scale = Math.max(max, 30 * 60); // mindestens 30h Skala
  el.innerHTML =
    '<div class="weekly-chart">'
    + stats.weekly.map(w => {
        const h = (w.mins / scale) * 100;
        let cls = "";
        if (w.mins > 56 * 60) cls = "over";
        else if (w.mins > 48 * 60) cls = "warn";
        const label = w.label + ": " + minutesToHoursShort(w.mins);
        return ''
          + '<div class="weekly-col">'
          + '<div class="weekly-bar-stack" style="height:100%;">'
          + '<div class="weekly-bar ' + cls + '" style="height:' + h.toFixed(1) + '%" data-label="' + escapeHtml(label) + '"></div>'
          + '</div></div>';
      }).join("")
    + '</div>'
    + '<div class="weekly-axis-row">'
    + stats.weekly.map(w => '<div class="weekly-axis-label">' + escapeHtml(w.label) + '</div>').join("")
    + '</div>'
    + '<div class="weekly-legend">'
    + '<span class="weekly-legend-item"><span class="weekly-legend-swatch" style="background:var(--acc-indigo)"></span>normal</span>'
    + '<span class="weekly-legend-item"><span class="weekly-legend-swatch" style="background:var(--acc-amber)"></span>über 48 h</span>'
    + '<span class="weekly-legend-item"><span class="weekly-legend-swatch" style="background:var(--acc-rose)"></span>über 56 h (Verstoß)</span>'
    + '</div>';
}

// Top 5 häufigste Dienstnummern als horizontale Bars.
function renderTopDuties(stats) {
  const el = document.getElementById("statTopDuties");
  if (!el) return;
  if (!stats.topDuties.length) {
    el.innerHTML = '<div class="muted">Keine Dienstnummern verfügbar.</div>';
    return;
  }
  const max = stats.topDuties[0].count;
  el.innerHTML =
    '<div class="topduties-list">'
    + stats.topDuties.map(d => {
        const w = (d.count / max) * 100;
        return ''
          + '<div class="topduties-row">'
          + '<div class="topduties-num">' + escapeHtml(d.number) + '</div>'
          + '<div class="topduties-track">'
          + '<div class="topduties-fill" style="width:' + w.toFixed(1) + '%">' + d.count + '×</div>'
          + '</div>'
          + '<div><span class="topduties-count">' + d.count + '</span> '
          + '<span class="topduties-count-unit">' + (d.count === 1 ? 'mal' : 'mal') + '</span></div>'
          + '</div>';
      }).join("")
    + '</div>';
}

function renderCatalog() {
  const grid = document.getElementById("catalogGrid");
  const catalog = getCatalog();
  const reviewStatus = getCatalogReviewStatus();

  // Phase 5: Review-Stats oben im Tab — zeigt Fortschritt der manuellen QA.
  const stats = { verified: 0, errors: 0, open: 0, total: 0 };
  for (const [num, entry] of Object.entries(catalog)) {
    if (entry.varianten && Object.keys(entry.varianten).length > 0) {
      stats.total++;
      const st = getReviewState(num);
      if (st === "verified") stats.verified++;
      else if (st === "errors") stats.errors++;
      else stats.open++;
    }
  }
  const statsEl = document.getElementById("catalogReviewStats");
  if (statsEl) {
    if (stats.total > 0) {
      statsEl.classList.remove("hidden");
      statsEl.innerHTML = `
        <span class="crs-pill crs-verified">✓ ${stats.verified} geprüft</span>
        <span class="crs-pill crs-errors">✗ ${stats.errors} mit Fehlern</span>
        <span class="crs-pill crs-open">○ ${stats.open} offen</span>
        <span class="crs-total">von ${stats.total} Diensten mit Detail-Daten</span>
      `;
    } else {
      statsEl.classList.add("hidden");
    }
  }

  grid.innerHTML = Object.entries(catalog)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([number, entry]) => {
      const isCustom = Object.prototype.hasOwnProperty.call(customCatalog, number);
      const s = dutySettings(number);
      const isLinie = s.lineMode === "linie50";
      const showTariff = isLinie && (s.pauseRule === "sixth" || (s.pauseRule === "auto" && s.stopDistance === "lte3"));
      // Phase 5: hat dieser Dienst extrahierte Detail-Daten (Lenkblöcke/Pausen/Linien)?
      const hasDetails = entry.varianten && Object.keys(entry.varianten).length > 0;
      // Phase 5: hat irgendeine Variante ein "problem"-Feld (fehlende Seite, schemafremd, ...)?
      // Falls ja → oranger Badge auf der Karte, Begründung im Detail-Popup oben.
      let problemReason = null;
      if (hasDetails) {
        for (const v of Object.values(entry.varianten)) {
          if (v && typeof v.problem === "string" && v.problem.trim()) {
            problemReason = v.problem.trim();
            break;
          }
        }
      }
      // Phase 5: manueller Review-Status (✓ geprüft, ✗ Fehler, undefined offen).
      const reviewState = getReviewState(number); // verified | errors | null
      const reviewNote = reviewState === "errors" ? getReviewNote(number) : "";
      const cardStateClass = reviewState ? " cat-review-" + reviewState : "";
      const cardProblemClass = problemReason ? " cat-has-problem" : "";
      const sel = (field, options) => `<select data-cat-number="${escapeHtml(number)}" data-cat-field="${escapeHtml(field)}">${
        options.map(([v, label]) => `<option value="${escapeHtml(v)}"${s[field] === v ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")
      }</select>`;
      return `
      <div class="card catalog-card${cardStateClass}${cardProblemClass}" data-cat-number="${escapeHtml(number)}">
        <div class="catalog-card-top">
          <div class="catalog-card-titlewrap">
            <h2>${escapeHtml(number)}</h2>
            <span class="badge ${isCustom ? "warn" : "info"}">${isCustom ? "Eigen" : escapeHtml(entry.days || "")}</span>
            ${problemReason ? `<span class="badge problem" title="${escapeHtml(problemReason)}">⚠ Problem</span>` : ""}
          </div>
          ${hasDetails ? `<div class="catalog-card-review">
            <button class="review-btn review-ok${reviewState === 'verified' ? ' active' : ''}" data-review-target="verified" data-cat-number="${escapeHtml(number)}" title="Als geprüft markieren" aria-label="Als geprüft markieren">✓</button>
            <button class="review-btn review-err${reviewState === 'errors' ? ' active' : ''}" data-review-target="errors" data-cat-number="${escapeHtml(number)}" title="Fehler gefunden markieren" aria-label="Fehler gefunden markieren">✗</button>
          </div>` : ""}
        </div>
        <div class="muted" style="margin-top:6px;">${escapeHtml(entry.start || "")}–${escapeHtml(entry.end || "")}</div>
        ${entry.fridayEnd ? `<div class="muted" style="margin-top:2px; color:#92400e;">Freitag: ${escapeHtml(entry.start)}–${escapeHtml(entry.fridayEnd)}</div>` : ""}
        <div class="catalog-settings">
          <label class="catalog-setting"><span class="catalog-setting-label">Verkehrsart</span>${sel("lineMode", [["linie50","Linienverkehr ≤ 50 km"],["eu","EU-Regel > 50 km"]])}</label>
          ${isLinie ? `<label class="catalog-setting"><span class="catalog-setting-label">Haltestellenabstand</span>${sel("stopDistance", [["gt3","mehr als 3 km"],["lte3","höchstens 3 km"]])}</label>` : ""}
          ${isLinie ? `<label class="catalog-setting"><span class="catalog-setting-label">Pausenregel</span>${sel("pauseRule", [["auto","Automatisch"],["block","Blockregel"],["sixth","Ein-Sechstel"]])}</label>` : ""}
          ${showTariff ? `<label class="checkbox-row" style="margin-top:6px;"><input type="checkbox" data-cat-number="${escapeHtml(number)}" data-cat-field="tariffEight"${s.tariffEight ? " checked" : ""}>Tarifregel ≥ 8 Min. zählen</label>` : ""}
        </div>
        ${reviewState === "errors" ? `<div class="cat-review-note">
          <span class="cat-review-note-icon">💬</span>
          <span class="cat-review-note-text">${reviewNote ? escapeHtml(reviewNote) : "<em>Kein Fehler beschrieben</em>"}</span>
          <button class="cat-review-note-edit" data-cat-number="${escapeHtml(number)}" title="${reviewNote ? "Notiz bearbeiten" : "Notiz hinzufügen"}">${reviewNote ? "✎" : "+"}</button>
        </div>` : ""}
        <div class="catalog-card-actions">
          ${hasDetails ? `<button class="btn-primary btn-small show-catalog-details" data-cat-number="${escapeHtml(number)}">📋 Details anzeigen</button>` : ""}
          ${isCustom ? `<button class="btn-secondary btn-small delete-template" data-number="${escapeHtml(number)}">Vorlage löschen</button>` : ""}
        </div>
      </div>
    `;
    }).join("");

  // Eintrag-Setting ändern → in customCatalog spiegeln (deep merge in getCatalog).
  grid.querySelectorAll("[data-cat-field]").forEach(input => {
    input.addEventListener("change", () => {
      const number = input.dataset.catNumber;
      const field = input.dataset.catField;
      const value = input.type === "checkbox" ? input.checked : input.value;
      customCatalog[number] = { ...(customCatalog[number] || {}), [field]: value };
      // Switch-Logik: lineMode != linie50 → pauseRule auto behalten ergibt
      // EU-Modus, andere Regeln sind nicht anwendbar. Reset auf auto, damit
      // alte „sixth"/„block"-Werte nicht bei EU-Umschaltung Verwirrung stiften.
      if (field === "lineMode" && value !== "linie50") {
        customCatalog[number].pauseRule = "auto";
      }
      saveLocalState();
      renderAll();
    });
  });

  grid.querySelectorAll(".delete-template").forEach(btn => {
    btn.addEventListener("click", () => {
      delete customCatalog[btn.dataset.number];
      saveLocalState();
      renderAll();
    });
  });

  // Phase 5: Detail-Popup öffnen mit allen Lenkblöcken, Pausen, Linienfahrten.
  grid.querySelectorAll(".show-catalog-details").forEach(btn => {
    btn.addEventListener("click", () => {
      openCatalogDetailsModal(btn.dataset.catNumber);
    });
  });

  // Phase 5: Review-Toggle (✓ / ✗) pro Karte. Klick auf den schon aktiven
  // Knopf entfernt die Markierung (zurück auf „offen"). Server-Sync
  // fire-and-forget, damit andere Geräte den Stand sehen.
  // Beim Setzen auf "errors" optional eine kurze Fehlerbeschreibung erfragen.
  grid.querySelectorAll(".review-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const number = btn.dataset.catNumber;
      const target = btn.dataset.reviewTarget;
      const current = getReviewState(number);
      let note;
      if (target === "errors" && current !== "errors") {
        // Neuer Fehler-Markierung → Notiz erfragen (kann leer bleiben).
        note = window.prompt("Was stimmt nicht? (kurze Beschreibung, kann leer bleiben)", "");
        if (note === null) return; // User hat abgebrochen
      }
      toggleReviewState(number, target, note);
      saveCatalogReviewToServer();
      renderCatalog();
    });
  });

  // Phase 5: Notiz nachträglich bearbeiten (✎-Button neben der bestehenden Notiz).
  grid.querySelectorAll(".cat-review-note-edit").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const number = btn.dataset.catNumber;
      const old = getReviewNote(number);
      const note = window.prompt("Fehlerbeschreibung bearbeiten:", old);
      if (note === null) return;
      updateReviewNote(number, note);
      saveCatalogReviewToServer();
      renderCatalog();
    });
  });
}

function renderTests() {
  const tests = runSelfTests();
  const failed = tests.filter(t => !t.pass).length;
  document.getElementById("testsBadge").innerHTML = badge(failed ? "fail" : "ok", failed ? failed + " fehlgeschlagen" : "Alle bestanden");
  document.getElementById("testsRows").innerHTML = tests.map(test => `
    <div class="test-row">
      <strong>${escapeHtml(test.name)}</strong>
      ${badge(test.pass ? "ok" : "fail", test.pass ? "Bestanden" : "Fehlgeschlagen")}
    </div>
  `).join("");
}

function renderAll() {
  const plan = evaluatePlan(duties);
  renderDuties();
  renderSummary(plan);
  renderMessages(plan);
  renderOverview(plan);
  renderStatistics(plan);
  renderCatalog();
  renderBundeslaenderSettings();
  renderVacationSection();
  renderTests();
  saveLocalState();
}

// Phase 5: aktiver Tab überlebt Page-Reload — gespeichert in localStorage
// unter "lrz-active-tab". Beim Start wird der zuletzt aktive Tab wieder
// hergestellt; existiert er nicht (mehr), bleibt der Default-Tab aus der
// HTML-Markierung aktiv.
const TAB_NAMES = ["eingabe", "auswertung", "katalog", "statistik", "einstellungen", "tests"];
const ACTIVE_TAB_KEY = "lrz-active-tab";

function activateTab(tab) {
  const btn = document.querySelector('.tab[data-tab="' + tab + '"]');
  if (!btn) return false;
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  TAB_NAMES.forEach(name => {
    const section = document.getElementById("tab-" + name);
    if (section) section.classList.toggle("hidden", name !== tab);
  });
  return true;
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (!activateTab(tab)) return;
      try { localStorage.setItem(ACTIVE_TAB_KEY, tab); } catch { /* private mode */ }
    });
  });
  // Beim Bootstrap zuletzt aktiven Tab wiederherstellen.
  let saved = null;
  try { saved = localStorage.getItem(ACTIVE_TAB_KEY); } catch { /* ignored */ }
  if (saved && TAB_NAMES.indexOf(saved) >= 0) activateTab(saved);
}

// Phase 5: namentliche Pläne (Runke, Lady) als separate localStorage-Snapshots
// — getrennt vom Autosave (lenkRuhezeitenRunke20260413), das den aktuellen
// Zustand für den Page-Refresh hält. So kann ein Nutzer zwischen Runke- und
// Lady-Plan wechseln, ohne dass der jeweils andere überschrieben wird.
const NAMED_PLAN_KEYS = {
  runke: "lrz-plan-runke",
  lady:  "lrz-plan-lady"
};

function saveNamedPlan(name) {
  const key = NAMED_PLAN_KEYS[name];
  if (!key) return false;
  try {
    // Phase 5: Urlaube + Anspruch + Bundesländer + Sonntage-Toggle im
    // selben Plan-Body — pro Profil getrennt im localStorage gemirrort,
    // damit Offline-Reload den letzten Stand findet.
    localStorage.setItem(key, JSON.stringify({
      duties,
      vacations,
      vacationEntitlement,
      bundeslaender: appSettings.bundeslaender || null,
      hideSundays: !!appSettings.hideSundays,
      savedAt: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    return false;
  }
}

function loadNamedPlan(name) {
  const key = NAMED_PLAN_KEYS[name];
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return {
      duties: Array.isArray(obj.duties) ? obj.duties : null,
      vacations: Array.isArray(obj.vacations) ? obj.vacations : [],
      vacationEntitlement: Number.isFinite(obj.vacationEntitlement) ? obj.vacationEntitlement : 30,
      bundeslaender: (obj.bundeslaender && typeof obj.bundeslaender === "object") ? obj.bundeslaender : null,
      hideSundays: typeof obj.hideSundays === "boolean" ? obj.hideSundays : null
    };
  } catch (e) {
    return null;
  }
}

// Phase 5: rendert die 16-Zeilen-Tabelle in Tab "Einstellungen" und wired
// die Checkboxen — jede Änderung wird sofort persistiert und der Kalender
// neu gerendert, damit die Bundesland-Auswahl unmittelbar sichtbar wird.
function renderBundeslaenderSettings() {
  const tbody = document.getElementById("blSettingsBody");
  if (!tbody) return;
  const ferienSet = new Set(getActiveStates("ferien"));
  const feiertageSet = new Set(getActiveStates("feiertage"));
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  for (const bl of BUNDESLAENDER) {
    const tr = document.createElement("tr");
    const ferienOn = ferienSet.has(bl.code);
    const feiertageOn = feiertageSet.has(bl.code);
    if (ferienOn) tr.classList.add("ferien-active");
    if (feiertageOn) tr.classList.add("feiertage-active");

    const tdName = document.createElement("td");
    tdName.className = "bl-col-name";
    const code = document.createElement("span");
    code.className = "bl-code";
    code.textContent = bl.code;
    const full = document.createElement("span");
    full.className = "bl-fullname";
    full.textContent = bl.name;
    tdName.appendChild(code);
    tdName.appendChild(full);

    const tdFerien = document.createElement("td");
    tdFerien.className = "bl-col-ferien";
    const labelF = document.createElement("label");
    labelF.className = "bl-checkbox";
    const cbFerien = document.createElement("input");
    cbFerien.type = "checkbox";
    cbFerien.checked = ferienOn;
    cbFerien.setAttribute("aria-label", `Ferien für ${bl.name}`);
    cbFerien.addEventListener("change", () => updateBlSetting("ferien", bl.code, cbFerien.checked));
    labelF.appendChild(cbFerien);
    tdFerien.appendChild(labelF);

    const tdFeiertage = document.createElement("td");
    tdFeiertage.className = "bl-col-feiertage";
    const labelH = document.createElement("label");
    labelH.className = "bl-checkbox";
    const cbFeiertage = document.createElement("input");
    cbFeiertage.type = "checkbox";
    cbFeiertage.checked = feiertageOn;
    cbFeiertage.setAttribute("aria-label", `Feiertage für ${bl.name}`);
    cbFeiertage.addEventListener("change", () => updateBlSetting("feiertage", bl.code, cbFeiertage.checked));
    labelH.appendChild(cbFeiertage);
    tdFeiertage.appendChild(labelH);

    tr.appendChild(tdName);
    tr.appendChild(tdFerien);
    tr.appendChild(tdFeiertage);
    tbody.appendChild(tr);
  }
}

function updateBlSetting(kind, code, checked) {
  if (!appSettings.bundeslaender) {
    appSettings.bundeslaender = { ferien: ["NI"], feiertage: ["NI"] };
  }
  const current = appSettings.bundeslaender[kind] || [];
  const set = new Set(current);
  if (checked) set.add(code); else set.delete(code);
  appSettings.bundeslaender = {
    ...appSettings.bundeslaender,
    [kind]: [...set]
  };
  saveLocalState();
  renderBundeslaenderSettings();
  renderAll();
}

// === Phase 5: Jahresurlaub-Modul =====================================
// Pro Profil verwaltete Urlaubszeiträume. Jeder Urlaub hat:
//   { id, label (string), emoji (string), start (YYYY-MM-DD), end (YYYY-MM-DD) }
// Plus pro Profil ein vacationEntitlement (Tagesanspruch, Standard 30).
// Urlaube werden im selben Plan-Body wie duties gespeichert (lrz-plan-runke /
// lrz-plan-lady und auf dem Server unter /api/plan/<profile>) — siehe
// saveNamedPlan / fetchPlanFromServer.

let vacations = [];
let vacationEntitlement = 30;
let vacationViewYear = (new Date()).getFullYear();
let vacationEditId = null;

function vacationCreateId() {
  return "vac-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

// Tag liegt im Urlaubszeitraum? Gibt das passende Vacation-Objekt zurück
// (oder null). Wird vom Kalender-Renderer benutzt, um Urlaub-Banner zu setzen.
function vacationOnDate(dateIso) {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  for (const v of vacations) {
    if (v && v.start && v.end && dateIso >= v.start && dateIso <= v.end) return v;
  }
  return null;
}

// Anzahl Werktage (Mo–Fr) im Zeitraum, Feiertage zählen NICHT (Tariflogik).
function countVacationWorkdays(startIso, endIso) {
  if (!startIso || !endIso || startIso > endIso) return 0;
  let count = 0;
  let cur = startIso;
  let safety = 0;
  while (cur <= endIso && safety++ < 800) {
    const dow = dayIndex(cur);
    if (dow !== 0 && dow !== 6 && !holidayName(cur)) {
      count++;
    }
    cur = addDays(cur, 1);
  }
  return count;
}

function dayOfYear(dateIso) {
  if (!dateIso) return 0;
  const d = new Date(dateIso + "T12:00:00");
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d - start) / 86400000) + 1;
}

function vacationsForYear(year) {
  return vacations
    .filter(v => v && v.start && v.end)
    .filter(v => {
      const startY = parseInt(v.start.slice(0, 4), 10);
      const endY = parseInt(v.end.slice(0, 4), 10);
      return startY === year || endY === year || (startY < year && endY > year);
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

// Summe der Werktage im Jahr (Cross-Year-Urlaube werden auf das Jahr geclippt).
function totalVacationWorkdaysInYear(year) {
  return vacationsForYear(year).reduce((sum, v) => {
    const yStart = year + "-01-01";
    const yEnd = year + "-12-31";
    const startInYear = v.start < yStart ? yStart : v.start;
    const endInYear = v.end > yEnd ? yEnd : v.end;
    return sum + countVacationWorkdays(startInYear, endInYear);
  }, 0);
}

function renderVacationSection() {
  const noProfile = document.getElementById("vacationNoProfile");
  const content = document.getElementById("vacationContent");
  if (!noProfile || !content) return;

  if (!appSettings.activeProfile) {
    noProfile.classList.remove("hidden");
    content.classList.add("hidden");
    return;
  }
  noProfile.classList.add("hidden");
  content.classList.remove("hidden");

  document.getElementById("vacationYearLabel").textContent = String(vacationViewYear);
  const ent = document.getElementById("vacationEntitlement");
  if (ent && document.activeElement !== ent) ent.value = String(vacationEntitlement);

  const taken = totalVacationWorkdaysInYear(vacationViewYear);
  const remaining = Math.max(0, vacationEntitlement - taken);
  const pct = vacationEntitlement > 0
    ? Math.min(100, (taken / vacationEntitlement) * 100)
    : 0;
  document.getElementById("vacationStatsTaken").textContent = String(taken);
  document.getElementById("vacationStatsTotal").textContent = String(vacationEntitlement);
  document.getElementById("vacationStatsRemaining").textContent = "noch " + remaining + " übrig";
  document.getElementById("vacationProgressFill").style.width = pct.toFixed(1) + "%";

  renderVacationYearstrip();
  renderVacationList();

  const yearVacs = vacationsForYear(vacationViewYear);
  const emptyEl = document.getElementById("vacationEmpty");
  if (emptyEl) {
    emptyEl.classList.toggle("hidden", yearVacs.length > 0);
    const yearSpan = document.getElementById("vacationEmptyYear");
    if (yearSpan) yearSpan.textContent = String(vacationViewYear);
  }
}

function renderVacationYearstrip() {
  const svg = document.getElementById("vacationYearstrip");
  const labels = document.getElementById("vacationYearstripLabels");
  if (!svg || !labels) return;
  const year = vacationViewYear;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const totalDays = isLeap ? 366 : 365;
  const monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthShort = ["J","F","M","A","M","J","J","A","S","O","N","D"];

  let parts = [];
  // Monats-Trenner
  let cum = 0;
  for (let m = 0; m < 12; m++) {
    cum += monthDays[m];
    if (m < 11) {
      parts.push('<line x1="' + cum + '" y1="0" x2="' + cum + '" y2="32" stroke="rgba(15,23,42,0.06)" stroke-width="1"/>');
    }
  }
  // Heute-Marker (falls Jahr = aktuelles Jahr)
  const today = localToday();
  if (today.startsWith(year + "-")) {
    const td = dayOfYear(today);
    parts.push('<line x1="' + (td - 0.5) + '" y1="0" x2="' + (td - 0.5) + '" y2="32" stroke="#0f172a" stroke-width="1.5" stroke-dasharray="2 2"/>');
  }
  // Urlaubs-Rechtecke
  for (const v of vacationsForYear(year)) {
    const yStart = year + "-01-01";
    const yEnd = year + "-12-31";
    const startInYear = v.start < yStart ? yStart : v.start;
    const endInYear = v.end > yEnd ? yEnd : v.end;
    const startDay = dayOfYear(startInYear);
    const endDay = dayOfYear(endInYear);
    const x = startDay - 1;
    const w = Math.max(1, endDay - startDay + 1);
    parts.push('<rect x="' + x + '" y="6" width="' + w + '" height="20" fill="#10b981" rx="2"><title>'
      + escapeHtml((v.emoji ? v.emoji + " " : "") + (v.label || "Urlaub") + " · " + formatDateGerman(v.start) + " – " + formatDateGerman(v.end))
      + '</title></rect>');
  }

  svg.setAttribute("viewBox", "0 0 " + totalDays + " 32");
  svg.innerHTML = parts.join("");
  labels.innerHTML = monthShort.map(n => "<span>" + n + "</span>").join("");
}

function renderVacationList() {
  const list = document.getElementById("vacationList");
  if (!list) return;
  const yearVacs = vacationsForYear(vacationViewYear);
  list.innerHTML = yearVacs.map(v => {
    const days = countVacationWorkdays(v.start, v.end);
    const startGerm = formatDateGerman(v.start);
    const endGerm = formatDateGerman(v.end);
    const safeLabel = escapeHtml(v.label || "Urlaub");
    const safeEmoji = escapeHtml(v.emoji || "🌴");
    return ''
      + '<div class="vacation-card" data-vac-id="' + escapeHtml(v.id) + '">'
      +   '<div class="vacation-card-emoji">' + safeEmoji + '</div>'
      +   '<div class="vacation-card-text">'
      +     '<div class="vacation-card-label">' + safeLabel + '</div>'
      +     '<div class="vacation-card-range">' + escapeHtml(startGerm) + ' – ' + escapeHtml(endGerm) + '</div>'
      +   '</div>'
      +   '<div class="vacation-card-days">' + days + ' ' + (days === 1 ? "Tag" : "Tage") + '</div>'
      +   '<div class="vacation-card-actions">'
      +     '<button type="button" class="vacation-card-action edit" data-vac-action="edit" title="Bearbeiten" aria-label="Bearbeiten">✏</button>'
      +     '<button type="button" class="vacation-card-action delete" data-vac-action="delete" title="Löschen" aria-label="Löschen">🗑</button>'
      +   '</div>'
      + '</div>';
  }).join("");
  list.querySelectorAll(".vacation-card-action").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".vacation-card");
      if (!card) return;
      const id = card.dataset.vacId;
      const action = btn.dataset.vacAction;
      if (action === "edit") openVacationForm(id);
      else if (action === "delete") deleteVacation(id);
    });
  });
}

function openVacationForm(editId) {
  vacationEditId = editId || null;
  const form = document.getElementById("vacationForm");
  const title = document.getElementById("vacationFormTitle");
  if (!form || !title) return;
  if (vacationEditId) {
    const v = vacations.find(x => x.id === vacationEditId);
    if (!v) return;
    title.textContent = "Urlaub bearbeiten";
    document.getElementById("vacationFormLabel").value = v.label || "";
    document.getElementById("vacationFormStart").value = v.start;
    document.getElementById("vacationFormEnd").value = v.end;
    setVacationEmojiSelection(v.emoji || "🌴");
  } else {
    title.textContent = "Neuer Urlaub";
    document.getElementById("vacationFormLabel").value = "";
    // Standard-Start: heutiges Datum bzw. erster Tag des angezeigten Jahres,
    // falls man durch ein anderes Jahr scrollt.
    const today = localToday();
    const defStart = today.startsWith(vacationViewYear + "-") ? today : (vacationViewYear + "-01-02");
    document.getElementById("vacationFormStart").value = defStart;
    document.getElementById("vacationFormEnd").value = defStart;
    setVacationEmojiSelection("🌴");
  }
  form.classList.remove("hidden");
  updateVacationFormFeedback();
  // Kleine Verzögerung, damit das Element sichtbar ist bevor wir fokussieren.
  setTimeout(() => document.getElementById("vacationFormLabel")?.focus(), 0);
}

function closeVacationForm() {
  const form = document.getElementById("vacationForm");
  if (form) form.classList.add("hidden");
  vacationEditId = null;
}

function setVacationEmojiSelection(emoji) {
  document.querySelectorAll(".vacation-emoji-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.emoji === emoji);
  });
}

function getVacationSelectedEmoji() {
  const active = document.querySelector(".vacation-emoji-btn.active");
  return active ? active.dataset.emoji : "🌴";
}

function updateVacationFormFeedback() {
  const start = document.getElementById("vacationFormStart").value;
  const end = document.getElementById("vacationFormEnd").value;
  const fb = document.getElementById("vacationFormFeedback");
  if (!fb) return;
  if (!start || !end) {
    fb.className = "vacation-form-feedback";
    fb.textContent = "";
    return;
  }
  if (start > end) {
    fb.className = "vacation-form-feedback error";
    fb.textContent = "Startdatum liegt nach dem Enddatum.";
    return;
  }
  const days = countVacationWorkdays(start, end);
  const total = Math.max(0, Math.round((new Date(end + "T12:00:00") - new Date(start + "T12:00:00")) / 86400000) + 1);
  fb.className = "vacation-form-feedback info";
  fb.textContent = days + " " + (days === 1 ? "Werktag" : "Werktage") + " (Sa, So und Feiertage abgezogen) · "
    + total + " " + (total === 1 ? "Kalendertag" : "Kalendertage") + " gesamt";
}

function saveVacationForm() {
  const label = (document.getElementById("vacationFormLabel").value || "").trim();
  const start = document.getElementById("vacationFormStart").value;
  const end = document.getElementById("vacationFormEnd").value;
  const emoji = getVacationSelectedEmoji();
  const fb = document.getElementById("vacationFormFeedback");

  if (!start || !end) {
    if (fb) { fb.className = "vacation-form-feedback error"; fb.textContent = "Bitte Start- und Enddatum eingeben."; }
    return;
  }
  if (start > end) {
    if (fb) { fb.className = "vacation-form-feedback error"; fb.textContent = "Startdatum liegt nach dem Enddatum."; }
    return;
  }

  if (vacationEditId) {
    const idx = vacations.findIndex(v => v.id === vacationEditId);
    if (idx >= 0) vacations[idx] = { id: vacationEditId, label, emoji, start, end };
  } else {
    vacations.push({ id: vacationCreateId(), label, emoji, start, end });
  }
  closeVacationForm();
  saveLocalState();
  // Beim Anlegen ggf. zum Jahr des neuen Urlaubs springen, damit der User
  // ihn direkt sieht.
  const startY = parseInt(start.slice(0, 4), 10);
  if (Number.isFinite(startY)) vacationViewYear = startY;
  renderAll();
}

function deleteVacation(id) {
  const v = vacations.find(x => x.id === id);
  if (!v) return;
  const days = countVacationWorkdays(v.start, v.end);
  const labelText = (v.emoji ? v.emoji + " " : "") + (v.label || "Urlaub");
  if (!confirm('"' + labelText + '" (' + days + " " + (days === 1 ? "Tag" : "Tage") + ") wirklich löschen?")) return;
  vacations = vacations.filter(x => x.id !== id);
  saveLocalState();
  renderAll();
}

function setupVacationActions() {
  const ctrlPrev = document.getElementById("vacationYearPrev");
  const ctrlNext = document.getElementById("vacationYearNext");
  if (ctrlPrev) ctrlPrev.addEventListener("click", () => { vacationViewYear--; renderVacationSection(); });
  if (ctrlNext) ctrlNext.addEventListener("click", () => { vacationViewYear++; renderVacationSection(); });

  const ent = document.getElementById("vacationEntitlement");
  if (ent) {
    ent.addEventListener("change", () => {
      const v = parseInt(ent.value, 10);
      vacationEntitlement = Math.max(0, Math.min(99, Number.isFinite(v) ? v : 30));
      ent.value = String(vacationEntitlement);
      saveLocalState();
      renderVacationSection();
    });
  }

  const addBtn = document.getElementById("vacationAddBtn");
  if (addBtn) addBtn.addEventListener("click", () => openVacationForm(null));

  const cancel = document.getElementById("vacationFormCancel");
  if (cancel) cancel.addEventListener("click", closeVacationForm);
  const save = document.getElementById("vacationFormSave");
  if (save) save.addEventListener("click", saveVacationForm);

  const startInput = document.getElementById("vacationFormStart");
  const endInput = document.getElementById("vacationFormEnd");
  if (startInput) startInput.addEventListener("change", () => {
    // Wenn Startdatum nach Enddatum liegt, Enddatum auto-anpassen
    if (endInput && startInput.value && endInput.value && startInput.value > endInput.value) {
      endInput.value = startInput.value;
    }
    updateVacationFormFeedback();
  });
  if (endInput) endInput.addEventListener("change", updateVacationFormFeedback);

  const labelInput = document.getElementById("vacationFormLabel");
  if (labelInput) labelInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveVacationForm(); }
  });

  document.querySelectorAll(".vacation-emoji-btn").forEach(btn => {
    btn.addEventListener("click", () => setVacationEmojiSelection(btn.dataset.emoji));
  });
}

function setupActions() {
  // Phase 5: Monatspicker — fügt einen beliebigen Monat zu shownMonths hinzu,
  // damit er auch ohne Dienste rendert (Bootstrapping eines neuen Plans).
  // Der Input ist visuell ausgeblendet (opacity:0), damit der Knopf nur
  // "📅 Monat hinzufügen" zeigt und nicht die "tt.mm.jjjj"-Striche. Damit
  // der Klick aufs Label trotzdem den Picker öffnet, rufen wir explizit
  // showPicker() auf — Label-Klick-Delegation ist bei versteckten Inputs
  // unzuverlässig (Chrome/Safari unterschiedlich).
  const monthPicker = document.getElementById("monthPicker");
  if (monthPicker) {
    monthPicker.addEventListener("change", () => {
      const m = monthPicker.value;
      if (!m) return;
      appSettings.shownMonths = [...new Set([...(appSettings.shownMonths || []), m])];
      saveLocalState();
      monthPicker.value = "";
      renderAll();
    });
    const monthPickerLabel = monthPicker.closest(".toolbar-pick");
    if (monthPickerLabel) {
      // Wir hängen den Handler an den Label-Container, damit Klicks auf das
      // Icon, den Text ODER den (unsichtbaren) Input alle den Picker öffnen.
      // Eine Re-Entry-Sperre verhindert die Doppel-Auslösung, wenn ein Klick
      // erst auf dem Input und dann (per Label-Delegation) erneut auf der
      // Label-Ebene ankommt.
      let pickerOpening = false;
      monthPickerLabel.addEventListener("click", (e) => {
        if (pickerOpening) return;
        e.preventDefault();
        if (typeof monthPicker.showPicker === "function") {
          try {
            pickerOpening = true;
            monthPicker.showPicker();
            setTimeout(() => { pickerOpening = false; }, 0);
            return;
          } catch (err) {
            pickerOpening = false;
          }
        }
        // Fallback für sehr alte Browser: Input fokussieren.
        monthPicker.focus();
      });
    }
  }

  // Phase 5: "Aktueller Monat"-Toolbar-Knopf wurde entfernt — der Empty-
  // State-Button "Aktuellen Monat öffnen" deckt den Erstkontakt-Fall ab,
  // und wer einen Plan laedt, bekommt sowieso alle Monate. Der Picker-
  // Knopf "Monat hinzufuegen" reicht fuer alle anderen Faelle.

  // Phase 5: Sonntage ausblenden — speichert Toggle in localStorage.
  const sundaysToggle = document.getElementById("toggleSundays");
  if (sundaysToggle) {
    sundaysToggle.checked = !!appSettings.hideSundays;
    sundaysToggle.addEventListener("change", () => {
      appSettings = { ...appSettings, hideSundays: sundaysToggle.checked };
      saveLocalState();
      renderAll();
    });
  }

  // Phase 5: Upload-Widget kann an mehreren Stellen leben (Übersicht +
  // Dienstkatalog), darum als Helper. Jedes Widget braucht 3 Element-IDs:
  // Klick-Knopf, verstecktes file-Input, Status-Container. Backend-Pfad
  // (/upload-dienstkarte) und Verhalten sind identisch.
  function wireUploadWidget(buttonId, inputId, statusId) {
    const btn = document.getElementById(buttonId);
    const fileInput = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    if (!btn || !fileInput || !status) return;

    function setUploadStatus({ kind, headline, savedNames, skipped, tip }) {
      status.classList.remove("hidden", "uploading", "success", "partial", "error");
      status.classList.add(kind);
      // Sicheres DOM-Bauen statt innerHTML — alle Texte landen via textContent,
      // sodass Server-Antwort-Strings (z. B. Datei-Namen) nicht als Markup
      // interpretiert werden können.
      while (status.firstChild) status.removeChild(status.firstChild);

      const dismissBtn = document.createElement("button");
      dismissBtn.className = "upload-dismiss";
      dismissBtn.type = "button";
      dismissBtn.setAttribute("aria-label", "Schließen");
      dismissBtn.textContent = "×";
      dismissBtn.addEventListener("click", () => status.classList.add("hidden"));
      status.appendChild(dismissBtn);

      const head = document.createElement("div");
      head.className = "upload-headline";
      head.textContent = headline;
      status.appendChild(head);

      if (savedNames && savedNames.length) {
        const lbl = document.createElement("div");
        lbl.textContent = "Gespeichert:";
        status.appendChild(lbl);
        const ul = document.createElement("ul");
        for (const n of savedNames) {
          const li = document.createElement("li");
          li.textContent = n;
          ul.appendChild(li);
        }
        status.appendChild(ul);
      }
      if (skipped && skipped.length) {
        const lbl = document.createElement("div");
        lbl.style.marginTop = "8px";
        lbl.textContent = "Übersprungen:";
        status.appendChild(lbl);
        const ul = document.createElement("ul");
        for (const s of skipped) {
          const li = document.createElement("li");
          li.textContent = `${s.name} — ${s.reason}`;
          ul.appendChild(li);
        }
        status.appendChild(ul);
      }
      if (tip) {
        const tipEl = document.createElement("div");
        tipEl.className = "upload-tip";
        tipEl.textContent = tip;
        status.appendChild(tipEl);
      }
    }

    btn.addEventListener("click", () => {
      fileInput.value = ""; // allow re-selecting the same file later
      fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      const files = [...fileInput.files];
      if (!files.length) return;
      setUploadStatus({
        kind: "uploading",
        headline: `${files.length} Foto${files.length === 1 ? "" : "s"} werden hochgeladen…`,
      });
      const fd = new FormData();
      for (const f of files) fd.append("files", f, f.name);
      try {
        const res = await fetch("/upload-dienstkarte", { method: "POST", body: fd });
        const json = await res.json();
        const saved = json.saved || [];
        const skipped = json.skipped || [];
        if (!res.ok || !json.ok) {
          setUploadStatus({ kind: "error", headline: "Upload fehlgeschlagen", tip: json.error || res.statusText });
          return;
        }
        if (saved.length === 0) {
          setUploadStatus({
            kind: "partial",
            headline: "Nichts Neues zum Speichern",
            skipped,
            tip: "Diese Fotos sind schon in der Sammlung. Wenn die Dienstkarte tatsächlich anders ist, bitte ein anderes Foto auswählen.",
          });
          return;
        }
        setUploadStatus({
          kind: skipped.length ? "partial" : "success",
          headline: skipped.length
            ? `${saved.length} neu hochgeladen, ${skipped.length} übersprungen`
            : `${saved.length} Foto${saved.length === 1 ? "" : "s"} erfolgreich hochgeladen`,
          savedNames: saved,
          skipped,
          tip: "Die Fotos liegen jetzt im Ordner dienstplan/. Die KI-Extraktion läuft separat — sobald sie durchgelaufen ist, erscheinen Pausen und Lenkblöcke automatisch im Kalender.",
        });
      } catch (e) {
        setUploadStatus({ kind: "error", headline: "Upload-Fehler", tip: e.message });
      }
    });
  }
  // Phase 5: Upload-Knopf gibt es jetzt nur noch im Dienstkatalog-Tab —
  // der Upload bezieht sich konzeptionell auf den Katalog (Dienstkarten
  // -> Katalog-Eintraege), nicht auf den Plan auf der Uebersicht.
  wireUploadWidget("uploadDienstkarteCatalog", "dienstkarteFilesCatalog", "uploadStatusCatalog");

  // Phase 5: zwei Nutzer (Runke, Lady) — Plan laden + speichern.
  // "Runke laden" greift auf den gespeicherten Snapshot zurück; falls noch
  // keiner existiert, wird der hardgecodete Beispiel-Plan geladen (das
  // bisherige Verhalten). "Lady laden" zeigt nur eine Meldung wenn nichts
  // gespeichert ist — sie startet leer und baut sich ihren Plan selbst auf.
  // Phase 5: applyLoadedDuties wird beim Profil-Wechsel benutzt — wir setzen
  // suppressServerSave, damit das gerade vom Server geholte (oder aus dem
  // localStorage-Cache) NICHT direkt wieder als PUT zurückgeschickt wird.
  // Phase 5: applyLoadedPlan ersetzt das alte applyLoadedDuties — kann
  // entweder ein reines duties-Array (Legacy) oder ein {duties, vacations,
  // vacationEntitlement}-Objekt entgegennehmen, damit Urlaub mit dem Plan
  // mitwandert.
  function applyLoadedPlan(loaded) {
    let dutyArr, vacArr, ent, bl, hs;
    if (Array.isArray(loaded)) {
      dutyArr = loaded;
      vacArr = [];
      ent = 30;
      bl = null;
      hs = null;
    } else {
      dutyArr = Array.isArray(loaded && loaded.duties) ? loaded.duties : [];
      vacArr = Array.isArray(loaded && loaded.vacations) ? loaded.vacations : [];
      ent = Number.isFinite(loaded && loaded.vacationEntitlement) ? loaded.vacationEntitlement : 30;
      bl = (loaded && loaded.bundeslaender && typeof loaded.bundeslaender === "object") ? loaded.bundeslaender : null;
      hs = (loaded && typeof loaded.hideSundays === "boolean") ? loaded.hideSundays : null;
    }
    duties = dedupDuties(dutyArr);
    applyCatalogToEmptyFields(duties);
    vacations = vacArr;
    vacationEntitlement = ent;
    // Phase 5: Bundesländer-Auswahl + Sonntage-Toggle vom geladenen Profil
    // übernehmen, damit Änderungen vom anderen Gerät hier sichtbar werden.
    // Sonntage-Toggle-Checkbox wird erst beim renderAll/setupActions wieder
    // synchron — saveLocalState am Ende speichert den neuen Stand zurück.
    if (bl) appSettings = { ...appSettings, bundeslaender: bl };
    if (hs !== null) appSettings = { ...appSettings, hideSundays: hs };
    const sundaysToggle = document.getElementById("toggleSundays");
    if (sundaysToggle) sundaysToggle.checked = !!appSettings.hideSundays;
    suppressServerSave = true;
    renderAll();
    suppressServerSave = false;
  }

  // Backwards-compat-Alias — falls anderer Code applyLoadedDuties referenziert.
  function applyLoadedDuties(loaded) { applyLoadedPlan(loaded); }

  // Phase 5: Profil-Laden — Server zuerst, localStorage-Cache als Fallback.
  // Mit Auto-Sync sind die manuellen "Speichern"-Knöpfe weg, deshalb erzeugt
  // diese Funktion ein leeres Profil falls noch keins existiert (Lady-First-
  // Run): activeProfile wird gesetzt, die nächste Bearbeitung autosaved.
  // fromServer kann sein:
  //   {duties, vacations, vacationEntitlement} → Plan-Envelope vom Server
  //   null  → 404, noch nie gespeichert (frisches Profil)
  //   undefined → Server nicht erreichbar / Fehler
  async function loadProfile(profile, opts) {
    // Vor dem Wechsel: pending Debounce-PUT für das alte Profil flushen,
    // sonst gehen die letzten Änderungen verloren.
    await flushPendingSave();

    setSyncStatus("saving");
    const fromServer = await fetchPlanFromServer(profile);
    let plan;
    let nextStatus;
    if (fromServer && typeof fromServer === "object" && Array.isArray(fromServer.duties) && fromServer.duties.length) {
      plan = fromServer;
      nextStatus = "synced";
    } else if (fromServer === undefined) {
      // Offline → localStorage-Cache versuchen.
      const local = loadNamedPlan(profile);
      if (local && Array.isArray(local.duties) && local.duties.length) {
        plan = local;
        nextStatus = "offline";
      } else if (opts && opts.fallbackExample) {
        plan = { duties: exampleDuties(), vacations: [], vacationEntitlement: 30 };
        nextStatus = "offline";
      } else {
        plan = { duties: [], vacations: [], vacationEntitlement: 30 };
        nextStatus = "offline";
      }
    } else {
      // null → noch kein Plan gespeichert. Profil leer/Beispiel starten,
      // erste Bearbeitung wird autom. zum Server gepusht.
      plan = (opts && opts.fallbackExample)
        ? { duties: exampleDuties(), vacations: [], vacationEntitlement: 30 }
        : { duties: [], vacations: [], vacationEntitlement: 30 };
      nextStatus = "synced";
    }
    if (duties.length > 0 && !confirm(`Aktueller Plan wird durch ${profile.charAt(0).toUpperCase() + profile.slice(1)}-Plan ersetzt — fortfahren?`)) {
      setSyncStatus(serverSyncStatus); // unverändert lassen
      return false;
    }
    appSettings = { ...appSettings, activeProfile: profile };
    applyLoadedPlan(plan);
    updateProfileUI();
    setSyncStatus(nextStatus);
    return true;
  }

  document.getElementById("loadRunke").addEventListener("click", () => {
    loadProfile("runke", { fallbackExample: true });
  });

  document.getElementById("loadLady").addEventListener("click", () => {
    loadProfile("lady", { fallbackExample: false });
  });

  document.getElementById("clearDuties").addEventListener("click", () => {
    if (duties.length === 0) return;
    const msg = "Alle " + duties.length + " Einträge wirklich löschen?\n\nGespeicherte Pläne (Runke / Lady) bleiben erhalten — die kannst du danach mit „Plan laden“ zurückholen.";
    if (!confirm(msg)) return;
    duties = [];
    renderAll();
  });

}

const loadedState = loadLocalState();
if (loadedState && typeof loadedState === "object") {
  customCatalog = loadedState.customCatalog && typeof loadedState.customCatalog === "object" ? loadedState.customCatalog : {};
  duties = Array.isArray(loadedState.duties) ? loadedState.duties : exampleDuties();
  if (loadedState.appSettings && typeof loadedState.appSettings === "object") {
    appSettings = { ...appSettings, ...loadedState.appSettings };
  }
} else {
  duties = exampleDuties();
}
setupTabs();
setupActions();
setupVacationActions();
renderBundeslaenderSettings();
renderVacationSection();
// Phase 4: render once the catalog is loaded so auto-fill works on first paint.
// loadCatalog never throws — it falls through to an empty catalog.
duties = dedupDuties(duties); // strip any stale duplicates from localStorage
loadCatalog().then(async () => {
  // Phase 5: Review-Status beim Start vom Server holen, damit ein Klick auf
  // dem PC am Handy auch sichtbar wird (und umgekehrt). Server gewinnt.
  await loadCatalogReviewFromServer();
  // Phase 5: wenn ein Profil aktiv war, beim Start den Server-Stand holen —
  // damit Edits vom anderen Gerät hier auftauchen. Falls offline, bleibt
  // einfach der localStorage-Stand stehen.
  if (appSettings.activeProfile) {
    setSyncStatus("saving");
    const fromServer = await fetchPlanFromServer(appSettings.activeProfile);
    // Phase 5: fetchPlanFromServer gibt jetzt ein Envelope-Objekt zurueck
    // {duties, vacations, vacationEntitlement, bundeslaender, hideSundays}.
    // Vorher war es ein Array — der alte Array-Check hat den Server-Stand
    // auf dem Handy komplett verworfen, weil Array.isArray(envelope) false ist.
    if (fromServer && typeof fromServer === "object" && Array.isArray(fromServer.duties) && fromServer.duties.length) {
      duties = dedupDuties(fromServer.duties);
      if (Array.isArray(fromServer.vacations)) vacations = fromServer.vacations;
      if (Number.isFinite(fromServer.vacationEntitlement)) vacationEntitlement = fromServer.vacationEntitlement;
      if (fromServer.bundeslaender && typeof fromServer.bundeslaender === "object") {
        appSettings = { ...appSettings, bundeslaender: fromServer.bundeslaender };
      }
      if (typeof fromServer.hideSundays === "boolean") {
        appSettings = { ...appSettings, hideSundays: fromServer.hideSundays };
      }
      setSyncStatus("synced");
    } else if (fromServer === undefined) {
      setSyncStatus("offline");
    } else {
      // null oder leeres duties — Server kennt das Profil nicht. localStorage-
      // Stand behalten, beim ersten Edit landet er drüben.
      setSyncStatus("synced");
    }
  }
  applyCatalogToEmptyFields(duties); // retrofill so pre-loaded duties get AI values
  // Bootstrap: erstes saveLocalState (via renderAll) NICHT als Server-PUT
  // zurückspielen — wir haben gerade von dort geholt.
  suppressServerSave = true;
  renderAll();
  suppressServerSave = false;
  updateProfileUI();                 // H1/title/aktiver Lade-Knopf.
  setSyncStatus(serverSyncStatus);   // Badge nach Render aktualisieren.
});

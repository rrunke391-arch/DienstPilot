"use strict";
const BASE_SERVICE_CATALOG = {
  "3001": { start: "05:03", end: "12:12", days: "Mo-Fr" },
  "3003": { start: "05:47", end: "14:10", days: "Mo-Fr" },
  "3005": { start: "05:51", end: "15:49", days: "Mo-Fr" },
  "3006": { start: "06:00", end: "16:20", fridayEnd: "14:21", days: "Mo-Fr" },
  "3007": { start: "06:03", end: "14:19", days: "Mo-Fr" },
  "3009": { start: "06:04", end: "16:25", fridayEnd: "15:30", days: "Mo-Fr" },
  "3011": { start: "06:23", end: "17:00", fridayEnd: "14:34", days: "Mo-Fr" },
  "3012": { start: "06:31", end: "16:50", days: "Mo-Fr" },
  "3013": { start: "06:35", end: "17:06", days: "Mo-Fr" },
  "3014": { start: "06:35", end: "15:39", days: "Mo-Fr" },
  "3016": { start: "06:43", end: "18:06", days: "Mo-Fr" },
  "3019": { start: "06:49", end: "17:28", fridayEnd: "15:50", days: "Mo-Fr" },
  "3022": { start: "12:03", end: "19:21", days: "Mo-Fr" },
  "3023": { start: "12:03", end: "20:21", days: "Mo-Fr" },
  "3024": { start: "12:20", end: "21:05", days: "Mo-Fr" },
  "3025": { start: "13:10", end: "21:50", days: "Mo-Fr" },
  "3041": { start: "08:20", end: "19:41", days: "Mo-Fr" },
  "3042": { start: "11:20", end: "21:05", days: "Mo-Fr" },
  "3051": { start: "06:42", end: "15:21", days: "Sa" },
  "3052": { start: "06:43", end: "14:41", days: "Sa" },
  "3053": { start: "06:47", end: "14:39", days: "Sa" },
  "3054": { start: "06:51", end: "19:21", days: "Sa" },
  "3055": { start: "07:03", end: "17:04", days: "Sa" },
  "3056": { start: "07:07", end: "16:04", days: "Sa" },
  "3057": { start: "09:20", end: "18:21", days: "Sa" },
  "3095": { start: "20:20", end: "04:05", days: "Fr" }
};


let customCatalog = {};

function getCatalog() {
  return { ...BASE_SERVICE_CATALOG, ...customCatalog };
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
    localStorage.setItem("lenkRuhezeitenRunke20260413", JSON.stringify({ duties, customCatalog }));
  } catch {
    /* Speichern ist optional. */
  }
}

const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
let duties = [];

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

function emptyDuty() {
  return {
    id: createId(),
    date: localToday(),
    number: "3006",
    start: "06:00",
    end: "16:20",
    breaks: "09:30-10:00",
    drivingBlocks: "4:00 4:00",
    lineMode: "linie50",
    stopDistance: "gt3",
    pauseRule: "auto",
    tariffEight: false
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
  const blocks = parseList(duty.drivingBlocks);
  const breaks = parseBreakDurations(duty.breaks);
  const driving = blocks.reduce((sum, b) => sum + b, 0);
  const pauseRule = duty.pauseRule || "auto";

  if (blocks.length === 0 || driving === 0) {
    return { type: "warn", title: "Lenkblöcke fehlen", detail: "Trage die tatsächlichen Lenkblöcke ein, z. B. 2:15 2:10 1:40. Ohne Lenkblöcke ist die 4,5-Stunden-Prüfung nicht vollständig." };
  }

  if (blocks.some(b => b > 270)) {
    return { type: "fail", title: "Ununterbrochene Lenkzeit", detail: "Mindestens ein Lenkblock ist länger als 4 Std. 30 Min." };
  }

  const useSixthRule = duty.lineMode === "linie50" && (
    pauseRule === "sixth" || (pauseRule === "auto" && duty.stopDistance === "lte3")
  );

  if (useSixthRule) {
    const relevant = duty.tariffEight ? 8 : 10;
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

  const mode = duty.lineMode === "linie50" ? "linie50" : "eu";
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
  const rows = dutiesInput.map(dutyMetrics).sort((a, b) => a.startAbs - b.startAbs);
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

function renderDutyCard(duty) {
  const catalog = getCatalog()[duty.number];
  return `
    <article class="card duty-card" data-duty="${escapeHtml(duty.id)}">
      <div class="duty-head">
        <div>
          <div class="muted">${escapeHtml(getDay(duty.date))} · ${escapeHtml(duty.date)}</div>
          <h2>Dienst ${escapeHtml(duty.number || "ohne Nummer")}</h2>
          ${catalog ? `<div class="muted">Katalog: ${escapeHtml(catalog.days)}${catalog.fridayEnd ? " · Freitag abweichend" : ""}</div>` : `<div class="muted" style="color:#92400e;">Nicht im Dienstkatalog</div>`}
        </div>
        <button class="btn-danger btn-small delete-duty" data-id="${escapeHtml(duty.id)}">Löschen</button>
      </div>

      <div class="grid grid-4">
        <label><span class="label">Datum</span><input type="date" data-field="date" value="${escapeHtml(duty.date)}"></label>
        <label><span class="label">Dienstnummer</span><input data-field="number" value="${escapeHtml(duty.number)}" inputmode="numeric"></label>
        <label><span class="label">Beginn</span><input type="time" data-field="start" value="${escapeHtml(duty.start)}"></label>
        <label><span class="label">Ende</span><input type="time" data-field="end" value="${escapeHtml(duty.end)}"></label>
      </div>

      <div class="grid grid-4" style="margin-top:12px;">
        <label><span class="label">Lenkblöcke</span><input data-field="drivingBlocks" value="${escapeHtml(duty.drivingBlocks)}"><span class="hint">Beispiel: 2:15 2:10 1:40</span></label>
        <label><span class="label">Pausen manuell</span><input data-field="breaks" value="${escapeHtml(duty.breaks)}"><span class="hint">Minuten: 15 30 · oder Uhrzeiten: 09:15-09:45 12:00-12:15 · erkannt: ${escapeHtml(formatPauseInput(duty.breaks))}</span></label>
        <label><span class="label">Verkehrsart</span>
          <select data-field="lineMode">
            <option value="linie50" ${duty.lineMode === "linie50" ? "selected" : ""}>Linienverkehr bis 50 km</option>
            <option value="eu" ${duty.lineMode === "eu" ? "selected" : ""}>Busverkehr über 50 km / EU-Regel</option>
          </select>
        </label>
        <label><span class="label">Haltestellenabstand</span>
          <select data-field="stopDistance" ${duty.lineMode !== "linie50" ? "disabled" : ""}>
            <option value="gt3" ${duty.stopDistance === "gt3" ? "selected" : ""}>mehr als 3 km</option>
            <option value="lte3" ${duty.stopDistance === "lte3" ? "selected" : ""}>höchstens 3 km</option>
          </select>
        </label>
      </div>

      ${duty.lineMode === "linie50" ? `
      <div class="grid grid-3" style="margin-top:12px;">
        <label><span class="label">Fahrtunterbrechungsregel</span>
          <select data-field="pauseRule">
            <option value="auto" ${(duty.pauseRule || "auto") === "auto" ? "selected" : ""}>Automatisch nach Haltestellenabstand</option>
            <option value="block" ${duty.pauseRule === "block" ? "selected" : ""}>Blockregel: 30 / 2×20 / 3×15</option>
            <option value="sixth" ${duty.pauseRule === "sixth" ? "selected" : ""}>Ein-Sechstel-Regelung</option>
          </select>
          <span class="hint">Ein-Sechstel: anrechenbare Unterbrechungen müssen zusammen mindestens 1/6 der Lenkzeit betragen.</span>
        </label>
      </div>` : ""}

      ${duty.lineMode === "linie50" && ((duty.pauseRule || "auto") === "sixth" || ((duty.pauseRule || "auto") === "auto" && duty.stopDistance === "lte3")) ? `
      <label class="checkbox-row">
        <input type="checkbox" data-field="tariffEight" ${duty.tariffEight ? "checked" : ""}>
        Tarifregel vorhanden: Unterbrechungen ab 8 Min. zählen
      </label>` : ""}
    </article>
  `;
}

function renderDuties() {
  const container = document.getElementById("dutiesContainer");
  if (duties.length === 0) {
    container.innerHTML = '<div class="card muted">Noch kein Dienst eingetragen. Über „Runke-Plan laden“ kannst du die Runke-Dienste wieder einfügen.</div>';
    return;
  }
  container.innerHTML = duties.map(renderDutyCard).join("");

  container.querySelectorAll(".delete-duty").forEach(btn => {
    btn.addEventListener("click", () => {
      duties = duties.filter(d => d.id !== btn.dataset.id);
      renderAll();
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

          if (field === "pauseRule" && input.value === "sixth") {
            next.lineMode = "linie50";
            next.stopDistance = "lte3";
          }
          if (field === "pauseRule" && input.value === "block") {
            next.lineMode = "linie50";
            next.stopDistance = "gt3";
          }
          if (field === "lineMode" && input.value !== "linie50") {
            next.pauseRule = "auto";
          }

          if (field === "number" || field === "date") {
            const times = catalogTimes(field === "number" ? next.number : d.number, field === "date" ? next.date : d.date);
            if (times) {
              next.start = times.start;
              next.end = times.end;
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
  const totalDriving = plan.rows.reduce((sum, row) => sum + row.driving, 0);
  const totalShift = plan.rows.reduce((sum, row) => sum + row.shift, 0);
  const statusText = failCount ? "Nicht passend" : warnCount ? "Mit Einschränkung" : "Passend";
  const metricStatus = failCount ? "Fehler" : warnCount ? "Prüfen" : "OK";

  document.getElementById("metricDuties").textContent = String(duties.length);
  document.getElementById("metricDriving").textContent = minutesToText(totalDriving);
  document.getElementById("metricShift").textContent = minutesToText(totalShift);
  document.getElementById("metricStatus").textContent = metricStatus;
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

function renderCatalog() {
  const grid = document.getElementById("catalogGrid");
  const catalog = getCatalog();
  grid.innerHTML = Object.entries(catalog).map(([number, entry]) => {
    const isCustom = Object.prototype.hasOwnProperty.call(customCatalog, number);
    return `
    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <h2>${escapeHtml(number)}</h2>
        <span class="badge ${isCustom ? "warn" : "info"}">${isCustom ? "Eigen" : escapeHtml(entry.days)}</span>
      </div>
      <div class="muted" style="margin-top:8px;">${escapeHtml(entry.start)}–${escapeHtml(entry.end)}</div>
      ${entry.fridayEnd ? `<div class="muted" style="margin-top:4px; color:#92400e;">Freitag: ${escapeHtml(entry.start)}–${escapeHtml(entry.fridayEnd)}</div>` : ""}
      ${isCustom ? `<button class="btn-secondary btn-small delete-template" data-number="${escapeHtml(number)}" style="margin-top:10px;">Vorlage löschen</button>` : ""}
    </div>
  `;
  }).join("");

  grid.querySelectorAll(".delete-template").forEach(btn => {
    btn.addEventListener("click", () => {
      delete customCatalog[btn.dataset.number];
      saveLocalState();
      renderAll();
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
  renderCatalog();
  renderTests();
  saveLocalState();
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      ["eingabe", "auswertung", "katalog", "daten", "tests"].forEach(name => {
        document.getElementById("tab-" + name).classList.toggle("hidden", name !== tab);
      });
    });
  });
}

function setupActions() {
  document.getElementById("addDuty").addEventListener("click", () => {
    duties.push(emptyDuty());
    renderAll();
  });

  document.getElementById("resetExample").addEventListener("click", () => {
    duties = exampleDuties();
    renderAll();
  });

  document.getElementById("clearDuties").addEventListener("click", () => {
    duties = [];
    renderAll();
  });

  document.getElementById("addTemplate").addEventListener("click", () => {
    const number = document.getElementById("templateNumber").value.replace(/\D/g, "").slice(0, 4);
    const start = document.getElementById("templateStart").value;
    const end = document.getElementById("templateEnd").value;
    const days = document.getElementById("templateDays").value || "eigener Dienst";
    const fridayEnd = document.getElementById("templateFridayEnd").value;

    if (!number || !start || !end) {
      alert("Bitte Dienstnummer, Dienstanfang und Dienstende eintragen.");
      return;
    }

    customCatalog[number] = fridayEnd ? { start, end, fridayEnd, days } : { start, end, days };
    saveLocalState();
    renderAll();
    alert("Dienstvorlage " + number + " gespeichert.");
  });

  document.getElementById("exportData").addEventListener("click", () => {
    document.getElementById("dataBox").value = JSON.stringify({ duties, customCatalog }, null, 2);
  });

  document.getElementById("importData").addEventListener("click", () => {
    try {
      const parsed = JSON.parse(document.getElementById("dataBox").value);
      const importedDuties = Array.isArray(parsed) ? parsed : parsed.duties;
      if (!Array.isArray(importedDuties)) throw new Error("JSON muss eine Liste von Diensten oder ein App-Export sein.");
      customCatalog = parsed.customCatalog && typeof parsed.customCatalog === "object" ? parsed.customCatalog : customCatalog;
      duties = importedDuties.map(d => ({ ...emptyDuty(), ...d, id: d.id || createId() }));
      renderAll();
      alert("Daten geladen.");
    } catch (err) {
      alert("Daten konnten nicht geladen werden: " + err.message);
    }
  });

  document.getElementById("downloadJson").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ duties, customCatalog }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lenk_ruhezeiten_dienste.json";
    link.click();
    URL.revokeObjectURL(url);
  });
}

const loadedState = loadLocalState();
if (loadedState && typeof loadedState === "object") {
  customCatalog = loadedState.customCatalog && typeof loadedState.customCatalog === "object" ? loadedState.customCatalog : {};
  duties = Array.isArray(loadedState.duties) ? loadedState.duties : exampleDuties();
} else {
  duties = exampleDuties();
}
setupTabs();
setupActions();
renderAll();

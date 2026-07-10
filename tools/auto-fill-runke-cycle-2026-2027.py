#!/usr/bin/env python3
"""Überträgt den bestätigten 22-Wochen-Umlauf auf Runke.

Als sichere Vorlage wird Gerdings vollständig bestätigter Umlauf vom
21.12.2026 bis 23.05.2027 verwendet. Innerhalb dieser 22 Wochen wird die
Woche 3014/3011 automatisch gesucht und als Startwoche für Runke verwendet.

Runke beginnt am Dienstag, 18.08.2026:
- Dienstag frei
- Mittwoch und Donnerstag Dienst 3011 von 06:23 bis 17:00 Uhr
- Freitag Dienst 3011 von 06:23 bis 14:34 Uhr

Danach läuft derselbe 22-Wochen-Umlauf mit WD, 3022, 3009/3007 usw. bis
einschließlich 31.12.2027 weiter.

Sonntage und gesetzliche Feiertage in Niedersachsen werden nicht automatisch
belegt. Bereits dort eingetragene Dienste bleiben erhalten. Automatisch
erzeugte Dienste bleiben in DienstPilot vollständig bearbeitbar.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import shutil
import sqlite3
from pathlib import Path

DB = Path("/opt/dienstpilot-api/dienstpilot.sqlite")
BACKUP_DIR = Path("/opt/dienstpilot-backups")
SOURCE_KEY = "plan_gerding"
TARGET_KEY = "plan_runke"

SOURCE_START = dt.date(2026, 12, 21)
SOURCE_END = dt.date(2027, 5, 23)
CYCLE_DAYS = (SOURCE_END - SOURCE_START).days + 1
TARGET_WEEK_START = dt.date(2026, 8, 17)
TARGET_START = dt.date(2026, 8, 18)
TARGET_END = dt.date(2027, 12, 31)

NI_HOLIDAYS = {
    dt.date(2026, 10, 3), dt.date(2026, 10, 31), dt.date(2026, 12, 25), dt.date(2026, 12, 26),
    dt.date(2027, 1, 1), dt.date(2027, 3, 26), dt.date(2027, 3, 29), dt.date(2027, 5, 1),
    dt.date(2027, 5, 6), dt.date(2027, 5, 17), dt.date(2027, 10, 3), dt.date(2027, 10, 31),
    dt.date(2027, 12, 25), dt.date(2027, 12, 26),
}

SPECIAL_TIMES = {
    "3006": {"weekday": ("06:00", "16:20"), "friday": ("06:00", "14:21")},
    "3009": {"weekday": ("06:04", "16:25"), "friday": ("06:04", "15:30")},
    "3011": {"weekday": ("06:23", "17:00"), "friday": ("06:23", "14:34")},
    "3019": {"weekday": ("06:49", "17:28"), "friday": ("06:49", "15:50")},
}


def parse_iso(value: object) -> dt.date | None:
    try:
        return dt.date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def is_protected_day(day: dt.date) -> bool:
    return day.weekday() == 6 or day in NI_HOLIDAYS


def month_range(start: dt.date, end: dt.date) -> list[str]:
    months: list[str] = []
    current = dt.date(start.year, start.month, 1)
    last = dt.date(end.year, end.month, 1)
    while current <= last:
        months.append(current.strftime("%Y-%m"))
        current = dt.date(current.year + 1, 1, 1) if current.month == 12 else dt.date(current.year, current.month + 1, 1)
    return months


def read_plan(con: sqlite3.Connection, key: str, *, required: bool) -> tuple[dict, bool]:
    row = con.execute("SELECT data_json FROM app_data WHERE data_key=?", (key,)).fetchone()
    if not row:
        if required:
            raise RuntimeError(f"{key} fehlt in app_data")
        return {}, False
    try:
        data = json.loads(row[0])
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{key} enthält ungültiges JSON") from error
    if not isinstance(data, dict):
        raise RuntimeError(f"{key} ist kein Plan-Objekt")
    return data, True


def entries_by_date(duties: list[dict], start: dt.date, end: dt.date) -> dict[dt.date, list[dict]]:
    result: dict[dt.date, list[dict]] = {}
    for entry in duties:
        if not isinstance(entry, dict):
            continue
        day = parse_iso(entry.get("date"))
        if day and start <= day <= end:
            result.setdefault(day, []).append(entry)
    return result


def has_number(entries: list[dict], number: str) -> bool:
    return any(entry.get("type") != "frei" and str(entry.get("number") or "") == number for entry in entries)


def has_free(entries: list[dict]) -> bool:
    return any(entry.get("type") == "frei" for entry in entries)


def find_3014_3011_start_week(by_date: dict[dt.date, list[dict]]) -> int:
    for week_index in range(22):
        monday = SOURCE_START + dt.timedelta(days=week_index * 7)
        if not has_number(by_date.get(monday, []), "3014"):
            continue
        if not has_free(by_date.get(monday + dt.timedelta(days=1), [])):
            continue
        if not has_number(by_date.get(monday + dt.timedelta(days=2), []), "3011"):
            continue
        if not has_number(by_date.get(monday + dt.timedelta(days=3), []), "3011"):
            continue
        if not has_number(by_date.get(monday + dt.timedelta(days=4), []), "3011"):
            continue
        return week_index
    raise RuntimeError(
        "Im bestätigten 22-Wochen-Umlauf wurde keine Woche mit Montag 3014, "
        "Dienstag frei und Mittwoch bis Freitag 3011 gefunden."
    )


def apply_confirmed_times(entry: dict, target_date: dt.date) -> None:
    if entry.get("type") == "frei":
        return
    number = str(entry.get("number") or "")
    timing = SPECIAL_TIMES.get(number)
    if not timing:
        return
    key = "friday" if target_date.weekday() == 4 else "weekday"
    entry["start"], entry["end"] = timing[key]


def make_entry(source_entry: dict, target_date: dt.date, cycle_number: int, sequence: int) -> dict:
    entry = copy.deepcopy(source_entry)
    target_iso = target_date.isoformat()
    entry["date"] = target_iso
    suffix = str(entry.get("number") or entry.get("type") or "eintrag")
    entry["id"] = f"runke-auto-{target_date.strftime('%Y%m%d')}-{suffix}-umlauf{cycle_number}-{sequence}"
    for key in ("locked", "isLocked", "readonly", "readOnly", "protected"):
        entry.pop(key, None)
    entry["autoGeneratedBy"] = "runke-22-week-cycle"
    apply_confirmed_times(entry, target_date)
    return entry


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Nur prüfen; Datenbank nicht verändern.")
    args = parser.parse_args()

    if CYCLE_DAYS != 154:
        raise RuntimeError(f"Unerwartete Umlauflänge: {CYCLE_DAYS} Tage")
    if not DB.exists():
        raise FileNotFoundError(f"Datenbank fehlt: {DB}")

    con = sqlite3.connect(DB)
    try:
        source_data, _ = read_plan(con, SOURCE_KEY, required=True)
        target_data, target_exists = read_plan(con, TARGET_KEY, required=False)
        source_duties = source_data.get("duties", [])
        if not isinstance(source_duties, list):
            raise RuntimeError("plan_gerding.duties ist keine Liste")
        target_duties = target_data.get("duties", [])
        if not isinstance(target_duties, list):
            target_duties = []

        source_by_date = entries_by_date(source_duties, SOURCE_START, SOURCE_END)
        source_weeks = {(day - SOURCE_START).days // 7 for day in source_by_date}
        if source_weeks != set(range(22)):
            raise RuntimeError(f"Vorlagen-Umlauf ist unvollständig: gefunden wurden {len(source_weeks)} von 22 Wochen")

        start_week_index = find_3014_3011_start_week(source_by_date)
        source_start_monday = SOURCE_START + dt.timedelta(days=start_week_index * 7)

        generated: list[dict] = []
        managed_dates: set[str] = set()
        protected_dates: set[str] = set()
        current = TARGET_START
        sequence = 0

        while current <= TARGET_END:
            if is_protected_day(current):
                protected_dates.add(current.isoformat())
                current += dt.timedelta(days=1)
                continue

            target_offset = (current - TARGET_WEEK_START).days
            cycle_offset = target_offset % CYCLE_DAYS
            source_offset = (start_week_index * 7 + cycle_offset) % CYCLE_DAYS
            source_date = SOURCE_START + dt.timedelta(days=source_offset)
            source_entries = source_by_date.get(source_date, [])

            if source_entries:
                cycle_number = target_offset // CYCLE_DAYS + 1
                for source_entry in source_entries:
                    sequence += 1
                    generated.append(make_entry(source_entry, current, cycle_number, sequence))
                managed_dates.add(current.isoformat())

            current += dt.timedelta(days=1)

        retained = [
            entry for entry in target_duties
            if not (isinstance(entry, dict) and str(entry.get("date") or "") in managed_dates)
        ]
        replaced_count = len(target_duties) - len(retained)
        final_duties = retained + generated
        final_duties.sort(key=lambda entry: (str(entry.get("date") or ""), str(entry.get("id") or "")))

        first_week = [entry for entry in generated if "2026-08-18" <= str(entry.get("date") or "") <= "2026-08-21"]

        print(f"Vorlage:       {SOURCE_START} bis {SOURCE_END} · Startwoche ab {source_start_monday}")
        print(f"Ziel:          {TARGET_START} bis {TARGET_END}")
        print(f"Neu erzeugt:   {len(generated)} Einträge")
        print(f"Zu ersetzen:   {replaced_count} vorhandene Einträge auf Zyklustagen")
        print(f"Geschützt:     {len(protected_dates)} Sonntags-/Feiertagsdaten")
        print("Erste Runke-Woche:")
        for entry in first_week:
            if entry.get("type") == "frei":
                print(f"  {entry['date']} FREI")
            else:
                print(f"  {entry['date']} Dienst {entry.get('number')} {entry.get('start')}–{entry.get('end')}")

        expected = {
            "2026-08-18": ("frei", "", ""),
            "2026-08-19": ("3011", "06:23", "17:00"),
            "2026-08-20": ("3011", "06:23", "17:00"),
            "2026-08-21": ("3011", "06:23", "14:34"),
        }
        actual: dict[str, tuple[str, str, str]] = {}
        for entry in first_week:
            date = str(entry.get("date") or "")
            if entry.get("type") == "frei":
                actual[date] = ("frei", "", "")
            else:
                actual[date] = (str(entry.get("number") or ""), str(entry.get("start") or ""), str(entry.get("end") or ""))
        if actual != expected:
            raise RuntimeError(f"Erste Runke-Woche stimmt nicht. Erwartet: {expected}; erhalten: {actual}")

        if args.dry_run:
            print("Trockenlauf beendet; Datenbank wurde nicht verändert.")
            return 0

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup = BACKUP_DIR / f"dienstpilot-vor-runke-auto-{stamp}.sqlite"
        shutil.copy2(DB, backup)

        target_data["duties"] = final_duties
        target_data["shownMonths"] = sorted(set(list(target_data.get("shownMonths", [])) + month_range(dt.date(2026, 8, 1), TARGET_END)))
        target_data["startDate"] = TARGET_START.isoformat()
        target_data["profile"] = "runke"
        target_data["savedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()

        payload = json.dumps(target_data, ensure_ascii=False)
        if target_exists:
            con.execute("UPDATE app_data SET data_json=?, updated_at=CURRENT_TIMESTAMP WHERE data_key=?", (payload, TARGET_KEY))
        else:
            con.execute("INSERT INTO app_data (data_key, data_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", (TARGET_KEY, payload))
        con.commit()

        print(f"Backup:        {backup}")
        print("Runke-Umlauf wurde gespeichert und bleibt in DienstPilot bearbeitbar.")
        return 0
    finally:
        con.close()


if __name__ == "__main__":
    raise SystemExit(main())

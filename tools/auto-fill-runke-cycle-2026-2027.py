#!/usr/bin/env python3
"""Überträgt den bestätigten 22-Wochen-Umlauf auf Runke.

Grundlage ist Gerdings vollständig eingetragener Umlauf vom 17.08.2026 bis
17.01.2027. Für Runke beginnt die Eintragung am Dienstag, 18.08.2026:
Dienstag frei, Mittwoch bis Freitag Dienst 3011. Danach läuft der bestätigte
Umlauf WD, 3022, 3009/3007 usw. bis einschließlich 31.12.2027 weiter.

Sonntage und gesetzliche Feiertage in Niedersachsen werden nicht automatisch
belegt. Bereits manuell eingetragene Sonntags- und Feiertagsdienste bleiben
erhalten. Normale automatisch verwaltete Zyklustage werden beim Ausführen
ersetzt und bleiben anschließend in DienstPilot vollständig bearbeitbar.
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

SOURCE_START = dt.date(2026, 8, 17)   # Montag der ersten Umlaufwoche
SOURCE_END = dt.date(2027, 1, 17)     # Sonntag nach 22 vollständigen Wochen
TARGET_START = dt.date(2026, 8, 18)   # Runke beginnt am Dienstag
TARGET_END = dt.date(2027, 12, 31)
CYCLE_DAYS = (SOURCE_END - SOURCE_START).days + 1

# Gesetzliche Feiertage in Niedersachsen für den benötigten Zeitraum.
NI_HOLIDAYS = {
    dt.date(2026, 1, 1),
    dt.date(2026, 4, 3),
    dt.date(2026, 4, 6),
    dt.date(2026, 5, 1),
    dt.date(2026, 5, 14),
    dt.date(2026, 5, 25),
    dt.date(2026, 10, 3),
    dt.date(2026, 10, 31),
    dt.date(2026, 12, 25),
    dt.date(2026, 12, 26),
    dt.date(2027, 1, 1),
    dt.date(2027, 3, 26),
    dt.date(2027, 3, 29),
    dt.date(2027, 5, 1),
    dt.date(2027, 5, 6),
    dt.date(2027, 5, 17),
    dt.date(2027, 10, 3),
    dt.date(2027, 10, 31),
    dt.date(2027, 12, 25),
    dt.date(2027, 12, 26),
}

# Dienste mit bestätigten abweichenden Freitagszeiten.
SPECIAL_TIMES = {
    "3006": {
        "weekday": ("06:00", "16:20"),
        "friday": ("06:00", "14:21"),
    },
    "3009": {
        "weekday": ("06:04", "16:25"),
        "friday": ("06:04", "15:30"),
    },
    "3011": {
        "weekday": ("06:23", "17:00"),
        "friday": ("06:23", "14:34"),
    },
    "3019": {
        "weekday": ("06:49", "17:28"),
        "friday": ("06:49", "15:50"),
    },
}


def parse_iso(value: object) -> dt.date | None:
    try:
        return dt.date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def is_protected_day(day: dt.date) -> bool:
    """Sonntage und Feiertage werden ausschließlich manuell disponiert."""
    return day.weekday() == 6 or day in NI_HOLIDAYS


def month_range(start: dt.date, end: dt.date) -> list[str]:
    months: list[str] = []
    current = dt.date(start.year, start.month, 1)
    last = dt.date(end.year, end.month, 1)
    while current <= last:
        months.append(current.strftime("%Y-%m"))
        if current.month == 12:
            current = dt.date(current.year + 1, 1, 1)
        else:
            current = dt.date(current.year, current.month + 1, 1)
    return months


def read_plan(con: sqlite3.Connection, key: str, required: bool) -> tuple[dict, bool]:
    row = con.execute(
        "SELECT data_json FROM app_data WHERE data_key=?",
        (key,),
    ).fetchone()
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


def first_week_is_correct(source_entries: list[tuple[dt.date, dict]]) -> bool:
    by_date: dict[dt.date, list[dict]] = {}
    for day, entry in source_entries:
        by_date.setdefault(day, []).append(entry)

    tuesday = by_date.get(dt.date(2026, 8, 18), [])
    if not any(entry.get("type") == "frei" for entry in tuesday):
        return False

    for day in (dt.date(2026, 8, 19), dt.date(2026, 8, 20), dt.date(2026, 8, 21)):
        if not any(str(entry.get("number") or "") == "3011" for entry in by_date.get(day, [])):
            return False
    return True


def apply_confirmed_times(entry: dict, target_date: dt.date) -> None:
    if entry.get("type") == "frei":
        return

    number = str(entry.get("number") or "")
    timing = SPECIAL_TIMES.get(number)
    if not timing:
        return

    key = "friday" if target_date.weekday() == 4 else "weekday"
    start, end = timing[key]
    entry["start"] = start
    entry["end"] = end


def make_entry(source_entry: dict, target_date: dt.date, cycle_number: int, sequence: int) -> dict:
    entry = copy.deepcopy(source_entry)
    target_iso = target_date.isoformat()
    entry["date"] = target_iso

    suffix = str(entry.get("number") or entry.get("type") or "eintrag")
    entry["id"] = (
        f"runke-auto-{target_date.strftime('%Y%m%d')}-{suffix}-"
        f"umlauf{cycle_number}-{sequence}"
    )

    # Automatische Einträge dürfen keinerlei Sperrkennzeichen übernehmen.
    for key in ("locked", "isLocked", "readonly", "readOnly", "protected"):
        entry.pop(key, None)

    entry["autoGeneratedBy"] = "runke-22-week-cycle"
    apply_confirmed_times(entry, target_date)
    return entry


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur prüfen und anzeigen; Datenbank nicht verändern.",
    )
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

        source_entries: list[tuple[dt.date, dict]] = []
        for entry in source_duties:
            if not isinstance(entry, dict):
                continue
            source_date = parse_iso(entry.get("date"))
            if source_date and SOURCE_START <= source_date <= SOURCE_END:
                source_entries.append((source_date, entry))

        source_entries.sort(key=lambda item: (item[0], str(item[1].get("id") or "")))
        source_weeks = {(day - SOURCE_START).days // 7 for day, _ in source_entries}
        if source_weeks != set(range(22)):
            raise RuntimeError(
                "Vorlagen-Umlauf ist unvollständig: "
                f"gefunden wurden {len(source_weeks)} von 22 Wochen"
            )
        if not first_week_is_correct(source_entries):
            raise RuntimeError(
                "Erste Vorlagenwoche stimmt nicht: erwartet werden 18.08. frei "
                "und 19.–21.08. Dienst 3011"
            )

        generated: list[dict] = []
        managed_dates: set[str] = set()
        protected_dates: set[str] = set()

        cycle_anchor = SOURCE_START
        cycle_number = 1
        while cycle_anchor <= TARGET_END:
            sequence = 0
            for source_date, source_entry in source_entries:
                offset = (source_date - SOURCE_START).days
                target_date = cycle_anchor + dt.timedelta(days=offset)
                if target_date < TARGET_START or target_date > TARGET_END:
                    continue

                if is_protected_day(target_date):
                    protected_dates.add(target_date.isoformat())
                    continue

                sequence += 1
                target_iso = target_date.isoformat()
                generated.append(
                    make_entry(source_entry, target_date, cycle_number, sequence)
                )
                managed_dates.add(target_iso)

            cycle_anchor += dt.timedelta(days=CYCLE_DAYS)
            cycle_number += 1

        # Auf automatisierten Zyklustagen vorhandene Einträge einmalig ersetzen.
        # Sonntags- und Feiertagseinträge werden nicht berührt.
        retained = [
            entry
            for entry in target_duties
            if not (
                isinstance(entry, dict)
                and str(entry.get("date") or "") in managed_dates
            )
        ]
        replaced_count = len(target_duties) - len(retained)
        final_duties = retained + generated
        final_duties.sort(
            key=lambda entry: (
                str(entry.get("date") or ""),
                str(entry.get("id") or ""),
            )
        )

        first_week = [
            entry
            for entry in generated
            if "2026-08-18" <= str(entry.get("date") or "") <= "2026-08-21"
        ]

        print(f"Vorlage:       {SOURCE_START} bis {SOURCE_END} · 22 Wochen")
        print(f"Ziel:          {TARGET_START} bis {TARGET_END}")
        print(f"Neu erzeugt:   {len(generated)} Einträge")
        print(f"Zu ersetzen:   {replaced_count} vorhandene Einträge auf Zyklustagen")
        print(f"Geschützt:     {len(protected_dates)} Sonntags-/Feiertagsdaten")
        print("Erste Runke-Woche:")
        for entry in first_week:
            if entry.get("type") == "frei":
                print(f"  {entry['date']} FREI")
            else:
                print(
                    f"  {entry['date']} Dienst {entry.get('number')} "
                    f"{entry.get('start')}–{entry.get('end')}"
                )

        if args.dry_run:
            print("Trockenlauf beendet; Datenbank wurde nicht verändert.")
            return 0

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup = BACKUP_DIR / f"dienstpilot-vor-runke-auto-{stamp}.sqlite"
        shutil.copy2(DB, backup)

        target_data["duties"] = final_duties
        target_data["shownMonths"] = sorted(
            set(
                list(target_data.get("shownMonths", []))
                + month_range(dt.date(2026, 8, 1), TARGET_END)
            )
        )
        target_data["startDate"] = TARGET_START.isoformat()
        target_data["profile"] = "runke"
        target_data["savedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()

        payload = json.dumps(target_data, ensure_ascii=False)
        if target_exists:
            con.execute(
                "UPDATE app_data SET data_json=?, updated_at=CURRENT_TIMESTAMP "
                "WHERE data_key=?",
                (payload, TARGET_KEY),
            )
        else:
            con.execute(
                "INSERT INTO app_data (data_key, data_json, updated_at) "
                "VALUES (?, ?, CURRENT_TIMESTAMP)",
                (TARGET_KEY, payload),
            )
        con.commit()

        print(f"Backup:        {backup}")
        print("Runke-Umlauf wurde gespeichert und bleibt in DienstPilot bearbeitbar.")
        return 0
    finally:
        con.close()


if __name__ == "__main__":
    raise SystemExit(main())

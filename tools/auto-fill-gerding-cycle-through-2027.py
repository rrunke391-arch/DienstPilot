#!/usr/bin/env python3
"""Füllt Gerdings bestätigten 22-Wochen-Umlauf automatisch bis Anfang 2028.

Die bereits vollständig eingetragenen Wochen vom 21.12.2026 bis 23.05.2027
werden als unveränderte Vorlage verwendet. Vorhandene Zieltage werden nicht
überschrieben, damit manuelle Korrekturen erhalten bleiben.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import os
import shutil
import sqlite3
from pathlib import Path

DB = Path("/opt/dienstpilot-api/dienstpilot.sqlite")
BACKUP_DIR = Path("/opt/dienstpilot-backups")
KEY = "plan_gerding"

SOURCE_START = dt.date(2026, 12, 21)
SOURCE_END = dt.date(2027, 5, 23)
TARGET_START = dt.date(2027, 5, 24)
# KW 52/2027 endet am 02.01.2028; deshalb wird die Woche vollständig angelegt.
TARGET_END = dt.date(2028, 1, 2)
CYCLE_DAYS = (SOURCE_END - SOURCE_START).days + 1  # 154 Tage = 22 Wochen


def parse_iso(value: object) -> dt.date | None:
    try:
        return dt.date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


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
        row = con.execute(
            "SELECT data_json FROM app_data WHERE data_key=?", (KEY,)
        ).fetchone()
        if not row:
            raise RuntimeError("plan_gerding fehlt in app_data")

        data = json.loads(row[0])
        duties = data.get("duties", [])
        if not isinstance(duties, list):
            raise RuntimeError("duties ist keine Liste")

        source_entries: list[tuple[dt.date, dict]] = []
        for duty in duties:
            source_date = parse_iso(duty.get("date")) if isinstance(duty, dict) else None
            if source_date and SOURCE_START <= source_date <= SOURCE_END:
                source_entries.append((source_date, duty))

        source_entries.sort(key=lambda item: item[0])
        source_weeks = {((date - SOURCE_START).days // 7) for date, _ in source_entries}
        if len(source_weeks) != 22:
            raise RuntimeError(
                "Vorlagen-Umlauf ist unvollständig: "
                f"gefunden wurden {len(source_weeks)} von 22 Wochen"
            )

        existing_dates = {
            str(duty.get("date"))
            for duty in duties
            if isinstance(duty, dict) and parse_iso(duty.get("date"))
        }

        generated: list[dict] = []
        skipped: list[str] = []
        cycle_start = TARGET_START
        cycle_number = 1

        while cycle_start <= TARGET_END:
            for source_date, source_duty in source_entries:
                day_offset = (source_date - SOURCE_START).days
                target_date = cycle_start + dt.timedelta(days=day_offset)
                if target_date > TARGET_END:
                    continue

                target_iso = target_date.isoformat()
                if target_iso in existing_dates:
                    skipped.append(target_iso)
                    continue

                new_duty = copy.deepcopy(source_duty)
                new_duty["date"] = target_iso
                suffix = str(new_duty.get("number") or new_duty.get("type") or "eintrag")
                new_duty["id"] = (
                    f"gerding-auto-{target_date.strftime('%Y%m%d')}-"
                    f"{suffix}-umlauf{cycle_number}"
                )
                generated.append(new_duty)
                existing_dates.add(target_iso)

            cycle_start += dt.timedelta(days=CYCLE_DAYS)
            cycle_number += 1

        print(f"Vorlage: {SOURCE_START} bis {SOURCE_END} ({len(source_entries)} Einträge)")
        print(f"Ziel:     {TARGET_START} bis {TARGET_END}")
        print(f"Neu:      {len(generated)} Einträge")
        print(f"Behalten: {len(set(skipped))} bereits vorhandene Tage")

        if args.dry_run:
            print("Trockenlauf beendet; Datenbank wurde nicht verändert.")
            return 0

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup = BACKUP_DIR / f"dienstpilot-vor-gerding-auto-2027-{stamp}.sqlite"
        shutil.copy2(DB, backup)

        duties.extend(generated)
        duties.sort(key=lambda duty: str(duty.get("date", "")))
        data["duties"] = duties

        shown_months = data.get("shownMonths", [])
        if not isinstance(shown_months, list):
            shown_months = []
        data["shownMonths"] = sorted(
            set(shown_months + month_range(TARGET_START, TARGET_END))
        )
        data["profile"] = "gerding"
        data["savedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()

        payload = json.dumps(data, ensure_ascii=False)
        con.execute(
            "UPDATE app_data SET data_json=?, updated_at=CURRENT_TIMESTAMP "
            "WHERE data_key=?",
            (payload, KEY),
        )
        con.commit()

        print(f"Backup:   {backup}")
        print("Automatischer 22-Wochen-Umlauf wurde gespeichert.")
        return 0
    finally:
        con.close()


if __name__ == "__main__":
    raise SystemExit(main())

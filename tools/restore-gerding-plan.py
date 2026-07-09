#!/usr/bin/env python3
import datetime
import json
import os
import shutil
import sqlite3

DB = "/opt/dienstpilot-api/dienstpilot.sqlite"
BACKUP_DIR = "/opt/dienstpilot-backups"
KEY = "plan_gerding"

os.makedirs(BACKUP_DIR, exist_ok=True)
stamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
backup = os.path.join(BACKUP_DIR, f"dienstpilot-vor-gerding-wiederherstellung-{stamp}.sqlite")
shutil.copy2(DB, backup)

DUTY_DEFAULTS = {
    "breaks": "",
    "drivingBlocks": "",
    "lineMode": "linie50",
    "stopDistance": "lte3",
    "pauseRule": "auto",
    "tariffEight": False,
}

def duty(date, number, start, end):
    return {
        "id": f"gerding-{date.replace('-', '')}-{number}",
        "date": date,
        "number": number,
        "start": start,
        "end": end,
        **DUTY_DEFAULTS,
    }

def free_day(date):
    return {
        "id": f"gerding-{date.replace('-', '')}-frei",
        "date": date,
        "type": "frei",
        "number": "",
        "start": "",
        "end": "",
        "breaks": "",
        "drivingBlocks": "",
        "note": "frei",
    }

# Gerding startet am 17.08.2026 mit Paket 3001/3013.
duties = [
    duty("2026-08-17", "3001", "05:03", "12:12"),
    duty("2026-08-18", "3001", "05:03", "12:12"),
    duty("2026-08-19", "3013", "06:35", "17:05"),
    duty("2026-08-20", "3013", "06:35", "17:05"),
    duty("2026-08-21", "3013", "06:35", "17:05"),

    duty("2026-08-24", "3014", "06:35", "15:39"),
    free_day("2026-08-25"),
    duty("2026-08-26", "3011", "06:23", "17:00"),
    duty("2026-08-27", "3011", "06:23", "17:00"),
    duty("2026-08-28", "3011", "06:23", "17:00"),

    duty("2026-08-31", "3016", "06:43", "18:06"),
    duty("2026-09-01", "3019", "06:49", "17:28"),
    duty("2026-09-02", "3012", "06:31", "16:50"),
    free_day("2026-09-03"),
    duty("2026-09-04", "3095", "20:20", "04:05"),
]

con = sqlite3.connect(DB)
cur = con.cursor()
row = cur.execute("SELECT data_json FROM app_data WHERE data_key=?", (KEY,)).fetchone()
data = json.loads(row[0]) if row else {}

data["duties"] = duties
data["shownMonths"] = ["2026-08", "2026-09"]
data["startDate"] = "2026-08-01"
data["profile"] = "gerding"
data["savedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

payload = json.dumps(data, ensure_ascii=False)
cur.execute(
    """
    INSERT INTO app_data (data_key, data_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(data_key) DO UPDATE SET
      data_json=excluded.data_json,
      updated_at=CURRENT_TIMESTAMP
    """,
    (KEY, payload),
)
con.commit()
con.close()

print("Backup:", backup)
print("Wiederhergestellt: plan_gerding")
print("shownMonths:", data["shownMonths"])
print("Gesamt-Einträge:", len(duties))
print("Echte Dienste:", sum(1 for d in duties if d.get("type") != "frei"))
print("Freie Tage:", sum(1 for d in duties if d.get("type") == "frei"))
print()
for d in duties:
    if d.get("type") == "frei":
        print(d["date"], "FREI")
    else:
        print(d["date"], d["number"], d["start"], d["end"])

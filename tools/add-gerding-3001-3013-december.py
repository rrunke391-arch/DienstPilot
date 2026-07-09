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
backup = os.path.join(BACKUP_DIR, f"dienstpilot-vor-gerding-3001-3013-dezember-{stamp}.sqlite")
shutil.copy2(DB, backup)

con = sqlite3.connect(DB)
cur = con.cursor()
row = cur.execute("SELECT data_json FROM app_data WHERE data_key=?", (KEY,)).fetchone()
if not row:
    print("FEHLER: plan_gerding fehlt")
    raise SystemExit(1)

data = json.loads(row[0])
duties = data.get("duties", [])
if not isinstance(duties, list):
    duties = []

entries = [
    ("2026-12-21", "3001", "05:03", "12:12"),
    ("2026-12-22", "3001", "05:03", "12:12"),
    ("2026-12-23", "3013", "06:35", "17:05"),
    ("2026-12-24", "3013", "06:35", "17:05"),
    ("2026-12-25", "3013", "06:35", "17:05"),
]

replace_dates = {date for date, _, _, _ in entries}
duties = [d for d in duties if d.get("date") not in replace_dates]

for date, number, start, end in entries:
    duties.append({
        "id": f"gerding-{date.replace('-', '')}-{number}",
        "date": date,
        "number": number,
        "start": start,
        "end": end,
        "breaks": "",
        "drivingBlocks": "",
        "lineMode": "linie50",
        "stopDistance": "lte3",
        "pauseRule": "auto",
        "tariffEight": False,
    })

duties.sort(key=lambda d: d.get("date", ""))

data["duties"] = duties
data["shownMonths"] = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]
data["startDate"] = "2026-08-01"
data["profile"] = "gerding"
data["savedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

payload = json.dumps(data, ensure_ascii=False)
cur.execute(
    "UPDATE app_data SET data_json=?, updated_at=CURRENT_TIMESTAMP WHERE data_key=?",
    (payload, KEY),
)
con.commit()
con.close()

print("Backup:", backup)
print("3001/3013-Woche Dezember gespeichert")
print("Gesamt-Einträge:", len(duties))
print("Echte Dienste:", sum(1 for d in duties if d.get("type") != "frei"))
print("Freie Tage:", sum(1 for d in duties if d.get("type") == "frei"))
print()
for d in duties:
    if d.get("date", "").startswith("2026-12"):
        if d.get("type") == "frei":
            print(d["date"], "FREI")
        else:
            print(d["date"], d.get("number"), d.get("start"), d.get("end"))

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
backup = os.path.join(BACKUP_DIR, f"dienstpilot-vor-gerding-3001-3013-2027-05-24-{stamp}.sqlite")
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
    ("2027-05-24", "3001", "05:03", "12:12"),
    ("2027-05-25", "3001", "05:03", "12:12"),
    ("2027-05-26", "3013", "06:35", "17:05"),
    ("2027-05-27", "3013", "06:35", "17:05"),
    ("2027-05-28", "3013", "06:35", "17:05"),
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
shown_months = data.get("shownMonths", [])
if not isinstance(shown_months, list):
    shown_months = []
data["shownMonths"] = sorted(set(shown_months + ["2027-05"]))
data["startDate"] = data.get("startDate") or "2026-08-01"
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
print("3001/3013-Woche KW 21 gespeichert")
print("Gesamt-Einträge:", len(duties))
print()
for d in duties:
    date = d.get("date", "")
    if "2027-05-24" <= date <= "2027-05-30":
        if d.get("type") == "frei":
            print(d["date"], "FREI")
        else:
            print(d["date"], d.get("number"), d.get("start"), d.get("end"))

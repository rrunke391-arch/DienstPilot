#!/usr/bin/env python3
import datetime
import json
import os
import shutil
import sqlite3

DB = "/opt/dienstpilot-api/dienstpilot.sqlite"
BACKUP_DIR = "/opt/dienstpilot-backups"
KEY = "plan_gerding"
FIX_DATE = "2027-04-14"

os.makedirs(BACKUP_DIR, exist_ok=True)
stamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
backup = os.path.join(BACKUP_DIR, f"dienstpilot-vor-fix-gerding-2027-04-14-frei-{stamp}.sqlite")
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

# Den falschen Dienst am 14.04.2027 entfernen und durch FREI ersetzen.
duties = [d for d in duties if d.get("date") != FIX_DATE]
duties.append({
    "id": "gerding-20270414-frei",
    "date": FIX_DATE,
    "type": "frei",
    "number": "",
    "start": "",
    "end": "",
    "breaks": "",
    "drivingBlocks": "",
    "note": "frei",
})

duties.sort(key=lambda d: d.get("date", ""))

data["duties"] = duties
data["shownMonths"] = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"]
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
print("Korrektur gespeichert: 14.04.2027 ist jetzt FREI")
print("Gesamt-Einträge:", len(duties))
print("Echte Dienste:", sum(1 for d in duties if d.get("type") != "frei"))
print("Freie Tage:", sum(1 for d in duties if d.get("type") == "frei"))
print()
for d in duties:
    date = d.get("date", "")
    if "2027-04-12" <= date <= "2027-04-16":
        if d.get("type") == "frei":
            print(d["date"], "FREI")
        else:
            print(d["date"], d.get("number"), d.get("start"), d.get("end"))

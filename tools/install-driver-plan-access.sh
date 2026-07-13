#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/dienstpilot-api"
SERVER_FILE="$APP_DIR/server.js"
MODULE_FILE="$APP_DIR/driver-plan-access-routes.js"
TEMP_MODULE_FILE="$APP_DIR/driver-plan-access-routes.tmp.js"
BACKUP_DIR="/opt/dienstpilot-backups"
MODULE_URL="https://raw.githubusercontent.com/rrunke391-arch/DienstPilot/main/server/dienstpilot-api/driver-plan-access-routes.js"
MARKER="require('./driver-plan-access-routes')(app);"
STATUS_BODY_FILE="/tmp/dienstpilot-driver-plan-access-status.json"
TEST_BODY_FILE="/tmp/dienstpilot-driver-plan-access-test.json"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Bitte mit sudo ausführen: sudo bash $0"
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "FEHLER: $APP_DIR wurde nicht gefunden."
  exit 1
fi
if [[ ! -f "$SERVER_FILE" ]]; then
  echo "FEHLER: $SERVER_FILE wurde nicht gefunden."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y-%m-%d_%H-%M-%S)"
cp -a "$SERVER_FILE" "$BACKUP_DIR/server-vor-fahrerplan-rechten-$stamp.js"
if [[ -f "$APP_DIR/dienstpilot.sqlite" ]]; then
  cp -a "$APP_DIR/dienstpilot.sqlite" "$BACKUP_DIR/dienstpilot-vor-fahrerplan-rechten-$stamp.sqlite"
fi

trap 'rm -f "$TEMP_MODULE_FILE" "$STATUS_BODY_FILE" "$TEST_BODY_FILE"' EXIT

echo "Fahrerplan-Rechtemodul wird geladen ..."
curl -fsSL "$MODULE_URL" -o "$TEMP_MODULE_FILE"

# Die Benutzerverwaltung verwendet teilweise die Rollenbezeichnung "Disponent"
# statt "Disposition". Beide Schreibweisen erhalten dieselben Rechte.
python3 - "$TEMP_MODULE_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
text = text.replace(
    "['administrator', 'geschaftsleitung', 'geschaeftsleitung', 'disposition']",
    "['administrator', 'geschaftsleitung', 'geschaeftsleitung', 'disposition', 'disponent']"
)
text = text.replace(
    "['geschaftsleitung', 'geschaeftsleitung', 'disposition']",
    "['geschaftsleitung', 'geschaeftsleitung', 'disposition', 'disponent']"
)
text = text.replace(
    "vacationReviewRoles: ['Geschäftsleitung', 'Disposition']",
    "vacationReviewRoles: ['Geschäftsleitung', 'Disposition', 'Disponent']"
)
text = text.replace("version: 3,", "version: 4,")
text = text.replace("Rechte aktiv (Version 3)", "Rechte aktiv (Version 4)")
path.write_text(text, encoding="utf-8")
PY

node --check "$TEMP_MODULE_FILE"
mv "$TEMP_MODULE_FILE" "$MODULE_FILE"
chown --reference="$SERVER_FILE" "$MODULE_FILE" 2>/dev/null || true
chmod 0644 "$MODULE_FILE"

python3 - "$SERVER_FILE" "$MARKER" <<'PY'
from pathlib import Path
import re
import sys

server_path = Path(sys.argv[1])
marker = sys.argv[2]
text = server_path.read_text(encoding="utf-8")

text = re.sub(r"(?m)^\s*" + re.escape(marker) + r"\s*$\n?", "", text)

patterns = [
    r"(?m)^\s*app\.use\s*\(\s*cors\b[^\n]*\)\s*;?\s*$",
    r"(?m)^\s*app\.use\s*\(\s*express\.json\b[^\n]*\)\s*;?\s*$",
    r"(?m)^\s*app\.use\s*\(\s*bodyParser\.[A-Za-z]+\b[^\n]*\)\s*;?\s*$",
]
positions = []
for pattern in patterns:
    for match in re.finditer(pattern, text):
        positions.append(match.end())

if positions:
    position = max(positions)
else:
    app_match = re.search(r"(?m)^\s*(?:const|let|var)\s+app\s*=\s*express\s*\(\s*\)\s*;?\s*$", text)
    if not app_match:
        raise SystemExit("FEHLER: Express-App oder JSON-Parser wurde in server.js nicht gefunden.")
    position = app_match.end()

insert = "\n\n// Rollenbasierter Zugriff auf fahrerbezogene Dienstpläne.\n" + marker + "\n"
text = text[:position] + insert + text[position:]
server_path.write_text(text, encoding="utf-8")
print("Fahrerplan-Rechtemodul wurde vor den Datenrouten eingetragen.")
PY

node --check "$SERVER_FILE"

restart_done=0
if systemctl list-unit-files --type=service 2>/dev/null | grep -q '^dienstpilot-api\.service'; then
  systemctl restart dienstpilot-api.service
  systemctl --no-pager --full status dienstpilot-api.service | sed -n '1,18p'
  restart_done=1
elif command -v pm2 >/dev/null 2>&1 && pm2 list 2>/dev/null | grep -qi 'dienstpilot'; then
  pm2 restart dienstpilot-api || pm2 restart all
  restart_done=1
fi

if [[ $restart_done -eq 0 ]]; then
  echo "FEHLER: Kein DienstPilot-Systemdienst wurde automatisch erkannt."
  exit 1
fi

sleep 3
if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "DienstPilot API antwortet auf Port 3000."
else
  echo "FEHLER: Der Health-Test war nicht erfolgreich."
  echo "Prüfe: sudo journalctl -u dienstpilot-api -n 100 --no-pager"
  exit 1
fi

status_code="$(curl -sS -o "$STATUS_BODY_FILE" -w '%{http_code}' \
  http://127.0.0.1:3000/api/driver-plan-access/status || true)"

if [[ "$status_code" == "200" ]] && grep -q '"active":true' "$STATUS_BODY_FILE"; then
  echo "FAHRERPLAN-RECHTEMODUL AKTIV."
  cat "$STATUS_BODY_FILE"
  echo
else
  echo "FEHLER: Status-Endpunkt ist nicht aktiv. HTTP-Status: ${status_code:-keiner}"
  [[ -s "$STATUS_BODY_FILE" ]] && cat "$STATUS_BODY_FILE" && echo
  exit 1
fi

http_status="$(curl -sS -o "$TEST_BODY_FILE" -w '%{http_code}' \
  http://127.0.0.1:3000/api/data/plan_testfahrer || true)"

if [[ "$http_status" == "401" ]] && grep -q 'Anmeldung erforderlich' "$TEST_BODY_FILE"; then
  echo "PLANZUGRIFF AKTIV: Ohne Anmeldung wird der Fahrerplan korrekt gesperrt."
else
  echo "FEHLER: Der geschützte Fahrerplan-Endpunkt antwortet nicht korrekt. HTTP-Status: ${http_status:-keiner}"
  [[ -s "$TEST_BODY_FILE" ]] && cat "$TEST_BODY_FILE" && echo
  exit 1
fi

echo
echo "INSTALLATION ERFOLGREICH ABGESCHLOSSEN."
echo "Administrator, Geschäftsleitung, Disposition und Disponent dürfen Fahrerpläne ändern."
echo "Geschäftsleitung, Disposition und Disponent dürfen Urlaubswünsche entscheiden."
echo "Fahrer dürfen ausschließlich ihren eigenen Plan lesen."
echo "Sicherung server.js: $BACKUP_DIR/server-vor-fahrerplan-rechten-$stamp.js"
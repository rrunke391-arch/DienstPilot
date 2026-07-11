#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/dienstpilot-api"
SERVER_FILE="$APP_DIR/server.js"
MODULE_FILE="$APP_DIR/self-password-routes.js"
TEMP_MODULE_FILE="$APP_DIR/self-password-routes.tmp.js"
DB_FILE="$APP_DIR/dienstpilot.sqlite"
BACKUP_DIR="/opt/dienstpilot-backups"
MODULE_URL="https://raw.githubusercontent.com/rrunke391-arch/DienstPilot/main/server/dienstpilot-api/self-password-routes.js"
MARKER="require('./self-password-routes')(app);"
TEST_BODY_FILE="/tmp/dienstpilot-password-route-test.json"
STATUS_BODY_FILE="/tmp/dienstpilot-password-status-test.json"

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
cp -a "$SERVER_FILE" "$BACKUP_DIR/server-vor-passwortwechsel-$stamp.js"
if [[ -f "$DB_FILE" ]]; then
  cp -a "$DB_FILE" "$BACKUP_DIR/dienstpilot-vor-passwortwechsel-$stamp.sqlite"
fi

trap 'rm -f "$TEMP_MODULE_FILE" "$TEST_BODY_FILE" "$STATUS_BODY_FILE"' EXIT

echo "Aktuelles Passwortmodul wird geladen ..."
curl -fsSL "$MODULE_URL" -o "$TEMP_MODULE_FILE"
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

# Alte Einbindung vollständig entfernen, damit sie nicht hinter einer 404-Route stehen bleibt.
text = re.sub(
    r"\n?\s*//\s*Persönliche Passwortänderung[^\n]*\n\s*" + re.escape(marker) + r"\s*\n?",
    "\n",
    text,
    flags=re.IGNORECASE,
)
text = re.sub(r"(?m)^\s*" + re.escape(marker) + r"\s*$\n?", "", text)

# Die Route muss nach CORS/JSON-Parser, aber vor späteren 404- oder Fehler-Handlern stehen.
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

insert = "\n\n// Persönliche Passwortänderung für angemeldete Benutzer.\n" + marker + "\n"
text = text[:position] + insert + text[position:]
server_path.write_text(text, encoding="utf-8")
print("Passwortmodul wurde vor möglichen 404-Handlern eingetragen.")
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
  echo "FEHLER: Der Health-Test auf Port 3000 war nicht erfolgreich."
  echo "Prüfe: sudo journalctl -u dienstpilot-api -n 100 --no-pager"
  exit 1
fi

status_code="$(curl -sS -o "$STATUS_BODY_FILE" -w '%{http_code}' \
  http://127.0.0.1:3000/api/account/password/status || true)"

if [[ "$status_code" == "200" ]] && grep -q '"active":true' "$STATUS_BODY_FILE"; then
  echo "PASSWORT-MODUL VERSION 3 AKTIV."
  cat "$STATUS_BODY_FILE"
  echo
else
  echo "FEHLER: Status-Endpunkt ist nicht aktiv. HTTP-Status: ${status_code:-keiner}"
  [[ -s "$STATUS_BODY_FILE" ]] && cat "$STATUS_BODY_FILE" && echo
  echo "Prüfe: sudo journalctl -u dienstpilot-api -n 100 --no-pager"
  exit 1
fi

http_status="$(curl -sS -o "$TEST_BODY_FILE" -w '%{http_code}' \
  -X POST http://127.0.0.1:3000/api/account/password \
  -H 'Content-Type: application/json' \
  --data '{"currentPassword":"test","newPassword":"test12345"}' || true)"

if [[ "$http_status" == "401" ]] && grep -q 'Anmeldung erforderlich' "$TEST_BODY_FILE"; then
  echo "PASSWORT-ENDPUNKT AKTIV: Anmeldung wird korrekt verlangt."
else
  echo "FEHLER: Passwort-Endpunkt antwortet nicht korrekt. HTTP-Status: ${http_status:-keiner}"
  [[ -s "$TEST_BODY_FILE" ]] && cat "$TEST_BODY_FILE" && echo
  echo "Prüfe: sudo journalctl -u dienstpilot-api -n 100 --no-pager"
  exit 1
fi

echo
echo "REPARATUR ERFOLGREICH ABGESCHLOSSEN."
echo "Sicherung server.js: $BACKUP_DIR/server-vor-passwortwechsel-$stamp.js"
if [[ -f "$BACKUP_DIR/dienstpilot-vor-passwortwechsel-$stamp.sqlite" ]]; then
  echo "Sicherung Datenbank: $BACKUP_DIR/dienstpilot-vor-passwortwechsel-$stamp.sqlite"
fi
echo "Alle angemeldeten Benutzer können jetzt ausschließlich ihr eigenes Passwort ändern."
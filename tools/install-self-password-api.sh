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

trap 'rm -f "$TEMP_MODULE_FILE" "$TEST_BODY_FILE"' EXIT

echo "Passwortmodul wird geladen ..."
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

if marker in text:
    print("Passwortmodul ist bereits in server.js eingetragen und wird aktualisiert.")
    raise SystemExit(0)

matches = list(re.finditer(r"(?m)^\s*app\.listen\s*\(", text))
if not matches:
    raise SystemExit("FEHLER: app.listen(...) wurde in server.js nicht gefunden.")

position = matches[-1].start()
insert = "\n// Persönliche Passwortänderung für angemeldete Benutzer.\n" + marker + "\n\n"
text = text[:position] + insert + text[position:]
server_path.write_text(text, encoding="utf-8")
print("Passwortmodul wurde vor app.listen(...) eingetragen.")
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
  echo "HINWEIS: Kein DienstPilot-Systemdienst wurde automatisch erkannt."
  echo "Bitte den Node-Server anschließend manuell neu starten."
fi

sleep 2
if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "DienstPilot API antwortet auf Port 3000."
else
  echo "FEHLER: Der Health-Test auf Port 3000 war nicht erfolgreich."
  echo "Prüfe: sudo journalctl -u dienstpilot-api -n 80 --no-pager"
  exit 1
fi

http_status="$(curl -sS -o "$TEST_BODY_FILE" -w '%{http_code}' \
  -X POST http://127.0.0.1:3000/api/account/password \
  -H 'Content-Type: application/json' \
  --data '{"currentPassword":"test","newPassword":"test12345"}' || true)"

if [[ "$http_status" == "401" ]]; then
  echo "PASSWORT-ENDPUNKT AKTIV: Der Server verlangt korrekt eine Anmeldung."
else
  echo "FEHLER: Passwort-Endpunkt ist nicht korrekt aktiv. HTTP-Status: ${http_status:-keiner}"
  if [[ -s "$TEST_BODY_FILE" ]]; then
    echo "Serverantwort:"
    cat "$TEST_BODY_FILE"
    echo
  fi
  echo "Prüfe: sudo journalctl -u dienstpilot-api -n 80 --no-pager"
  exit 1
fi

echo
echo "Installation und Prüfung abgeschlossen."
echo "Sicherung server.js: $BACKUP_DIR/server-vor-passwortwechsel-$stamp.js"
if [[ -f "$BACKUP_DIR/dienstpilot-vor-passwortwechsel-$stamp.sqlite" ]]; then
  echo "Sicherung Datenbank: $BACKUP_DIR/dienstpilot-vor-passwortwechsel-$stamp.sqlite"
fi
echo "Alle angemeldeten Benutzer können jetzt ausschließlich ihr eigenes Passwort ändern."
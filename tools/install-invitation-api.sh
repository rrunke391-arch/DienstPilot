#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/dienstpilot-api"
SERVER_FILE="$APP_DIR/server.js"
MODULE_FILE="$APP_DIR/invitation-routes.js"
DB_FILE="$APP_DIR/dienstpilot.sqlite"
BACKUP_DIR="/opt/dienstpilot-backups"
MODULE_URL="https://raw.githubusercontent.com/rrunke391-arch/DienstPilot/main/server/dienstpilot-api/invitation-routes.js"
MARKER="require('./invitation-routes')(app);"

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
cp -a "$SERVER_FILE" "$BACKUP_DIR/server-vor-einladung-$stamp.js"
if [[ -f "$DB_FILE" ]]; then
  cp -a "$DB_FILE" "$BACKUP_DIR/dienstpilot-vor-einladung-$stamp.sqlite"
fi

echo "Servermodul wird geladen ..."
curl -fsSL "$MODULE_URL" -o "$MODULE_FILE.tmp"
node --check "$MODULE_FILE.tmp"
mv "$MODULE_FILE.tmp" "$MODULE_FILE"
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
    print("Einladungsmodul ist bereits in server.js eingetragen.")
    raise SystemExit(0)

matches = list(re.finditer(r"(?m)^\s*app\.listen\s*\(", text))
if not matches:
    raise SystemExit("FEHLER: app.listen(...) wurde in server.js nicht gefunden.")

position = matches[-1].start()
insert = "\n// Sichere DienstPilot-Einladungen: 48 Stunden, nur einmal verwendbar.\n" + marker + "\n\n"
text = text[:position] + insert + text[position:]
server_path.write_text(text, encoding="utf-8")
print("Einladungsmodul wurde vor app.listen(...) eingetragen.")
PY

node --check "$SERVER_FILE"

cd "$APP_DIR"
if [[ -f package.json ]]; then
  if ! node -e "require.resolve('nodemailer')" >/dev/null 2>&1; then
    echo "Nodemailer wird für den automatischen E-Mail-Versand installiert ..."
    npm install --omit=dev --save nodemailer
  fi
fi

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
  echo "WARNUNG: Der Health-Test auf Port 3000 war nicht erfolgreich."
  echo "Prüfe: sudo journalctl -u dienstpilot-api -n 60 --no-pager"
fi

echo
echo "Installation abgeschlossen."
echo "Sicherung server.js: $BACKUP_DIR/server-vor-einladung-$stamp.js"
if [[ -f "$BACKUP_DIR/dienstpilot-vor-einladung-$stamp.sqlite" ]]; then
  echo "Sicherung Datenbank: $BACKUP_DIR/dienstpilot-vor-einladung-$stamp.sqlite"
fi
echo "Ohne SMTP-Daten erzeugt DienstPilot den sicheren Einladungstext für das Mailprogramm."
echo "Für automatischen Versand müssen SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM und SMTP_SECURE in .env gesetzt werden."

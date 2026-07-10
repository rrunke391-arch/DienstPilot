#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/dienstpilot-api"
ENV_FILE="$APP_DIR/.env"
SERVER_FILE="$APP_DIR/server.js"
BACKUP_DIR="/opt/dienstpilot-backups"
DEFAULT_EMAIL="rrunke391@gmail.com"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Bitte mit sudo ausführen: sudo bash $0"
  exit 1
fi

if [[ ! -d "$APP_DIR" || ! -f "$SERVER_FILE" ]]; then
  echo "FEHLER: DienstPilot wurde unter $APP_DIR nicht gefunden."
  exit 1
fi

cd "$APP_DIR"

if [[ ! -f package.json ]]; then
  echo "FEHLER: package.json wurde in $APP_DIR nicht gefunden."
  exit 1
fi

if ! node -e "require.resolve('nodemailer')" >/dev/null 2>&1; then
  echo "Nodemailer wird installiert ..."
  npm install --omit=dev --save nodemailer
fi

if ! node -e "require.resolve('dotenv')" >/dev/null 2>&1; then
  echo "dotenv wird installiert ..."
  npm install --omit=dev --save dotenv
fi

echo
echo "Gmail-SMTP für DienstPilot"
echo "---------------------------"
read -r -p "Gmail-Adresse [$DEFAULT_EMAIL]: " SMTP_USER_INPUT
SMTP_USER_INPUT="${SMTP_USER_INPUT:-$DEFAULT_EMAIL}"

read -r -s -p "16-stelliges Google-App-Passwort eingeben: " SMTP_PASS_INPUT
echo
SMTP_PASS_INPUT="${SMTP_PASS_INPUT// /}"

if [[ ! "$SMTP_USER_INPUT" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "FEHLER: Die E-Mail-Adresse ist ungültig."
  exit 1
fi

if [[ ${#SMTP_PASS_INPUT} -ne 16 ]]; then
  echo "FEHLER: Das Google-App-Passwort muss 16 Zeichen haben. Leerzeichen werden automatisch entfernt."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y-%m-%d_%H-%M-%S)"
if [[ -f "$ENV_FILE" ]]; then
  cp -a "$ENV_FILE" "$BACKUP_DIR/env-vor-smtp-$stamp"
fi

export SMTP_USER_INPUT SMTP_PASS_INPUT ENV_FILE
umask 077
python3 <<'PY'
import os
from pathlib import Path

path = Path(os.environ['ENV_FILE'])
user = os.environ['SMTP_USER_INPUT']
password = os.environ['SMTP_PASS_INPUT']
values = {
    'SMTP_HOST': 'smtp.gmail.com',
    'SMTP_PORT': '465',
    'SMTP_SECURE': 'true',
    'SMTP_USER': user,
    'SMTP_PASS': password,
    'SMTP_FROM': user,
}

lines = path.read_text(encoding='utf-8').splitlines() if path.exists() else []
seen = set()
result = []
for line in lines:
    stripped = line.strip()
    if not stripped or stripped.startswith('#') or '=' not in line:
        result.append(line)
        continue
    key = line.split('=', 1)[0].strip()
    if key in values:
        result.append(f'{key}={values[key]}')
        seen.add(key)
    else:
        result.append(line)

for key, value in values.items():
    if key not in seen:
        result.append(f'{key}={value}')

path.write_text('\n'.join(result).rstrip() + '\n', encoding='utf-8')
PY

chmod 600 "$ENV_FILE"
chown --reference="$SERVER_FILE" "$ENV_FILE" 2>/dev/null || true
unset SMTP_PASS_INPUT

restart_done=0
if systemctl list-unit-files --type=service 2>/dev/null | grep -q '^dienstpilot-api\.service'; then
  echo "DienstPilot-API wird neu gestartet ..."
  systemctl restart dienstpilot-api.service
  restart_done=1
elif command -v pm2 >/dev/null 2>&1 && pm2 list 2>/dev/null | grep -qi 'dienstpilot'; then
  echo "DienstPilot-API wird über PM2 neu gestartet ..."
  pm2 restart dienstpilot-api || pm2 restart all
  restart_done=1
fi

if [[ $restart_done -eq 0 ]]; then
  echo "WARNUNG: Kein DienstPilot-Dienst wurde automatisch erkannt."
  echo "Bitte den Node-Server nach dem Test manuell neu starten."
fi

echo "SMTP-Verbindung wird geprüft und eine Testmail wird versendet ..."
TEST_TO="$SMTP_USER_INPUT" node <<'NODE'
'use strict';
require('dotenv').config({ path: '/opt/dienstpilot-api/.env' });
const nodemailer = require('nodemailer');

(async () => {
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.verify();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.TEST_TO,
    subject: 'DienstPilot SMTP-Test erfolgreich',
    text: [
      'Die SMTP-Einrichtung von DienstPilot funktioniert.',
      '',
      'Einladungen können jetzt automatisch per E-Mail versendet werden.',
      '',
      'Viele Grüße',
      'DienstPilot'
    ].join('\n'),
  });
  console.log('TEST ERFOLGREICH: E-Mail wurde an ' + process.env.TEST_TO + ' übergeben.');
  console.log('Nachrichten-ID: ' + (info.messageId || 'nicht verfügbar'));
})().catch((error) => {
  console.error('TEST FEHLGESCHLAGEN: ' + (error && error.message ? error.message : error));
  process.exit(1);
});
NODE

echo
echo "SMTP-Einrichtung abgeschlossen."
echo "Sicherung der bisherigen .env: $BACKUP_DIR/env-vor-smtp-$stamp"
echo "Die Zugangsdaten liegen geschützt in $ENV_FILE."

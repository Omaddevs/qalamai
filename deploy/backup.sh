#!/bin/sh
# Daily dump of the QalamAI database into /root/backups/qalamai, keeping the last KEEP_DAYS days,
# plus an encrypted off-site copy posted to the private Telegram backup group (same send-only bot
# and passphrase as TaxiLine). Root cron: 15 3 * * * /opt/qalamai/deploy/backup.sh
# Off-site is on when deploy/.env has BACKUP_BOT_TOKEN, BACKUP_CHAT_ID and BACKUP_PASSPHRASE.
# Decrypt:  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in qalamai-….sql.gz.enc -out qalamai.sql.gz
# Restore:  zcat qalamai.sql.gz | docker compose exec -T db psql -U qalam -d qalam
set -eu
umask 077 # dumps hold users' emails and phone numbers

cd "$(dirname "$0")"
DIR=${BACKUP_DIR:-/root/backups/qalamai}
KEEP_DAYS=${KEEP_DAYS:-14}
mkdir -p "$DIR"

FILE="$DIR/qalamai-$(date +%Y%m%d-%H%M).sql.gz"
TMP="$FILE.part"
docker compose exec -T db pg_dump -U qalam -d qalam --clean --if-exists </dev/null | gzip >"$TMP"
# A dump cut short (postgres down, disk full) must never replace a good one.
gzip -t "$TMP"
zcat "$TMP" | tail -n 5 | grep -q "PostgreSQL database dump complete"
mv "$TMP" "$FILE"

find "$DIR" -name 'qalamai-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') ok $FILE $(du -h "$FILE" | cut -f1)"

env_value() {
  { grep -E "^$1=" .env || true; } | tail -n 1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]\$//"
}
BOT_TOKEN=$(env_value BACKUP_BOT_TOKEN)
CHAT_ID=$(env_value BACKUP_CHAT_ID)
PASSPHRASE=$(env_value BACKUP_PASSPHRASE)
[ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ] && [ -n "$PASSPHRASE" ] || exit 0

ENC="$FILE.enc"
trap 'rm -f "$ENC"' EXIT
if ! BACKUP_PASSPHRASE="$PASSPHRASE" openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "$FILE" -out "$ENC" -pass env:BACKUP_PASSPHRASE; then
  echo "$(date '+%F %T') offsite FAILED: encryption"
  exit 1
fi
CAPTION="QalamAI backup $(date '+%F %H:%M') · $(du -h "$FILE" | cut -f1) · shifrlangan"
# The token goes in through stdin (curl -K -), not argv, so it never shows up in `ps`.
if printf 'url = "https://api.telegram.org/bot%s/sendDocument"\n' "$BOT_TOKEN" |
  curl -sf -m 120 -K - -F chat_id="$CHAT_ID" -F caption="$CAPTION" -F document=@"$ENC" >/dev/null; then
  echo "$(date '+%F %T') offsite ok"
else
  echo "$(date '+%F %T') offsite FAILED: telegram"
  exit 1
fi

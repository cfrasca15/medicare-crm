#!/bin/bash
# Nightly CRM backup for Unraid: copies the database out of the running
# container, encrypts it with your backup password, and uploads it to Google
# Drive with rclone, keeping the last 30 days. Setup steps: docs/BACKUP.md.
set -euo pipefail

CONTAINER="medicare-crm"
REMOTE="gdrive:CRM Backups"                  # rclone remote name + Drive folder
PASSWORD_FILE="/boot/config/crm-backup.pass" # one line: your backup password
KEEP_DAYS=30

STAMP="$(date +%Y-%m-%d_%H%M)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"; docker exec "$CONTAINER" rm -f /app/data/backup-tmp.db >/dev/null 2>&1 || true' EXIT

# 1. A consistent copy of the live database, made inside the container.
docker exec "$CONTAINER" node scripts/backup-db.mjs /app/data/backup-tmp.db
docker cp "$CONTAINER:/app/data/backup-tmp.db" "$WORK/crm.db"

# 2. Compress and encrypt (AES-256). Only someone with the password can open it.
gzip -9 "$WORK/crm.db"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "$WORK/crm.db.gz" -out "$WORK/crm-$STAMP.db.gz.enc" -pass "file:$PASSWORD_FILE"

# 3. Upload, then remove backups older than KEEP_DAYS.
rclone copy "$WORK/crm-$STAMP.db.gz.enc" "$REMOTE"
rclone delete "$REMOTE" --min-age "${KEEP_DAYS}d"

echo "CRM backup crm-$STAMP.db.gz.enc uploaded to $REMOTE"

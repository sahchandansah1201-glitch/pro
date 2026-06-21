#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/dermatolog-pro/app}"
ENV_FILE="${ENV_FILE:-deploy/self-hosted/.env.production}"
PROJECT_NAME="${PROJECT_NAME:-dermatolog-pro-production}"
APP_PORT="${APP_PORT:-8080}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/dermatolog-pro/backups}"
SUMMARY_PATH="${SUMMARY_PATH:-/opt/dermatolog-pro/logs/update-production-summary.md}"
LOCK_FILE="${LOCK_FILE:-/var/lock/dermatolog-pro-update.lock}"

mkdir -p "$(dirname "$SUMMARY_PATH")" "$(dirname "$LOCK_FILE")"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[dermatolog-pro-update] another update is already running"
  exit 75
fi

cd "$APP_DIR"

echo "[dermatolog-pro-update] starting in $APP_DIR"
echo "[dermatolog-pro-update] project=$PROJECT_NAME app_port=$APP_PORT backup_root=$BACKUP_ROOT"

node scripts/stage4m-production-deploy-verify.mjs update \
  --project-name "$PROJECT_NAME" \
  --app-port "$APP_PORT" \
  --env-file "$ENV_FILE" \
  --backup-root "$BACKUP_ROOT" \
  --summary "$SUMMARY_PATH"

echo "[dermatolog-pro-update] complete"
echo "[dermatolog-pro-update] summary: $SUMMARY_PATH"

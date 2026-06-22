#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/dermatolog-pro/app}"
ENV_FILE="${ENV_FILE:-deploy/self-hosted/.env.production}"
PROJECT_NAME="${PROJECT_NAME:-dermatolog-pro-production}"
APP_PORT="${APP_PORT:-8080}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/dermatolog-pro/backups}"
LOG_ROOT="${LOG_ROOT:-/opt/dermatolog-pro/logs}"
RUN_ID="${DEPLOY_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)}"
RUN_DIR="${RUN_DIR:-$LOG_ROOT/deploys/$RUN_ID}"
SUMMARY_PATH="${SUMMARY_PATH:-$RUN_DIR/update-production-summary.md}"
RECEIPT_PATH="${RECEIPT_PATH:-$RUN_DIR/update-production-receipt.json}"
STATUS_PATH="${STATUS_PATH:-$RUN_DIR/update-production-status.json}"
LATEST_SUMMARY_PATH="${LATEST_SUMMARY_PATH:-$LOG_ROOT/update-production-summary.md}"
LATEST_RECEIPT_PATH="${LATEST_RECEIPT_PATH:-$LOG_ROOT/update-production-receipt.json}"
LATEST_STATUS_PATH="${LATEST_STATUS_PATH:-$LOG_ROOT/update-production-status.json}"
LOCK_FILE="${LOCK_FILE:-/var/lock/dermatolog-pro-update.lock}"

mkdir -p "$RUN_DIR" "$(dirname "$LATEST_SUMMARY_PATH")" "$(dirname "$LOCK_FILE")"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[dermatolog-pro-update] another update is already running"
  exit 75
fi

cd "$APP_DIR"

echo "[dermatolog-pro-update] starting in $APP_DIR"
echo "[dermatolog-pro-update] project=$PROJECT_NAME app_port=$APP_PORT backup_root=$BACKUP_ROOT"
echo "[dermatolog-pro-update] run_id=$RUN_ID run_dir=$RUN_DIR"

cat > "$SUMMARY_PATH" <<EOF
## Stage 4M production deployment verification

- Status: \`running\`
- Run ID: \`$RUN_ID\`
- Command: \`update\`
- Project: \`$PROJECT_NAME\`
- Env file: \`$ENV_FILE\`
- Started: \`$(date -u +%Y-%m-%dT%H:%M:%SZ)\`
- Finished: \`running\`

Deployment is still running. Do not treat an older summary as the current result.
EOF
cp "$SUMMARY_PATH" "$LATEST_SUMMARY_PATH"
cat > "$STATUS_PATH" <<EOF
{
  "schemaVersion": "stage4m-production-deploy-receipt/v1",
  "runId": "$RUN_ID",
  "status": "running",
  "command": "update",
  "projectName": "$PROJECT_NAME",
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "finishedAt": null
}
EOF
cp "$STATUS_PATH" "$LATEST_STATUS_PATH"

node scripts/stage4m-production-deploy-verify.mjs update \
  --project-name "$PROJECT_NAME" \
  --app-port "$APP_PORT" \
  --env-file "$ENV_FILE" \
  --backup-root "$BACKUP_ROOT" \
  --summary "$SUMMARY_PATH" \
  --latest-summary "$LATEST_SUMMARY_PATH" \
  --receipt "$RECEIPT_PATH" \
  --latest-receipt "$LATEST_RECEIPT_PATH" \
  --status-json "$STATUS_PATH" \
  --latest-status-json "$LATEST_STATUS_PATH" \
  --run-id "$RUN_ID"

echo "[dermatolog-pro-update] complete"
echo "[dermatolog-pro-update] summary: $SUMMARY_PATH"
echo "[dermatolog-pro-update] receipt: $RECEIPT_PATH"
echo "[dermatolog-pro-update] latest status: $LATEST_STATUS_PATH"

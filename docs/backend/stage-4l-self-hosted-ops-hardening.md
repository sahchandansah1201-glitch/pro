# Stage 4L — Self-hosted operations hardening

Stage 4K proved that the product can run as a single self-hosted stack. Stage
4L adds the first operations layer for running that stack on a server: production
environment templates, backup/restore commands, restore verification, CI guards,
and a runbook that keeps the managed-runtime boundary explicit.

## Scope

- Production environment template: `deploy/self-hosted/.env.production.example`.
- Production compose overlay: `deploy/self-hosted/docker-compose.production.example.yml`.
- Backup/restore helper: `scripts/stage4l-self-hosted-ops.mjs`.
- Guard: `scripts/check-stage4l-self-hosted-ops.mjs`.
- Workflow: `.github/workflows/stage4l-self-hosted-ops-hardening.yml`.
- Preflight: `npm run preflight:stage4l`.

## Production env setup

On the server:

```bash
cp deploy/self-hosted/.env.production.example deploy/self-hosted/.env.production
$EDITOR deploy/self-hosted/.env.production
```

Replace every `replace-me-*` value before starting the stack. In production:

- `POSTGRES_PASSWORD` is generated and unique to the server.
- `JWT_SECRET` is at least 32 random characters.
- `DEVICE_BRIDGE_WORKER_TOKEN` is generated, at least 32 random characters, and only shared with the local Device Bridge worker.
- `MINIO_ROOT_PASSWORD` is generated even if MinIO is only used for inspection.
- `VITE_APP_MODE` is `production`, otherwise the browser shell stays in учебный режим.
- `VITE_SELF_HOSTED_API_BASE_URL` points at the public self-hosted address, for example `https://pro.skindoktor.ru`.
- `.env.production` is never committed.

Validate the env file:

```bash
node scripts/stage4l-self-hosted-ops.mjs verify-env \
  --env-file deploy/self-hosted/.env.production
```

## Production compose start

Build the frontend with the production env first, then start the production overlay:

```bash
set -a
. deploy/self-hosted/.env.production
set +a
npm run build
docker compose --env-file deploy/self-hosted/.env.production \
  -f deploy/self-hosted/docker-compose.stage4a.yml \
  -f deploy/self-hosted/docker-compose.production.example.yml \
  -p dermatolog-pro-production up -d --build
```

Verify the deployed stack:

```bash
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/readyz
npm run smoke:stage4k -- --skip-build --project-name dermatolog-pro-production
```

## Backup

Dry-run first:

```bash
npm run ops:stage4l:backup:dry-run
```

Create a backup from a running stack:

```bash
node scripts/stage4l-self-hosted-ops.mjs backup \
  --project-name dermatolog-pro-production \
  --compose-file deploy/self-hosted/docker-compose.stage4a.yml \
  --compose-file deploy/self-hosted/docker-compose.production.example.yml \
  --compose-env-file deploy/self-hosted/.env.production \
  --backup-root backups/self-hosted
```

The backup directory contains:

- `postgres.dump` — custom-format PostgreSQL dump.
- `object-storage.tgz` — archive of the backend-owned object storage volume.
- `stage4l-backup-manifest.json` — safe manifest without credentials, tokens,
  object keys, storage paths, or patient names.

`backups/self-hosted/` is gitignored.

## Restore

Restore is intentionally explicit because it replaces local data volumes. Always
dry-run and inspect the plan:

```bash
node scripts/stage4l-self-hosted-ops.mjs restore --dry-run \
  --project-name dermatolog-pro-production \
  --compose-file deploy/self-hosted/docker-compose.stage4a.yml \
  --compose-file deploy/self-hosted/docker-compose.production.example.yml \
  --compose-env-file deploy/self-hosted/.env.production \
  --backup-dir backups/self-hosted/<timestamp>
```

Run the restore only with an explicit confirmation:

```bash
node scripts/stage4l-self-hosted-ops.mjs restore \
  --project-name dermatolog-pro-production \
  --compose-file deploy/self-hosted/docker-compose.stage4a.yml \
  --compose-file deploy/self-hosted/docker-compose.production.example.yml \
  --compose-env-file deploy/self-hosted/.env.production \
  --backup-dir backups/self-hosted/<timestamp> \
  --confirm=RESTORE_SELF_HOSTED_DATA
```

The restore plan:

1. Stops the compose stack.
2. Removes PostgreSQL and backend object-storage volumes.
3. Re-initializes PostgreSQL from migrations.
4. Restores `postgres.dump` with `pg_restore`.
5. Restores `object-storage.tgz` into the backend-owned object storage volume.
6. Starts the full stack.
7. Runs the Stage 4K smoke as a post-restore verification.

## CI and local preflight

```bash
npm run test:stage4l
npm run check:stage4l
npm run preflight:stage4l
```

`preflight:stage4l` is included in `preflight:all`. CI runs dry-run and guard
checks only; it does not mutate live volumes.

## Runtime boundary

Stage 4L remains self-hosted only:

- No Supabase runtime coupling.
- No `api-read`, `api-write`, edge function, or `SUPABASE_*` dependency.
- Backups are created from local Docker volumes and PostgreSQL.
- Restore verification uses the existing Stage 4K self-hosted smoke.

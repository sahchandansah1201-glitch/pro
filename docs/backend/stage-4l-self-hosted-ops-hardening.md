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

Q1 implements and tests the fail-closed application-consistency boundary. The
required lifecycle is:

```text
inventory -> quiesce writers -> stop MinIO -> capture -> reconcile -> resume
```

The backup is classified as `application_consistent_quiesced` only when all of
the following are true:

- the writer inventory contains the known `backend` writer and zero unknown
  writers;
- every running writer and the MinIO `object-storage` service is proven stopped
  inside the bounded drain interval and without forced termination;
- the PostgreSQL dump and both object-storage archives validate;
- cross-store reconciliation reports zero dangling references, orphan
  payloads, payload/sidecar defects, checksum mismatches, and byte-size
  mismatches;
- the exact 40-character product Git SHA and Stage 4L Git SHA are recorded;
- services are proven resumed after capture.

The CLI currently has no production lifecycle/reconciliation adapter, so
production execution remains disabled and a non-dry-run CLI backup fails closed.
Q1 can be executed only through a reviewed adapter supplied by the runtime or
test harness. The future invocation contract is:

```bash
node scripts/stage4l-self-hosted-ops.mjs backup \
  --project-name dermatolog-pro-production \
  --compose-file deploy/self-hosted/docker-compose.stage4a.yml \
  --compose-file deploy/self-hosted/docker-compose.production.example.yml \
  --compose-env-file deploy/self-hosted/.env.production \
  --backup-root backups/self-hosted \
  --backup-set-id <safe-unique-id> \
  --product-git-sha <exact-40-hex-sha> \
  --stage4l-git-sha <exact-40-hex-sha> \
  --quiescence-timeout-seconds 30
```

Do not run that command against production until the Q2 disposable-stack test
has proved the concrete adapter under concurrent write load and the production
change has separate authorization and rollback evidence.

The backup directory contains:

- `postgres.dump` — custom-format PostgreSQL dump.
- `object-storage.tgz` — archive of the backend-owned local object-storage
  volume used by the current file read/write implementation.
- `minio-object-storage.tgz` — archive of the separate MinIO data volume.
- `stage4l-backup-manifest.json` — safe manifest without credentials, tokens,
  object keys, storage paths, or patient names. Manifest v2 uses state
  `CAPTURE_VALIDATED`; this state alone is not a restore point.
- `SHA256SUMS` — checksums for the database dump, both object-storage archives,
  and the safe manifest.
- `stage4l-backup-completion.json` — created only after successful service
  resume; state `SEALED_RESTORE_POINT` binds the receipt to `SHA256SUMS`.

The helper verifies that both named Docker volumes already exist before it
mounts either one. This prevents Docker from silently creating and archiving an
empty volume after a naming error. It then validates the PostgreSQL catalog with
`pg_restore --list`, lists both tar archives, writes checksums, and restricts the
backup directory/files to modes `0700`/`0600`.

A manifest v2 without a matching sealed completion receipt is an incomplete
capture and must never be selected for restore. Older manifests remain
recognizable as `legacy_storage_level`; that compatibility does not upgrade
their consistency classification or make them release-grade evidence.

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

1. For manifest v2, verifies the matching `SEALED_RESTORE_POINT` receipt and its
   binding to `SHA256SUMS` before running any command.
2. Verifies `SHA256SUMS` before any destructive restore step.
3. Stops the compose stack.
4. Removes PostgreSQL, backend-owned object-storage, and MinIO data volumes.
5. Re-initializes PostgreSQL from migrations.
6. Restores `postgres.dump` with `pg_restore`.
7. Restores `object-storage.tgz` into the backend-owned object-storage volume.
8. Restores `minio-object-storage.tgz` into the MinIO data volume.
9. Starts the full stack.
10. Requires an injected restored-application verifier and fails closed if it
    is missing. The verifier must target this restore Compose project; the
    generic Stage 4K smoke is not accepted because its defaults can address a
    different project.

## Q2 disposable synthetic gate

Q2 is a local-only, disposable proof of the concrete Q1 adapter. Its default is
a mutation-free dry run:

```bash
npm run ops:stage4l:q2:dry-run
```

Live execution requires both an explicit `--execute` flag and a unique
`skindoctor-q2-*` gate id. It accepts only the fixed Stage 4A Compose file and
four unique loopback ports. Production-like ids, the production server address,
the approved production backup id, pre-existing disposable resources, dirty Git
state, or ports already in use all fail before stack creation.

The acceptance contract is:

1. Start a source Compose project with synthetic seed data only.
2. Run a concurrent synthetic upload writer in a separate process.
3. Prove a successful write before quiescence, a rejected write fully inside
   the quiescence fence, and a successful write after resume.
4. Prove that PostgreSQL contains zero clinical-asset rows created inside the
   fence.
5. Reconcile database metadata, payloads, sidecars, checksums, and byte sizes
   with all five defect counters at zero.
6. Restore into a different disposable Compose project from a sealed backup.
7. Perform read-only verification of the restored application through its own
   loopback route: `healthz`, `readyz`, authenticated download, and exact seed
   SHA-256.
8. Match the reconciled source and restored database asset counts.
9. Remove both exact Compose projects, their volumes, networks and local images,
   plus the exact backup directory, then prove zero Q2 residue and no drift in
   protected non-Q2 Docker resources.

The live form is intentionally not exposed as a no-argument package script:

```bash
node scripts/stage4l-q2-disposable.mjs \
  --execute \
  --gate-id=skindoctor-q2-<unique-id> \
  --source-port=<unused-loopback-port> \
  --source-minio-port=<unused-loopback-port> \
  --restore-port=<unused-loopback-port> \
  --restore-minio-port=<unused-loopback-port>
```

Q2 does not target, inspect, stop, restore, or otherwise mutate production.

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
- Restore execution requires a target-bound, read-only application verifier.

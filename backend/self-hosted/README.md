# Self-hosted Backend

This directory is the first backend target that is not tied to a managed cloud
runtime. It is intentionally small and runnable with stock Node.js plus the
PostgreSQL client used by the container image.

## What is included

- `server.mjs` — local HTTP process with health, readiness, metadata, and
  OpenAPI endpoints.
- `api-response.mjs` — shared JSON response helpers and consistent API errors.
- `auth-crypto.mjs`, `auth-tokens.mjs`, `auth-service.mjs` — local auth
  foundation for Stage 4C.
- `auth-repository.mjs`, `rbac.mjs`, `audit-repository.mjs` — PostgreSQL-backed
  user roles, patient authorization, and audit events.
- `db-client.mjs` — PostgreSQL adapter for self-hosted runtime checks and reads.
- `patients-repository.mjs` — patient read/write SQL builders for Stage 4B-4D.
- `patient-write-service.mjs` — Stage 4D validation, RBAC scope resolution, and
  audit orchestration for patient writes.
- `visit-workspace-repository.mjs`, `visit-workspace-write-service.mjs` —
  Stage 4G-4H visit, lesion, report and asset metadata read/write boundaries.
- `asset-write-repository.mjs`, `asset-write-service.mjs`, `object-store.mjs` —
  Stage 4I-4J clinical asset metadata, binary storage, and backend-owned
  download contracts.
- `device-registry-repository.mjs`, `device-bridge-command-service.mjs`,
  `device-bridge-worker-service.mjs` — Stage 4Q-4S Device Bridge registry,
  backend-owned command queue, and local worker heartbeat/poll/ack/complete
  contract.
- `../../worker/device-bridge/worker.mjs` — Stage 4T local Device Bridge
  worker runtime that consumes the Stage 4S contract.
- `ops-logger.mjs` — Stage 4N structured JSON logs, correlation helpers, and
  redaction for production observability.
- `openapi.stage4a.json` — contract-first API boundary for auth, patients,
  visits, assets, and audit.
- `openapi.stage4b.json` — first runtime API boundary with `GET /api/v1/patients`.
- `openapi.stage4c.json` — local JWT auth and RBAC boundary.
- `openapi.stage4d.json` — patient create/update/detail/soft-archive boundary.
- `openapi.stage4g.json`, `openapi.stage4h.json`, `openapi.stage4i.json`,
  `openapi.stage4j.json` — visit workspace read/write and clinical asset
  write/binary boundaries.
- `openapi.stage4n.json` — production observability status contract.
- `openapi.stage4q.json`, `openapi.stage4r.json`, `openapi.stage4s.json` —
  Device Bridge registry, command queue, and worker contract boundaries.
- `db/migrations/0001_stage4a_core.sql` — PostgreSQL schema foundation with
  users, separate roles, patients, visits, lesions, assets, reports, and
  append-only audit.
- `db/migrations/0002_stage4b_runtime_seed.sql` — harmless demo seed rows for
  local backend verification.
- `db/migrations/0003_stage4c_auth_seed.sql` — local demo auth seed.
- `db/migrations/0004_stage4d_patient_writes.sql` — patient write indexes and
  soft-archive documentation.
- `db/migrations/0005_stage4h_visit_workspace_writes.sql` — lesion soft archive.
- `db/migrations/0006_stage4i_asset_write_contract.sql` — asset lookup indexes.
- `db/migrations/0007_stage4k_deploy_smoke_seed.sql` — harmless visit/lesion
  seed rows for full compose smoke verification.
- `db/migrations/0008_stage4q_device_registry.sql` — Device Bridge and medical
  device registry.
- `db/migrations/0009_stage4r_device_bridge_commands.sql` — backend-owned
  Device Bridge command queue.
- `db/migrations/0010_stage4s_device_bridge_worker_contract.sql` — worker
  heartbeat/lifecycle metadata and command queue indexes.
- `Dockerfile` — backend container used by the self-hosted compose stack.

## Local commands

```bash
npm run test:stage4a
npm run check:stage4a
npm run preflight:stage4a
npm run test:stage4b
npm run check:stage4b
npm run preflight:stage4b
npm run test:stage4c
npm run check:stage4c
npm run preflight:stage4c
npm run test:stage4d
npm run check:stage4d
npm run preflight:stage4d
npm run test:stage4i
npm run check:stage4i
npm run preflight:stage4i
npm run test:stage4j
npm run check:stage4j
npm run preflight:stage4j
npm run test:stage4k
npm run check:stage4k
npm run preflight:stage4k
npm run test:stage4l
npm run check:stage4l
npm run preflight:stage4l
npm run test:stage4m
npm run check:stage4m
npm run preflight:stage4m
npm run test:stage4n
npm run check:stage4n
npm run preflight:stage4n
npm run test:stage4q
npm run check:stage4q
npm run preflight:stage4q
npm run test:stage4r
npm run check:stage4r
npm run preflight:stage4r
npm run test:stage4s
npm run check:stage4s
npm run preflight:stage4s
npm run test:stage4t
npm run check:stage4t
npm run preflight:stage4t
npm run worker:stage4t:dry-run
npm run ops:stage4n:audit-export:dry-run
npm run smoke:stage4k:dry-run
npm run smoke:stage4k
npm run ops:stage4l:backup:dry-run
npm run ops:stage4l:restore:dry-run
npm run deploy:stage4m:first-boot:dry-run
npm run deploy:stage4m:post-deploy:dry-run
npm run deploy:stage4m:backup-after-deploy:dry-run
npm run deploy:stage4m:rollback-drill:dry-run
node backend/self-hosted/server.mjs
```

`/readyz` returns `503` until `DATABASE_URL` is configured and reachable and
object storage is configured through `OBJECT_STORAGE_ENDPOINT` or
`OBJECT_STORAGE_LOCAL_DIR`. Health, metadata, and API error responses never
print raw connection strings, object paths, or credentials.

Stage 4C protects `GET /api/v1/patients` with backend-issued bearer tokens and
RBAC. Stage 4D adds backend-owned patient create, detail, update, and soft
archive routes. Stage 4G-4H add visit workspace reads/writes. Stage 4I registers
clinical asset metadata and issues backend-owned download URL contracts. Stage
4J stores uploaded asset bytes in the self-hosted object store and streams them
through authenticated backend download routes without exposing object bucket/key
to the frontend. Stage 4K runs a full Docker Compose smoke across frontend,
backend, PostgreSQL, login, patients, visits, and asset upload/download.
Stage 4L adds production env templates, compose hardening, backup/restore
dry-runs, restore verification guidance, and CI guardrails for operating the
self-hosted stack on a server.
Stage 4M adds first-boot, post-deploy smoke, backup-after-deploy, and rollback
drill verification plans for production deployment.
Stage 4N adds structured JSON logs, `x-correlation-id` propagation, a
system-admin-only `/api/v1/ops/status` endpoint, metadata-only audit export
dry-run, and privacy guardrails for production observability.
Stage 4Q-4S add a Device Bridge registry, safe backend-owned command enqueueing,
and a deployment-local worker contract using `DEVICE_BRIDGE_WORKER_TOKEN`.
Stage 4T adds the local worker runtime, dry-run/once/loop commands, a systemd
unit template, and a noop adapter boundary for future clinic-owned hardware
drivers.

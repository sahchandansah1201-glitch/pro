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
- `clinical-workspace-repository.mjs`, `clinical-workspace-service.mjs` —
  Stage 5H production assessment, conclusion, and report read/write contracts.
- `doctor-dashboard-repository.mjs`, `doctor-dashboard-service.mjs` —
  Stage 5I production doctor dashboard aggregations from PostgreSQL.
- `visit-schedule-repository.mjs`, `visit-schedule-service.mjs` — Stage 5J
  production visit schedule contract from operator-owned PostgreSQL.
- `leads-appointments-repository.mjs`, `leads-appointments-service.mjs` —
  Stage 5K production lead intake and visit-derived appointment overview.
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
- `openapi.stage4q.json`, `openapi.stage4r.json`, `openapi.stage4s.json`,
  `openapi.stage4u.json`, `openapi.stage4v.json`, `openapi.stage4w.json`,
  `openapi.stage4x.json`, `openapi.stage4y.json`, `openapi.stage4z.json` —
  Device Bridge registry, command queue, worker contract, worker observability,
  production hardening, command recovery, command audit/replay, and command
  audit export/product-readiness boundaries.
- `openapi.stage5h.json` — production clinical workspace assessment,
  conclusion, and report contracts.
- `openapi.stage5i.json` — production doctor dashboard contract.
- `openapi.stage5j.json` — production visit schedule contract.
- `openapi.stage5k.json` — production leads/appointments contract.
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
- `db/migrations/0013_stage4x_device_bridge_audit_replay.sql` — command
  replay metadata and command-audit lookup indexes.
- `db/migrations/0014_stage5h_clinical_workspace_contracts.sql` — production
  clinical assessment/conclusion tables and report lookup contract.
- `db/migrations/0015_stage5k_leads_appointments_contract.sql` — production
  lead intake table for local PostgreSQL.
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
npm run test:stage4u
npm run check:stage4u
npm run preflight:stage4u
npm run test:stage4v
npm run check:stage4v
npm run preflight:stage4v
npm run test:stage4w
npm run check:stage4w
npm run preflight:stage4w
npm run test:stage4x
npm run check:stage4x
npm run preflight:stage4x
npm run test:stage4y
npm run check:stage4y
npm run preflight:stage4y
npm run test:stage4z
npm run check:stage4z
npm run preflight:stage4z
npm run test:stage5a
npm run check:stage5a
npm run preflight:stage5a
npm run release:stage5a:dry-run
npm run test:stage5b
npm run check:stage5b
npm run preflight:stage5b
npm run bootstrap:stage5b:dry-run
npm run bootstrap:stage5b:verify-env:example
npm run test:stage5c
npm run check:stage5c
npm run preflight:stage5c
npm run migrate:stage5c:dry-run
npm run migrate:stage5c:schema-sql
npm run migrate:stage5c:seed-policy
npm run test:stage5d
npm run check:stage5d
npm run preflight:stage5d
npm run test:stage5e
npm run check:stage5e
npm run preflight:stage5e
npm run test:stage5f
npm run check:stage5f
npm run preflight:stage5f
npm run test:stage5g
npm run check:stage5g
npm run preflight:stage5g
npm run test:stage5h
npm run check:stage5h
npm run preflight:stage5h
npm run test:stage5i
npm run check:stage5i
npm run preflight:stage5i
npm run test:stage5j
npm run check:stage5j
npm run preflight:stage5j
npm run test:stage5k
npm run check:stage5k
npm run preflight:stage5k
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
Stage 4U adds a system-admin worker observability projection at
`/api/v1/device-bridge-worker/status` and shows safe heartbeat/command lifecycle
metadata on `/sys/devices` without exposing worker tokens, payloads, storage
paths, patient names, or browser hardware APIs.
Stage 4V hardens the Device Bridge worker queue with idempotent lifecycle
updates, poll backoff metadata, stale-worker and queue-age metrics, and
retention cleanup planning exposed through
`/api/v1/device-bridge-worker/hardening`.
Stage 4W adds worker command leases, stuck-command recovery metadata, and
system-admin recovery actions at `/api/v1/device-bridge-worker/recovery`
without exposing raw command payloads, worker tokens, patient identifiers,
storage paths, or browser hardware APIs.
Stage 4X adds a safe append-only command audit projection and backend-owned
manual replay endpoint at `/api/v1/device-bridge-worker/audit` and
`/api/v1/device-bridge-worker/commands/{commandId}/replay`; replay clones raw
payload server-side in PostgreSQL, but the API/UI return only safe command
metadata and never expose worker tokens, raw payloads, storage paths, patient
identifiers, or browser hardware APIs.
Stage 4Y adds a backend-owned CSV export endpoint at
`/api/v1/device-bridge-worker/audit/export`; exports include safe command
metadata and filter metadata only, log `device_bridge.command.audit.export`,
and never expose raw payloads, worker tokens, storage paths, patient
identifiers, signed URLs, or browser hardware APIs.
Stage 4Z adds a system-admin product-readiness manifest at
`/api/v1/product/readiness` and `/openapi.stage4z.json`; it ties frontend,
backend, PostgreSQL, object storage, auth/RBAC, clinical workflows, Device
Bridge, backup/restore, deploy smoke, observability, and release gates into one
self-hosted product boundary with no managed runtime or managed database
dependency.
Stage 5A packages that boundary as a release candidate: the
`deploy/self-hosted/release-candidate.stage5a.env.example` inventory template,
safe release-candidate manifest, PostgreSQL migration order, server install
outline, and `npm run preflight:stage5a` gate for promoting a self-hosted build.
Stage 5B adds the production server bootstrap flow: host/env checks, port and
directory planning, first `system_admin` SQL generation through
`deploy/self-hosted/bootstrap-system-admin.stage5b.sql.example`, and
`npm run preflight:stage5b` before first server install.
Stage 5C hardens production migrations and bootstrap: it classifies demo/smoke
seed files away from production, generates
`deploy/self-hosted/prestart-schema-check.stage5c.sql` style checks, verifies
the audit append-only trigger and first `system_admin`, and gates this through
`npm run preflight:stage5c`.
Stage 5D cuts the browser shell over to an explicit production mode:
`VITE_APP_MODE=production` hides the demo banner and demo role switcher,
requires `/self-hosted/login` for protected routes, and derives navigation and
access checks from self-hosted backend roles. Demo mode remains available for
local review, but production deployments are driven by the self-hosted session
and gated by `npm run preflight:stage5d`.
Stage 5E turns `/self-hosted/login` into the production login and bootstrap UX:
operators can check `/healthz`, `/readyz`, and `/api/v1/meta` before sign-in,
see first-`system_admin` guidance tied to Stage 5B/5C, and validate the flow
through `npm run preflight:stage5e`.
Stage 5F completes the production patient/workspace cutover: `/patients`,
`/patients/:id`, and `/patients/:id/visits/:visitId` use self-hosted backend
patient/visit endpoints in `VITE_APP_MODE=production`; demo/mock fallback stays
demo/dev-only and is guarded by `npm run preflight:stage5f`.
Stage 5G completes the production clinical workspace guardrails: assessment,
conclusion, and report tabs no longer render mock-derived clinical content in
production, Body Map disables local demo lesion creation, and the remaining
live workspace surface stays within the self-hosted product boundary through
`npm run preflight:stage5g`.
Stage 5H adds backend-owned production clinical workspace contracts:
assessment and conclusion tables, report read access, RBAC/audit-protected
GET/PATCH endpoints, frontend adapters, and production UI panels that save only
through the self-hosted backend. Demo/dev mode keeps mock tabs; production mode
uses the local server and is gated by `npm run preflight:stage5h`.
Stage 5I adds the production doctor dashboard contract:
`GET /api/v1/doctor/dashboard` aggregates KPI, upcoming visits, pending
conclusions, recent patients, asset metadata issues, and device status from
operator-owned PostgreSQL. `/desk` in production uses this contract and does
not fall back to mock dashboard data; demo/dev keeps the historical dashboard.
Stage 5J adds the production visit schedule contract:
`GET /api/v1/visits` lists scheduled visits from operator-owned PostgreSQL
with RBAC scope, date/status/search filters, and safe patient/clinic labels.
The `/visits` route in production reads only this self-hosted contract; demo/dev
keeps the historical mock schedule and is guarded by `npm run preflight:stage5j`.
Stage 5K adds the production leads/appointments contract:
`GET /api/v1/leads/appointments` reads local lead intake rows and derives
appointments from `visits`, under local RBAC and audit. `/desk` in production
uses this self-hosted overview for the "Лиды и записи" block; demo/dev keeps
historical mock dashboard data and is guarded by `npm run preflight:stage5k`.

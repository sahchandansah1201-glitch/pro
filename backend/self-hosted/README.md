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
- `openapi.stage4a.json` — contract-first API boundary for auth, patients,
  visits, assets, and audit.
- `openapi.stage4b.json` — first runtime API boundary with `GET /api/v1/patients`.
- `openapi.stage4c.json` — local JWT auth and RBAC boundary.
- `openapi.stage4d.json` — patient create/update/detail/soft-archive boundary.
- `openapi.stage4g.json`, `openapi.stage4h.json`, `openapi.stage4i.json`,
  `openapi.stage4j.json` — visit workspace read/write and clinical asset
  write/binary boundaries.
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
to the frontend.

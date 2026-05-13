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
  user roles, patient-read authorization, and audit events.
- `db-client.mjs` — PostgreSQL adapter for self-hosted runtime checks and reads.
- `patients-repository.mjs` — read-only patient list query for Stage 4B.
- `openapi.stage4a.json` — contract-first API boundary for auth, patients,
  visits, assets, and audit.
- `openapi.stage4b.json` — first runtime API boundary with `GET /api/v1/patients`.
- `openapi.stage4c.json` — local JWT auth and RBAC boundary.
- `db/migrations/0001_stage4a_core.sql` — PostgreSQL schema foundation with
  users, separate roles, patients, visits, lesions, assets, reports, and
  append-only audit.
- `db/migrations/0002_stage4b_runtime_seed.sql` — harmless demo seed rows for
  local backend verification.
- `db/migrations/0003_stage4c_auth_seed.sql` — local demo auth seed.
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
node backend/self-hosted/server.mjs
```

`/readyz` returns `503` until `DATABASE_URL` is configured and reachable and
`OBJECT_STORAGE_ENDPOINT` is configured. Health, metadata, and API error
responses never print raw connection strings or credentials.

Stage 4C protects `GET /api/v1/patients` with backend-issued bearer tokens and
RBAC. Mutating clinical workflows remain contract-only until later backend
stages define create/update/delete semantics, recovery, and stricter audit
requirements.

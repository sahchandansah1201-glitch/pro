# Stage 4A Self-hosted Backend Foundation

This directory is the first backend target that is not tied to a managed cloud
runtime. It is intentionally small and runnable with stock Node.js.

## What is included

- `server.mjs` — local HTTP process with health, readiness, metadata, and
  OpenAPI endpoints.
- `openapi.stage4a.json` — contract-first API boundary for auth, patients,
  visits, assets, and audit.
- `db/migrations/0001_stage4a_core.sql` — PostgreSQL schema foundation with
  users, separate roles, patients, visits, lesions, assets, reports, and
  append-only audit.
- `Dockerfile` — backend container used by the Stage 4A compose stack.

## Local commands

```bash
npm run test:stage4a
npm run check:stage4a
npm run preflight:stage4a
node backend/self-hosted/server.mjs
```

`/readyz` returns `503` until `DATABASE_URL` and `OBJECT_STORAGE_ENDPOINT` are
configured. Health and metadata responses never print raw connection strings or
credentials.

# Stage 4A — Self-hosted backend foundation

## 1. Goal

Stage 4A starts the move from demo screens and managed-cloud artifacts toward a
single deployable product:

- React/Vite frontend behind a reverse proxy.
- Local backend process.
- PostgreSQL database owned by the operator.
- S3-compatible object storage owned by the operator.
- Contract-first API boundary for auth, patients, visits, assets, reports, and
  audit.

This stage intentionally avoids real clinical writes. It creates the foundation
that later patient/visit/asset CRUD must use.

## 2. Included files

- `backend/self-hosted/server.mjs` — runnable Node backend using built-in HTTP.
- `backend/self-hosted/routes.mjs` — health, readiness, metadata, and OpenAPI
  handlers.
- `backend/self-hosted/openapi.stage4a.json` — API contract for the next
  backend stages.
- `backend/self-hosted/db/migrations/0001_stage4a_core.sql` — PostgreSQL
  foundation schema.
- `deploy/self-hosted/docker-compose.stage4a.yml` — local deployment skeleton.
- `deploy/self-hosted/nginx.stage4a.conf` — one entrypoint for frontend and
  backend.
- `scripts/check-stage4a-self-hosted.mjs` — guard that prevents accidental
  managed-runtime coupling in the new backend/deploy slice.

## 3. Local run

```bash
npm run build
docker compose \
  --env-file deploy/self-hosted/.env.example \
  -f deploy/self-hosted/docker-compose.stage4a.yml \
  up --build
```

Open:

- frontend: `http://localhost:8080`
- backend health: `http://localhost:8080/healthz`
- backend readiness: `http://localhost:8080/readyz`
- backend metadata: `http://localhost:8080/api/v1/meta`
- OpenAPI: `http://localhost:8080/openapi.stage4a.json`

## 4. Data model boundary

The first migration defines:

- `clinics`
- `app_users`
- `user_roles`
- `patients`
- `visits`
- `lesions`
- `clinical_assets`
- `reports`
- `audit_log`

Roles are separate from users through `user_roles`. The audit table is
append-only through a database trigger. Backend authorization remains the
source of truth; browser role switching is still a UX simulation.

## 5. No managed backend dependency

Stage 4A backend and deploy files must not introduce managed backend runtime
coupling. The guard checks the new runtime slice for managed-cloud function
names, managed project references, and frontend-only secret patterns.

Historical database/function artifacts remain in the repository for earlier
stages, but new Stage 4 work should target the self-hosted backend boundary.

## 6. Verification

```bash
npm run test:stage4a
npm run check:stage4a
npm run preflight:stage4a
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- backend route tests pass;
- OpenAPI JSON parses;
- PostgreSQL migration includes role separation and append-only audit;
- compose stack includes reverse proxy, backend, PostgreSQL, and object
  storage;
- no `deno.lock` files are generated.

## 7. Non-goals

- No real patient CRUD implementation yet.
- No production auth/session store yet.
- No object upload implementation yet.
- No migration away from existing frontend demo flows yet.
- No claim that browser role switching is security.

Those belong to later Stage 4 backend slices.

## 8. Next slice

Stage 4B lives in
[`docs/backend/stage-4b-backend-runtime.md`](./stage-4b-backend-runtime.md).
It keeps the same self-hosted boundary and adds PostgreSQL runtime readiness
plus the first read-only patient-list endpoint.

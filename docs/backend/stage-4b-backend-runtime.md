# Stage 4B — Self-hosted backend runtime

## 1. Goal

Stage 4B turns the Stage 4A backend skeleton into the first real runtime slice
of the self-hosted product:

- PostgreSQL-backed read path through the backend process.
- Real `/readyz` database connectivity check.
- Read-only `GET /api/v1/patients` endpoint.
- Consistent JSON error shape for API failures.
- A consistent JSON error envelope for DB, method, contract, and missing-route
  failures.
- Docker runtime support for `psql` without adding npm dependencies.

Mutating clinical workflows still stay out of scope. Stage 4B proves the
self-hosted backend can read from operator-owned PostgreSQL without relying on a
managed backend runtime.

## 2. Runtime files

- `backend/self-hosted/db-client.mjs` — PostgreSQL adapter using `psql` with
  connection secrets passed through environment variables, not process args.
- `backend/self-hosted/patients-repository.mjs` — safe read-only patient list
  query and DTO normalization.
- `backend/self-hosted/api-response.mjs` — shared JSON response and consistent
  JSON error helpers.
- `backend/self-hosted/openapi.stage4b.json` — Stage 4B contract with a real
  `GET /api/v1/patients` response path.
- `backend/self-hosted/db/migrations/0002_stage4b_runtime_seed.sql` — harmless
  demo seed rows for local runtime verification.
- `.github/workflows/stage4b-backend-runtime.yml` — CI gate for this backend
  slice.

## 3. Local run

```bash
npm run build
docker compose \
  --env-file deploy/self-hosted/.env.example \
  -f deploy/self-hosted/docker-compose.stage4a.yml \
  up --build
```

Open:

- readiness: `http://localhost:8080/readyz`
- patients: `http://localhost:8080/api/v1/patients`
- Stage 4B OpenAPI: `http://localhost:8080/openapi.stage4b.json`

`/readyz` returns `200` only when PostgreSQL is configured and reachable and
object storage is configured. The object-storage health probe remains a later
stage; Stage 4B only verifies database connectivity.

## 4. API error shape

All API failures use the same safe envelope:

```json
{
  "error": {
    "code": "database_unavailable",
    "message": "Database is unavailable for the self-hosted backend."
  },
  "correlationId": "stage4b-local"
}
```

The backend must not print raw connection strings, passwords, signed URLs,
storage paths, or patient-adjacent internals in error responses.

## 5. No managed backend runtime dependency

Stage 4B remains self-hosted. The runtime guard scans backend/deploy files for
managed backend coupling and blocks managed function names, project references,
and frontend-only secret patterns.

Historical managed-backend files may still exist elsewhere in the repository,
but new Stage 4 backend/deploy code targets:

- Node backend process;
- PostgreSQL owned by the operator;
- S3-compatible object storage owned by the operator;
- reverse proxy serving frontend and backend as one deployable product.

## 6. Verification

```bash
npm run test:stage4b
npm run check:stage4b
npm run preflight:stage4b
docker compose --env-file deploy/self-hosted/.env.example -f deploy/self-hosted/docker-compose.stage4a.yml config
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- DB adapter tests pass without needing a live database;
- route tests cover database unavailable, patient list, and no secret leaks;
- OpenAPI Stage 4B parses and exposes `GET /api/v1/patients`;
- Docker image installs `postgresql-client` for the runtime DB adapter;
- `package-lock.json` stays untouched because no npm dependency is added.

## 7. Non-goals

- No real patient creation, update, or deletion yet.
- No production auth/session implementation yet.
- No object-storage upload/download runtime yet.
- No frontend migration from demo patient data yet.
- No claim that the read-only patient endpoint is the final authorization
  model.

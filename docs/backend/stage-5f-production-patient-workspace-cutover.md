# Stage 5F — Production Patient Workspace Cutover

Stage 5F removes the remaining production dependency on demo patient and
visit lookup. Stage 5D made the shell mode-aware and Stage 5E made
`/self-hosted/login` the production entry point. Stage 5F makes the primary
clinical workflow follow that same boundary.

## Scope

- `/patients` keeps demo data only in demo/dev mode.
- In `VITE_APP_MODE=production`, `/patients` renders rows only from
  `GET /api/v1/patients`.
- `/patients/:id` uses `GET /api/v1/patients/:id` and
  `GET /api/v1/patients/:id/visits` in production.
- `/patients/:id/visits/:visitId` uses `GET /api/v1/visits/:visitId` and
  `GET /api/v1/visits/:visitId/lesions` in production before rendering the
  workspace.
- Demo mode remains unchanged and still uses the mock model for product
  review and local UI work.

## Production Data Boundary

- managed runtime: none
- managed database: none
- auth provider: self-hosted backend token from Stage 5E
- database: operator-owned PostgreSQL
- object storage: operator-owned self-hosted storage from Stage 4J+

Production screens must not fall back to mock patients after a backend error.
If the self-hosted backend returns 401/403/404/5xx or the network fails, the UI
shows a production-safe empty/error state and keeps demo data hidden.

## UI Changes

- `PatientsPage` clears rows during production live loading and keeps the
  table empty on live-list failure.
- `PatientDetailPage` fetches patient detail and visits from the self-hosted
  backend for production UUID routes.
- `VisitWorkspacePage` fetches visit detail and lesions from the self-hosted
  backend before rendering workspace tabs in production.
- `self-hosted-clinical-adapter.ts` maps backend DTOs into the existing UI
  domain model without importing mock data.

## Validation

```bash
npm run preflight:stage5f
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- `npm run preflight:stage5f` passes tests, guard, and deno-lock guard.
- `preflight:all -- --dry-run` lists
  `Stage 5F production patient/workspace cutover preflight`.
- `package-lock.json` remains unchanged.
- No `deno.lock` files exist.
- Protected Stage 5F files contain no `api-read`, `api-write`, Edge Function,
  `SUPABASE_*`, browser hardware API, signed URL, or storage path coupling.

## Out Of Scope

- New backend schemas or migrations.
- New asset binary behavior.
- Removing demo mode from the repository. Demo/dev mode remains useful, but it
  must not activate inside `VITE_APP_MODE=production`.


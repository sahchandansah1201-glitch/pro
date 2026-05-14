# Stage 5I — Production Doctor Dashboard Contracts

Stage 5I moves the doctor workspace landing page (`/desk`) off demo/mock
dashboard data in production mode. The production page now reads a single
self-hosted backend contract:

- `GET /api/v1/doctor/dashboard`

The endpoint is served by the operator-owned backend, backed by local
PostgreSQL tables, and guarded by the same bearer-token/RBAC model used by
patients and visit workspace contracts.

## Backend contract

- `backend/self-hosted/doctor-dashboard-repository.mjs` aggregates:
  - KPI counts for active visits, visits today, pending conclusions,
    patients in scope, clinical asset metadata review items, and devices.
  - upcoming visits.
  - signed visits waiting for a signed report.
  - recent patients by last visit.
  - clinical asset metadata issues without exposing object bucket/key.
  - device registry summary from `medical_devices`.
- `backend/self-hosted/doctor-dashboard-service.mjs` applies
  `visitReadScope`, records `doctor.dashboard.read`, and scopes doctors to
  their own `doctor_user_id` while allowing clinic/system admins their normal
  clinic scope.
- `backend/self-hosted/openapi.stage5i.json` documents the response shape.
- `routes.mjs` exposes `/api/v1/doctor/dashboard` and
  `/openapi.stage5i.json`.

## Frontend cutover

- `src/pages/doctor/DeskPage.tsx` switches by `VITE_APP_MODE`.
- In production, `DeskPageLive` uses only
  `getSelfHostedDoctorDashboard()` and displays the self-hosted source.
- In demo/dev, `DeskPageDemo` keeps the historical mock dashboard for UX
  simulation and screenshots.
- Production never falls back to mock dashboard data when the backend is
  unavailable; it shows an error and a login action.

## Product boundary

Protected Stage 5I files must not contain:

- `api-read`
- `api-write`
- Edge Function references
- `SUPABASE_*`
- browser hardware APIs
- signed URLs or storage paths
- mock-data imports in the production dashboard path

Clinical asset rows expose only safe metadata (`kind`, content type, byte
size, capture time, issue code). Object bucket/key and raw file paths remain
backend-private.

## Verification

```bash
npm run preflight:stage5i
npm run preflight:stage5h
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git status --short
```

Expected:

- `npm run preflight:stage5i` passes backend repository/service/routes
  tests, frontend API/dashboard tests, guard tests, and no-deno-locks.
- `/desk` in production renders data from `/api/v1/doctor/dashboard`.
- `/desk` in demo/dev still renders the mock dashboard.
- `package-lock.json` remains unchanged.

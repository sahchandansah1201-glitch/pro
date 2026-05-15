# Stage 5N — Production patient portal contracts

## 1. Goal

Stage 5N cuts the patient-facing `/me` workspace over to the
self-hosted product boundary in production mode.

- Backend owns patient portal reads through PostgreSQL.
- Frontend production mode reads `/api/v1/me/portal` and
  `/api/v1/me/reports/{reportId}`.
- Demo/dev mode keeps the existing mock patient portal.
- Patient self-booking writes are intentionally out of scope; booking is
  read-only until a dedicated write contract is added.

## 2. Backend

New PostgreSQL contract:

- `patient_user_links` maps local `app_users.id` to local `patients.id`.
- `app_role` includes `patient`.
- Patient portal endpoints require the `patient` role.

Endpoints:

- `GET /api/v1/me/portal`
- `GET /api/v1/me/reports/{reportId}`
- `GET /openapi.stage5n.json`

The repository selects `patient_safe_text` only. Physician-only report
text is not selected or returned to the browser.

## 3. Frontend

Production pages:

- `/me`
- `/me/reports`
- `/me/reports/:id`
- `/me/booking`
- `/me/reminders`

Production mode renders live components that read only from the
self-hosted backend. Demo mode renders the preserved `*Demo` pages.

## 4. Product Boundary

Stage 5N remains a single self-hosted product:

- runtime: local Node.js backend
- database: local PostgreSQL
- object storage: backend-owned local object store from earlier stages
- managed runtime/database: none
- Supabase/API-read/API-write/Edge Function coupling: forbidden
- browser hardware APIs: forbidden in patient portal runtime files

## 5. Validation

Run:

```bash
npm run preflight:stage5n
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- backend node tests pass
- patient portal API/front-end tests pass
- Stage 5N guard reports OK
- no `deno.lock`
- `package-lock.json` is unchanged

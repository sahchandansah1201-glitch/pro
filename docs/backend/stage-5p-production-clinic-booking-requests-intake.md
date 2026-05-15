# Stage 5P — Production clinic booking requests intake

Stage 5P closes the loop between patient self-service booking requests and
the clinic/operator workspace. Requests created through `/api/v1/me/booking-requests`
are reviewed inside Dermatolog Pro through local PostgreSQL tables and
self-hosted backend routes.

This stage does not integrate a third-party CRM or ad network directly. Those
systems may feed booking requests in later stages through backend-owned import
contracts, but the Stage 5P runtime path remains self-hosted and operator-owned.

## Contracts

- `GET /api/v1/clinic/booking-requests`
- `GET /api/v1/clinic/booking-requests/{requestId}`
- `PATCH /api/v1/clinic/booking-requests/{requestId}`
- `GET /openapi.stage5p.json`

The queue is scoped by the authenticated operator, clinic admin, or system
admin. Doctor-only users do not own this intake queue.

## Data model

Migration `0019_stage5p_clinic_booking_requests_intake.sql` extends
`patient_portal_booking_requests` with:

- `assigned_visit_id`
- `reviewed_by_user_id`
- `reviewed_at`
- `clinic_note`

The backend updates request status and clinic review metadata only. Confirmed
visits remain normal local `visits` rows.

## Frontend

- `/operator/booking-requests` renders production UI through
  `OperatorBookingRequestsPageLive`.
- The page reads and writes only via `/api/v1/clinic/booking-requests`.
- Demo/dev mode renders `OperatorBookingRequestsPageDemo`.
- Production operator sidebar includes `Запросы на запись`.

## Product Boundary

- Managed runtime/database dependency: none.
- Database: local PostgreSQL in the self-hosted deployment.
- No Supabase, `api-read`, `api-write`, Edge Function, external CRM runtime,
  browser hardware API, signed URL, or storage path coupling in protected
  Stage 5P runtime files.
- External advertising sources and clinic CRM availability feeds must enter
  through later backend-owned import contracts, not direct frontend calls.

## Verification

```bash
npm run preflight:stage5p
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git status --short
```

Expected:

- Stage 5P backend repository/service tests pass.
- Stage 5P route tests pass for list/detail/update/OpenAPI/meta.
- Stage 5P frontend API and production page tests pass.
- Stage 5P guard passes and confirms the self-hosted product boundary.
- `package-lock.json` remains preserved and no `deno.lock` files exist.

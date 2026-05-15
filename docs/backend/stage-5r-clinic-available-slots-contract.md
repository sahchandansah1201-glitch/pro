# Stage 5R — Clinic available slots contract

Stage 5R exposes the clinic availability imported in Stage 5Q as a
self-hosted, operator-readable contract.

The key boundary stays unchanged: external CRM, advertising, site, or manual
adapters push data into the backend. During normal product use, the frontend and
backend read only the local PostgreSQL cache. They do not call external CRM
systems, ad networks, calendars, managed databases, Supabase, or Edge Functions.

## Runtime contract

- `GET /api/v1/clinic/available-slots`
  - Requires self-hosted bearer auth.
  - Allows operator, clinic_admin, and system_admin scopes.
  - Denies doctor-only access to keep intake operations with clinic staff.
  - Reads `clinic_available_slots`.
  - Supports `sourceSystem`, `status`, `dateFrom`, `dateTo`, `limit`, and
    `offset`.
  - Returns sanitized slot metadata only: source, local slot ID, start time,
    duration, status, clinic, and optional doctor display name.
- `/openapi.stage5r.json`
  - Documents the local availability contract.

## Data model

Stage 5Q created `clinic_available_slots`. Stage 5R adds production read indexes:

- `clinic_available_slots_clinic_status_started_idx`
- `clinic_available_slots_source_started_idx`

These indexes are local PostgreSQL structures. They do not add any managed
runtime dependency.

## Frontend

`OperatorBookingRequestsPageLive` now shows a “Свободные окна клиники” panel next
to the booking request queue. It calls only:

- `/api/v1/clinic/available-slots`
- `/api/v1/clinic/booking-requests`
- `/api/v1/integrations/booking-imports`

The UI does not call a CRM or advertising platform directly.

## Product boundary

- Managed runtime/database dependency: none.
- Database: local PostgreSQL owned by the deployment.
- External systems: inbound import only.
- Browser hardware APIs: none.
- Supabase/API-read/API-write/Edge Function coupling: forbidden by guard.
- Raw CRM payloads, storage paths, signed URLs, patient secret fields: not shown.

## Verification

```bash
npm run preflight:stage5r
npm run preflight:stage5q
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- Stage 5R repository/service/route tests pass.
- Stage 5R frontend API and operator production page tests pass.
- Stage 5R guard passes and confirms the self-hosted product boundary.
- `package-lock.json` remains unchanged.
- No `deno.lock` files are created.


# Stage 5S — Booking slot confirmation

Stage 5S completes the operator booking intake loop. A clinic/operator user can
confirm a patient booking request by choosing one locally cached availability
slot. The self-hosted backend then creates the visit, marks the slot as booked,
and marks the request as booked inside PostgreSQL.

## Backend contract

- `POST /api/v1/clinic/booking-requests/{requestId}/book-from-slot`
- Request body:
  - `slotId` — UUID from `clinic_available_slots`
  - `clinicNote` — optional safe clinic note, max 1000 chars
- The operation is atomic from the product perspective:
  - request must be `requested` or `reviewing`
  - request must not already have `assigned_visit_id`
  - slot must be in the same clinic and `status = 'available'`
  - backend updates the slot to `booked`
  - backend inserts a `visits` row with `draft` status
  - backend updates the booking request with the generated visit id

No CRM, ad network, or third-party scheduling runtime is called during
confirmation. CRM/ad systems can push availability into the local import
contracts from Stage 5Q/5R; Stage 5S consumes only that local cache.

## Frontend contract

`/operator/booking-requests` now lets the operator select a free local slot
from “Свободное окно для записи” and click “Подтвердить запись”. The UI calls only:

- `GET /api/v1/clinic/booking-requests`
- `GET /api/v1/clinic/available-slots`
- `POST /api/v1/clinic/booking-requests/{requestId}/book-from-slot`

The previous manual visit-id assignment is not the primary booking flow.

## Product boundary

- Managed runtime/database dependency: none.
- Runtime database: operator-owned PostgreSQL in the self-hosted deployment.
- External CRM/ad systems: inbound import only; no outbound dependency.
- Browser hardware APIs: none.
- Supabase, Edge Functions, `api-read`, and `api-write`: not used.

## Verification

```bash
npm run preflight:stage5s
npm run preflight:stage5r
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- Stage 5S tests pass for repository/service/routes/frontend API/UI.
- `check:stage5s` confirms OpenAPI, nginx, docs, workflow, scripts, and
  protected runtime files.
- `package-lock.json` remains unchanged.
- No `deno.lock` files exist.

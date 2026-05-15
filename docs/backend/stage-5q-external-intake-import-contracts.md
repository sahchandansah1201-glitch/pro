# Stage 5Q — External intake import contracts

Stage 5Q adds the self-hosted import boundary for booking data that originates
outside Dermatolog Pro: clinic CRM exports, advertising forms, the clinic site,
or a manual local adapter. The product accepts sanitized inbound payloads and
stores local PostgreSQL rows. The browser and backend do not call external CRM
or advertising services at runtime.

## Contracts

- `GET /api/v1/integrations/booking-imports`
- `POST /api/v1/integrations/booking-imports`
- `GET /openapi.stage5q.json`

`POST` accepts two item kinds:

- `booking_request`: patient-code based appointment request. When the patient
  exists locally, the backend creates a `patient_portal_booking_requests` row
  for the clinic queue.
- `available_slot`: CRM/exported appointment window. The backend upserts the
  slot into `clinic_available_slots`.

## Storage

Migration `0020_stage5q_external_intake_import_contracts.sql` adds:

- `external_booking_import_batches` — local metadata for each import batch.
- `clinic_available_slots` — locally cached appointment windows.

Only safe metadata is stored. Raw CRM payloads, access tokens, URLs, signed
links, managed-service identifiers, and patient transcripts stay outside this
schema.

## Frontend

`/operator/booking-requests` now shows an "Импорт CRM и рекламных источников"
panel in production mode. The panel reads only
`/api/v1/integrations/booking-imports` through the self-hosted backend session.
It does not call CRM/ad systems from the browser.

## Boundary

- Managed runtime/database dependency: none.
- External CRM/ad systems are inbound data sources only.
- Available windows from the clinic CRM are cached locally before UI use.
- Failed/unmatched records are counted in the import batch; the UI never needs
  a live third-party dependency to keep operating.

## Verification

```bash
npm run preflight:stage5q
```

Expected:

- Stage 5Q repository/service/route tests pass.
- Stage 5Q frontend API and operator production page tests pass.
- Guard confirms no Supabase, api-read/api-write, Edge Function, browser
  hardware, signed URL, storage-path, mock-data, or direct third-party fetch
  coupling in protected runtime files.
- `node scripts/check-no-deno-locks.mjs` passes.

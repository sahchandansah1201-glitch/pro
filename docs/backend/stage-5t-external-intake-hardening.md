# Stage 5T — External intake hardening

Stage 5T hardens the self-hosted inbound integration boundary for clinic CRM,
advertising sources, site forms, and manual import adapters.

## Scope

- `POST /api/v1/integrations/booking-imports`
  - Accepts sanitized booking requests and available slots.
  - Adds `idempotencyKey` support for replay-safe adapter retries.
  - Rejects raw URLs, tokens, storage paths, managed-runtime markers, and
    unsafe source metadata before writing to PostgreSQL.
- `GET /api/v1/integrations/booking-imports`
  - Continues to list local import batches.
  - Includes duplicate counts and hardening metadata.
- `GET /api/v1/integrations/booking-imports/status`
  - Returns local PostgreSQL counters for recent batches, rejected items,
    duplicates, open booking requests, available slots, and latest source
    import status.
- `GET /openapi.stage5t.json`
  - Documents the hardened import/status contract.

## Database

Migration `0023_stage5t_external_intake_hardening.sql` adds:

- `external_booking_import_batches.idempotency_key`
- `external_booking_import_batches.duplicate_count`
- `external_booking_import_batches.hardening_version`
- `patient_portal_booking_requests.source_system`
- `patient_portal_booking_requests.external_request_id`

The partial unique indexes make adapter replay safe:

- `external_booking_import_batches_idempotency_idx`
- `patient_portal_booking_requests_external_request_idx`

## Product Boundary

- Managed runtime/database dependency: none.
- CRM/ad systems do not get called by browser UI or backend runtime.
- The only supported integration shape is inbound push into this self-hosted
  backend, followed by local PostgreSQL review/booking workflows.
- Raw CRM payloads, URLs, tokens, signed URLs, storage paths, and managed
  runtime IDs are rejected and must not be persisted.

## Operator UI

`OperatorBookingRequestsPageLive` now shows:

- Import batch history.
- Duplicate and rejected item counters for the last 24 hours.
- Open booking request and available slot counters from local PostgreSQL.
- Explicit hardening state: `storedRawPayload=false` and
  `runtimeCallsExternalSystems=false`.

## Validation

```bash
npm run preflight:stage5t
npm run preflight:stage5q
npm run preflight:stage5r
npm run preflight:stage5s
node scripts/check-no-deno-locks.mjs
```

The Stage 5T guard verifies the OpenAPI, nginx route, repository/service
markers, UI status panel, workflow, docs, package scripts, and protected-file
runtime boundary.

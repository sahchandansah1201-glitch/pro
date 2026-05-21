# Stage 8D-8F — Appointment availability sync

Stage 8D-8F turns imported CRM/ad availability into an appointment availability sync and operator-owned
confirmation workflow inside the self-hosted product. It connects the existing
Stage 5Q import, Stage 5R local slot cache, and Stage 5S booking-from-slot
contract without adding any external runtime dependency.

## Scope

- Stage 8D: build a local availability sync snapshot from redacted booking
  requests and locally cached available slots.
- Stage 8E: detect stale slots, duplicate source slots, overlapping slots,
  recent import rejects/duplicates, and requests without compatible slots.
- Stage 8F: produce safe confirmation candidates that the operator can confirm
  through `/api/v1/clinic/booking-requests/{requestId}/book-from-slot`.

## Files

- `deploy/self-hosted/integrations/availability-sync.stage8d-8f.json`
- `deploy/self-hosted/integrations/availability-sync-input.stage8d.example.json`
- `deploy/self-hosted/integrations/availability-sync-report.stage8f.example.json`
- `scripts/stage8d-8f-availability-sync.mjs`
- `scripts/check-stage8d-8f-availability-sync.mjs`
- `src/lib/self-hosted-availability-sync.ts`
- `src/pages/operator/OperatorBookingRequestsPageLive.tsx`

## Local usage

Dry-run the bundled redacted snapshot:

```bash
npm run availability:stage8d-8f:dry-run
```

Write a JSON report and Markdown audit:

```bash
node scripts/stage8d-8f-availability-sync.mjs \
  --input deploy/self-hosted/integrations/availability-sync-input.stage8d.example.json \
  --output test-results/stage8d-8f-availability-sync-report.json \
  --audit-output test-results/stage8d-8f-availability-sync-audit.md \
  --dry-run
```

The CLI does not import data and does not confirm bookings. Confirmation remains
owned by the self-hosted Stage 5S endpoint after an operator reviews conflicts.

## Operator UI

`OperatorBookingRequestsPageLive` now shows `Availability sync readiness`:

- open booking requests;
- locally cached available slots;
- confirmation candidates;
- conflict/warning count;
- explicit statement that no CRM runtime calls are made.

The UI reads only existing self-hosted backend endpoints. It does not call CRM,
advertising systems, external scheduling systems, or browser hardware APIs.

## Product boundary

- Managed runtime/database dependency: none.
- Network calls to CRM/ad systems: none.
- Raw external payload storage: false.
- Direct confirmation writes from the planner: false.
- Browser/backend runtime continues to use only the self-hosted product
  contracts from Stage 5Q/5R/5S.
- Reports do not print raw patient names, email addresses, phone numbers,
  tokens, signed links, storage paths, raw external URLs, or raw payloads.

## Verification

```bash
npm run test:stage8d-8f
npm run check:stage8d-8f
npm run availability:stage8d-8f:dry-run
npm run preflight:stage8d-8f
npm run preflight:stage5r
npm run preflight:stage5s
npm run test:project-memory
npm run check:project-memory
node scripts/check-no-deno-locks.mjs
```

Expected result:

- safe snapshot produces `availability-sync-report.stage8f.example.json`;
- unsafe raw fields are rejected before report generation;
- conflict detection blocks duplicate/overlapping slots;
- operator UI displays readiness without external runtime calls;
- package scripts, workflow, project-memory, and preflight-all wiring stay in
  sync.

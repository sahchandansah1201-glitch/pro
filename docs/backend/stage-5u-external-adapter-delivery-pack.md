# Stage 5U — External adapter delivery pack

Stage 5U packages the safe handoff contract for clinics and integrators that
need to send appointment requests and available slots from CRM, ads, site forms,
or manual exports into the self-hosted `Дерматолог Pro` backend.

## Scope

- Provide a sanitized example payload at
  `deploy/self-hosted/integrations/booking-import.stage5u.example.json`.
- Provide an offline validator/dry-run CLI:
  `scripts/stage5u-external-adapter-pack.mjs`.
- Print a copyable local import command for
  `/api/v1/integrations/booking-imports`.
- Keep CRM/ad adapters outside the product runtime. The product accepts
  inbound push into the self-hosted backend and then works from local
  PostgreSQL state.

## Product Boundary

- Managed runtime/database dependency: none.
- External CRM/ad systems are not called by browser UI or backend runtime.
- The delivery pack performs no network calls.
- Raw CRM URLs, tokens, signed URLs, storage paths, Supabase markers, and
  managed-runtime IDs are rejected before import.
- The example payload contains only local metadata required by Stage 5T:
  `clinicId`, `sourceSystem`, `sourceReference`, `idempotencyKey`, and
  `booking_request` / `available_slot` items.

## Local Usage

Validate the bundled example payload and render the dry-run instructions:

```bash
npm run adapter:stage5u:validate:example
```

Validate a clinic-specific payload:

```bash
node scripts/stage5u-external-adapter-pack.mjs \
  --input deploy/self-hosted/integrations/booking-import.stage5u.example.json \
  --api-base-url http://localhost:8080 \
  --dry-run
```

Output includes a local `curl` command. The operator-owned adapter replaces
`<SELF_HOSTED_BEARER_TOKEN>` and pushes into the self-hosted backend. The core
product still does not depend on CRM/ad availability.

## Validation

```bash
npm run preflight:stage5u
npm run preflight:stage5t
node scripts/check-no-deno-locks.mjs
```

The Stage 5U guard verifies the example payload, validator, tests, workflow,
docs, package scripts, preflight-all wiring, and protected-file runtime
boundary.

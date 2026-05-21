# Stage 8A-8C — CRM inbound adapter

Stage 8A-8C turns the roadmap item "CRM inbound adapter implementation" into
a repository-owned, operator-run adapter layer. It converts safe local CRM,
advertising, site, or manual exports into the existing Stage 5Q import payload
for `/api/v1/integrations/booking-imports`.

## Scope

- Stage 8A: define the local CRM/ad export shape and mapping manifest.
- Stage 8B: normalize booking requests and available slots into the Stage 5Q
  import contract.
- Stage 8C: render a redacted import audit report and reject unsafe input
  before an operator posts the payload to the self-hosted backend.

## Files

- `deploy/self-hosted/integrations/crm-inbound-adapter.stage8a-8c.json`
- `deploy/self-hosted/integrations/crm-inbound-export.stage8a.example.json`
- `deploy/self-hosted/integrations/crm-inbound-mapping.stage8a.example.json`
- `deploy/self-hosted/integrations/booking-import.stage8b.example.json`
- `scripts/stage8a-8c-crm-inbound-adapter.mjs`
- `scripts/check-stage8a-8c-crm-inbound-adapter.mjs`

## Local usage

Dry-run the bundled example:

```bash
npm run adapter:stage8a-8c:dry-run
```

Write a normalized Stage 5Q payload and a redacted audit report:

```bash
node scripts/stage8a-8c-crm-inbound-adapter.mjs \
  --input deploy/self-hosted/integrations/crm-inbound-export.stage8a.example.json \
  --mapping deploy/self-hosted/integrations/crm-inbound-mapping.stage8a.example.json \
  --output test-results/stage8a-8c-booking-import.json \
  --audit-output test-results/stage8a-8c-crm-inbound-audit.md \
  --dry-run
```

The output file is ready for the existing Stage 5Q endpoint. The operator-owned
connector, not the browser UI, performs the final local import step.

## Product boundary

- Managed runtime/database dependency: none.
- The adapter performs no network calls.
- The backend and browser do not call external CRM or advertising systems.
- Raw external URLs, access tokens, storage paths, signed links, managed
  runtime markers, raw patient names, email addresses, and phone numbers are
  rejected before normalization.
- The audit report contains counts and rejection reasons only. It does not
  print patient codes, external IDs, tokens, raw export rows, or raw CRM fields.

## Verification

```bash
npm run test:stage8a-8c
npm run check:stage8a-8c
npm run adapter:stage8a-8c:dry-run
npm run preflight:stage8a-8c
node scripts/check-no-deno-locks.mjs
```

Expected result:

- example CRM export maps to `booking-import.stage8b.example.json`;
- unsafe input is rejected before Stage 5Q payload generation;
- the audit report remains redacted and count-only;
- package scripts, workflow, docs, project-memory, and preflight-all wiring stay
  in sync.

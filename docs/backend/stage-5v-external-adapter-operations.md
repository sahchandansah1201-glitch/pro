# Stage 5V — External adapter operations

Stage 5V adds the operator runbook and local reporting layer for CRM/ad inbound
imports. It builds on Stage 5U payload validation and Stage 5T hardening status
without adding any runtime dependency on external systems.

## Scope

- Add a sanitized status snapshot fixture:
  `deploy/self-hosted/integrations/booking-import-status.stage5v.example.json`.
- Add `scripts/stage5v-external-adapter-ops.mjs` to produce an operator report
  from:
  - a validated Stage 5U payload
  - a local Stage 5T status snapshot
- Add report gates for:
  - valid payload
  - valid hardening status
  - `storedRawPayload=false`
  - `runtimeCallsExternalSystems=false`
  - rejected/duplicate counters that need operator review

## Product Boundary

- Managed runtime/database dependency: none.
- The operations CLI performs no network calls.
- CRM/ad adapters remain operator-owned processes that push sanitized payloads
  into `/api/v1/integrations/booking-imports`.
- The core product does not call CRM/ad services and remains usable when those
  services are offline.
- Reports must not contain raw URLs, tokens, storage paths, patient names, or
  managed-runtime markers.

## Local Usage

Generate the bundled operator report:

```bash
npm run adapter:stage5v:ops:example
```

Write the report to a file:

```bash
node scripts/stage5v-external-adapter-ops.mjs \
  --input deploy/self-hosted/integrations/booking-import.stage5u.example.json \
  --status-file deploy/self-hosted/integrations/booking-import-status.stage5v.example.json \
  --output test-results/stage5v-external-adapter-ops.md \
  --dry-run
```

The generated operator report includes a local import command, status counters,
review gates, and the checklist for handling rejected or duplicate items.

## Validation

```bash
npm run preflight:stage5v
npm run preflight:stage5u
npm run preflight:stage5t
node scripts/check-no-deno-locks.mjs
```

The Stage 5V guard verifies the status snapshot, operations CLI, tests,
workflow, docs, package scripts, preflight-all wiring, and protected-file
runtime boundary.

# Stage 5Z — External adapter production handoff

Stage 5Z adds the final local production handoff package for inbound CRM/ad
adapters. It aggregates Stage 5U delivery validation, Stage 5V operations
status, Stage 5W incident state, Stage 5X audit evidence, and Stage 5Y
reconciliation signoff into one operator-ready handoff.

## Scope

- Add `deploy/self-hosted/integrations/adapter-handoff-manifest.stage5z.example.json`.
- Add `scripts/stage5z-external-adapter-production-handoff.mjs`.
- Generate:
  - `handoff-summary.json`
  - `handoff-checklist.json`
  - `handoff-summary.md`
- Verify all required packages are present and green.
- Add guard, tests, workflow, and `preflight-all` wiring.

## Product Boundary

- Managed runtime/database dependency: none.
- The product runtime does not call CRM, advertising, or external scheduling
  systems.
- External adapters remain operator-owned processes outside the product runtime.
- Handoff uses sanitized local evidence only.
- The self-hosted backend remains the only product ingestion boundary.

## Local Usage

```bash
npm run adapter:stage5z:handoff:example
npm run preflight:stage5z
```

The example command writes the production handoff output into
`test-results/stage5z-handoff`.

## Handoff Gates

The generated package marks `readyForProductionHandoff` only when:

- Stage 5U delivery evidence is valid;
- Stage 5V operations report has no blocking warnings;
- Stage 5W incident state is running;
- Stage 5X audit bundle is complete and clean;
- Stage 5Y reconciliation is signed off;
- no raw external URLs, credentials, storage paths, patient identity fields, or
  managed-runtime markers are present in the generated handoff.

## Release Gate

`npm run preflight:stage5z` runs:

1. Stage 5Z unit tests.
2. Stage 5Z guard.
3. The example production handoff generator.
4. `node scripts/check-no-deno-locks.mjs`.

Stage 5Z is also included in `npm run preflight:all`.

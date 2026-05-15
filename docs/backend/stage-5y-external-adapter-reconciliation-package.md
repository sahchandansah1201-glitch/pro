# Stage 5Y — External adapter reconciliation package

Stage 5Y adds the local reconciliation package for inbound CRM/ad adapters. It
compares the sanitized Stage 5U payload with operator-owned local outcomes and
the Stage 5X audit bundle, then writes a safe signoff report.

## Scope

- Add `deploy/self-hosted/integrations/adapter-reconciliation-manifest.stage5y.example.json`.
- Add `scripts/stage5y-external-adapter-reconciliation-package.mjs`.
- Generate:
  - `reconciliation-summary.json`
  - `reconciliation-ledger.json`
  - `reconciliation-report.md`
- Detect pending payload items, unexpected outcomes, duplicate outcome rows,
  and kind mismatches.
- Add guard, tests, workflow, and `preflight-all` wiring.

## Product Boundary

- Managed runtime/database dependency: none.
- The product runtime does not call CRM, advertising, or external scheduling
  systems.
- External adapters remain operator-owned processes outside the product runtime.
- Reconciliation uses sanitized local payload/status/audit evidence only.
- The self-hosted backend remains the system of record for accepted local state.

## Local Usage

```bash
npm run adapter:stage5y:reconcile:example
npm run preflight:stage5y
```

The example command writes the reconciliation output into
`test-results/stage5y-reconciliation`.

## Signoff Gates

The generated report marks `readyForOperatorSignoff` only when:

- every payload item has a local outcome;
- there are no unexpected outcomes;
- there are no duplicate outcome rows;
- item kinds match the source payload;
- the Stage 5X audit bundle is complete and clean;
- the reconciliation output has no raw external URLs, credentials, storage
  paths, patient identity fields, or managed-runtime markers.

## Release Gate

`npm run preflight:stage5y` runs:

1. Stage 5Y unit tests.
2. Stage 5Y guard.
3. The example reconciliation generator.
4. `node scripts/check-no-deno-locks.mjs`.

Stage 5Y is also included in `npm run preflight:all`.

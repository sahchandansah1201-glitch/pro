# Stage 5X — External adapter audit package

Stage 5X packages the Stage 5U payload summary, Stage 5V operations report,
and Stage 5W incident/control evidence into one local audit bundle. The goal is
release and incident evidence for inbound CRM/ad adapters without adding any
runtime dependency on those external systems.

## Scope

- Add `deploy/self-hosted/integrations/adapter-audit-manifest.stage5x.example.json`.
- Add `scripts/stage5x-external-adapter-audit-package.mjs`.
- Build a local evidence bundle with:
  - `payload-summary.json`
  - `status-snapshot.json`
  - `ops-report.md`
  - `incident-runbook.md`
  - `adapter-control-manifest.json`
  - `audit-index.md`
- Add a leak scanner and completeness gates.
- Add guard, tests, workflow, and `preflight-all` wiring.

## Product Boundary

- Managed runtime/database dependency: none.
- The product runtime does not call CRM, advertising, or external scheduling
  systems.
- Adapters remain operator-owned processes outside the product runtime.
- The bundle is generated locally from sanitized files already accepted by
  Stage 5U, Stage 5V, and Stage 5W.
- The self-hosted backend remains the only runtime integration point for the
  product.

## Local Usage

```bash
npm run adapter:stage5x:audit:example
npm run preflight:stage5x
```

The example command writes the audit bundle into
`test-results/stage5x-audit`. It is safe to attach the generated evidence to a
release review after a quick human check.

## Privacy Gates

The Stage 5X script scans the manifest and generated evidence for raw external
URLs, credentials, storage paths, patient identity fields, and managed-runtime
markers. The local import command may keep the self-hosted bearer-token
placeholder and `localhost` endpoint because those are not production secrets.

## Release Gate

`npm run preflight:stage5x` runs:

1. Stage 5X unit tests.
2. Stage 5X guard.
3. The example audit-bundle generator.
4. `node scripts/check-no-deno-locks.mjs`.

Stage 5X is also included in `npm run preflight:all`.

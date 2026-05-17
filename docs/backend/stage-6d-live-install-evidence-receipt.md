# Stage 6D — Live install evidence receipt

Stage 6D turns the Stage 6C production install verification package into an
operator-facing receipt contract for redacted live install evidence. It does not
introduce a new runtime API, database schema, frontend route, auth change, or
browser hardware integration. The package is an offline evidence intake layer
for confirming what the operator must collect after installing Dermatolog Pro on
an operator-owned server.

## Scope

- Add `deploy/self-hosted/live-install-evidence.stage6d.json`.
- Add `scripts/stage6d-live-install-evidence-receipt.mjs`.
- Generate:
  - `stage6d-live-install-evidence-receipt.md`
  - `stage6d-live-install-evidence-receipt.json`
- Add guard, unit tests, workflow, and `preflight-all` wiring.
- Require Stage 6C to be ready before the receipt package is marked ready.

## Verification boundary

- Managed runtime/database dependency: none.
- Product runtime does not call external CRM, advertising, or scheduling
  systems.
- Production mode must not fall back to demo data.
- The Stage 6D report does not prove that a live server was installed. It proves
  that the repository has a safe receipt contract for redacted evidence.
- Raw live evidence, production environment values, backup contents, patient
  records, object keys, credentials, external adapter payloads, and signed links
  must stay outside git.

## Included receipt inputs

Stage 6D checks that the receipt package has the required local inputs:

- Stage 6C production install verification package.
- Stage 6C verification generator.
- Stage 6B server install package.
- Stage 6A accepted product baseline.
- Stage 4M production deploy verifier.
- Stage 4K self-hosted compose smoke.
- Stage 4L backup and restore operations.
- Stage 4Z product readiness contract.
- Stage 4N production observability export.
- Production environment template.

## Evidence categories

The operator evidence remains outside git. The repository stores only the
receipt contract for these redacted evidence categories:

- target server environment validation;
- production compose config summary;
- health and readiness snapshot;
- product readiness snapshot;
- Stage 4K smoke result against the installed stack;
- post-install backup manifest receipt;
- rollback drill review;
- operator evidence signoff.

## Local usage

```bash
npm run evidence:stage6d:report
npm run evidence:stage6d:dry-run
npm run preflight:stage6d
```

The report command writes the redacted receipt contract into `test-results/` and
prints a Markdown summary suitable for deployment review.

## Release gate

`npm run preflight:stage6d` runs:

1. Stage 6D unit tests.
2. Stage 6D guard.
3. The live install evidence receipt report generator.
4. `node scripts/check-no-deno-locks.mjs`.

The generated report is ready only when Stage 6C is ready, all required receipt
inputs exist, evidence categories are present and redaction-required, receipt
fields are redacted, receipt gates are present, live evidence policy is safe,
safety assertions are green, package scripts are wired, and the report has no
privacy leak findings.

## Privacy

Stage 6D must not commit live server logs, raw production command output,
environment values, backup contents, patient records, object keys, credentials,
external adapter payloads, or signed links. The only git-safe output is the
redacted receipt structure and status report.

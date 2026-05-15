# Stage 6C — Production install verification

Stage 6C turns the Stage 6B server install package into an operator-facing
verification package for the first production install. It does not introduce a
new runtime API, database schema, frontend route, auth change, or browser
hardware integration. The package is an offline checklist and evidence plan for
verifying a Dermatolog Pro install on an operator-owned server.

## Scope

- Add `deploy/self-hosted/install-verification.stage6c.json`.
- Add `scripts/stage6c-production-install-verification.mjs`.
- Generate:
  - `stage6c-production-install-verification.md`
  - `stage6c-production-install-verification.json`
- Add guard, unit tests, workflow, and `preflight-all` wiring.
- Require Stage 6B to be ready before live install verification is marked
  ready to run.

## Verification boundary

- Managed runtime/database dependency: none.
- Product runtime does not call external CRM, advertising, or scheduling
  systems.
- Production mode must not fall back to demo data.
- The Stage 6C report does not prove that a live server was installed. It proves
  that the local verification package is ready for the operator to run.
- Live server evidence, production environment values, backup contents, patient
  records, object keys, credentials, external adapter payloads, and signed links
  must stay outside git.

## Included verification inputs

Stage 6C checks that the verification package has the required local inputs:

- Stage 6B server install package.
- Stage 6A accepted product baseline.
- Stage 6B install generator.
- Stage 5B production server bootstrap planner.
- Stage 4M production deploy verifier.
- Stage 4K self-hosted compose smoke.
- Stage 4L backup and restore operations.
- Production environment template.
- Docker Compose base stack and production overlay.
- Production schema prestart check.
- PostgreSQL migration directory.

## Local usage

```bash
npm run verify:stage6c:report
npm run verify:stage6c:dry-run
npm run preflight:stage6c
```

The report command writes install verification evidence into `test-results/`
and prints a Markdown summary suitable for deployment review.

## Release gate

`npm run preflight:stage6c` runs:

1. Stage 6C unit tests.
2. Stage 6C guard.
3. The production install verification report generator.
4. `node scripts/check-no-deno-locks.mjs`.

The generated report is ready only when Stage 6B is ready, all required
verification inputs exist, verification gates are present, live evidence policy
is safe, safety assertions are green, package scripts are wired, and the report
has no privacy leak findings.

## Operator evidence checklist

The live server operator should collect evidence outside git for:

- production env validation on the target server;
- production Compose config without secrets;
- health and readiness checks;
- product readiness endpoint;
- Stage 4K smoke against the installed stack;
- post-install backup manifest;
- rollback drill plan review before any live restore.

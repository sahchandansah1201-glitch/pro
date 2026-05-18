# Stage 6E — Production go-live handoff

Stage 6E turns the Stage 6D live install evidence receipt package into an
operator-facing production go-live handoff contract. It does not introduce a new
runtime API, database schema, frontend route, auth change, browser hardware
integration, or external service dependency. The package is an offline release
decision layer for preparing the operator's final go-live approval.

## Scope

- Add `deploy/self-hosted/go-live-handoff.stage6e.json`.
- Add `scripts/stage6e-production-go-live-handoff.mjs`.
- Generate:
  - `stage6e-production-go-live-handoff.md`
  - `stage6e-production-go-live-handoff.json`
- Add guard, unit tests, workflow, and `preflight-all` wiring.
- Require Stage 6D to be ready before the go-live handoff package is marked
  ready.

## Verification boundary

- Managed runtime/database dependency: none.
- Product runtime does not call external CRM, advertising, or scheduling
  systems.
- Production mode must not fall back to demo data.
- The Stage 6E report does not approve go-live and does not prove that a live
  server is running. It proves that the repository has a safe handoff contract
  for the operator's external go-live decision.
- Raw live evidence, go-live approval records, production environment values,
  backup contents, patient records, object keys, credentials, external adapter
  payloads, and signed links must stay outside git.

## Included handoff inputs

Stage 6E checks that the handoff package has the required local inputs:

- Stage 6D live install evidence receipt package.
- Stage 6D evidence receipt generator.
- Stage 6C production install verification package.
- Stage 6B server install package.
- Stage 6A accepted product baseline.
- Stage 5A release candidate environment template.
- Stage 5B bootstrap system admin SQL template.
- Stage 5C pre-start schema check.
- Stage 5Z external adapter production handoff.
- Project-memory handoff snapshot.

## Handoff sections

The go-live handoff contract lists the required sections that the operator must
review before the final external approval:

- release scope and accepted baseline;
- redacted live install evidence references;
- operator support contacts;
- backup and restore readiness;
- rollback and stop conditions;
- production monitoring and audit checks;
- external adapter handoff;
- post go-live observation window.

## Local usage

```bash
npm run handoff:stage6e:report
npm run handoff:stage6e:dry-run
npm run preflight:stage6e
```

The report command writes the redacted handoff contract into `test-results/` and
prints a Markdown summary suitable for release review.

## Release gate

`npm run preflight:stage6e` runs:

1. Stage 6E unit tests.
2. Stage 6E guard.
3. The production go-live handoff report generator.
4. `node scripts/check-no-deno-locks.mjs`.

The generated report is ready only when Stage 6D is ready, all required handoff
inputs exist, sections are present, decision fields are redacted and stored
outside git, go-live gates are present, policy is safe, safety assertions are
green, package scripts are wired, and the report has no privacy leak findings.

## Privacy

Stage 6E must not commit live server logs, final go-live approval records, raw
production command output, environment values, backup contents, patient records,
object keys, credentials, external adapter payloads, or signed links. The only
git-safe output is the redacted handoff structure and status report.

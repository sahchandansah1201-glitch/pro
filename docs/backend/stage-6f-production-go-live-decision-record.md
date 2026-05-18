# Stage 6F — Production go-live decision record

Stage 6F turns the Stage 6E go-live handoff into a git-safe decision-record
contract. It does not introduce a runtime API, database schema, frontend route,
auth change, browser hardware integration, or external service dependency. It
also does not approve go-live and does not prove that a live production server is
running.

This production go-live decision record is intentionally a repository-side
contract, not a final approval artifact.

The stage exists to make the next external operator decision auditable without
committing secrets, raw live evidence, patient data, backup contents, object
keys, approver identities, or final go-live outcome into the repository.

## Scope

- Add `deploy/self-hosted/go-live-decision-record.stage6f.json`.
- Add `scripts/stage6f-production-go-live-decision-record.mjs`.
- Generate:
  - `stage6f-production-go-live-decision-record.md`
  - `stage6f-production-go-live-decision-record.json`
- Add guard, unit tests, workflow, and `preflight-all` wiring.
- Require Stage 6E to be ready before the decision-record package is marked
  ready.

## Verification boundary

- Managed runtime/database dependency: none.
- Product runtime does not call external CRM, advertising, or scheduling
  systems.
- Production mode must not fall back to demo data.
- The Stage 6F report does not approve go-live and does not verify that a live
  server is running.
- The final decision id, approver reference, approval channel reference,
  evidence bundle reference, rollback owner, observation owner, support window,
  and final outcome must stay outside git.

## Included decision inputs

Stage 6F checks that the decision-record package has the required local inputs:

- Stage 6E production go-live handoff package.
- Stage 6E handoff generator.
- Stage 6D live install evidence receipt package.
- Stage 6C production install verification package.
- Stage 5Z external adapter production handoff.
- Project-memory handoff snapshot.
- Deterministic preflight-all orchestrator.
- Backend guardrails workflow.

## Decision record sections

The decision-record contract lists the required sections that the operator must
keep in the external decision record:

- decision scope and accepted release baseline;
- external operator decision reference;
- external evidence bundle reference;
- go/no-go conditions and stop criteria;
- rollback authority and escalation reference;
- operator support window;
- post-decision observation window;
- post-decision actions and release note updates.

## Local usage

```bash
npm run decision:stage6f:report
npm run decision:stage6f:dry-run
npm run preflight:stage6f
```

The report command writes the redacted decision-record contract into
`test-results/` and prints a Markdown summary suitable for release review.

## Release gate

`npm run preflight:stage6f` runs:

1. Stage 6F unit tests.
2. Stage 6F guard.
3. The production go-live decision-record report generator.
4. `node scripts/check-no-deno-locks.mjs`.

The generated report is ready only when Stage 6E is ready, all required decision
inputs exist, required sections are present, external decision fields are
redacted and stored outside git, decision gates are present, policy is safe,
safety assertions are green, package scripts are wired, and the report has no
privacy leak findings.

## Privacy

Stage 6F must not commit final approval records, raw production command output,
environment values, backup contents, patient records, object keys, credentials,
external adapter payloads, signed links, or live server evidence. The only
git-safe output is the redacted decision-record structure and status report.

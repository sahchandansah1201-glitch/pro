# Stage 6X — Production release archive retention cycle final closure reconciliation receipt

Stage 6X turns the Stage 6W production release archive retention cycle final
closure reconciliation into a git-safe final-closure reconciliation receipt package. It is
still a repository-side contract: it does not approve go-live, does not prove
that a live production server was archived, and does not store live archive
contents, external receipt values, or the final archive reconciliation outcome.

This is the production release archive retention cycle final closure reconciliation receipt package for the self-hosted release flow.

## 1. Scope

- Add `deploy/self-hosted/release-archive-retention-cycle-final-closure-reconciliation-receipt.stage6x.json`.
- Add `scripts/stage6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.mjs`.
- Generate redacted offline outputs:
  - `stage6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.md`
  - `stage6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.json`
- Check the Stage 6W archive retention cycle final closure reconciliation readiness.
- Keep the real archive, external final-closure receipt values,
  reconciliation result, owner confirmation, review-window evidence,
  disposal-hold watch, and final reconciliation outcome outside git.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains operator-owned self-hosted frontend, backend,
  PostgreSQL, object storage, and Device Bridge worker.
- This package performs no network calls and does not read live production
  logs, live metrics, raw patient records, credentials, object keys, backup
  contents, archive receipt values, or final archive contents.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6W

Stage 6W prepares the release archive retention cycle final closure
reconciliation. Stage 6X checks that Stage 6W is ready, then prepares a
repository-safe receipt package for the external final-closure reconciliation
receipt process.

The repository may contain:

- final closure reconciliation receipt schema;
- redacted reconciliation field names;
- required gates;
- Stage 6W manifest paths;
- output templates.

The repository must not contain:

- final go-live approval;
- live-server verification proof;
- raw live logs;
- live metrics;
- patient-identifying content;
- credentials or object-storage keys;
- backup contents;
- external archive contents;
- external archive retention cycle final closure receipt values;
- final archive receipt outcome;
- final archive retention cycle final closure reconciliation receipt outcome.

## 4. Required external reconciliation fields

The external reconciliation record should store these redacted references
outside git:

- archive retention cycle final closure reconciliation receipt id reference;
- archive retention cycle final closure receipt id reference;
- archive retention cycle final closure id reference;
- final closure receipt reconciliation result reference;
- retention cycle final closure reconciliation receipt owner reference;
- retention review window final closure reconciliation receipt reference;
- disposal hold watch final closure reconciliation receipt reference;
- retention exception register final closure reconciliation receipt reference.

## 5. Commands

```bash
npm run receipt:stage6x:report
npm run receipt:stage6x:dry-run
npm run preflight:stage6x
```

`npm run preflight:stage6x` runs:

1. Stage 6X unit tests.
2. Stage 6X guard.
3. Stage 6X report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6x-production-release-archive-retention-cycle-final-closure-reconciliation-receipt.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6X is ready when:

- `npm run preflight:stage6x` passes;
- Stage 6W is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, final receipt outcome,
  final closure reconciliation receipt outcome, or patient-identifying content are
  committed.

The final release archive retention cycle final closure reconciliation receipt remains
an operator-owned external record. It is not bundled in this repository.

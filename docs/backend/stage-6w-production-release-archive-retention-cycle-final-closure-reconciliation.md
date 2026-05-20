# Stage 6W — Production release archive retention cycle final closure reconciliation

Stage 6W turns the Stage 6V production release archive retention cycle final
closure receipt into a git-safe final-closure reconciliation package. It is
still a repository-side contract: it does not approve go-live, does not prove
that a live production server was archived, and does not store live archive
contents, external receipt values, or the final archive reconciliation outcome.

This is the production release archive retention cycle final closure reconciliation package for the self-hosted release flow.

## 1. Scope

- Add `deploy/self-hosted/release-archive-retention-cycle-final-closure-reconciliation.stage6w.json`.
- Add `scripts/stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.mjs`.
- Generate redacted offline outputs:
  - `stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.md`
  - `stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.json`
- Check the Stage 6V archive retention cycle final closure receipt readiness.
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

## 3. Relationship to Stage 6V

Stage 6V prepares the release archive retention cycle final closure receipt.
Stage 6W checks that Stage 6V is ready, then prepares a repository-safe
reconciliation package for the external final-closure receipt process.

The repository may contain:

- final closure reconciliation schema;
- redacted reconciliation field names;
- required gates;
- Stage 6V manifest paths;
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
- final archive retention cycle final closure reconciliation outcome.

## 4. Required external reconciliation fields

The external reconciliation record should store these redacted references
outside git:

- archive retention cycle final closure reconciliation id reference;
- archive retention cycle final closure receipt id reference;
- archive retention cycle final closure id reference;
- final closure receipt reconciliation result reference;
- retention cycle final closure reconciliation owner reference;
- retention review window final closure reconciliation reference;
- disposal hold watch final closure reconciliation reference;
- retention exception register final closure reconciliation reference.

## 5. Commands

```bash
npm run reconcile:stage6w:report
npm run reconcile:stage6w:dry-run
npm run preflight:stage6w
```

`npm run preflight:stage6w` runs:

1. Stage 6W unit tests.
2. Stage 6W guard.
3. Stage 6W report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6w-production-release-archive-retention-cycle-final-closure-reconciliation.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6W is ready when:

- `npm run preflight:stage6w` passes;
- Stage 6V is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, final receipt outcome,
  final closure reconciliation outcome, or patient-identifying content are
  committed.

The final release archive retention cycle final closure reconciliation remains
an operator-owned external record. It is not bundled in this repository.

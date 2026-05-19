# Stage 6K — Production release archive reconciliation

Stage 6K turns the Stage 6J production release archive handoff receipt into a
git-safe reconciliation package. It is still a repository-side contract: it
does not approve go-live, does not prove that a live production server was
archived, and does not store live archive contents, external receipt values, or
the final archive reconciliation outcome.

This is the production release archive reconciliation package for the
self-hosted release flow.

## 1. Scope

- Add `deploy/self-hosted/release-archive-reconciliation.stage6k.json`.
- Add `scripts/stage6k-production-release-archive-reconciliation.mjs`.
- Generate redacted offline outputs:
  - `stage6k-production-release-archive-reconciliation.md`
  - `stage6k-production-release-archive-reconciliation.json`
- Check the Stage 6J archive handoff receipt readiness.
- Keep the real archive, external receipt values, checksum match proof,
  restore-drill result, archive owner confirmation, and final reconciliation
  outcome outside git.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains operator-owned self-hosted frontend, backend,
  PostgreSQL, object storage, and Device Bridge worker.
- This package performs no network calls and does not read live production
  logs, live metrics, raw patient records, credentials, object keys, backup
  contents, archive receipt values, or final archive contents.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6J

Stage 6J prepares the release archive handoff receipt. Stage 6K checks that
Stage 6J is ready, then prepares a repository-safe reconciliation package for
the external archive receipt process.

The repository may contain:

- reconciliation schema;
- redacted reconciliation field names;
- required gates;
- Stage 6J manifest paths;
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
- external archive receipt values;
- final archive receipt outcome;
- final archive reconciliation outcome.

## 4. Required external reconciliation fields

The external reconciliation record should store these redacted references
outside git:

- archive receipt id reference;
- checksum match reference;
- restore-drill result reference;
- retention policy acknowledgement reference;
- archive owner confirmation reference;
- reconciliation owner reference.

## 5. Commands

```bash
npm run reconcile:stage6k:report
npm run reconcile:stage6k:dry-run
npm run preflight:stage6k
```

`npm run preflight:stage6k` runs:

1. Stage 6K unit tests.
2. Stage 6K guard.
3. Stage 6K report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6k-production-release-archive-reconciliation.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6K is ready when:

- `npm run preflight:stage6k` passes;
- Stage 6J is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, final receipt outcome,
  final reconciliation outcome, or patient-identifying content are committed.

The final release archive reconciliation remains an operator-owned external
record. It is not bundled in this repository.

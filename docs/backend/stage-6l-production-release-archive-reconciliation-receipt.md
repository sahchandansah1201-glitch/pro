# Stage 6L — Production release archive reconciliation receipt

Stage 6L turns the Stage 6K production release archive reconciliation into a
git-safe receipt package. It is still a repository-side contract: it does not
approve go-live, does not prove that a live production server was archived, and
does not store live archive contents, external receipt values, external
reconciliation values, or the final archive reconciliation receipt outcome.

This is the production release archive reconciliation receipt package for the
self-hosted release flow.

## 1. Scope

- Add `deploy/self-hosted/release-archive-reconciliation-receipt.stage6l.json`.
- Add `scripts/stage6l-production-release-archive-reconciliation-receipt.mjs`.
- Generate redacted offline outputs:
  - `stage6l-production-release-archive-reconciliation-receipt.md`
  - `stage6l-production-release-archive-reconciliation-receipt.json`
- Check the Stage 6K archive reconciliation readiness.
- Keep the real archive, external archive receipt values, external
  reconciliation values, archive owner signoff, and final receipt outcome
  outside git.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains operator-owned self-hosted frontend, backend,
  PostgreSQL, object storage, and Device Bridge worker.
- This package performs no network calls and does not read live production
  logs, live metrics, raw patient records, credentials, object keys, backup
  contents, archive receipt values, reconciliation values, or final archive
  contents.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6K

Stage 6K prepares the release archive reconciliation package. Stage 6L checks
that Stage 6K is ready, then prepares a repository-safe receipt package for the
external archive reconciliation receipt process.

The repository may contain:

- reconciliation receipt schema;
- redacted receipt field names;
- required gates;
- Stage 6K manifest paths;
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
- external archive reconciliation values;
- external archive reconciliation receipt values;
- final archive receipt outcome;
- final archive reconciliation outcome;
- final archive reconciliation receipt outcome.

## 4. Required external receipt fields

The external reconciliation receipt record should store these redacted
references outside git:

- archive reconciliation receipt id reference;
- archive receipt outcome reference;
- reconciliation outcome reference;
- archive owner signoff reference;
- retention follow-up reference;
- reconciliation receipt owner reference.

## 5. Commands

```bash
npm run receipt:stage6l:report
npm run receipt:stage6l:dry-run
npm run preflight:stage6l
```

`npm run preflight:stage6l` runs:

1. Stage 6L unit tests.
2. Stage 6L guard.
3. Stage 6L report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6l-production-release-archive-reconciliation-receipt.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6L is ready when:

- `npm run preflight:stage6l` passes;
- Stage 6K is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, external reconciliation
  values, final receipt outcome, final reconciliation outcome, final
  reconciliation receipt outcome, or patient-identifying content are committed.

The final release archive reconciliation receipt remains an operator-owned
external record. It is not bundled in this repository.

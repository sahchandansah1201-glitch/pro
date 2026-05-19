# Stage 6M — Production release archive final closure

Stage 6M turns the Stage 6L production release archive reconciliation receipt
into a git-safe final closure package. It is still a repository-side contract: it does not
approve go-live, does not prove that a live production server was archived, and
does not store live archive contents, external closure values, external
reconciliation values, or the final archive final closure outcome.

This is the production release archive final closure package for the
self-hosted release flow.

## 1. Scope

- Add `deploy/self-hosted/release-archive-final-closure.stage6m.json`.
- Add `scripts/stage6m-production-release-archive-final-closure.mjs`.
- Generate redacted offline outputs:
  - `stage6m-production-release-archive-final-closure.md`
  - `stage6m-production-release-archive-final-closure.json`
- Check the Stage 6L archive reconciliation receipt readiness.
- Keep the real archive, external archive closure values, external
  reconciliation values, archive owner signoff, and final receipt outcome
  outside git.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains operator-owned self-hosted frontend, backend,
  PostgreSQL, object storage, and Device Bridge worker.
- This package performs no network calls and does not read live production
  logs, live metrics, raw patient records, credentials, object keys, backup
  contents, archive closure values, reconciliation values, or final archive
  contents.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6L

Stage 6L prepares the release archive reconciliation receipt package. Stage 6M
checks that Stage 6L is ready, then prepares a repository-safe final closure
package for the external archive final closure process.

The repository may contain:

- final closure schema;
- redacted closure field names;
- required gates;
- Stage 6L manifest paths;
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
- external archive closure values;
- external archive reconciliation values;
- external archive final closure values;
- final archive receipt outcome;
- final archive reconciliation outcome;
- final archive final closure outcome.

## 4. Required external closure fields

The external final closure record should store these redacted
references outside git:

- archive final closure id reference;
- archive index outcome reference;
- archive reconciliation receipt outcome reference;
- archive owner signoff reference;
- retention follow-up reference;
- final closure owner reference.

## 5. Commands

```bash
npm run closure:stage6m:report
npm run closure:stage6m:dry-run
npm run preflight:stage6m
```

`npm run preflight:stage6m` runs:

1. Stage 6M unit tests.
2. Stage 6M guard.
3. Stage 6M report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6m-production-release-archive-final-closure.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6M is ready when:

- `npm run preflight:stage6m` passes;
- Stage 6L is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external closure values, external reconciliation
  values, final receipt outcome, final reconciliation outcome, final
  final closure outcome, or patient-identifying content are committed.

The final release archive final closure remains an operator-owned
external record. It is not bundled in this repository.

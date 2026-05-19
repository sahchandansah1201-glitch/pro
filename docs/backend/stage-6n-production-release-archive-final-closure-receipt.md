# Stage 6N — Production release archive final closure receipt

Stage 6N adds the production release archive final closure receipt package for
the Stage 6M release
archive final closure. It records the schema, gates, and redacted field names
needed by the external archive process, while keeping the actual receipt
values and final archive outcome outside git.

This is still an offline repository contract. It does not approve go-live,
does not verify a live production server, and does not store live evidence,
logs, metrics, credentials, object keys, backup contents, raw archive content,
or patient-identifying content.

## 1. Scope

- Add `deploy/self-hosted/release-archive-final-closure-receipt.stage6n.json`.
- Add `scripts/stage6n-production-release-archive-final-closure-receipt.mjs`.
- Generate redacted offline outputs:
  - `stage6n-production-release-archive-final-closure-receipt.md`
  - `stage6n-production-release-archive-final-closure-receipt.json`
- Check that Stage 6M final closure is ready before marking this receipt
  package ready.
- Keep external final closure receipt contents and final archive closure
  outcomes outside the repository.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains the operator-owned self-hosted frontend, backend,
  PostgreSQL database, object storage, and Device Bridge worker.
- The Stage 6N script performs no network calls.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6M

Stage 6M creates the repository final closure package. Stage 6N references
that package and prepares a git-safe final closure receipt package for the
external archive process.

The repository may contain:

- final closure receipt schema;
- redacted receipt field names;
- required verification gates;
- Stage 6M manifest paths;
- output templates;
- self-hosted product boundary statements.

The repository must not contain:

- final go-live approval;
- live-server verification proof;
- raw live logs or metrics;
- patient-identifying content;
- credentials or object-storage keys;
- backup contents;
- external archive contents;
- external archive receipt values;
- external archive reconciliation values;
- external archive final closure values;
- external archive final closure receipt values;
- final archive receipt outcome;
- final archive reconciliation outcome;
- final archive final closure outcome;
- final archive final closure receipt outcome.

## 4. Required external receipt fields

The external final closure receipt record should store these redacted
references outside git:

- archive final closure receipt id reference;
- archive final closure outcome reference;
- archive owner signoff receipt reference;
- retention follow-up receipt reference;
- final closure receipt owner reference.

## 5. Commands

```bash
npm run closure:stage6n:report
npm run closure:stage6n:dry-run
npm run preflight:stage6n
```

`npm run preflight:stage6n` runs:

1. Stage 6N unit tests.
2. Stage 6N guard.
3. Stage 6N report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6n-production-release-archive-final-closure-receipt.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6N is ready when:

- `npm run preflight:stage6n` passes;
- Stage 6M is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, external reconciliation
  values, final closure outcome, final closure receipt outcome, or
  patient-identifying content are committed.

The final release archive final closure receipt remains an operator-owned
external record. It is not bundled in this repository.

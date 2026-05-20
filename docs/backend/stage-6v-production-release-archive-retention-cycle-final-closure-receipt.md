# Stage 6V — Production release archive retention cycle final closure receipt

Stage 6V adds the production release archive retention cycle final closure receipt package for
the Stage 6U release
archive retention cycle final closure. It records the schema, gates, and redacted field names
needed by the external archive process, while keeping the actual receipt
values and final archive outcome outside git.

This is still an offline repository contract. It does not approve go-live,
does not verify a live production server, and does not store live evidence,
logs, metrics, credentials, object keys, backup contents, raw archive content,
or patient-identifying content.

## 1. Scope

- Add `deploy/self-hosted/release-archive-retention-cycle-final-closure-receipt.stage6v.json`.
- Add `scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs`.
- Generate redacted offline outputs:
  - `stage6v-production-release-archive-retention-cycle-final-closure-receipt.md`
  - `stage6v-production-release-archive-retention-cycle-final-closure-receipt.json`
- Check that Stage 6U retention cycle final closure is ready before marking this receipt
  package ready.
- Keep external retention cycle final closure receipt contents and final archive closure
  outcomes outside the repository.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains the operator-owned self-hosted frontend, backend,
  PostgreSQL database, object storage, and Device Bridge worker.
- The Stage 6V script performs no network calls.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6U

Stage 6U creates the repository retention cycle final closure package. Stage 6V references
that package and prepares a git-safe retention cycle final closure receipt package for the
external archive process.

The repository may contain:

- retention cycle final closure receipt schema;
- redacted receipt field names;
- required verification gates;
- Stage 6U manifest paths;
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
- external archive retention cycle final closure values;
- external archive retention cycle final closure receipt values;
- final archive receipt outcome;
- final archive reconciliation outcome;
- final archive retention cycle final closure outcome;
- final archive retention cycle final closure receipt outcome.

## 4. Required external receipt fields

The external retention cycle final closure receipt record should store these redacted
references outside git:

- archive retention cycle final closure receipt id reference;
- archive retention cycle final closure id reference;
- archive retention cycle closure receipt id reference;
- archive retention cycle owner final closure receipt reference;
- retention review window final closure receipt reference;
- disposal hold watch final closure receipt reference;
- retention exception register final closure receipt reference;
- retention cycle final closure receipt owner reference.

## 5. Commands

```bash
npm run receipt:stage6v:report
npm run receipt:stage6v:dry-run
npm run preflight:stage6v
```

`npm run preflight:stage6v` runs:

1. Stage 6V unit tests.
2. Stage 6V guard.
3. Stage 6V report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6v-production-release-archive-retention-cycle-final-closure-receipt.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6V is ready when:

- `npm run preflight:stage6v` passes;
- Stage 6U is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, external reconciliation
  values, retention cycle final closure outcome, retention cycle final closure receipt outcome, or
  patient-identifying content are committed.

The final release archive retention cycle final closure receipt remains an operator-owned
external record. It is not bundled in this repository.

# Stage 6P — Production release archive retention register receipt

Stage 6P adds the production release archive retention register receipt package for
the Stage 6O release
archive retention register. It records the schema, gates, and redacted field names
needed by the external archive process, while keeping the actual receipt
values and final archive outcome outside git.

This is still an offline repository contract. It does not approve go-live,
does not verify a live production server, and does not store live evidence,
logs, metrics, credentials, object keys, backup contents, raw archive content,
or patient-identifying content.

## 1. Scope

- Add `deploy/self-hosted/release-archive-retention-register-receipt.stage6p.json`.
- Add `scripts/stage6p-production-release-archive-retention-register-receipt.mjs`.
- Generate redacted offline outputs:
  - `stage6p-production-release-archive-retention-register-receipt.md`
  - `stage6p-production-release-archive-retention-register-receipt.json`
- Check that Stage 6O retention register is ready before marking this receipt
  package ready.
- Keep external retention register receipt contents and final archive closure
  outcomes outside the repository.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains the operator-owned self-hosted frontend, backend,
  PostgreSQL database, object storage, and Device Bridge worker.
- The Stage 6P script performs no network calls.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6O

Stage 6O creates the repository retention register package. Stage 6P references
that package and prepares a git-safe retention register receipt package for the
external archive process.

The repository may contain:

- retention register receipt schema;
- redacted receipt field names;
- required verification gates;
- Stage 6O manifest paths;
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
- external archive retention register values;
- external archive retention register receipt values;
- final archive receipt outcome;
- final archive reconciliation outcome;
- external archive retention outcome;
- external archive retention register receipt outcome.

## 4. Required external receipt fields

The external retention register receipt record should store these redacted
references outside git:

- archive retention receipt id reference;
- archive retention register id reference;
- archive retention owner signoff receipt reference;
- retention review receipt reference;
- disposal hold receipt reference.

## 5. Commands

```bash
npm run receipt:stage6p:report
npm run receipt:stage6p:dry-run
npm run preflight:stage6p
```

`npm run preflight:stage6p` runs:

1. Stage 6P unit tests.
2. Stage 6P guard.
3. Stage 6P report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6p-production-release-archive-retention-register-receipt.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6P is ready when:

- `npm run preflight:stage6p` passes;
- Stage 6O is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, external reconciliation
  values, retention register outcome, retention register receipt outcome, or
  patient-identifying content are committed.

The final release archive retention register receipt remains an operator-owned
external record. It is not bundled in this repository.

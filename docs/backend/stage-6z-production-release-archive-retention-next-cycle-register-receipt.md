# Stage 6Z — Production release archive retention next-cycle register receipt

Stage 6Z adds the production release archive retention next-cycle register receipt package for
the Stage 6Y release
archive retention next-cycle register. It records the schema, gates, and redacted field names
needed by the external archive process, while keeping the actual receipt
values and final archive outcome outside git.

This is still an offline repository contract. It does not approve go-live,
does not verify a live production server, and does not store live evidence,
logs, metrics, credentials, object keys, backup contents, raw archive content,
or patient-identifying content.

## 1. Scope

- Add `deploy/self-hosted/release-archive-retention-next-cycle-register-receipt.stage6z.json`.
- Add `scripts/stage6z-production-release-archive-retention-next-cycle-register-receipt.mjs`.
- Generate redacted offline outputs:
  - `stage6z-production-release-archive-retention-next-cycle-register-receipt.md`
  - `stage6z-production-release-archive-retention-next-cycle-register-receipt.json`
- Check that Stage 6Y retention next-cycle register is ready before marking this receipt
  package ready.
- Keep external retention next-cycle register receipt contents and final archive closure
  outcomes outside the repository.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains the operator-owned self-hosted frontend, backend,
  PostgreSQL database, object storage, and Device Bridge worker.
- The Stage 6Z script performs no network calls.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6Y

Stage 6Y creates the repository retention next-cycle register package. Stage 6Z references
that package and prepares a git-safe retention next-cycle register receipt package for the
external archive process.

The repository may contain:

- retention next-cycle register receipt schema;
- redacted receipt field names;
- required verification gates;
- Stage 6Y manifest paths;
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
- external archive retention next-cycle register values;
- external archive retention next-cycle register receipt values;
- final archive receipt outcome;
- final archive reconciliation outcome;
- external archive retention outcome;
- external archive retention next-cycle register receipt outcome.

## 4. Required external receipt fields

The external retention next-cycle register receipt record should store these redacted
references outside git:

- archive retention receipt id reference;
- archive retention next-cycle register id reference;
- archive retention owner signoff receipt reference;
- retention review receipt reference;
- disposal hold receipt reference.

## 5. Commands

```bash
npm run receipt:stage6z:report
npm run receipt:stage6z:dry-run
npm run preflight:stage6z
```

`npm run preflight:stage6z` runs:

1. Stage 6Z unit tests.
2. Stage 6Z guard.
3. Stage 6Z report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6z-production-release-archive-retention-next-cycle-register-receipt.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6Z is ready when:

- `npm run preflight:stage6z` passes;
- Stage 6Y is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, external reconciliation
  values, retention next-cycle register outcome, retention next-cycle register receipt outcome, or
  patient-identifying content are committed.

The final release archive retention next-cycle register receipt remains an operator-owned
external record. It is not bundled in this repository.

## 8. Next stage

Stage 7A is a hypothesis until repository files define it. Stage 6Z only
records that the next-cycle retention register receipt can be prepared while
external receipt values and final outcomes remain outside git.

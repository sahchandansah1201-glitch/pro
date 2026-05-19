# Stage 6Q — Production release archive retention cycle index

Stage 6Q adds the production release archive retention cycle index package for
the Stage 6P release archive retention register receipt. It records the schema,
gates, redacted field names, and safe repository pointers needed by the next
external archive retention cycle, while keeping the actual cycle values and
final retention outcome outside git.

This is an offline repository contract. It does not approve go-live, does not
verify a live production server, and does not store live evidence, logs,
metrics, credentials, object keys, backup contents, raw archive contents,
retention-cycle values, or patient-identifying content.

## 1. Scope

- Add `deploy/self-hosted/release-archive-retention-cycle-index.stage6q.json`.
- Add `scripts/stage6q-production-release-archive-retention-cycle-index.mjs`.
- Generate redacted offline outputs:
  - `stage6q-production-release-archive-retention-cycle-index.md`
  - `stage6q-production-release-archive-retention-cycle-index.json`
- Check that Stage 6P retention register receipt is ready before marking this
  cycle index package ready.
- Keep external retention cycle index contents, owner roster values, review
  windows, disposal hold watches, exception registers, and final retention
  cycle outcomes outside the repository.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains the operator-owned self-hosted frontend, backend,
  PostgreSQL database, object storage, and Device Bridge worker.
- The Stage 6Q script performs no network calls.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6P

Stage 6P creates the repository retention register receipt package. Stage 6Q
references that package and prepares a git-safe retention cycle index package
for the external archive process.

The repository may contain:

- retention cycle index schema;
- redacted external cycle field names;
- required verification gates;
- Stage 6P manifest paths;
- Stage 6O and Stage 6I reference paths;
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
- external archive retention cycle values;
- retention review window values;
- retention owner roster values;
- disposal hold watch values;
- retention exception register values;
- archive disposition authority values;
- final archive retention cycle outcome.

## 4. Required external cycle fields

The external retention cycle index record should store these redacted
references outside git:

- archive retention cycle index id reference;
- next retention review window reference;
- retention cycle owner reference;
- disposal hold watch reference;
- retention exception register reference;
- archive disposition authority reference.

## 5. Commands

```bash
npm run cycle:stage6q:report
npm run cycle:stage6q:dry-run
npm run preflight:stage6q
```

`npm run preflight:stage6q` runs:

1. Stage 6Q unit tests.
2. Stage 6Q guard.
3. Stage 6Q report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6q-production-release-archive-retention-cycle-index.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6Q is ready when:

- `npm run preflight:stage6q` passes;
- Stage 6P is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, external reconciliation
  values, retention register outcome, retention register receipt outcome,
  retention cycle index values, or patient-identifying content are committed.

The final release archive retention cycle index remains an operator-owned
external record. It is not bundled in this repository.

# Stage 6O — Production release archive retention register

Stage 6O adds the production release archive retention register package on top
of the Stage 6N release archive final closure receipt. It records the schema,
gates, and redacted field names needed to track retention ownership, retention
schedules, disposal holds, and retention review references outside git.

This is still an offline repository contract. It does not approve go-live,
does not verify a live production server, and does not store live evidence,
logs, metrics, credentials, object keys, backup contents, raw archive content,
retention schedules, disposal hold values, or patient-identifying content.

## 1. Scope

- Add `deploy/self-hosted/release-archive-retention-register.stage6o.json`.
- Add `scripts/stage6o-production-release-archive-retention-register.mjs`.
- Generate redacted offline outputs:
  - `stage6o-production-release-archive-retention-register.md`
  - `stage6o-production-release-archive-retention-register.json`
- Check that Stage 6N final closure receipt is ready before marking the
  retention register package ready.
- Keep external retention register contents, retention schedules, disposal
  holds, retention review values, and archive retention outcomes outside the
  repository.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains the operator-owned self-hosted frontend, backend,
  PostgreSQL database, object storage, and Device Bridge worker.
- The Stage 6O script performs no network calls.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6N

Stage 6N creates the repository final closure receipt package. Stage 6O
references that package and prepares a git-safe retention register for the
external archive owner.

The repository may contain:

- retention register schema;
- redacted retention field names;
- required verification gates;
- Stage 6N manifest paths;
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
- retention schedules;
- disposal hold values;
- retention review evidence;
- archive retention outcome.

## 4. Required external retention fields

The external archive retention register should store these redacted references
outside git:

- archive retention register id reference;
- archive retention schedule reference;
- archive retention owner reference;
- archive disposal hold reference;
- retention review receipt reference.

## 5. Commands

```bash
npm run retention:stage6o:report
npm run retention:stage6o:dry-run
npm run preflight:stage6o
```

`npm run preflight:stage6o` runs:

1. Stage 6O unit tests.
2. Stage 6O guard.
3. Stage 6O report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6o-production-release-archive-retention-register.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6O is ready when:

- `npm run preflight:stage6o` passes;
- Stage 6N is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, external receipt values, external reconciliation
  values, final closure values, final closure receipt values, retention
  schedules, disposal holds, retention review evidence, retention outcome, or
  patient-identifying content are committed.

The final archive retention register remains an operator-owned external
record. It is not bundled in this repository.

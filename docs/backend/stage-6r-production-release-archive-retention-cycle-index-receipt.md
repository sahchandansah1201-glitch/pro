# Stage 6R — Production release archive retention cycle index receipt

Stage 6R adds the production release archive retention cycle index receipt
package for the self-hosted release archive chain. It references the Stage 6Q
retention cycle index package and records the repository-safe schema for the
external operator receipt without committing the receipt values.

## Scope

- Create a deterministic receipt package for the Stage 6Q retention cycle index.
- Confirm that the Stage 6Q cycle index is ready before this receipt is ready.
- Keep the receipt schema, redacted field names, commands, and product boundary
  in git.
- Keep external receipt values, retention review window values, disposal hold
  watch values, exception register values, live logs, archive contents, patient
  identity, credentials, and final archive retention cycle receipt outcome
  outside git.

## Product Boundary

- Deployment: operator-owned self-hosted production install.
- Frontend: static React build served by nginx.
- Backend: Node self-hosted API.
- Database: operator-owned PostgreSQL.
- Object storage: operator-owned object storage or local filesystem volume.
- Worker: operator-owned Device Bridge worker.
- Managed runtime/database dependency: none.
- Runtime calls external systems: false.
- Demo fallback in production: false.

## Relation To Stage 6Q

Stage 6Q creates the repository-safe release archive retention cycle index.
Stage 6R creates the repository-safe receipt package that points to the
external receipt record proving that the operator accepted or recorded that
cycle index outside git.

The repository stores:

- retention cycle index receipt schema;
- redacted receipt field names;
- repository evidence pointers;
- required verification commands;
- self-hosted product boundary.

The repository must not store:

- external retention cycle index receipt values;
- external retention cycle owner values;
- external retention review window values;
- external disposal hold watch values;
- external retention exception register values;
- live logs or metrics;
- patient-identifying content;
- credentials;
- backup contents;
- archive contents;
- final archive retention cycle receipt outcome.

## External Receipt Fields

The external receipt record should store these redacted references outside git:

- archive retention cycle index receipt id reference;
- archive retention cycle index id reference;
- archive retention cycle owner signoff receipt reference;
- retention review window receipt reference;
- disposal hold watch receipt reference;
- retention exception register receipt reference.

## Commands

```bash
npm run test:stage6r
npm run check:stage6r
npm run receipt:stage6r:dry-run
npm run receipt:stage6r:report
npm run preflight:stage6r
```

`npm run preflight:stage6r` runs:

1. Stage 6R unit tests.
2. Stage 6R guard.
3. Stage 6R report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## CI

Workflow:

```text
.github/workflows/stage6r-production-release-archive-retention-cycle-index-receipt.yml
```

The workflow runs `npm run preflight:stage6r`, renders the Stage 6R receipt
report, uploads the Markdown/JSON report artifacts, and writes a short
`GITHUB_STEP_SUMMARY`.

## Release Rule

Stage 6R is ready when:

- `npm run preflight:stage6q` passes.
- `npm run preflight:stage6r` passes.
- `npm run check:project-memory` passes.
- No external receipt values, live logs, metrics, archive contents, credentials,
  retention cycle values, or patient-identifying content are committed.

The final release archive retention cycle index receipt remains an
operator-owned external record. The repository only stores deterministic,
redacted receipt structure and verification entrypoints.

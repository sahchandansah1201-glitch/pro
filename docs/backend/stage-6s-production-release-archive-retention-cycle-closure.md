# Stage 6S — Production release archive retention cycle closure

Stage 6S adds the production release archive retention cycle closure
package for the self-hosted release archive chain. It references the Stage 6Q
retention cycle index and Stage 6R retention cycle index receipt packages and
records the repository-safe schema for the external operator closure without
committing the closure values.

## Scope

- Create a deterministic closure package for the Stage 6R retention cycle index
  receipt.
- Confirm that the Stage 6R cycle index receipt is ready before this closure is
  ready.
- Keep the closure schema, redacted field names, commands, and product boundary
  in git.
- Keep external closure values, retention review window values, disposal hold
  watch values, exception register values, live logs, archive contents, patient
  identity, credentials, and final archive retention cycle closure outcome
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

## Relation To Stage 6R

Stage 6R creates the repository-safe release archive retention cycle index
receipt. Stage 6S creates the repository-safe closure package that points to the
external closure record proving that the operator closed or recorded the
retention cycle outside git.

Stage 6S may be rendered later than Stage 6R, so the Stage 6S `--now` value is
only the closure generation timestamp. Nested readiness checks keep using the
referenced stage manifest timestamps:

- Stage 6S evaluates Stage 6R with the Stage 6R cycle index receipt manifest
  timestamp.
- Stage 6R evaluates Stage 6Q with the Stage 6Q cycle index manifest timestamp.
- Stage 6Q evaluates Stage 6P with the Stage 6P retention receipt manifest
  timestamp.
- Stage 6P evaluates Stage 6O with the Stage 6O retention register manifest
  timestamp.
- Stage 6O evaluates Stage 6N with the Stage 6N final closure receipt manifest
  timestamp.

This keeps a later Stage 6S closure render from changing the readiness result
of already finalized release archive retention stages.

The repository stores:

- retention cycle closure schema;
- redacted closure field names;
- repository evidence pointers;
- required verification commands;
- self-hosted product boundary.

The repository must not store:

- external retention cycle closure values;
- external retention cycle owner values;
- external retention review window values;
- external disposal hold watch values;
- external retention exception register values;
- live logs or metrics;
- patient-identifying content;
- credentials;
- backup contents;
- archive contents;
- final archive retention cycle closure outcome.

## External Closure Fields

The external closure record should store these redacted references outside git:

- archive retention cycle closure id reference;
- archive retention cycle index receipt id reference;
- archive retention cycle owner closure reference;
- retention review window closure reference;
- disposal hold watch closure reference;
- retention exception register closure reference.

## Commands

```bash
npm run test:stage6s
npm run check:stage6s
npm run closure:stage6s:dry-run
npm run closure:stage6s:report
npm run preflight:stage6s
```

`npm run preflight:stage6s` runs:

1. Stage 6S unit tests.
2. Stage 6S guard.
3. Stage 6S report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## CI

Workflow:

```text
.github/workflows/stage6s-production-release-archive-retention-cycle-closure.yml
```

The workflow runs `npm run preflight:stage6s`, renders the Stage 6S closure
report, uploads the Markdown/JSON report artifacts, and writes a short
`GITHUB_STEP_SUMMARY`.

## Release Rule

Stage 6S is ready when:

- `npm run preflight:stage6r` passes.
- `npm run preflight:stage6s` passes.
- `npm run check:project-memory` passes.
- No external closure values, live logs, metrics, archive contents, credentials,
  retention cycle values, or patient-identifying content are committed.

The final release archive retention cycle closure remains an
operator-owned external record. The repository only stores deterministic,
redacted closure structure and verification entrypoints.

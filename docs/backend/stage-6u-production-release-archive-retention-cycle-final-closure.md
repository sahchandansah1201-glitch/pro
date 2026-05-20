# Stage 6U — Production release archive retention cycle final closure

Stage 6U adds the repository-safe final closure package for the Stage 6T
production release archive retention cycle closure receipt.

This is the production release archive retention cycle final closure.

It is intentionally offline and redacted. The repository stores only the final
closure schema, safe file pointers, commands, and self-hosted product boundary.
The actual external final closure record, owner signoff, review-window final
closure, disposal-hold watch final closure, exception-register final closure,
live logs, credentials, patient-identifying content, archive contents, and
final closure outcome remain outside git.

## Scope

- `deploy/self-hosted/release-archive-retention-cycle-final-closure.stage6u.json`
  defines the Stage 6U final closure manifest.
- `scripts/stage6u-production-release-archive-retention-cycle-final-closure.mjs`
  validates the manifest, evaluates Stage 6T using the Stage 6T manifest
  timestamp, renders Markdown/JSON reports, and returns a ready/blocked status.
- `scripts/check-stage6u-production-release-archive-retention-cycle-final-closure.mjs`
  guards required files, package scripts, preflight-all wiring, and managed
  runtime boundary markers.
- `.github/workflows/stage6u-production-release-archive-retention-cycle-final-closure.yml`
  runs the Stage 6U preflight and uploads redacted report artifacts.

## Stage 6T Dependency

Stage 6U depends on the Stage 6T closure receipt package:

```text
deploy/self-hosted/release-archive-retention-cycle-closure-receipt.stage6t.json
```

Stage 6U may be rendered later than Stage 6T. To avoid time-based drift, the
Stage 6U builder evaluates Stage 6T using the Stage 6T manifest timestamp
(`2026-05-19T14:30:00.000Z`) instead of the Stage 6U render timestamp.

The Stage 6U report explicitly records:

- Stage 6T generated-at timestamp.
- Stage 6T status.
- Stage 6T missing required input count.
- Stage 6T leak finding count.
- Whether the external retention cycle final closure records remain outside git.
- Whether the final closure outcome is unknown to the repository.

## Product Boundary

Managed runtime/database dependency: none.

Stage 6U performs no runtime calls to external systems. It does not call
managed services, Supabase, browser hardware APIs, CRM systems, archive
storage, object storage, or the live production server. It only reads bundled
repository files and writes redacted local report artifacts.

The production product boundary remains:

- Frontend: static React build served by nginx.
- Backend: self-hosted Node API.
- Database: operator-owned PostgreSQL.
- Object storage: operator-owned object storage or local filesystem volume.
- Worker: operator-owned Device Bridge worker.

## Commands

```bash
npm run test:stage6u
npm run check:stage6u
npm run closure:stage6u:dry-run
npm run closure:stage6u:report
npm run preflight:stage6u
```

`npm run preflight:stage6u` runs:

1. Stage 6U unit tests.
2. Stage 6U guard.
3. Stage 6U report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## CI

```text
.github/workflows/stage6u-production-release-archive-retention-cycle-final-closure.yml
```

The workflow runs `npm run preflight:stage6u`, renders the Stage 6U final
closure report, uploads the Markdown/JSON report artifacts, and writes a short
GitHub step summary.

## Release Readiness

Stage 6U is ready when:

- `npm run preflight:stage6t` passes.
- `npm run preflight:stage6u` passes.
- `npm run preflight:all -- --dry-run` includes Stage 6U.
- `npm run check:project-memory` confirms Stage 6U as repository-confirmed
  and marks Stage 6V only as a hypothesis.
- `node scripts/check-no-deno-locks.mjs` passes.

Stage 6U does not approve go-live, verify live archive storage, or record the
external final closure outcome. Those remain operator-owned external records.

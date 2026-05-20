# Stage 6T — Production release archive retention cycle closure receipt

Stage 6T adds the repository-safe receipt package for the Stage 6S production
release archive retention cycle closure.

This is the production release archive retention cycle closure receipt.

It is intentionally offline and redacted. The repository stores only the
receipt schema, safe file pointers, commands, and self-hosted product boundary.
The actual external closure receipt record, owner signoff, review-window
receipt, disposal-hold watch receipt, exception-register receipt, live logs,
credentials, patient-identifying content, archive contents, and final receipt
outcome remain outside git.

## Scope

- `deploy/self-hosted/release-archive-retention-cycle-closure-receipt.stage6t.json`
  defines the Stage 6T receipt manifest.
- `scripts/stage6t-production-release-archive-retention-cycle-closure-receipt.mjs`
  validates the manifest, evaluates Stage 6S using the Stage 6S manifest
  timestamp, renders Markdown/JSON reports, and returns a ready/blocked status.
- `scripts/check-stage6t-production-release-archive-retention-cycle-closure-receipt.mjs`
  guards required files, package scripts, preflight-all wiring, and managed
  runtime boundary markers.
- `.github/workflows/stage6t-production-release-archive-retention-cycle-closure-receipt.yml`
  runs the Stage 6T preflight and uploads redacted report artifacts.

## Stage 6S Dependency

Stage 6T depends on the Stage 6S closure package:

```text
deploy/self-hosted/release-archive-retention-cycle-closure.stage6s.json
```

Stage 6T may be rendered later than Stage 6S. To avoid time-based drift, the
Stage 6T builder evaluates Stage 6S using the Stage 6S manifest timestamp
(`2026-05-19T14:00:00.000Z`) instead of the Stage 6T render timestamp.

The Stage 6T report explicitly records:

- Stage 6S generated-at timestamp.
- Stage 6S status.
- Stage 6S missing required input count.
- Stage 6S leak finding count.
- Whether the external retention cycle closure receipt remains outside git.
- Whether the closure receipt outcome is unknown to the repository.

## Product Boundary

Managed runtime/database dependency: none.

Stage 6T performs no runtime calls to external systems. It does not call
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
npm run test:stage6t
npm run check:stage6t
npm run receipt:stage6t:dry-run
npm run receipt:stage6t:report
npm run preflight:stage6t
```

`npm run preflight:stage6t` runs:

1. Stage 6T unit tests.
2. Stage 6T guard.
3. Stage 6T report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## CI

```text
.github/workflows/stage6t-production-release-archive-retention-cycle-closure-receipt.yml
```

The workflow runs `npm run preflight:stage6t`, renders the Stage 6T closure
receipt report, uploads the Markdown/JSON report artifacts, and writes a short
GitHub step summary.

## Release Readiness

Stage 6T is ready when:

- `npm run preflight:stage6s` passes.
- `npm run preflight:stage6t` passes.
- `npm run preflight:all -- --dry-run` includes Stage 6T.
- `npm run check:project-memory` confirms Stage 6T as repository-confirmed
  and marks Stage 6U only as a hypothesis.
- `node scripts/check-no-deno-locks.mjs` passes.

Stage 6T does not approve go-live, verify live archive storage, or record the
external closure receipt outcome. Those remain operator-owned external records.

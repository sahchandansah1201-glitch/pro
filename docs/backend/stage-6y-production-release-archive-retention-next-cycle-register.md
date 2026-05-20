# Stage 6Y — Production release archive retention next-cycle register

Stage 6Y starts the next release archive retention cycle after Stage 6X
confirmed the prior cycle's final closure reconciliation receipt. It is an
offline, repository-bundled control package for the operator-owned self-hosted
product. It does not approve go-live, verify a live archive, or store external
retention-cycle decisions in git.

## Scope

This stage adds:

- `deploy/self-hosted/release-archive-retention-next-cycle-register.stage6y.json`
- `scripts/stage6y-production-release-archive-retention-next-cycle-register.mjs`
- report outputs:
  - `stage6y-production-release-archive-retention-next-cycle-register.md`
  - `stage6y-production-release-archive-retention-next-cycle-register.json`
- guard/test coverage and CI wiring for the Stage 6Y package
- project-memory updates that mark Stage 6Y confirmed and Stage 6Z as
  hypothesis

## Product boundary

Managed runtime/database dependency: none.

Stage 6Y stays inside the self-hosted product boundary:

- frontend: static React build served by nginx;
- backend: Node self-hosted API;
- database: operator-owned PostgreSQL;
- object storage: operator-owned storage/local filesystem volume;
- worker: operator-owned Device Bridge worker.

The Stage 6Y tooling performs no network calls and has no dependency on
managed runtimes, managed databases, browser hardware APIs, external CRM APIs,
or Supabase.

## External records

The external archive retention next-cycle records stay outside git.

The repository may store:

- redacted next-cycle retention register schema;
- self-hosted product boundary;
- deterministic local preflight commands;
- placeholders for external retention-owner records.

The repository must not store:

- external retention next-cycle identifiers or signatures;
- external retention owner credentials;
- live archive retention decisions;
- patient identifiers;
- tokens, cookies, signed URLs, storage paths, or managed runtime credentials.

## Inputs

The register is derived from repository evidence:

- Stage 6X final closure reconciliation receipt package;
- Stage 6X generator;
- Stage 6W final closure reconciliation package;
- project-memory handoff;
- deterministic preflight-all orchestrator;
- backend guardrails workflow;
- Stage 6X workflow.

## Commands

```bash
npm run register:stage6y:report
npm run register:stage6y:dry-run
npm run preflight:stage6y
```

`npm run preflight:stage6y` runs:

1. Stage 6Y unit tests.
2. Stage 6Y guard.
3. Stage 6Y report generation.
4. `node scripts/check-no-deno-locks.mjs`.

## CI

`.github/workflows/stage6y-production-release-archive-retention-next-cycle-register.yml`
runs the Stage 6Y preflight on pull requests and pushes touching Stage 6Y
files, project-memory, package scripts, or preflight wiring.

## Release checklist

Stage 6Y is ready when:

- `npm run preflight:stage6y` passes;
- `npm run preflight:all -- --dry-run` lists Stage 6Y;
- `npm run check:project-memory` passes;
- `node scripts/check-no-deno-locks.mjs` passes;
- `package-lock.json` remains unchanged unless dependencies intentionally
  change.

## Next stage

Stage 6Z is a hypothesis until repository files define it. The Stage 6Y package
only records that a next-cycle retention register can be prepared; external
next-cycle retention decisions remain operator-owned records outside git.

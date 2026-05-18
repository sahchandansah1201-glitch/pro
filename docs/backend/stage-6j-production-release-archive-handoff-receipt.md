# Stage 6J — Production release archive handoff receipt

Stage 6J turns the Stage 6I production release archive index into a
git-safe archive handoff receipt package. It is still a repository-side
contract: it does not approve go-live, does not prove that a live production
server was archived, and does not store live archive contents or final archive
receipt outcome.

This is the production release archive handoff receipt for the self-hosted
release flow.

## 1. Scope

- Add `deploy/self-hosted/release-archive-handoff-receipt.stage6j.json`.
- Add `scripts/stage6j-production-release-archive-handoff-receipt.mjs`.
- Generate redacted offline outputs:
  - `stage6j-production-release-archive-handoff-receipt.md`
  - `stage6j-production-release-archive-handoff-receipt.json`
- Check the Stage 6I archive index readiness.
- Keep the real archive, archive media, checksum manifest, restore-drill
  proof, archive owner record, and final receipt outcome outside git.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains operator-owned self-hosted frontend, backend,
  PostgreSQL, object storage, and Device Bridge worker.
- This package performs no network calls and does not read live production
  logs, live metrics, raw patient records, credentials, object keys, backup
  contents, or final archive contents.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6I

Stage 6I prepares the release archive index. Stage 6J checks that Stage 6I is
ready, then prepares a repository-safe receipt package for the external archive
handoff.

The repository may contain:

- receipt schema;
- redacted receipt field names;
- required gates;
- Stage 6I manifest paths;
- output templates.

The repository must not contain:

- final go-live approval;
- live-server verification proof;
- raw live logs;
- live metrics;
- patient-identifying content;
- credentials or object-storage keys;
- backup contents;
- external archive contents;
- final archive receipt outcome.

## 4. Required external receipt fields

The external receipt should store these redacted references outside git:

- archive receipt id;
- archive owner reference;
- archive location reference;
- archive media reference;
- checksum manifest reference;
- restore-drill evidence reference;
- retention policy reference;
- receipt owner reference.

## 5. Commands

```bash
npm run receipt:stage6j:report
npm run receipt:stage6j:dry-run
npm run preflight:stage6j
```

`npm run preflight:stage6j` runs:

1. Stage 6J unit tests.
2. Stage 6J guard.
3. Stage 6J report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6j-production-release-archive-handoff-receipt.yml`
runs the same focused preflight and uploads the redacted markdown/JSON outputs
when they are produced.

## 7. Release rule

Stage 6J is ready when:

- `npm run preflight:stage6j` passes;
- Stage 6I is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, archive contents, final receipt outcome, or patient-identifying
  content are committed.

The final release archive receipt remains an operator-owned external record.
It is not bundled in this repository.

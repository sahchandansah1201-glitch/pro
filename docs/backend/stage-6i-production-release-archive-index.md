# Stage 6I — Production release archive index

Stage 6I turns the Stage 6H production release memory closure package into a
git-safe release archive index. It is still a repository-side contract:
it does not approve go-live, it does not prove that a live server was closed,
and it does not store live production logs, metrics, patient data, credentials,
object keys, backup contents, or the final external archive.

This is the production release archive index for the self-hosted release flow.

## 1. Scope

- Add `deploy/self-hosted/release-archive-index.stage6i.json`.
- Add `scripts/stage6i-production-release-archive-index.mjs`.
- Generate redacted offline outputs:
  - `stage6i-production-release-archive-index.md`
  - `stage6i-production-release-archive-index.json`
- Index the Stage 6A-6H repository manifests and required external archive
  record pointers.
- Keep all real archive contents outside git.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains operator-owned self-hosted frontend, backend,
  PostgreSQL, object storage, and Device Bridge worker.
- This package performs no network calls and does not read live production
  logs, live metrics, raw patient records, credentials, object keys, backup
  contents, or the operator's final archive.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6H

Stage 6H prepares the release memory closure package. Stage 6I checks that
Stage 6H is ready, then builds a repository-safe index of what belongs in the
external release archive.

The repository may contain:

- the archive index structure;
- redacted field names;
- required gates;
- Stage 6A-6H manifest paths;
- output templates.

The repository must not contain:

- final go-live approval;
- live-server verification proof;
- raw live logs;
- live metrics;
- patient-identifying content;
- credentials or object-storage keys;
- backup contents;
- the operator's final release archive.

## 4. Required external archive records

The external archive should store these redacted references outside git:

- live install evidence location;
- go-live decision record location;
- post-go-live observation evidence location;
- release memory closure location;
- operator archive owner reference;
- archive retention policy reference.

## 5. Commands

```bash
npm run archive:stage6i:report
npm run archive:stage6i:dry-run
npm run preflight:stage6i
```

`npm run preflight:stage6i` runs:

1. Stage 6I unit tests.
2. Stage 6I guard.
3. Stage 6I report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6i-production-release-archive-index.yml` runs the
same focused preflight and uploads the redacted markdown/JSON outputs when
they are produced.

## 7. Release rule

Stage 6I is ready when:

- `npm run preflight:stage6i` passes;
- Stage 6H is ready;
- every Stage 6A-6H manifest path is present;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, external archive contents, or patient-identifying content are
  committed.

The final release archive and archive outcome remain operator-owned external
records. They are not bundled in this repository.

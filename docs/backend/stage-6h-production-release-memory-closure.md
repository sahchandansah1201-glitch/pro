# Stage 6H — Production release memory closure

Stage 6H turns the Stage 6G post-go-live observation package into a git-safe
release memory closure package. It is still a repository-side contract:
it does not approve go-live, it does not prove that a live server was closed,
and it does not store live production logs or metrics.

This is the production release memory closure package for the self-hosted
release flow.

## 1. Scope

- Add `deploy/self-hosted/release-memory-closure.stage6h.json`.
- Add `scripts/stage6h-production-release-memory-closure.mjs`.
- Generate redacted offline outputs:
  - `stage6h-production-release-memory-closure.md`
  - `stage6h-production-release-memory-closure.json`
- Keep all real closure evidence outside git.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains operator-owned self-hosted frontend, backend,
  PostgreSQL, object storage, and Device Bridge worker.
- This package performs no network calls and does not read live production
  logs, live metrics, raw patient records, credentials, object keys, or backup
  contents.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6G

Stage 6G prepares the external post-go-live observation contract. Stage 6H
checks that the Stage 6G package is ready, then prepares the release memory
closure contract that an operator can use outside the repository.

The repository may contain:

- checklist structure;
- redacted field names;
- required gates;
- output templates.

The repository must not contain:

- final go-live approval;
- live-server verification proof;
- raw live logs;
- live metrics;
- patient-identifying content;
- credentials or object-storage keys;
- backup contents.

## 4. Required external closure fields

The external closure record should store these redacted references outside
git:

- closure record id;
- closure window start/end;
- operator decision reference;
- health-check evidence reference;
- production smoke evidence reference;
- audit review reference;
- rollback owner reference;
- closure owner reference.

## 5. Commands

```bash
npm run closure:stage6h:report
npm run closure:stage6h:dry-run
npm run preflight:stage6h
```

`npm run preflight:stage6h` runs:

1. Stage 6H unit tests.
2. Stage 6H guard.
3. Stage 6H report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6h-production-release-memory-closure.yml` runs the
same focused preflight and uploads the redacted markdown/JSON outputs when
they are produced.

## 7. Release rule

Stage 6H is ready when:

- `npm run preflight:stage6h` passes;
- Stage 6G is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, or patient-identifying content are committed.

The final release memory closure outcome remains an operator-owned external
record. It is not bundled in this repository.

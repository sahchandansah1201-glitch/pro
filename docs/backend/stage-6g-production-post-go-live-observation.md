# Stage 6G — Production post-go-live observation

Stage 6G turns the Stage 6F decision-record contract into a git-safe
post-go-live observation package. It is still a repository-side contract:
it does not approve go-live, it does not prove that a live server was observed,
and it does not store live production logs or metrics.

This is the production post-go-live observation package for the self-hosted
release flow.

## 1. Scope

- Add `deploy/self-hosted/post-go-live-observation.stage6g.json`.
- Add `scripts/stage6g-production-post-go-live-observation.mjs`.
- Generate redacted offline outputs:
  - `stage6g-production-post-go-live-observation.md`
  - `stage6g-production-post-go-live-observation.json`
- Keep all real observation evidence outside git.

## 2. Product boundary

- Managed runtime/database dependency: none.
- Runtime product remains operator-owned self-hosted frontend, backend,
  PostgreSQL, object storage, and Device Bridge worker.
- This package performs no network calls and does not read live production
  logs, live metrics, raw patient records, credentials, object keys, or backup
  contents.
- Production mode remains no-demo-fallback.

## 3. Relationship to Stage 6F

Stage 6F prepares the external go-live decision record. Stage 6G checks that
the Stage 6F package is ready, then prepares the post-go-live observation
contract that an operator can use outside the repository.

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

## 4. Required external observation fields

The external observation record should store these redacted references outside
git:

- observation record id;
- observation window start/end;
- operator decision reference;
- health-check evidence reference;
- production smoke evidence reference;
- audit review reference;
- rollback owner reference;
- observation owner reference.

## 5. Commands

```bash
npm run observation:stage6g:report
npm run observation:stage6g:dry-run
npm run preflight:stage6g
```

`npm run preflight:stage6g` runs:

1. Stage 6G unit tests.
2. Stage 6G guard.
3. Stage 6G report generation in dry-run mode.
4. `node scripts/check-no-deno-locks.mjs`.

## 6. CI

`.github/workflows/stage6g-production-post-go-live-observation.yml` runs the
same focused preflight and uploads the redacted markdown/JSON outputs when
they are produced.

## 7. Release rule

Stage 6G is ready when:

- `npm run preflight:stage6g` passes;
- Stage 6F is ready;
- no `deno.lock` files exist;
- no live evidence, live logs, live metrics, secrets, object keys, backup
  contents, or patient-identifying content are committed.

The final post-go-live observation outcome remains an operator-owned external
record. It is not bundled in this repository.

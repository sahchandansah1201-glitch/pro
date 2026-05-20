# Stage 7D-7F — Batch automation contract

Stage 7D-7F turns the Stage 7A-7C working contract into executable
repository checks. It is a process batch, not a product runtime change.

## 1. Scope

- Stage 7D: add a machine-readable batch manifest.
- Stage 7E: add a merge-before-Lovable handoff gate.
- Stage 7F: refresh project-memory rules and artifacts for the next batch.

These three stages belong in one Pull request because they enforce the same
development workflow and make future larger related-stage batches less
ambiguous.

## 2. Operator contract

Lovable prompt remains blocked until all of these facts are true:

- The Pull request is merged into `main`.
- Local branch is `main`.
- Local `main` is verified after the merge.
- `npm run preflight:stage7d-7f` passes.
- `npm run check:project-memory` passes.
- `node scripts/check-no-deno-locks.mjs` passes.

## 3. Commands

```bash
npm run test:stage7d-7f
npm run check:stage7d-7f
npm run handoff:stage7d-7f:dry-run
npm run preflight:stage7d-7f
npm run preflight:all -- --dry-run
```

## 4. Product boundary

- Runtime product change: none.
- Backend schema change: none.
- Frontend runtime change: none.
- Managed runtime/database dependency: none.
- Browser hardware APIs: none.

## 5. Batch rule

Future normal development remains at least three related stages per Pull
request. Smaller PRs still require a documented urgent CI fix, security fix,
single-file typo, or hotfix reason.

## 6. Next hypothesis

Stage 7G is the next hypothesis after this batch. Its scope is not confirmed
until repository files define it.

# Stage 7A-7C - Development workflow contract

## Purpose

Stage 7A-7C converts repeated operator instructions into a repository-enforced
workflow contract.

- Stage 7A: Codex owns branch, commit, push, Pull request, checks, merge, and
  post-merge verification before Lovable prompt.
- Stage 7B: Future work defaults to larger related batches with at least three
  related stages per Pull request.
- Stage 7C: Future batches use a planning template before implementation.

## Files

- `deploy/self-hosted/development-workflow-contract.stage7a-7c.json`
- `docs/project-memory/WORKING_CONTRACT.md`
- `docs/project-memory/BATCH_TEMPLATE.md`
- `scripts/check-stage7a-7c-development-workflow-contract.mjs`
- `.github/workflows/stage7a-7c-development-workflow-contract.yml`

## Verification

```bash
npm run test:stage7a-7c
npm run check:stage7a-7c
npm run preflight:stage7a-7c
npm run check:project-memory
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

## Lovable rule

The Lovable prompt is sent only after the Pull request is merged into `main` and
local `main` is verified. A prompt for an open Pull request branch is considered
invalid unless the project is explicitly switched to that branch.

## Batch size rule

The default batch size is at least three related stages per Pull request. Smaller
PRs need a documented reason: urgent CI fix, security fix, single-file typo, or
hotfix.

## Product boundary

Managed runtime/database dependency: none.

Stage 7A-7C does not add product runtime behavior, backend routes, database
migrations, frontend pages, device APIs, or external service dependencies.

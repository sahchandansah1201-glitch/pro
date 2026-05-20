# Stage 7G-7I — Batch verification loop

Stage 7G-7I closes the loop created by Stage 7A-7F. It keeps larger Codex
batches moving quickly while making the merge-before-Lovable rule harder to
skip.

- Stage 7G: Batch readiness reporter.
- Stage 7H: Lovable sync verification manifest.
- Stage 7I: Batch drift guard.

This is a process/control batch. It does not alter product runtime behavior.

## Artifacts

- `deploy/self-hosted/batch-verification-loop.stage7g-7i.json`
- `scripts/stage7g-7i-batch-readiness.mjs`
- `scripts/stage7g-7i-batch-readiness.test.mjs`
- `scripts/check-stage7g-7i-batch-verification-loop.mjs`
- `scripts/check-stage7g-7i-batch-verification-loop.test.mjs`
- `.github/workflows/stage7g-7i-batch-verification-loop.yml`

## Stage 7G: Batch readiness reporter

`npm run readiness:stage7g-7i:dry-run` renders a redacted markdown report with:

- included stages;
- required checks;
- product-boundary claims;
- blocked Lovable prompt gates;
- generated post-merge Lovable prompt.

The report intentionally starts as `blocked` until the Pull request is merged,
local `main` is verified, GitHub checks pass, project-memory passes, the drift
guard passes, `package-lock.json` is unchanged, and `deno.lock` is absent.

## Stage 7H: Lovable sync verification manifest

The manifest records the exact files and commands Lovable must verify after the
PR is merged into `main`. This prevents each prompt from becoming a hand-written
variant with missing checks.

The expected confirmation is:

`Confirmed: Stage 7G-7I synced from main, no conflicts.`

## Stage 7I: Batch drift guard

`npm run check:stage7g-7i` fails if these drift apart:

- manifest;
- reporter exports;
- docs;
- workflow;
- package scripts;
- `preflight-all` label;
- project-memory confirmed stage and next hypothesis.

## Verification

```bash
npm run test:stage7g-7i
npm run check:stage7g-7i
npm run readiness:stage7g-7i:dry-run
npm run preflight:stage7g-7i
npm run check:project-memory
node scripts/check-no-deno-locks.mjs
```

## Product Boundary

- Runtime product change: false
- Backend schema change: false
- Frontend runtime change: false
- Managed runtime/database dependency: none
- Browser hardware API dependency: false

Stage 7J is the next hypothesis after this batch. Its scope is not confirmed
until repository files define it.

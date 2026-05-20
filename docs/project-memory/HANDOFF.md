# HANDOFF

## Scope

This handoff captures the repository state while Stage 7D-7F is being
implemented on branch `codex/stage7d-7f-batch-automation-contract`.

## Confirmed state

1. Stage 6A-6Z and Stage 7A-7C are present on the current branch base.
2. Current branch base commit:
   - `114de32 Add Stage 7A-7C development workflow contract`
3. Stage 7D-7F adds a batch automation contract only:
   - Stage 7D: machine-readable batch manifest.
   - Stage 7E: Lovable prompt gate for merge-before-sync handoff.
   - Stage 7F: project-memory refresh requirements.
4. Stage 7D-7F product boundary:
   - no backend route changes
   - no database migrations
   - no frontend runtime pages
   - no managed runtime or managed database dependency

## Important operational fact

The Lovable sync prompt is valid only after the Pull request is merged into
`main` and local `main` is verified. A prompt for an open PR branch is expected
to produce a false "missing files" result because Lovable follows `main` unless
branch switching is explicitly enabled.

## Hypothesis

- `Stage 7G` is likely next, but its product or process scope is not confirmed
  by repository files yet.

## Immediate continuation recommendation

1. Finish Stage 7D-7F in one Pull request.
2. Run:
   - `npm run preflight:stage7d-7f`
   - `npm run check:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`
3. Create the Pull request, wait for checks, merge into `main`, verify local
   `main`, then send the Lovable sync prompt.
4. Future Stage 7 batches should default to at least three related stages per
   Pull request unless a documented hotfix reason applies.

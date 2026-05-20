# HANDOFF

## Scope

This handoff captures the repository state while Stage 7A-7C is being
implemented on branch `codex/stage7a-7c-development-workflow-contract`.

## Confirmed state

1. Stage 6A-6Z are present on the current branch base.
2. Current branch base commit:
   - `4b3ffdd Add Stage 6Z release archive retention next-cycle register receipt`
3. Stage 7A-7C adds a process contract only:
   - Stage 7A: Codex owns branch, commit, push, Pull request, checks, merge,
     local main verification, then Lovable sync prompt.
   - Stage 7B: future work defaults to at least three related stages per Pull
     request.
   - Stage 7C: future batches use a reusable planning template.
4. Stage 7A-7C product boundary:
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

- `Stage 7D` is likely next, but its product or process scope is not confirmed
  by repository files yet.

## Immediate continuation recommendation

1. Finish Stage 7A-7C in one Pull request.
2. Run:
   - `npm run preflight:stage7a-7c`
   - `npm run check:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`
3. Create the Pull request, wait for checks, merge into `main`, verify local
   `main`, then send the Lovable sync prompt.
4. Future Stage 7 batches should default to at least three related stages per
   Pull request unless a documented hotfix reason applies.

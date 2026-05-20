# HANDOFF

## Scope

This handoff captures the repository state while Stage 7G-7I is being
implemented on branch `codex/stage7g-7i-batch-verification-loop`.

## Confirmed state

1. Stage 6A-6Z, Stage 7A-7C, and Stage 7D-7F are present on the current branch
   base.
   Stage 7D-7F is the confirmed batch automation contract and Lovable prompt
   gate foundation for this batch. The exact Lovable prompt gate rule remains
   active: prompt only after merge into `main` and local `main` verification.
2. Current branch base commit:
   - `ab8a129 Add Stage 7D-7F batch automation contract`
3. Stage 7G-7I adds a batch verification loop only:
   - Stage 7G: readiness reporter for current batch gates.
   - Stage 7H: Lovable sync verification manifest.
   - Stage 7I: drift guard for manifest/docs/workflow/scripts/project-memory.
4. Stage 7G-7I product boundary:
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

- `Stage 7J` is likely next, but its product or process scope is not confirmed
  by repository files yet.

## Immediate continuation recommendation

1. Finish Stage 7G-7I in one Pull request.
2. Run:
   - `npm run preflight:stage7g-7i`
   - `npm run check:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`
3. Create the Pull request, wait for checks, merge into `main`, verify local
   `main`, then send the Lovable sync prompt.
4. Future Stage 7 batches should default to at least three related stages per
   Pull request unless a documented hotfix reason applies.

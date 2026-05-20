# NEXT_ACTIONS

## Highest-confidence next step

Stage 6Y is implemented in the current branch and awaits the normal PR lifecycle.
The next action is to complete the PR lifecycle before any Lovable sync prompt.

## Immediate sequence

1. **Merge Stage 6Y to `main` first**:
   - Create/push the Stage 6Y Pull request.
   - Wait for checks.
   - Merge into `main`.
   - Verify local `main` contains Stage 6Y files and `npm run preflight:stage6y`
     passes.

2. **Confirm Stage 6Y in Lovable**:
   - Ask Lovable to verify Stage 6Y files from `main`.
   - Treat "Stage 6Y missing" as a sync issue only after checking that Lovable
     is pointed at `main`.

3. **Define Stage 6Z scaffold (hypothesis)**:
   - Hypothesis: Stage 6Z follows Stage 6Y.
   - Basis: Stage 6A-6Y exist in the current branch; Stage 6Z files are not
     confirmed.
   - Do not implement Stage 6Z until Stage 6Y is merged and confirmed in
     Lovable.

## Verification commands to keep using

- `npm run preflight:stage6w`
- `npm run preflight:stage6x`
- `npm run preflight:stage6y`
- `npm run check:project-memory`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6Z is not the intended target

Treat any Stage 6Z scope as unconfirmed until repository files or an explicit
user instruction define it.

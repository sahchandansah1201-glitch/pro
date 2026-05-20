# NEXT_ACTIONS

## Highest-confidence next step

Stage 6Z is implemented in the current branch and awaits the normal PR lifecycle.
The next action is to complete the PR lifecycle before any Lovable sync prompt.

## Immediate sequence

1. **Merge Stage 6Z to `main` first**:
   - Create/push the Stage 6Z Pull request.
   - Wait for checks.
   - Merge into `main`.
   - Verify local `main` contains Stage 6Z files and `npm run preflight:stage6z`
     passes.

2. **Confirm Stage 6Z in Lovable**:
   - Ask Lovable to verify Stage 6Z files from `main`.
   - Treat "Stage 6Z missing" as a sync issue only after checking that Lovable
     is pointed at `main`.

3. **Define Stage 7A scaffold (hypothesis)**:
   - Hypothesis: Stage 7A follows Stage 6Z.
   - Basis: Stage 6A-6Z exist in the current branch; Stage 7A files are not
     confirmed.
   - Do not implement Stage 7A until Stage 6Z is merged and confirmed in
     Lovable.

## Verification commands to keep using

- `npm run preflight:stage6w`
- `npm run preflight:stage6x`
- `npm run preflight:stage6y`
- `npm run preflight:stage6z`
- `npm run check:project-memory`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 7A is not the intended target

Treat any Stage 7A scope as unconfirmed until repository files or an explicit
user instruction define it.

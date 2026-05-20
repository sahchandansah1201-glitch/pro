# NEXT_ACTIONS

## Highest-confidence next step

Stage 6X is implemented in the current branch and verified locally. The next
action is to complete the PR lifecycle before any Lovable sync prompt.

## Immediate sequence

1. **Merge Stage 6X to `main` first**:
   - Create/push the Stage 6X Pull request.
   - Wait for checks.
   - Merge into `main`.
   - Verify local `main` contains Stage 6X files and `npm run preflight:stage6x`
     passes.

2. **Confirm Stage 6X in Lovable**:
   - Ask Lovable to verify Stage 6X files from `main`.
   - Treat "Stage 6X missing" as a sync issue only after checking that Lovable
     is pointed at `main`.

3. **Define Stage 6Y scaffold (hypothesis)**:
   - Hypothesis: Stage 6Y follows Stage 6X.
   - Basis: Stage 6A-6X exist in the current branch; Stage 6Y files are not
     confirmed.
   - Do not implement Stage 6Y until Stage 6X is merged and confirmed in
     Lovable.

## Verification commands to keep using

- `npm run preflight:stage6v`
- `npm run preflight:stage6w`
- `npm run preflight:stage6x`
- `npm run check:project-memory`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6Y is not the intended target

Treat any Stage 6Y scope as unconfirmed until repository files or an explicit
user instruction define it.

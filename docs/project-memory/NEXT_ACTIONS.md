# NEXT_ACTIONS

## Highest-confidence next step

Stage 6W is implemented in the current branch and verified locally. The next
action is to complete the PR lifecycle before any Lovable sync prompt.

## Immediate sequence

1. **Merge Stage 6W to `main` first**:
   - Create/push the Stage 6W Pull request.
   - Wait for checks.
   - Merge into `main`.
   - Verify local `main` contains Stage 6W files and `npm run preflight:stage6w`
     passes.

2. **Confirm Stage 6W in Lovable**:
   - Ask Lovable to verify Stage 6W files from `main`.
   - Treat "Stage 6W missing" as a sync issue only after checking that Lovable
     is pointed at `main`.

3. **Define Stage 6X scaffold (hypothesis)**:
   - Hypothesis: Stage 6X follows Stage 6W.
   - Basis: Stage 6A-6W exist in the current branch; Stage 6X files are not
     confirmed.
   - Do not implement Stage 6X until Stage 6W is merged and confirmed in
     Lovable.

## Verification commands to keep using

- `npm run preflight:stage6v`
- `npm run preflight:stage6w`
- `npm run check:project-memory`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6X is not the intended target

Treat any Stage 6X scope as unconfirmed until repository files or an explicit
user instruction define it.

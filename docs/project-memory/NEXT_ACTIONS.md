# NEXT_ACTIONS

## Highest-confidence next step

Stage 6V is implemented in the current branch and verified with its focused
test, guard, report, and preflight path. Do not send the Lovable sync prompt
until the Pull request is merged into `main` and local `main` verification
confirms Stage 6V files.

## Immediate sequence

1. **Complete Stage 6V PR lifecycle**:
   - Create the Stage 6V Pull request from the current branch.
   - Wait for GitHub checks.
   - Merge into `main`.
   - Verify local `main` contains Stage 6V files.
   - Only then send the Lovable sync prompt.

2. **Define Stage 6W scaffold (hypothesis)**:
   - Hypothesis: Stage 6W follows Stage 6V.
   - Basis: Stage 6A-6V exist in this branch; Stage 6W files are not confirmed.
   - Do not implement Stage 6W until Stage 6V is merged and synced.

## Verification commands to keep using

- `npm run preflight:stage6v`
- `npm run check:project-memory`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6W is not the intended target

Treat any Stage 6W scope as unconfirmed until repository files or an explicit
user instruction define it.

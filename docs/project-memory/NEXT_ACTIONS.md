# NEXT_ACTIONS

## Highest-confidence next step

Stage 6U is implemented in the current branch and verified with its focused
test, guard, report, and preflight commands. Do not infer Stage 6V scope from
chat memory alone.

## Immediate sequence

1. **Complete Stage 6U PR lifecycle**:
   - Create the Stage 6U Pull request from the current branch.
   - Wait for GitHub checks.
   - Merge into `main`.
   - Verify local `main` contains Stage 6U files.
   - Only then send the Lovable sync prompt.

2. **Define Stage 6V scaffold (hypothesis)**:
   - Hypothesis: Stage 6V follows Stage 6U.
   - Basis: Stage 6A-6U exist in this branch; Stage 6V files are not confirmed.
   - Do not implement Stage 6V until Stage 6U is merged and synced.

## Verification commands to keep using

- `npm run preflight:stage6u`
- `npm run check:project-memory`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6V is not the intended target

Treat any Stage 6V scope as unconfirmed until repository files or an explicit
user instruction define it.

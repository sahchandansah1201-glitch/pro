# NEXT_ACTIONS

## Highest-confidence next step

Stage 6V is merged into `main` and verified locally. The next action is to run
the Lovable sync confirmation against `main`.

## Immediate sequence

1. **Confirm Stage 6V in Lovable**:
   - Ask Lovable to verify Stage 6V files from `main`.
   - Treat "Stage 6V missing" as a sync issue only after checking that Lovable
     is pointed at `main`.

2. **Define Stage 6W scaffold (hypothesis)**:
   - Hypothesis: Stage 6W follows Stage 6V.
   - Basis: Stage 6A-6V exist on `main`; Stage 6W files are not confirmed.
   - Do not implement Stage 6W until Stage 6V is confirmed in Lovable.

## Verification commands to keep using

- `npm run preflight:stage6v`
- `npm run check:project-memory`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6W is not the intended target

Treat any Stage 6W scope as unconfirmed until repository files or an explicit
user instruction define it.

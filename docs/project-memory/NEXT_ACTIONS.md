# NEXT_ACTIONS

## Current decision

Stage 6O is implemented in the current branch and verified with its focused
test, guard, report, and preflight commands. Do not infer Stage 6P scope from
chat memory alone.

## Highest-confidence next step

1. **Complete Stage 6O PR lifecycle**:
   - Push the branch.
   - Create the Pull request.
   - Run/inspect checks.
   - Send the Lovable sync prompt after the PR is visible or merged.
2. **Define Stage 6P scaffold (hypothesis)**:
   - Justification: Stage 6A-6O are present in repo evidence after this branch,
     while no Stage 6P docs/scripts/workflows/package scripts have been
     confirmed.
   - Confidence: medium as sequencing evidence, low for exact scope until a
     Stage 6O contract is written and synced.

## Execution plan for the next coding cycle

1. Verify Stage 6O sync from `main` after merge.
2. Choose Stage 6P scope from repository facts.
3. Create Stage 6P docs/manifest/generator/guard/tests/workflow only after the
   scope is explicit.
4. Wire `preflight:stage6p` into `scripts/preflight-all.mjs` if Stage 6P is
   created.
5. Run:
   - `npm run preflight:stage6m`
   - `npm run preflight:stage6n`
   - `npm run preflight:stage6o`
   - `npm run preflight:stage6p` (only after Stage 6P exists)
   - `npm run preflight:all -- --dry-run`
   - `npm run check:project-memory`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6P is not the intended target

1. If roadmap changed outside repository, define the next stage id and scope in
   docs before implementation.
2. If focus should be real production archive execution, extend Stage 6O
   operator receipt tooling instead of committing raw live logs, live metrics,
   final approval, final archive outcome, archive contents, archive receipt
   values, reconciliation values, final closure values, final closure receipt
   values, or live-server proof to git.

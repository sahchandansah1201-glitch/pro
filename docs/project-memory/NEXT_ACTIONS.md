# NEXT_ACTIONS

## Current decision

Stage 6N is implemented in the current branch and verified with its focused
test, guard, report, and preflight commands. Do not infer Stage 6O scope from
chat memory alone.

## Highest-confidence next step

1. **Complete Stage 6N PR lifecycle**:
   - Push the branch.
   - Create the Pull request.
   - Run/inspect checks.
   - Send the Lovable sync prompt after the PR is visible or merged.
2. **Define Stage 6O scaffold (hypothesis)**:
   - Justification: Stage 6A-6N are present in repo evidence after this branch,
     while no Stage 6O docs/scripts/workflows/package scripts have been
     confirmed.
   - Confidence: medium as sequencing evidence, low for exact scope until a
     Stage 6N contract is written and synced.

## Execution plan for the next coding cycle

1. Verify Stage 6N sync from `main` after merge.
2. Choose Stage 6O scope from repository facts.
3. Create Stage 6O docs/manifest/generator/guard/tests/workflow only after the
   scope is explicit.
4. Wire `preflight:stage6o` into `scripts/preflight-all.mjs` if Stage 6O is
   created.
5. Run:
   - `npm run preflight:stage6m`
   - `npm run preflight:stage6n`
   - `npm run preflight:stage6o` (only after Stage 6O exists)
   - `npm run preflight:all -- --dry-run`
   - `npm run check:project-memory`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6O is not the intended target

1. If roadmap changed outside repository, define the next stage id and scope in
   docs before implementation.
2. If focus should be real production archive execution, extend Stage 6N
   operator receipt tooling instead of committing raw live logs, live metrics,
   final approval, final archive outcome, archive contents, archive receipt
   values, reconciliation values, final closure values, final closure receipt
   values, or live-server proof to git.

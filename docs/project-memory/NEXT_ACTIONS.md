# NEXT_ACTIONS

## Current decision
Stage 6G is implemented in the current branch and verified with its focused
test, guard, and report commands. Do not infer Stage 6H scope from chat memory
alone.

## Highest-confidence next step
1. **Complete Stage 6G PR lifecycle**:
   - Push the branch.
   - Create the Pull request.
   - Run/inspect checks.
   - Send the Lovable sync prompt after the PR is visible.
2. **Define Stage 6H scaffold (hypothesis)**:
   - Justification: Stage 6A-6G are present in repo evidence after this branch,
     while no Stage 6H docs/scripts/workflows/package scripts have been
     confirmed.
   - Confidence: medium as sequencing evidence, low for exact scope until a
     Stage 6H contract is written.

## Execution plan for the next coding cycle
1. Verify Stage 6G sync from `main` after merge.
2. Choose Stage 6H scope from repository facts.
3. Create Stage 6H docs/manifest/generator/guard/tests/workflow only after the
   scope is explicit.
4. Wire `preflight:stage6h` into `scripts/preflight-all.mjs` if Stage 6H is
   created.
5. Run:
   - `npm run preflight:stage6g`
   - `npm run preflight:stage6h` (only after Stage 6H exists)
   - `npm run preflight:all -- --dry-run`
   - `npm run check:project-memory`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6H is not the intended target
1. If roadmap changed outside repository, define the next stage id and scope in
   docs before implementation.
2. If focus should be real production observation execution, extend Stage 6G
   operator evidence tooling instead of committing raw live logs, live metrics,
   final approval, or live-server proof to git.

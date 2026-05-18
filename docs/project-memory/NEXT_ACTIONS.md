# NEXT_ACTIONS

## Current decision
Stage 6F is implemented in the current branch and verified with its focused
preflight. Do not infer Stage 6G scope from chat memory alone.

## Highest-confidence next step
1. **Complete Stage 6F PR lifecycle**:
   - Push the branch.
   - Create the Pull request.
   - Run/inspect checks.
   - Send the Lovable sync prompt after the PR is visible.
2. **Define Stage 6G scaffold (hypothesis)**:
   - Justification: Stage 6A-6F are present in repo evidence after this branch,
     while no Stage 6G docs/scripts/workflows/package scripts have been
     confirmed.
   - Confidence: medium as sequencing evidence, low for exact scope until a
     Stage 6G contract is written.

## Execution plan for the next coding cycle
1. Verify Stage 6F sync from `main` after merge.
2. Choose Stage 6G scope from repository facts.
3. Create Stage 6G docs/manifest/generator/guard/tests/workflow only after the
   scope is explicit.
4. Wire `preflight:stage6g` into `scripts/preflight-all.mjs` if Stage 6G is
   created.
5. Run:
   - `npm run preflight:stage6f`
   - `npm run preflight:stage6g` (only after Stage 6G exists)
   - `npm run preflight:all -- --dry-run`
   - `npm run check:project-memory`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6G is not the intended target
1. If roadmap changed outside repository, define the next stage id and scope in
   docs before implementation.
2. If focus should be real go-live execution, extend the Stage 6E/6F operator
   evidence tooling instead of committing final approval or live-server proof to
   git.

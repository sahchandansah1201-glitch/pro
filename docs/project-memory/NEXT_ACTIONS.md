# NEXT_ACTIONS

## Current decision
Stage 6J is implemented in the current branch and verified with its focused
test, guard, report, and preflight commands. Do not infer Stage 6K scope from
chat memory alone.

## Highest-confidence next step
1. **Complete Stage 6J PR lifecycle**:
   - Push the branch.
   - Create the Pull request.
   - Run/inspect checks.
   - Send the Lovable sync prompt after the PR is visible or merged.
2. **Define Stage 6K scaffold (hypothesis)**:
   - Justification: Stage 6A-6J are present in repo evidence after this branch,
     while no Stage 6K docs/scripts/workflows/package scripts have been
     confirmed.
   - Confidence: medium as sequencing evidence, low for exact scope until a
     Stage 6K contract is written.

## Execution plan for the next coding cycle
1. Verify Stage 6J sync from `main` after merge.
2. Choose Stage 6K scope from repository facts.
3. Create Stage 6K docs/manifest/generator/guard/tests/workflow only after the
   scope is explicit.
4. Wire `preflight:stage6k` into `scripts/preflight-all.mjs` if Stage 6K is
   created.
5. Run:
   - `npm run preflight:stage6i`
   - `npm run preflight:stage6j`
   - `npm run preflight:stage6k` (only after Stage 6K exists)
   - `npm run preflight:all -- --dry-run`
   - `npm run check:project-memory`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6K is not the intended target
1. If roadmap changed outside repository, define the next stage id and scope in
   docs before implementation.
2. If focus should be real production archive execution, extend Stage 6J
   operator archive tooling instead of committing raw live logs, live metrics,
   final approval, final archive outcome, archive contents, or live-server
   proof to git.

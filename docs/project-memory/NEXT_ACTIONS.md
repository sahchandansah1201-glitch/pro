# NEXT_ACTIONS

## Current decision

Stage 6Q is merged into `main` and verified with its focused test, guard,
report, and preflight commands. Do not infer Stage 6R scope from chat memory
alone.

## Highest-confidence next step

1. **Complete Stage 6Q Lovable sync**:
   - Confirm Lovable HEAD is at or after `1af3cd3`.
   - Confirm Stage 6Q files exist in Lovable.
   - Run or inspect `npm run preflight:stage6q` in the Lovable sandbox.
   - Treat "open PR only" as not synced unless Lovable branch switching is
     explicitly enabled.
2. **Define Stage 6R scaffold (hypothesis)**:
   - Justification: Stage 6A-6Q are present in repo evidence after this branch,
     while no Stage 6R docs/scripts/workflows/package scripts have been
     confirmed.
   - Confidence: medium as sequencing evidence, low for exact scope until a
     Stage 6Q contract is written and synced.

## Execution plan for the next coding cycle

1. Verify Stage 6Q sync from `main` after merge.
2. Choose Stage 6R scope from repository facts.
3. Create Stage 6R docs/manifest/generator/guard/tests/workflow only after the
   scope is explicit.
4. Wire `preflight:stage6r` into `scripts/preflight-all.mjs` if Stage 6R is
   created.
5. Run:
   - `npm run preflight:stage6m`
   - `npm run preflight:stage6n`
   - `npm run preflight:stage6o`
   - `npm run preflight:stage6p`
   - `npm run preflight:stage6q` (only after Stage 6Q exists)
   - `npm run preflight:all -- --dry-run`
   - `npm run check:project-memory`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6R is not the intended target

1. If roadmap changed outside repository, define the next stage id and scope in
   docs before implementation.
2. If focus should be real production archive execution, extend Stage 6Q
   operator receipt tooling instead of committing raw live logs, live metrics,
   final approval, final archive outcome, archive contents, archive receipt
   values, reconciliation values, final closure values, final closure receipt
   values, or live-server proof to git.

## Operator workflow rule

For future stages, do not hand off a Lovable sync prompt immediately after PR
creation. The prompt is only valid after the PR is merged into `main` and local
`main` is verified to contain the new stage artifacts.

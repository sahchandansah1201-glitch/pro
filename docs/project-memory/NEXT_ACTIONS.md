# NEXT_ACTIONS

## Current decision

Stage 6S is implemented in the current branch and verified with its focused
test, guard, report, and preflight commands. Do not infer Stage 6T scope from
chat memory alone.

## Highest-confidence next step

1. **Complete Stage 6S PR lifecycle**:
   - Push the branch.
   - Create the Pull request.
   - Run/inspect checks.
   - Merge the PR into `main`.
   - Verify local `main` contains Stage 6S files.
   - Send the Lovable sync prompt only after merge and local `main`
     verification.
   - Treat "open PR only" as not synced unless Lovable branch switching is
     explicitly enabled.
2. **Define Stage 6T scaffold (hypothesis)**:
   - Justification: Stage 6A-6S are present in repo evidence after this branch,
     while no Stage 6T docs/scripts/workflows/package scripts have been
     confirmed.
   - Confidence: medium as sequencing evidence, low for exact scope until a
     Stage 6S contract is written and synced.

## Execution plan for the next coding cycle

1. Verify Stage 6S sync from `main` after merge.
2. Choose Stage 6T scope from repository facts.
3. Create Stage 6T docs/manifest/generator/guard/tests/workflow only after the
   scope is explicit.
4. Wire `preflight:stage6t` into `scripts/preflight-all.mjs` if Stage 6T is
   created.
5. Run:
   - `npm run preflight:stage6r`
   - `npm run preflight:stage6s`
   - `npm run preflight:all -- --dry-run`
   - `npm run check:project-memory`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6T is not the intended target

1. If roadmap changed outside repository, define the next stage id and scope in
   docs before implementation.
2. If focus should be real production archive execution, extend Stage 6S
   operator closure tooling instead of committing raw live logs, live metrics,
   final approval, final archive outcome, archive contents, archive receipt
   values, reconciliation values, retention values, retention closure values, or
   live-server proof to git.

## Operator workflow rule

For future stages, do not hand off a Lovable sync prompt immediately after PR
creation. The prompt is only valid after the PR is merged into `main` and local
`main` is verified to contain the new stage artifacts.

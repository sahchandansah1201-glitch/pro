# NEXT_ACTIONS

## Current decision
Stage 6E is confirmed on `main`; do not start Stage 6F from chat memory alone.

## Highest-confidence next step
1. **Define Stage 6F scaffold (hypothesis)**:
   - Justification: Stage 6A-6E are present in repo evidence, while `rg` finds
     no Stage 6F docs/scripts/workflows/package scripts.
   - Confidence: medium as sequencing evidence, low for exact scope until a
     Stage 6F contract is written.
2. **Before implementation, create the Stage 6F contract first**:
   - Required: doc naming purpose, boundaries, required artifacts, preflight,
     self-hosted product boundary, and what remains external.
   - Reason: Stage 6E is a go-live handoff package, not proof of final operator
     approval or live production go-live.

## Execution plan for the next coding cycle
1. Choose Stage 6F scope from repository facts.
2. Create Stage 6F docs/manifest/generator/guard/tests/workflow only after the
   scope is explicit.
3. Wire `preflight:stage6f` into `scripts/preflight-all.mjs`.
4. Run:
   - `npm run preflight:stage6e`
   - `npm run preflight:stage6f`
   - `npm run preflight:all -- --dry-run`
   - `npm run check:project-memory`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6F is not the intended target
1. If roadmap changed outside repository, define the next stage id and scope in
   docs before implementation.
2. If focus should be real go-live execution, extend Stage 6E tooling instead
   of creating Stage 6F, because final approval and live-server evidence are
   intentionally external to git.

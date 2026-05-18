# NEXT_ACTIONS

## Current decision
Proceed from the confirmed Stage 6D baseline.

## Highest-confidence next step
1. **Stage 6E scaffold (hypothesis)**:
   - Justification: Stage 6A-6D are present and complete; no Stage 6E files are present.
   - Confidence: medium (based on repository sequencing, not an explicit spec file).

## Execution plan for the next coding cycle
1. Create `docs/backend/stage-6e-*.md` with explicit acceptance gates and scope boundaries.
2. Add Stage 6E generator script in `scripts/stage6e-*.mjs`.
3. Add Stage 6E guard script + tests:
   - `scripts/check-stage6e-*.mjs`
   - `scripts/stage6e-*.test.mjs`
   - `scripts/check-stage6e-*.test.mjs`
4. Wire npm scripts:
   - `test:stage6e`
   - `check:stage6e`
   - `preflight:stage6e`
5. Add `.github/workflows/stage6e-*.yml`.
6. Append Stage 6E step to `scripts/preflight-all.mjs` and update related tests.
7. Run:
   - `npm run preflight:stage6e`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6E is not the intended target
1. If roadmap changed outside repository, define the next stage id and scope in docs before implementation.
2. If focus should be production installation evidence ingestion (not new stage), extend Stage 6D tooling instead of creating Stage 6E.

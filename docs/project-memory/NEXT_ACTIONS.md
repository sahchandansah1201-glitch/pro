# NEXT_ACTIONS

## Current decision
Proceed from the Stage 6E production go-live handoff sync-hardening branch.

## Highest-confidence next step
1. **Finish and merge Stage 6E**:
   - Justification: Stage 6E was selected from the previous hypothesis and now has a manifest, generator, guard, tests, docs, workflow, and `preflight-all` wiring in the active branch.
   - Confidence: high after local `npm run preflight:stage6e` and added script-relative `cwd` regression tests for Stage 6D/6E.
2. **Stage 6F scaffold (hypothesis)**:
   - Justification: repository sequencing may continue after Stage 6E, but no Stage 6F spec file is present yet.
   - Confidence: low until Stage 6E is merged and the repo is re-scanned.

## Execution plan for the next coding cycle
1. Open PR for Stage 6E.
2. Verify CI.
3. Send Lovable sync prompt after merge.
4. Re-scan repository before selecting Stage 6F.
5. Run:
   - `npm run preflight:stage6e`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`

## Alternatives if Stage 6F is not the intended target
1. If roadmap changed outside repository, define the next stage id and scope in docs before implementation.
2. If focus should be live go-live evidence ingestion, extend Stage 6E tooling instead of creating Stage 6F.

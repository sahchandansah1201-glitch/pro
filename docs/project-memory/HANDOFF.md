# HANDOFF

## Scope
This handoff captures the repository state after Stage 6F was implemented in the
current development branch.

## Confirmed state
1. Repository work is currently on `codex/stage6f-go-live-decision-record`.
2. Latest committed base before this Stage 6F branch is:
   - `0e085c8 Refresh project memory after Stage 6E`
3. Stage 6A-6F artifacts, docs, scripts, guards, and workflows are present in
   the working tree:
   - Manifests in `deploy/self-hosted/*.stage6*.json`
   - Docs in `docs/backend/stage-6*.md`
   - Workflows in `.github/workflows/stage6*.yml`
   - Scripts in `scripts/stage6*.mjs` and `scripts/check-stage6*.mjs`
4. Fresh local verification for Stage 6F:
   - `npm run preflight:stage6f` -> pass
   - Stage 6F guard -> pass (`7 files checked`)
   - Stage 6F report renders in dry-run mode with zero leak findings
   - `node scripts/check-no-deno-locks.mjs` -> pass

## Important operational fact
Stage 6F report output explicitly states:
- `Status: ready`
- `Ready for external go-live decision record: true`
- `Final decision stored outside git: true`
- `Final go-live outcome known to repository: false`
- `Go-live approved by this report: false`
- `Live server go-live verified by this report: false`

Interpretation: Stage 6F creates a deterministic, redacted decision-record
contract for the external operator decision. It still does not approve go-live
and does not prove that a live production server is running.

## Hypothesis (explicit)
- `Stage 6G` is likely next, but its scope is not confirmed by repository files
  yet.

## Immediate continuation recommendation
1. Finish PR review/sync for Stage 6F first.
2. After Stage 6F is merged and Lovable confirms sync, define Stage 6G scope
   from repository facts.
3. Keep final go-live approval, raw live evidence, patient data, credentials,
   object keys, and backup contents outside git.

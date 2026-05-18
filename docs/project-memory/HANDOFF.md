# HANDOFF

## Scope
This handoff captures the repository state after Stage 6G was implemented in
the current development branch.

## Confirmed state
1. Repository work is currently on `codex/stage6g-post-go-live-observation`.
2. Latest committed base before this Stage 6G branch is:
   - `08444ed Add Stage 6F go-live decision record`
3. Stage 6A-6G artifacts, docs, scripts, guards, and workflows are present in
   the working tree:
   - Manifests in `deploy/self-hosted/*.stage6*.json`
   - Docs in `docs/backend/stage-6*.md`
   - Workflows in `.github/workflows/stage6*.yml`
   - Scripts in `scripts/stage6*.mjs` and `scripts/check-stage6*.mjs`
4. Fresh local verification for Stage 6G:
   - `npm run test:stage6g` -> pass
   - `npm run check:stage6g` -> pass (`7 files checked`)
   - `npm run observation:stage6g:report` -> pass
   - Stage 6G report renders in dry-run mode with zero leak findings

## Important operational fact
Stage 6G report output explicitly states:
- `Status: ready`
- `Ready for external post-go-live observation: true`
- `Observation evidence stored outside git: true`
- `Observation outcome known to repository: false`
- `Go-live approved by this report: false`
- `Live server go-live verified by this report: false`
- `Live observation verified by this report: false`

Interpretation: Stage 6G creates a deterministic, redacted post-go-live
observation contract. It still does not approve go-live, does not prove that a
live production server was observed, and does not store live logs or metrics in
git.

## Hypothesis
- `Stage 6H` is likely next, but its scope is not confirmed by repository
  files yet.

## Immediate continuation recommendation
1. Finish PR review/sync for Stage 6G first.
2. After Stage 6G is merged and Lovable confirms sync, define Stage 6H scope
   from repository facts.
3. Keep final go-live approval, raw live evidence, live logs, live metrics,
   patient data, credentials, object keys, and backup contents outside git.

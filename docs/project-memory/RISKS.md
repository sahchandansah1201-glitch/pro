# RISKS

## Confirmed risks

1. **Readiness package != live go-live approval**
   - Evidence: Stage 6E report output includes:
     - `Go-live approved by this report: false`
     - `Live server go-live verified by this report: false`
   - Impact: repository can be green while final operator approval and live
     evidence are still pending outside git.

2. **Operational dependence on external operator-run steps**
   - Evidence: Stage 6B-6E manifests include deploy/smoke/backup/rollback,
     live evidence, and manual go-live approval gates.
   - Impact: success depends on disciplined execution outside the code
     repository.

3. **Potential stale conversation memory**
   - Evidence: user reported previous compaction interruption.
   - Impact: chat history may have gaps; repository remains the source of truth.

## Hypotheses

1. **Next stage ambiguity**
   - Hypothesis: Stage 6F is next.
   - Basis: Stage 6A-6E exist; Stage 6F files are absent.
   - Uncertainty: no explicit roadmap file in current scan naming Stage 6F
     scope.

## Mitigations

1. Keep decision points codified in stage docs before implementation.
2. Require stage-specific preflight + guard + dry-run report before merge.
3. Keep live evidence and final go-live approval outside git, referenced only by
   deterministic redacted receipt/handoff fields.

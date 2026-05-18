# RISKS

## Confirmed risks

1. **Readiness/decision package != live go-live approval**
   - Evidence: Stage 6E/6F report outputs include:
     - `Go-live approved by this report: false`
     - `Live server go-live verified by this report: false`
     - `Final go-live outcome known to repository: false`
   - Impact: repository can be green while final operator approval and live
     evidence are still pending outside git.

2. **Operational dependence on external operator-run steps**
   - Evidence: Stage 6B-6F manifests include deploy/smoke/backup/rollback,
     live evidence, handoff, and external decision-record gates.
   - Impact: success depends on disciplined execution outside the code
     repository.

3. **Potential stale conversation memory**
   - Evidence: user reported previous compaction interruption.
   - Impact: chat history may have gaps; repository remains the source of truth.

## Hypotheses

1. **Next stage ambiguity**
   - Hypothesis: Stage 6G is next.
   - Basis: Stage 6A-6F exist in the current branch; Stage 6G files are not
     confirmed.
   - Uncertainty: no explicit roadmap file in current scan naming Stage 6G
     scope.

## Mitigations

1. Keep decision points codified in stage docs before implementation.
2. Require stage-specific preflight + guard + dry-run report before merge.
3. Keep live evidence and final go-live approval outside git, referenced only by
   deterministic redacted receipt/handoff/decision-record fields.

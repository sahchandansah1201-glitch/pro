# RISKS

## Confirmed risks

1. **Readiness/decision/observation/closure packages != live go-live approval**
   - Evidence: Stage 6E/6F/6G/6H report outputs include:
     - `Go-live approved by this report: false`
     - `Live server go-live verified by this report: false`
     - `Final go-live outcome known to repository: false`
     - `Observation outcome known to repository: false`
     - `Live observation verified by this report: false`
     - `Closure outcome known to repository: false`
     - `Live closure verified by this report: false`
   - Impact: repository can be green while final operator approval, live
     observation outcome, closure outcome, and live evidence are still pending
     outside git.

2. **Operational dependence on external operator-run steps**
   - Evidence: Stage 6B-6H manifests include deploy/smoke/backup/rollback,
     live evidence, handoff, decision-record, observation, and closure gates.
   - Impact: success depends on disciplined execution outside the code
     repository.

3. **Potential stale conversation memory**
   - Evidence: user reported previous compaction interruption.
   - Impact: chat history may have gaps; repository remains the source of truth.

## Hypotheses

1. **Next stage ambiguity**
   - Hypothesis: Stage 6I is next.
   - Basis: Stage 6A-6H exist in the current branch; Stage 6I files are not
     confirmed.
   - Uncertainty: no explicit roadmap file in current scan naming Stage 6I
     scope.

## Mitigations

1. Keep decision points codified in stage docs before implementation.
2. Require stage-specific preflight + guard + dry-run report before merge.
3. Keep live evidence, live logs, live metrics, final go-live approval, and
   final observation/closure outcomes outside git, referenced only by
   deterministic redacted receipt/handoff/decision-record/observation/closure
   fields.

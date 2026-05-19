# RISKS

## Confirmed risks

1. **Readiness/decision/observation/closure/archive packages != live go-live approval**
   - Evidence: Stage 6E-6N report outputs include:
     - `Go-live approved by this report: false`
     - `Live server go-live verified by this report: false`
     - `Final go-live outcome known to repository: false`
     - `Observation outcome known to repository: false`
     - `Live observation verified by this report: false`
     - `Closure outcome known to repository: false`
     - `Live closure verified by this report: false`
     - `Archive outcome known to repository: false`
     - `Archive receipt outcome known to repository: false`
     - `Archive reconciliation outcome known to repository: false`
     - `Archive reconciliation receipt outcome known to repository: false`
     - `Archive final closure outcome known to repository: false`
     - `Archive final closure receipt outcome known to repository: false`
     - `Live archive verified by this report: false`
   - Impact: repository can be green while final operator approval, live
     observation outcome, closure outcome, archive outcome, archive receipt
     outcome, archive reconciliation outcome, archive reconciliation receipt,
     archive final closure outcome, archive final closure receipt outcome,
     live evidence, and archive contents are still pending outside git.

2. **Operational dependence on external operator-run steps**
   - Evidence: Stage 6B-6N manifests include deploy/smoke/backup/rollback,
     live evidence, handoff, decision-record, observation, closure, archive,
     receipt, reconciliation, reconciliation receipt, final closure, and final
     closure receipt gates.
   - Impact: success depends on disciplined execution outside the code
     repository.

3. **Potential stale conversation memory**
   - Evidence: user reported previous compaction interruption.
   - Impact: chat history may have gaps; repository remains the source of truth.

## Hypotheses

1. **Next stage ambiguity**
   - Hypothesis: Stage 6O is next.
   - Basis: Stage 6A-6N exist in the current branch; Stage 6O files are not
     confirmed.
   - Uncertainty: no explicit roadmap file in current scan naming Stage 6O
     scope.

## Mitigations

1. Keep decision points codified in stage docs before implementation.
2. Require stage-specific preflight + guard + dry-run report before merge.
3. Keep live evidence, live logs, live metrics, final go-live approval, and
   final observation/closure/archive/reconciliation/reconciliation receipt/final
   closure/final closure receipt outcomes outside git, referenced only by
   deterministic redacted receipt/handoff/decision-record/observation/closure/
   archive/reconciliation fields.

# RISKS

## Confirmed risks

1. **Readiness/decision/observation packages != live go-live approval**
   - Evidence: Stage 6E/6F/6G report outputs include:
     - `Go-live approved by this report: false`
     - `Live server go-live verified by this report: false`
     - `Final go-live outcome known to repository: false`
     - `Observation outcome known to repository: false`
     - `Live observation verified by this report: false`
   - Impact: repository can be green while final operator approval, live
     observation outcome, and live evidence are still pending outside git.

2. **Operational dependence on external operator-run steps**
   - Evidence: Stage 6B-6G manifests include deploy/smoke/backup/rollback,
     live evidence, handoff, decision-record, and observation gates.
   - Impact: success depends on disciplined execution outside the code
     repository.

3. **Potential stale conversation memory**
   - Evidence: user reported previous compaction interruption.
   - Impact: chat history may have gaps; repository remains the source of truth.

## Hypotheses

1. **Next stage ambiguity**
   - Hypothesis: Stage 6H is next.
   - Basis: Stage 6A-6G exist in the current branch; Stage 6H files are not
     confirmed.
   - Uncertainty: no explicit roadmap file in current scan naming Stage 6H
     scope.

## Mitigations

1. Keep decision points codified in stage docs before implementation.
2. Require stage-specific preflight + guard + dry-run report before merge.
3. Keep live evidence, live logs, live metrics, final go-live approval, and
   final observation outcomes outside git, referenced only by deterministic
   redacted receipt/handoff/decision-record/observation fields.

# RISKS

## Confirmed risks

1. **Readiness/decision/observation/closure/archive packages != live go-live approval**
   - Evidence: Stage 6E-6T report outputs include:
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
     - `Archive retention outcome known to repository: false`
     - `Archive retention register receipt outcome known to repository: false`
     - `Archive retention cycle outcome known to repository: false`
     - `Archive retention cycle index receipt outcome known to repository: false`
     - `Archive retention cycle closure outcome known to repository: false`
     - `Archive retention cycle closure receipt outcome known to repository: false`
     - `Live archive verified by this report: false`
   - Impact: repository can be green while final operator approval, live
     observation outcome, closure outcome, archive outcome, archive receipt
     outcome, archive reconciliation outcome, archive reconciliation receipt,
     archive final closure outcome, archive final closure receipt outcome,
     archive retention outcome, archive retention register receipt outcome,
     archive retention cycle outcome, archive retention cycle index receipt
     outcome, archive retention cycle closure outcome, archive retention cycle
     closure receipt outcome, live evidence, and archive contents are still
     pending outside git.

2. **Operational dependence on external operator-run steps**
   - Evidence: Stage 6B-6T manifests include deploy/smoke/backup/rollback,
     live evidence, handoff, decision-record, observation, closure, archive,
     receipt, reconciliation, reconciliation receipt, final closure, final
     closure receipt, retention register, retention register receipt, retention
     cycle index/receipt, retention cycle closure, and retention cycle closure
     receipt gates.
   - Impact: success depends on disciplined execution outside the code
     repository.

3. **Potential stale conversation memory**
   - Evidence: user reported previous compaction interruption.
   - Impact: chat history may have gaps; repository remains the source of truth.

4. **Lovable sync prompt can be sent before merge**
   - Evidence: Stage 6Q PR #151 was opened and checked successfully, but the
     first Lovable sync check still saw Stage 6P because PR #151 was not yet
     merged into `main`.
   - Impact: Lovable can correctly report "missing stage" even when a PR exists
     and is green, because the project sync follows `main` unless branch
     switching is explicitly enabled.

## Hypotheses

1. **Next stage ambiguity**
   - Hypothesis: Stage 6U is next.
   - Basis: Stage 6A-6T exist in the current branch; Stage 6U files are not
     confirmed.
   - Uncertainty: no explicit roadmap file in current scan naming Stage 6U
     scope.

## Mitigations

1. Keep decision points codified in stage docs before implementation.
2. Require stage-specific preflight + guard + dry-run report before merge.
3. Keep live evidence, live logs, live metrics, final go-live approval, and
   final observation/closure/archive/reconciliation/reconciliation receipt/final
   closure/final closure receipt/retention/retention receipt/retention cycle/
   retention cycle receipt/retention cycle closure/retention cycle closure
   receipt outcomes outside git,
   referenced only by deterministic redacted receipt/handoff/decision-record/
   observation/closure/archive/reconciliation/retention/retention receipt/
   retention cycle/retention cycle receipt/retention cycle closure/retention
   cycle closure receipt fields.
4. For future stages, merge the checked PR into `main` before sending the
   Lovable sync prompt; then verify local `main` contains the stage artifacts.

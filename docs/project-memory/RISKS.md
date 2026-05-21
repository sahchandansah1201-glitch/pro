# RISKS

## Confirmed risks

1. **Readiness/decision/observation/closure/archive packages != live go-live approval**
   - Evidence: Stage 6E-6Z report outputs include or are required to include:
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
     - `Archive retention cycle final closure outcome known to repository: false`
     - `Archive retention cycle final closure receipt outcome known to repository: false`
     - `Archive retention cycle final closure reconciliation outcome known to repository: false`
     - `Archive retention cycle final closure reconciliation receipt outcome known to repository: false`
     - `Archive retention next-cycle outcome known to repository: false`
     - `Archive retention next-cycle register receipt outcome known to repository: false`
     - `Live archive verified by this report: false`
   - Impact: repository can be green while final operator approval, live
     observation outcome, closure outcome, archive outcome, archive receipt
     outcome, archive reconciliation outcome, archive reconciliation receipt,
     archive final closure outcome, archive final closure receipt outcome,
     archive retention outcome, archive retention register receipt outcome,
     archive retention cycle outcome, archive retention cycle index receipt
     outcome, archive retention cycle closure outcome, archive retention cycle
     closure receipt outcome, archive retention cycle final closure outcome,
     archive retention cycle final closure receipt outcome, archive retention
     cycle final closure reconciliation outcome, archive retention cycle final
     closure reconciliation receipt outcome, next-cycle retention outcome,
     next-cycle retention register receipt outcome, live evidence, and archive
     contents are still pending outside git.

2. **Operational dependence on external operator-run steps**
   - Evidence: Stage 6B-6Z manifests include deploy/smoke/backup/rollback,
     live evidence, handoff, decision-record, observation, closure, archive,
     receipt, reconciliation, reconciliation receipt, final closure, final
     closure receipt, retention register, retention register receipt, retention
     cycle index/receipt, retention cycle closure, retention cycle closure
     receipt, retention cycle final closure, retention cycle final closure
     receipt, retention cycle final closure reconciliation, retention cycle
     final closure reconciliation receipt, retention next-cycle register, and
     retention next-cycle register receipt gates.
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

5. **Small PR relapse after repeated large-batch instruction**
   - Evidence: the operator explicitly repeated the instruction to increase
     code volume per batch and asked why it was not converted into a working
     contract.
   - Impact: future work can regress into repeated small PRs, increasing sync
     overhead and Lovable prompt churn.
   - Mitigation: Stage 7A-7C records a minimum three related stages per Pull
     request and adds a guard/preflight for the working contract.
   - Contract term: every micro-PR needs a documented exception reason.

6. **Project-memory can become stale after a completed batch**
   - Evidence: after Stage 7A-7C merged, `NEXT_ACTIONS.md` still described
     completing Stage 7A-7C until Stage 7D-7F refreshed it.
   - Impact: future work may follow old instructions even when the repository
     already contains the completed stage.
   - Mitigation: Stage 7D-7F requires project-memory refresh as part of the
     batch automation contract.

7. **Batch artifacts can drift after the prompt is generated**
   - Evidence: Stage 7D-7F introduced the manifest and Lovable prompt gate, but
     future batches can still let docs, scripts, workflow, project-memory, and
     package scripts describe slightly different scopes.
   - Impact: Lovable sync prompts can be technically correct while missing an
     updated artifact, creating another false mismatch cycle.
   - Mitigation: Stage 7G-7I adds a readiness reporter, sync verification
     manifest, and drift guard.

8. **Product roadmap can drift from actual product evidence**
   - Evidence: Stage 7G-7I verifies batch artifacts but does not decide the
     next product implementation order.
   - Impact: future product work can choose small or unrelated PRs even after
     the process contract is green.
   - Mitigation: Stage 7J-7L adds a product gap register, next product batch
     planner, and product roadmap drift guard.

9. **CRM/ad-source adapter can leak raw external data**
   - Evidence: Stage 8A-8C accepts operator-owned CRM/ad export files and
     normalizes them before Stage 5Q import.
   - Impact: unsafe exports could include raw names, phone numbers, email
     addresses, external URLs, tokens, or raw external payload fields.
   - Mitigation: Stage 8A-8C rejects unsafe values before normalization and the
     audit report is count-only.
10. **Availability sync can confirm the wrong booking slot**
   - Evidence: Stage 8D-8F compares imported booking requests with local clinic
     availability slots before the Stage 5S booking-from-slot flow.
   - Impact: stale, duplicate, overlapping, or unmatched slots could lead to a
     wrong confirmation candidate.
   - Mitigation: Stage 8D-8F reports stale, duplicate-source, overlap,
     unmatched-request, rejected-import, and raw-payload risks before marking
     a candidate ready.
11. **Clinical report package can leak report content**
   - Evidence: Stage 8G-8I summarizes assessment, conclusion, report, lesion,
     and asset readiness for the production report tab.
   - Impact: putting raw report text, signed URLs, object storage paths, or
     tokens into the package would violate the self-hosted privacy boundary.
   - Mitigation: Stage 8G-8I returns counts, statuses, booleans, missing gate
     keys, and safe product-boundary flags only; the guard scans protected files
     for token, storage path, signed URL, and managed-runtime markers.
12. **Device Bridge production readiness can be mistaken for live hardware proof**
   - Evidence: Stage 8J-8O aggregates safe PostgreSQL worker telemetry,
     hardening, recovery, audit, and export metadata.
   - Impact: treating repository metadata as direct hardware proof could hide a
     live worker or clinic-network issue.
   - Mitigation: Stage 8J-8O labels the endpoint as readiness metadata only,
     keeps raw worker payloads backend-only, and requires operator review for
     stale workers, failed commands, and stuck commands.
13. **Server operations handbook can drift from deployed server practice**
   - Evidence: Stage 8J-8O adds a repository-bundled server operations
     handbook.
   - Impact: outdated commands or boundaries can make the handoff unreliable.
   - Mitigation: handbook manifest, renderer, guard, workflow, project-memory
     markers, and `preflight:stage8j-8o` keep the handbook checked with code.

## Hypotheses

1. **Next product batch**
   - hypothesis: Stage 8P-8R is next.
   - Basis: Stage 8J-8O closes Device Bridge production readiness and server
     operations handbook coverage.
   - Uncertainty: Stage 8P-8R is not implemented until repository files define
     it.
   - Historical marker: Stage 8J-8L was the original hypothesis after Stage
     8G-8I and is now implemented inside the larger Stage 8J-8O x2 batch.

## Mitigations

1. Keep decision points codified in stage docs before implementation.
2. Require stage-specific preflight + guard + dry-run report before merge.
3. Keep live evidence, live logs, live metrics, final go-live approval, and
   final observation/closure/archive/reconciliation/reconciliation receipt/final
   closure/final closure receipt/retention/retention receipt/retention cycle/
   retention cycle receipt/retention cycle closure/retention cycle closure
   receipt/retention cycle final closure/final closure receipt/final closure
   reconciliation/final closure reconciliation receipt/retention next-cycle
   outcomes outside git, referenced only by deterministic redacted
   receipt/handoff/decision-record/observation/closure/archive/reconciliation/
   retention/retention receipt/retention cycle/retention cycle receipt/retention
   cycle closure/retention cycle closure receipt/final closure/final closure
   receipt/final closure reconciliation/final closure reconciliation
   receipt/next-cycle register fields.
4. For future stages, merge the checked PR into `main` before sending the
   Lovable sync prompt; then verify local `main` contains the stage artifacts.
5. Use `docs/project-memory/BATCH_TEMPLATE.md` before future multi-stage work.
6. Use `deploy/self-hosted/product-roadmap.stage7j-7l.json` to choose the next
   product batch unless a documented hotfix reason applies.

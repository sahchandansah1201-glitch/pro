# RISKS

## Confirmed risks

1. **Readiness package != live installation proof**
   - Evidence: `npm run preflight:stage6d` report output includes:
     - `Live install evidence accepted by this report: false`
     - `Live install verified by this report: false`
   - Impact: repository can be green while operational evidence is still pending outside git.

2. **Operational dependence on external operator-run steps**
   - Evidence: Stage 6B/6C/6D manifests include required commands for deploy/smoke/backup/rollback.
   - Impact: success depends on disciplined execution outside code repository.

3. **Potential stale conversation memory**
   - Evidence: user reported previous compaction interruption.
   - Impact: chat history may have gaps; repository remains the source of truth.

## Hypotheses

1. **Next stage ambiguity**
   - Hypothesis: Stage 6E is next.
   - Basis: Stage 6A-6D exist; Stage 6E files are absent.
   - Uncertainty: no explicit roadmap file in current scan naming Stage 6E scope.

## Mitigations

1. Keep decision points codified in stage docs before implementation.
2. Require stage-specific preflight + guard + dry-run report before merge.
3. Keep live evidence redacted and outside git, but referenced by deterministic receipt fields.

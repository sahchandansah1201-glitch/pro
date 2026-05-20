# HANDOFF

## Scope

This handoff captures the repository state while Stage 6T is being prepared on
the current development branch.

## Confirmed state

1. Repository work is currently on
   `codex/stage6t-release-archive-retention-cycle-closure-receipt`.
2. Latest committed base before this Stage 6T branch is:
   - `c725a50 Add Stage 6S release archive retention cycle closure`
3. Stage 6A-6T artifacts, docs, scripts, guards, and workflows are present in
   the working tree:
   - Manifests in `deploy/self-hosted/*.stage6*.json`
   - Docs in `docs/backend/stage-6*.md`
   - Workflows in `.github/workflows/stage6*.yml`
   - Scripts in `scripts/stage6*.mjs` and `scripts/check-stage6*.mjs`
4. Fresh local verification for Stage 6T:
   - `npm run test:stage6t` -> pass
   - `npm run check:stage6t` -> pass (`7 files checked`)
   - `npm run receipt:stage6t:report` -> pass
   - Stage 6T report renders in dry-run mode with zero leak findings

## Important operational fact

Stage 6T report output explicitly states:

- `Status: ready`
- `Ready for external release archive retention cycle closure receipt: true`
- `Stage 6S retention cycle closure status: ready`
- `Stage 6S retention cycle closure generated at: 2026-05-19T14:00:00.000Z`
- `Stage 6S missing required inputs: 0`
- `Stage 6S leak findings: 0`
- `Release archive retention cycle closure receipt stored in git: true`
- `Release archive retention cycle closure stored in git: true`
- `Release archive retention cycle index receipt stored in git: true`
- `Release archive retention cycle index stored in git: true`
- `Release archive retention register receipt stored in git: true`
- `Release archive retention register stored in git: true`
- `Release archive reconciliation receipt stored in git: true`
- `Release archive reconciliation stored in git: true`
- `Release archive index stored in git: true`
- `Archive handoff receipt stored in git: true`
- `Release archive contents stored outside git: true`
- `External archive receipt stored outside git: true`
- `External archive reconciliation stored outside git: true`
- `External archive reconciliation receipt stored outside git: true`
- `External archive final closure stored outside git: true`
- `External archive final closure receipt stored outside git: true`
- `External archive retention records stored outside git: true`
- `External archive retention register receipt stored outside git: true`
- `External archive retention cycle records stored outside git: true`
- `External archive retention cycle index receipt stored outside git: true`
- `External archive retention cycle closure records stored outside git: true`
- `External archive retention cycle closure receipt stored outside git: true`
- `Archive receipt outcome known to repository: false`
- `Archive reconciliation outcome known to repository: false`
- `Archive final closure outcome known to repository: false`
- `Archive final closure receipt outcome known to repository: false`
- `Archive retention outcome known to repository: false`
- `Archive retention register receipt outcome known to repository: false`
- `Archive retention cycle outcome known to repository: false`
- `Archive retention cycle index receipt outcome known to repository: false`
- `Archive retention cycle closure outcome known to repository: false`
- `Archive retention cycle closure receipt outcome known to repository: false`
- `Go-live approved by this report: false`
- `Live server go-live verified by this report: false`
- `Live archive verified by this report: false`

Interpretation: Stage 6T creates a deterministic, redacted retention cycle
closure receipt package on top of Stage 6S. It still does not approve go-live, does not
prove that a live production server was observed or archived, and does not store
live logs, metrics, patient data, backup contents, archive contents, retention
cycle closure receipt values, retention review evidence, disposal holds,
exception registers, credentials, object keys, or archive outcomes in git.

## Hypothesis

- `Stage 6U` is likely next, but its scope is not confirmed by repository
  files yet.

## Lovable sync rule

Lovable sync checks must run against `main` unless GitHub Branch Switching is
explicitly enabled for the project. Do not send a Lovable sync prompt for a new
stage while its Pull request is only open or ready for review. Required order:
create PR, wait for checks, merge PR into `main`, verify local `main` contains
the stage files, then send the Lovable sync prompt.

## Immediate continuation recommendation

1. Send the Stage 6T Lovable sync prompt only after merging the Stage 6T PR and
   confirming local `main` contains Stage 6T files.
2. After Stage 6T is confirmed in Lovable, define Stage 6U scope from
   repository facts.
3. Keep final go-live approval, raw live evidence, live logs, live metrics,
   patient data, credentials, object keys, backup contents, archive contents,
   external archive values, retention values, retention closure values, and
   final archive outcomes outside git.

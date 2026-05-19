# HANDOFF

## Scope

This handoff captures the repository state while Stage 6R is being prepared on
the current development branch.

## Confirmed state

1. Repository work is currently on
   `codex/stage6r-release-archive-retention-cycle-index-receipt`.
2. Latest committed base before this Stage 6R branch is:
   - `60ae711 Document Lovable sync handoff rule`
3. Stage 6A-6R artifacts, docs, scripts, guards, and workflows are present in
   the working tree:
   - Manifests in `deploy/self-hosted/*.stage6*.json`
   - Docs in `docs/backend/stage-6*.md`
   - Workflows in `.github/workflows/stage6*.yml`
   - Scripts in `scripts/stage6*.mjs` and `scripts/check-stage6*.mjs`
4. Fresh local verification for Stage 6R:
   - `npm run test:stage6r` -> pass
   - `npm run check:stage6r` -> pass (`7 files checked`)
   - `npm run receipt:stage6r:report` -> pass
   - Stage 6R report renders in dry-run mode with zero leak findings

## Important operational fact

Stage 6R report output explicitly states:

- `Status: ready`
- `Ready for external release archive retention cycle index receipt: true`
- `Stage 6Q retention cycle index status: ready`
- `Ready for external retention cycle index: true`
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
- `Archive receipt outcome known to repository: false`
- `Archive reconciliation outcome known to repository: false`
- `Archive final closure outcome known to repository: false`
- `Archive final closure receipt outcome known to repository: false`
- `Archive retention outcome known to repository: false`
- `Archive retention register receipt outcome known to repository: false`
- `Archive retention cycle outcome known to repository: false`
- `Archive retention cycle index receipt outcome known to repository: false`
- `Go-live approved by this report: false`
- `Live server go-live verified by this report: false`
- `Live archive verified by this report: false`

Interpretation: Stage 6R creates a deterministic, redacted retention cycle
index receipt package on top of Stage 6Q. It still does not approve go-live, does
not prove that a live production server was observed or archived, and does not
store live logs, metrics, patient data, backup contents, external archive
contents, external receipt values, external reconciliation values, final
  closure values, final closure receipt values, retention receipt values,
  retention schedules, retention cycle values, retention cycle receipt values,
  disposal holds, exception registers, retention review evidence, or archive
  outcomes in git.

## Hypothesis

- `Stage 6S` is likely next, but its scope is not confirmed by repository
  files yet.

## Lovable sync rule

Lovable sync checks must run against `main` unless GitHub Branch Switching is
explicitly enabled for the project. Do not send a Lovable sync prompt for a new
stage while its Pull request is only open or ready for review. Required order:
create PR, wait for checks, merge PR into `main`, verify local `main` contains
the stage files, then send the Lovable sync prompt.

## Immediate continuation recommendation

1. Send the Stage 6R Lovable sync prompt only after merging the Stage 6R PR and
   confirming local `main` contains Stage 6R files.
2. After Stage 6R is confirmed in Lovable, define Stage 6S scope
   from repository facts.
3. Keep final go-live approval, raw live evidence, live logs, live metrics,
   patient data, credentials, object keys, backup contents, external archive
   contents, and final archive outcomes outside git.

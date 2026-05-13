# Stage 3M — Release operations dashboard for auth/assets readiness

## 1. Purpose

This document defines a small, sanitized release operations dashboard that
release reviewers and on-call owners can run locally or in CI to get a single
snapshot of repository and CI health before approving a release or
investigating an incident. It does not change runtime product behavior,
backend configuration, or workflow scheduling.

## 2. Source scripts

- Dashboard script: `scripts/release-status.mjs`.
- Dashboard tests: `scripts/release-status.test.mjs`.
- Dashboard smoke test: `scripts/release-status-smoke.test.mjs`.
- Privacy detector: `scripts/check-release-status-privacy.mjs`.
- Privacy detector tests: `scripts/check-release-status-privacy.test.mjs`.
- Release-status sync checker: `scripts/check-release-status-sync.mjs`.
- Release-status workflow gate checker:
  `scripts/check-release-status-workflow-gate.mjs`.
- Release-status workflow gate tests:
  `scripts/check-release-status-workflow-gate.test.mjs`.
- Release-status CI sync gate: `scripts/ci-release-status-sync-gate.mjs`.
- Release-status CI sync gate annotation tests:
  `scripts/ci-release-status-sync-gate.test.mjs`.
- Focused preflight: `scripts/preflight-release-status.mjs`.
- npm scripts:
  - `npm run release:status`
  - `npm run release:status:json`
  - `npm run release:status:html`
  - `npm run release:status:offline`
  - `npm run typecheck`
  - `npm run test:release-status`
  - `npm run test:release-status-privacy`
  - `npm run test:release-status-smoke`
  - `npm run test:release-status-ci`
  - `npm run check:release-status-privacy`
  - `npm run check:release-status-sync`
  - `npm run check:release-status-workflow-gate`
  - `npm run ci:release-status-sync`
  - `npm run preflight:release-status`
  - `npm run e2e:release-status`

The CLI does not mutate git state or source files. It writes only the explicit
output/history artifacts requested by `--output` and `--history`.

## 3. What the dashboard reports

- Repo and branch, validated against safe character sets.
- Current short SHA and a `https://github.com/<repo>/commit/<sha>` link.
- Local working-tree state: clean or `N changed file(s)` plus up to five
  truncated path hints.
- Latest run conclusion for the tracked main workflows:
  - `no-deno-locks`
  - `auth-assets-smoke-skip`
  - `frontend-auth-assets`
  - `e2e-smoke`
  - `backend-guardrails`
- A safe `https://github.com/<repo>/actions/runs/<run_id>` link for each
  workflow when the GitHub Actions API returns a run id. The dashboard never
  prints run query parameters, tokens, or artifact download URLs.
- Deno lock guard status from `node scripts/check-no-deno-locks.mjs`.
- E2E artifact summary presence at
  `test-results/e2e-nightly-full-artifact-summary.md` with size and
  modification timestamp when present.
- Overall status: `ok`, `incomplete`, or `fail`.

## 4. Privacy rules

- The script must not print tokens, cookies, signed URLs, emails, patient
  names, storage paths, or raw env values.
- All free-text fields pass through the shared `redact` helper from
  `scripts/write-e2e-artifact-summary.mjs`.
- Workflow names, run numbers, repo, and branch are validated against strict
  character sets. Anything else falls back to a default or the string
  `unknown`.
- SHAs that do not match the hex pattern are rendered as `unknown` instead of
  being printed verbatim.
- The CLI does not open the e2e artifact summary contents; it reports only
  size and modification time.
- `scripts/check-release-status-privacy.mjs` scans generated markdown, JSON,
  HTML, and release-history JSONL files before they are uploaded by CI.

## 5. Local usage

```bash
npm run release:status
npm run release:status:json
npm run release:status:html
npm run release:status:offline
node scripts/release-status.mjs --offline --output test-results/release-status.md
node scripts/release-status.mjs --offline --json --output test-results/release-status.json
node scripts/release-status.mjs --offline --html --output test-results/release-status.html
node scripts/release-status.mjs --offline --output test-results/release-status.md --history test-results/release-history.jsonl
```

The dashboard is meant to be pasted into release notes, incident notes, or PR
comments after a quick visual review. Reviewers should still follow Stage 3C,
Stage 3D, Stage 3E, Stage 3F, and Stage 3L for authoritative checks.

## 6. Output modes and release history

- Markdown is the default format and is intended for PR comments, incident
  notes, and GitHub step summaries.
- `--json` or `--format json` writes a structured sanitized payload with the
  same data as the markdown report.
- `--html` or `--format html` writes a static visual report suitable for local
  browser review or CI artifact download.
- `--output <path>` writes the sanitized report to disk and creates parent
  directories when needed.
- `--history <path>` appends a compact sanitized JSONL release-history entry
  with timestamp, repo, branch, short SHA, overall status, deno-lock status,
  artifact presence, and workflow conclusions.
- The CLI prints only short sanitized `wrote <path>` and `appended <path>`
  messages when files are used.

## 7. Visual report

The HTML mode is the lightweight UI export for release status. It contains:

- an overall status badge;
- repo, branch, and current SHA;
- working-tree state and changed path hints;
- deno-lock guard status;
- e2e artifact summary presence;
- latest main workflow conclusions with safe GitHub Actions links.

The visual report is static HTML with inline CSS only. It has no scripts, no
external assets, no cookies, and no embedded artifact contents.

## 8. Privacy detector

Run the detector directly when reviewing generated release-status artifacts:

```bash
npm run check:release-status-privacy -- \
  test-results/release-status.md \
  test-results/release-status.json \
  test-results/release-status.html \
  test-results/release-history.jsonl
```

The detector flags likely bearer tokens, cookies, URL token parameters, JSON
token fields, emails, `patient_full_name`, `actor_email`,
`storage_object_path`, Supabase keys, service-role env values, and
JWT-shaped values. Redacted placeholders such as `[redacted-cookie]` and
`[redacted-url-param]` are allowed.

## 9. CI automation

Workflow: `.github/workflows/release-status.yml`.
Typecheck workflow: `.github/workflows/typecheck.yml`.

The workflow runs on relevant PRs, pushes, and manual dispatch. It:

- runs `npm run preflight:release-status`;
- inherits the `typecheck-ci` gate through `npm run typecheck` in local
  preflight and through the standalone `.github/workflows/typecheck.yml`
  workflow on TypeScript/config changes;
- runs `npm run ci:release-status-sync` as the explicit `ci-sync-gate`
  before generated artifacts are written. The gate combines
  `npm run check:release-status-workflow-gate`,
  `npm run check:release-status-sync`, `node scripts/check-stage3-docs.mjs`,
  `node scripts/check-no-deno-locks.mjs`, and `git diff --check`;
- keeps `report-write-block` explicit on the report-writing step through
  `if: ${{ success() }}`. If preflight or `ci-sync-gate` fails, markdown,
  JSON, HTML, and history files are not written or uploaded as fresh reports;
- the focused preflight now includes `src/lib/release-status-ui.test.ts` and
  `src/pages/sys/SysReleaseStatusPage.test.tsx` so browser-viewer helpers and
  UI wiring are exercised before generated artifacts are written;
- writes `test-results/release-status.md`;
- appends `test-results/release-history.jsonl`;
- writes `test-results/release-status.json`;
- writes `test-results/release-status.html`;
- runs `npm run check:release-status-privacy` on all generated files;
- appends the markdown dashboard to `$GITHUB_STEP_SUMMARY`;
- uploads all four reports as `release-status-<run_id>` for seven days.

The workflow passes `GITHUB_TOKEN` only to the GitHub Actions API request.
The token is never printed in markdown, JSON, HTML, history, or logs by
`scripts/release-status.mjs`.

## 10. Test coverage

`npm run test:release-status` covers:

- rendering the dashboard with SHA, workflows, deno guard, artifact presence,
  and overall status;
- marking overall `fail` when any workflow failed or the deno guard failed;
- redacting tokens, cookies, emails, patient names, signed URLs, storage paths,
  and Supabase keys;
- rejecting unsafe repo, branch, workflow, and run-number values;
- running the CLI in `--offline` mode;
- building sanitized JSON output;
- building sanitized HTML visual output;
- writing markdown/JSON/HTML reports to files;
- appending sanitized release-history JSONL entries.

`npm run test:release-status-privacy` covers detector positives, redacted
placeholders, generated markdown/JSON/HTML/history outputs, and CLI exit
codes.

`npm run test:release-status-smoke` writes markdown, JSON, HTML, and history
JSONL files into a temp directory, verifies their basic shape, and runs
`npm run check:release-status-privacy` against those generated files.

`npm run test:release-status-ci` verifies the workflow success condition,
CI-gate-before-report-write ordering, and the GitHub annotation strings used by
`scripts/ci-release-status-sync-gate.mjs`.

`npm run e2e:release-status` runs only `e2e/sys-release-status.pw.ts`. It is
the targeted browser verification for the system-admin release-status page and
is also part of the fast e2e smoke set.

## 11. Local preflight

Use this local preflight before merging changes to the release dashboard:

```bash
npm run preflight:release-status
```

It sequentially runs the release-status tests, privacy detector tests,
the status report smoke test, CI annotation/workflow-gate tests, `npm run
typecheck`, `src/lib/blob-utils.test.ts`, markdown/json/html/history
generation, `src/pages/sys/SysAccessEventsPage.test.tsx`, privacy scan, Stage
3 docs guard, and the deno-lock guard. The success sentinel is:

```text
[preflight-release-status] OK
```

`npm run preflight:e2e-artifacts` remains the broader e2e artifact-reporting
preflight. Use it when touching Stage 3L or the nightly full-e2e artifact
summary flow.

## 12. System admin UI viewer

System administrators can review the same release-status surface in the app:

- Route: `/sys/release-status`.
- Sidebar entry: `Релиз-статус` in the `system_admin` system group.
- Page component: `src/pages/sys/SysReleaseStatusPage.tsx`.
- Browser helpers: `src/lib/release-status-ui.ts`.
- Unit tests:
  - `src/lib/release-status-ui.test.ts`
  - `src/pages/sys/SysReleaseStatusPage.test.tsx`
- Fast smoke: `e2e/sys-release-status.pw.ts`.

The page is intentionally local/demo-only. It does not call GitHub, does not
run shell commands from the browser, and does not read files from disk. It
shows a safe visual preview, supports markdown/JSON/HTML/history export from
the current sanitized snapshot, runs a browser-side privacy check before
download, and displays the local terminal command
`npm run preflight:release-status` for the operator to run manually.

The viewer also exposes the UI-side release operator guardrails:

- RBAC scope is visible in the page and the route remains available only to
  `system_admin` through the demo `RoleGuard`; e2e verifies that
  `clinic_admin` sees the no-access screen.
- Export is routed through one shared browser export builder. The UI can export
  one selected format or a unified four-file bundle (Markdown, JSON, HTML, and
  history JSONL) after the same privacy scan passes.
- The page compares the current sanitized main snapshot with the previous
  stored snapshot, including overall status movement, artifact availability,
  and changed workflow conclusions.
- The privacy preview shows scanned line count, detector category count, and
  expandable detector categories before any export.
- Operators can paste a sanitized `release-history.jsonl` fragment into the
  page, import it locally, and choose an imported baseline for comparison.
  Imports are blocked when the browser-side privacy detector sees tokens,
  emails, patient names, storage paths, or raw env values.
- Baseline comparison stays browser-only: imported history is not uploaded, is
  not persisted, and only normalized workflow names, conclusions, SHA, branch,
  artifact presence, and guard status are used.
- The import panel shows a history preview before import: total parsed lines,
  accepted baseline count, skipped line count, privacy finding count, latest
  SHA/status, and the first safe history records.
- The history preview includes JSONL format validation details, status/search
  filters (`filterReleaseHistoryRecords`), and a dry-run import mode that runs
  parse/privacy checks without changing the selected comparison baseline.
- Long imported histories are paginated in the browser (`history-pagination`)
  through `paginateReleaseHistoryRecords`, so reviewers can scan filtered
  records without losing the parse summary.
- The history preview now supports `advanced-history-filters`: status,
  deno-lock result, artifact presence, workflow conclusion, and free-text
  search are combined by `filterReleaseHistoryRecordsAdvanced`.
- The history preview supports `history-filter-presets`: built-in presets and
  up to eight saved browser-local presets. Preset names and filters are
  normalized by `buildReleaseHistoryFilterPreset` and
  `normalizeReleaseHistoryFilterPreset`, so unsafe names or query values are
  rejected/redacted before storage.
- The preset panel now includes `preset-management-ui`: saved presets can be
  renamed, duplicated, exported as sanitized JSON/XLSX, and imported back from
  a previously exported JSON file. JSON export uses
  `buildReleaseHistoryPresetExportJson`; XLSX export uses
  `buildReleaseHistoryPresetsXlsxBytes`; import uses
  `parseReleaseHistoryPresetExportJson` and blocks privacy findings before
  localStorage is updated.
- Preset import now includes `preset-import-preview`: before import,
  `summarizeReleaseHistoryPresetImport` reports accepted/skipped preset counts,
  privacy finding count, and up to four safe preset names.
- The same panel adds `preset-import-plan` through
  `planReleaseHistoryPresetImport`, including replacements, available preset
  slots, and older saved presets that will be displaced by the import.
- `preset-import-error-focus` gives invalid or privacy-blocked preset JSON the
  same keyboard recovery path as history JSONL: a visible hint list and a
  "К JSON пресетов" focus control.
- Operators can use `preset-clear-undo` to bulk-clear browser-local saved
  presets and restore the last cleared set within the same session.
- Preset operations append browser-local `preset-audit-export` entries. The
  sanitized JSON report is built by `buildReleaseHistoryPresetAuditReport`,
  downloaded with `releaseHistoryPresetAuditFilename`, and must not include
  raw query text, emails, tokens, storage paths, or patient identifiers.
- The selected comparison baseline has a compact `baseline-preview` with SHA,
  generated date, deno-lock status, artifact presence, and the first workflow
  conclusions before the comparison table.
- Each import attempt is appended to a local audit log with timestamp, result,
  accepted/skipped counts, privacy finding count, and a sanitized operator
  message. The audit log is browser-local and is cleared on reload.
- Operators can delete imported baseline records from the current browser
  session and download a sanitized JSON audit report built by
  `buildReleaseImportAuditReport`. The report includes an
  `audit-report-summary` with status counts, totals, selected baseline, and
  active history filters.
- Import audit entries support `audit-log-filters` by status, privacy count,
  and sanitized message/date query through `filterReleaseImportAuditEntries`.
- Operators can download a sanitized `audit-csv-export` via
  `buildReleaseImportAuditCsv` and `releaseHistoryAuditCsvFilename`; the CSV
  keeps summary rows and safe audit columns only.
- Operators can export the current filtered history set through
  `filtered-history-export`: JSONL is built by
  `buildFilteredReleaseHistoryJsonl`, CSV is built by
  `buildFilteredReleaseHistoryCsv`, and both outputs pass the same browser
  privacy scan before download.
- Operators can export the same sanitized matrix through
  `filtered-history-xlsx`: XLSX bytes are built by
  `buildFilteredReleaseHistoryXlsxBytes`, the filename comes from
  `releaseHistoryFilteredXlsxFilename`, and the privacy scan runs before the
  binary file is created.
- JSONL validation now has a visible `import-error-summary` from
  `summarizeReleaseHistoryIssues`, so invalid JSON, schema rejects, and
  privacy-blocked lines are announced as counts and affected line numbers.
- `import-error-actions` add a remediation list and a `Фокус на JSONL с
  ошибкой` control so keyboard users can jump back to the failing JSONL field
  after reading the summary. The control now selects the first affected line
  and announces the focused line number in the page status.
- The local preflight card exposes both `npm run preflight:release-status` and
  `npm run check:release-status-sync`; it also shows
  `npm run ci:release-status-sync` as the same compact CI gate used by
  `.github/workflows/release-status.yml`. E2E asserts the sync-check and CI
  gate commands are visible and copyable from the UI.
- The same card has an announced `CI gate status release status` line so
  operators can see that generated report writes are blocked until preflight
  and `ci:release-status-sync` pass.
- `write-gate-drill` lets reviewers switch between passing and failing gate
  states in the browser. The drill is powered by
  `buildReleaseStatusWriteGateSummary`, lists each gate check, and confirms
  that report writes stay blocked when the workflow success condition,
  release-status workflow, CI sync gate, or deno-lock guard fails.
- The history import textarea and filtered export controls carry
  `history-export-a11y` states: `aria-invalid`, `aria-describedby`, disabled
  no-result exports, and live status updates for JSONL/CSV export completion.
- Import, delete, export, and audit download actions expose
  `operation-busy-states` through disabled controls, button copy, and
  `aria-busy` status/region attributes.
- E2E coverage includes `edge-e2e-validation` for no-result filters,
  advanced history filters, audit-log filters, CSV audit download, and
  sanitized downloaded audit content.
- Import privacy status is announced separately from the general page status,
  so screen-reader users can distinguish "parse succeeded" from "privacy gate
  passed" or "privacy gate blocked".
- The `release-status-sync-checker` (`npm run check:release-status-sync`)
  keeps the release-status page, helper library, unit/e2e tests, workflow,
  preflight, and Stage 3 docs aligned before generated reports are written.
- `ci-sync-gate` (`npm run ci:release-status-sync`) is the workflow-facing
  guard that runs the release-status sync checker, Stage 3 docs guard,
  deno-lock guard, and whitespace diff check together.
- `report-write-block` is the workflow-facing guarantee that release-status
  reports are written only after the gate chain is successful.
- `workflow-gate-checker` (`npm run check:release-status-workflow-gate`)
  verifies that the release-status workflow still contains preflight,
  sync-check, CI gate, `if: ${{ success() }}`, and that the CI gate step
  appears before report generation.
- The local preflight card includes `sync-checker-full-block`: a copyable
  command block with sync checker, Stage 3 docs guard, deno-lock guard, and
  `git status --short` for before-PR and post-Lovable-sync verification.
- `typecheck-ci` runs `npm run typecheck` in TypeScript project build mode.
  The app compiler target is ES2022, so `replaceAll` and other modern string
  APIs are type-checked consistently in local and CI environments.
- `blob-utils` centralizes safe BlobPart creation for XLSX/CSV/download
  helpers. Binary exports should use `blobFromParts` instead of passing
  generic `Uint8Array` values directly to `new Blob(...)`.
- `strict-type-unions` keeps release workflow comparison states, baseline
  source values, import audit entries, and access-events export columns
  narrowed to their explicit literals instead of widening to `string`.
- `empty-mock-call-guard` keeps tests that inspect `mock.calls[0]` from
  indexing possibly empty tuple types; use a small assertion helper before
  reading the first argument.

### 12.1 Typecheck and blob-utils verification report

Post-merge verification after PR #74:

```bash
npm run typecheck
npm test -- --run src/lib/blob-utils.test.ts
```

Expected result:

- `npm run typecheck` exits 0 through `tsc -b --pretty false`.
- `src/lib/blob-utils.test.ts` reports 1 passed file and 2 passed tests.
- No `deno.lock` files are required or generated by either command.

This report is intentionally narrow: it confirms the TypeScript build gate and
the shared BlobPart helper coverage without re-running the broader release,
auth/assets, or e2e suites.

### 12.2 Typecheck/blob preflight and CI release checklist

Use the focused preflight when the change touches TypeScript config, typed
release-status helpers, access-events export helpers, or `blob-utils`:

```bash
npm run preflight:typecheck-blob
```

The command runs, in order:

- `npm run typecheck`
- `npm test -- --run src/lib/blob-utils.test.ts`
- `node scripts/check-stage3-docs.mjs`
- `node scripts/check-no-deno-locks.mjs`
- `git diff --check`

The preflight has a dry-run mode for PR descriptions and Lovable confirmation:

```bash
node scripts/preflight-typecheck-blob.mjs --dry-run
```

CI mirrors the same guard in
`.github/workflows/typecheck-blob-verification.yml`. The workflow first runs
`npm run test:typecheck-blob-preflight`, then `npm run preflight:typecheck-blob`,
and writes a concise GitHub Step Summary.

Release checklist for this slice:

- Local `npm run preflight:typecheck-blob` is green.
- `typecheck-blob-verification` workflow is green on the PR/head ref.
- `typecheck` workflow remains green.
- `node scripts/check-no-deno-locks.mjs` reports no `deno.lock` files.
- Lovable confirms Stage 3M §12.1 and §12.2 are synced without conflicts.

## 13. Write-gate drill and CI annotations

The write-gate drill is the browser-side rehearsal of the CI report-write
block. It is not a shell runner and does not write files; it models the same
release-status conditions that the workflow uses before report generation:

- workflow success condition is present;
- release-status workflow result is successful;
- `npm run ci:release-status-sync` is green;
- deno-lock guard is green.

The drill exposes two operator scenarios:

- `Gate passed` shows `may write release-status reports`.
- `Gate failed` shows `reports stay unwritten` and lists the blocked checks.
- `gate-fail-e2e` is covered by a dedicated Playwright case that switches the
  drill to `Gate failed`, asserts all four blocked checks, confirms the page
  does not announce report-write permission, then switches back to `Gate
  passed`.

CI uses the same policy at workflow level:

- `scripts/check-release-status-workflow-gate.mjs` verifies the YAML contains
  `if: ${{ success() }}` and that `Release-status CI sync gate` runs before
  `Write release status reports`.
- `scripts/ci-release-status-sync-gate.mjs` emits GitHub Actions annotations
  only when `GITHUB_ACTIONS=true`. Passing steps produce
  `Release status gate passed` notices; failures produce
  `Release status gate failed` errors and explicitly state that generated
  release-status reports must stay unwritten.
- `scripts/check-release-status-workflow-gate.test.mjs` and
  `scripts/ci-release-status-sync-gate.test.mjs` keep the success condition,
  gate ordering, and annotation text covered by local tests.
- `annotation-gating-runtime` is verified by running
  `scripts/ci-release-status-sync-gate.mjs` in two runtime environments:
  without `GITHUB_ACTIONS`, where no `::notice` or `::error` annotations may be
  printed, and with `GITHUB_ACTIONS=true`, where the passing gate emits the
  expected `Release status gate passed` and `Release status reports may be
  written` notices.

Use this `full-release-checks` bundle before merging release-status gate
changes:

```bash
npm run preflight:release-status
npm run typecheck
npm run ci:release-status-sync
npm run e2e:release-status
npm run build
node scripts/check-no-deno-locks.mjs
git diff --check
```

## 14. Maintenance rule

- Future workflows added to the tracked list must use safe names matching
  `[A-Za-z0-9._-]+`.
- Do not extend the dashboard to print run IDs, artifact contents, raw
  environment values, credentials, signed URLs, storage paths, or patient
  identifiers.
- New release-status output files must be added to
  `scripts/check-release-status-privacy.mjs`, `.github/workflows/release-status.yml`,
  and `scripts/preflight-release-status.mjs`.
- TypeScript helper or config changes must keep `npm run typecheck`,
  `.github/workflows/typecheck.yml`, and `scripts/preflight-release-status.mjs`
  aligned.
- UI viewer changes must update `src/lib/release-status-ui.ts`,
  `src/pages/sys/SysReleaseStatusPage.test.tsx`, and
  `e2e/sys-release-status.pw.ts` together.
- RBAC, export, release comparison, history-import, history-preview,
  history-pagination, history-filters, advanced-history-filters,
  audit-log-filters, audit-csv-export, operation-busy-states,
  edge-e2e-validation, filtered-history-export, import-error-summary,
  history-export-a11y, jsonl-validation, dry-run-import, import-audit,
  audit-report-summary, audit-report-download, baseline-preview,
  baseline-delete, baseline-selector, privacy-preview,
  history-filter-presets, preset-management-ui, preset-json-xlsx-export,
  preset-import-preview, preset-import-plan, preset-import-error-focus,
  preset-clear-undo, preset-audit-export, sync-checker-full-block,
  ci-sync-gate, report-write-block, filtered-history-xlsx, import-error-actions, jsonl-error-line-selection,
  write-gate-drill, workflow-gate-checker, release-status-sync-checker-ui,
  release-status-e2e-entrypoint, ci-check-annotations, gate-fail-e2e,
  annotation-gating-runtime, full-release-checks, status-report-smoke-test,
  typecheck-ci, blob-utils, strict-type-unions, empty-mock-call-guard,
  and release-status-sync-checker changes must also keep
  `scripts/check-stage3-docs.mjs` and `scripts/check-release-status-sync.mjs`
  aligned with the UI helper names and e2e assertions.
- Cross-link this stage from Stage 3I and Stage 3L when adding new release
  operations docs.

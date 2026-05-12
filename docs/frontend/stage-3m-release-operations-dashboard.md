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
- Privacy detector: `scripts/check-release-status-privacy.mjs`.
- Privacy detector tests: `scripts/check-release-status-privacy.test.mjs`.
- Focused preflight: `scripts/preflight-release-status.mjs`.
- npm scripts:
  - `npm run release:status`
  - `npm run release:status:json`
  - `npm run release:status:html`
  - `npm run release:status:offline`
  - `npm run test:release-status`
  - `npm run test:release-status-privacy`
  - `npm run check:release-status-privacy`
  - `npm run preflight:release-status`

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

The workflow runs on relevant PRs, pushes, and manual dispatch. It:

- runs `npm run preflight:release-status`;
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

## 11. Local preflight

Use this local preflight before merging changes to the release dashboard:

```bash
npm run preflight:release-status
```

It sequentially runs the release-status tests, privacy detector tests,
markdown/json/html/history generation, privacy scan, Stage 3 docs guard, and
the deno-lock guard. The success sentinel is:

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

## 13. Maintenance rule

- Future workflows added to the tracked list must use safe names matching
  `[A-Za-z0-9._-]+`.
- Do not extend the dashboard to print run IDs, artifact contents, raw
  environment values, credentials, signed URLs, storage paths, or patient
  identifiers.
- New release-status output files must be added to
  `scripts/check-release-status-privacy.mjs`, `.github/workflows/release-status.yml`,
  and `scripts/preflight-release-status.mjs`.
- UI viewer changes must update `src/lib/release-status-ui.ts`,
  `src/pages/sys/SysReleaseStatusPage.test.tsx`, and
  `e2e/sys-release-status.pw.ts` together.
- Cross-link this stage from Stage 3I and Stage 3L when adding new release
  operations docs.

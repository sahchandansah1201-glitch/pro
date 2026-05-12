# Stage 3M — Release operations dashboard for auth/assets readiness

## 1. Purpose

This document defines a small, sanitized release operations dashboard that
release reviewers and on-call owners can run locally to get a single
snapshot of repository and CI health before approving a release or before
investigating an incident. It does not change runtime code, tests,
backend configuration, or workflow scheduling.

## 2. Source script

- Script: `scripts/release-status.mjs`.
- Tests: `scripts/release-status.test.mjs`.
- npm script: `npm run release:status`.
- Offline mode: `node scripts/release-status.mjs --offline` skips the
  GitHub Actions API call and is used by tests and offline reviewers.
- The CLI is read-only: it never writes files, never mutates git state,
  and never edits CI configuration.

## 3. What the dashboard reports

- Repo and branch (validated against safe character sets).
- Current short SHA and a `https://github.com/<repo>/commit/<sha>` link.
- Local working-tree state: clean or `N changed file(s)` plus up to five
  truncated path hints.
- Latest run conclusion for the tracked main workflows:
  - `no-deno-locks`
  - `auth-assets-smoke-skip`
  - `frontend-auth-assets`
  - `e2e-smoke`
  - `backend-guardrails`
- A safe `https://github.com/<repo>/actions/runs/<run_id>` link for
  each workflow when the GitHub Actions API returns a run id. The
  dashboard never prints run query parameters, tokens, or artifact
  download URLs.
- Deno lock guard status from `node scripts/check-no-deno-locks.mjs`.
- E2E artifact summary presence at
  `test-results/e2e-nightly-full-artifact-summary.md` with size and
  modification timestamp when present.
- Overall status: `ok`, `incomplete`, or `fail`.

## 4. Privacy rules

- The script must not print tokens, cookies, signed URLs, emails,
  patient names, storage paths, or raw env values.
- All free-text fields pass through the shared `redact` helper from
  `scripts/write-e2e-artifact-summary.mjs`.
- Workflow names, run numbers, repo, and branch are validated against
  strict character sets. Anything else falls back to a default or the
  string `unknown`.
- SHAs that do not match the hex pattern are rendered as `unknown`
  instead of being printed verbatim.
- The CLI does not open the e2e artifact summary contents — only its
  size and modification time.

## 5. Local usage

```bash
npm run release:status            # online, hits GitHub Actions API
npm run release:status:json       # JSON output for tooling
node scripts/release-status.mjs --offline  # offline, used in tests
node scripts/release-status.mjs --output test-results/release-status.md
node scripts/release-status.mjs --json --output test-results/release-status.json
```

The dashboard is meant to be pasted into release notes, incident notes,
or PR comments after a quick visual review. Reviewers should still
follow Stage 3C, Stage 3D, Stage 3E, Stage 3F, and Stage 3L for the
authoritative checks.

## 6. File output and JSON mode

- `--output <path>` writes the sanitized report to disk and creates
  parent directories when needed.
- `--json` or `--format json` writes a structured sanitized payload
  with the same data as the markdown report.
- Markdown is the default format and is intended for PR comments,
  incident notes, and GitHub step summaries.
- JSON is intended for automation and must remain sanitized before it is
  written to disk.
- The CLI prints only a short sanitized `wrote <path>` message when an
  output file is used.

## 7. CI automation

Workflow: `.github/workflows/release-status.yml`.

The workflow runs on relevant PRs, pushes, and manual dispatch. It:

- runs `npm run test:release-status`;
- runs `node scripts/check-stage3-docs.mjs`;
- writes `test-results/release-status.md`;
- writes `test-results/release-status.json`;
- appends the markdown dashboard to `$GITHUB_STEP_SUMMARY`;
- uploads both reports as `release-status-<run_id>` for seven days.

The workflow passes `GITHUB_TOKEN` only to the GitHub Actions API
request. The token is never printed in markdown, JSON, or logs by
`scripts/release-status.mjs`.

## 8. Test coverage

`npm test -- scripts/release-status.test.mjs` covers:

- Rendering the dashboard with sha, workflows, deno guard, artifact
  presence, and overall status.
- Marking overall `fail` when any workflow failed or the deno guard
  failed.
- Redacting tokens, cookies, emails, patient names, signed URLs,
  storage paths, and Supabase keys.
- Rejecting unsafe repo, branch, workflow, and run-number values and
  falling back to defaults.
- Running the CLI in `--offline` mode without leaking secrets.
- Building sanitized JSON output.
- Writing markdown and JSON reports to files.

## 9. Local preflight

Use this local preflight before merging changes to the release dashboard:

```bash
npm run preflight:e2e-artifacts
npm run test:release-status
node scripts/check-stage3-docs.mjs
node scripts/check-no-deno-locks.mjs
node scripts/release-status.mjs --offline --output test-results/release-status.md
node scripts/release-status.mjs --offline --json --output test-results/release-status.json
```

Expected:

- all tests pass;
- the focused e2e artifact preflight includes the release status
  privacy/output-mode tests and ends with `[preflight-e2e-artifacts] OK`;
- `check-stage3-docs` reports all Stage 3 docs verified;
- no `deno.lock` files exist;
- both output files are created and contain no tokens, cookies, signed
  URLs, emails, patient names, storage paths, or raw env values.

## 10. Maintenance rule

- Future workflows added to the tracked list must use safe names matching
  `[A-Za-z0-9._-]+`.
- Do not extend the dashboard to print run IDs, artifact contents, or
  raw environment values.
- Cross-link this stage from Stage 3I and Stage 3L when adding new
  release operations docs.

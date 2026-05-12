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
- A safe `https://github.com/<repo>/actions/runs/<run_number>` link for
  each workflow when a run number is available. The dashboard never
  prints the raw `run_id` or any run query parameters.
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
node scripts/release-status.mjs --offline  # offline, used in tests
```

The dashboard is meant to be pasted into release notes, incident notes,
or PR comments after a quick visual review. Reviewers should still
follow Stage 3C, Stage 3D, Stage 3E, Stage 3F, and Stage 3L for the
authoritative checks.

## 6. Test coverage

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

## 7. Maintenance rule

- Future workflows added to the tracked list must use safe names matching
  `[A-Za-z0-9._-]+`.
- Do not extend the dashboard to print run IDs, artifact contents, or
  raw environment values.
- Cross-link this stage from Stage 3I and Stage 3L when adding new
  release operations docs.

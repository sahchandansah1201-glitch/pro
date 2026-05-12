# Stage 3L — Nightly artifacts report for auth/assets readiness

## 1. Purpose

This report captures the minimum evidence needed to review a nightly full e2e
run without copying sensitive data out of GitHub Actions. It is used when the
nightly run fails, when a manual run is started with artifact upload enabled,
or when a release reviewer asks for full-e2e evidence.

## 2. Source workflow

- Workflow: `.github/workflows/e2e-nightly-full.yml`.
- Schedule: `23 2 * * *`.
- Manual trigger: `workflow_dispatch`.
- Command: `npx playwright test --reporter=list,html --retries=1 --trace=retain-on-failure`.

## 3. Artifact policy

- Default policy: `failure`.
- Manual options: `failure`, `always`, `never`.
- Artifact name pattern: `e2e-nightly-full-report-<run_id>`.
- Retention: 7 days.
- Successful scheduled runs with default policy should not upload artifacts.
- Failed runs, or manual `always` runs, should upload artifacts.
- Generated summary path: `test-results/e2e-nightly-full-artifact-summary.md`.
- Summary writer: `node scripts/write-e2e-artifact-summary.mjs`.
- Summary viewer: `npm run view:e2e-artifacts -- test-results/e2e-nightly-full-artifact-summary.md`.
- Report entry: `playwright-report/index.html`.
- Focused local preflight: `npm run preflight:e2e-artifacts`.

## 4. Expected artifact bundle

The uploaded artifact, when policy allows upload, must include:

- `playwright-report/`
- `test-results/`
- `playwright-report/index.html`
- `test-results/e2e-nightly-full-vite.log`
- `test-results/e2e-nightly-full-artifact-summary.md`

The job summary must state the command, schedule, retry count, artifact policy,
artifact link or not-uploaded status, final result, and the generated artifact
summary content. The generated summary must also include an `Artifact size check`
section for the expected bundle paths so reviewers can see whether the report,
test-results directory, Vite log, and summary file were present when the report
was written. The local summary viewer re-sanitizes this markdown and prints a
compact CLI view with result, upload expectation, report entry, missing artifact
count, and artifact size rows.

## 5. Report fields

Use this template in release notes, incident notes, or PR comments:

```text
Nightly full e2e report
- Date:
- GitHub Actions run:
- Commit SHA:
- Result:
- Artifact policy:
- Artifact uploaded: yes/no
- Artifact name:
- Report entry:
- Bundle paths checked:
  - playwright-report/
  - test-results/
  - playwright-report/index.html
  - test-results/e2e-nightly-full-vite.log
  - test-results/e2e-nightly-full-artifact-summary.md
- Artifact size check:
- Visual-regression status:
- Auth smoke status:
- Failure summary:
- Owner:
- Follow-up issue/PR:
```

## 6. Failure investigation

- Start from the GitHub Actions run summary.
- Use the artifact link instead of copying logs into docs.
- Check `test-results/` first for failed Playwright traces and screenshots.
- Check `playwright-report/` for grouped failures and retry behavior.
- Check `test-results/e2e-nightly-full-vite.log` for app startup failures.
- Check `test-results/e2e-nightly-full-artifact-summary.md` for the sanitized
  run metadata used in the GitHub job summary.
- Run `npm run view:e2e-artifacts -- test-results/e2e-nightly-full-artifact-summary.md`
  to get a compact terminal view before sharing findings in a PR or incident
  note.
- If the artifact size check marks a path as `missing`, start from that path
  before investigating individual test failures.
- If auth smoke skipped because credentials were absent, treat that as expected
  for credential-free CI unless the run was explicitly meant to use real auth.

## 7. Retention and privacy

- Do not paste credentials, signed URLs, storage paths, access tokens, emails,
  full patient names, or service-role keys into this report. The generated
  summary and viewer redact bearer tokens, cookies, access/refresh/id/JWT query
  tokens, JSON token fields, signature values, Supabase keys, storage object
  paths, actor e-mails, patient full-name fields, and doctor e-mail/password
  fields, but reviewers must still avoid adding sensitive text manually.
- Do not extend artifact retention without an explicit incident or release
  review reason.
- If an artifact contains sensitive data, delete it from GitHub Actions and
  use Stage 3D incident response.

## 8. Related dashboards

- For a single-snapshot view of git state, the current SHA, latest main
  GitHub Actions runs, the deno-lock guard status, and the e2e artifact
  summary presence, run `npm run release:status`. See
  [Stage 3M — Release operations dashboard](./stage-3m-release-operations-dashboard.md).
- To attach release status to CI or an incident note, run
  `node scripts/release-status.mjs --output test-results/release-status.md`
  and `node scripts/release-status.mjs --json --output test-results/release-status.json`.
  The `release-status` workflow uploads both files as a short-lived
  `release-status-<run_id>` artifact.

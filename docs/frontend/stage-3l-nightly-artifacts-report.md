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

## 4. Expected artifact bundle

The uploaded artifact, when policy allows upload, must include:

- `playwright-report/`
- `test-results/`
- `test-results/e2e-nightly-full-vite.log`

The job summary must state the command, schedule, retry count, artifact policy,
artifact link or not-uploaded status, and final result.

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
- Bundle paths checked:
  - playwright-report/
  - test-results/
  - test-results/e2e-nightly-full-vite.log
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
- If auth smoke skipped because credentials were absent, treat that as expected
  for credential-free CI unless the run was explicitly meant to use real auth.

## 7. Retention and privacy

- Do not paste credentials, signed URLs, storage paths, access tokens, emails,
  full patient names, or service-role keys into this report.
- Do not extend artifact retention without an explicit incident or release
  review reason.
- If an artifact contains sensitive data, delete it from GitHub Actions and
  use Stage 3D incident response.

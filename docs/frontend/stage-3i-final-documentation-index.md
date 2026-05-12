# Stage 3I — Final documentation index for auth/assets readiness

## 1. Purpose

This document is the final index for the auth/assets readiness
documentation chain. It is documentation only and does not change
runtime code, tests, scripts, CI, or backend configuration.

## 2. Full documentation map

- Stage 1I — Auth/assets readiness: [docs/frontend/stage-1i-auth-assets-readiness.md](./stage-1i-auth-assets-readiness.md)
- Stage 3A — Deployment runbook: [docs/frontend/stage-3a-deployment-runbook.md](./stage-3a-deployment-runbook.md)
- Stage 3B — Rollback drill: [docs/frontend/stage-3b-rollback-drill.md](./stage-3b-rollback-drill.md)
- Stage 3C — Production smoke checklist: [docs/frontend/stage-3c-production-smoke.md](./stage-3c-production-smoke.md)
- Stage 3D — Incident response: [docs/frontend/stage-3d-incident-response.md](./stage-3d-incident-response.md)
- Stage 3E — Release decision record: [docs/frontend/stage-3e-release-decision-record.md](./stage-3e-release-decision-record.md)
- Stage 3F — Release audit index: [docs/frontend/stage-3f-release-audit-index.md](./stage-3f-release-audit-index.md)
- Stage 3G — Final handoff summary: [docs/frontend/stage-3g-final-handoff-summary.md](./stage-3g-final-handoff-summary.md)
- Stage 3H — Release reviewer FAQ: [docs/frontend/stage-3h-release-reviewer-faq.md](./stage-3h-release-reviewer-faq.md)
- Stage 3J — GitHub-first working mode: [docs/frontend/stage-3j-github-lovable-working-mode.md](./stage-3j-github-lovable-working-mode.md)
- Stage 3K — Lovable suggestions backlog: [docs/frontend/stage-3k-lovable-suggestions-backlog.md](./stage-3k-lovable-suggestions-backlog.md)
- Stage 3L — Nightly artifacts report: [docs/frontend/stage-3l-nightly-artifacts-report.md](./stage-3l-nightly-artifacts-report.md)
- Stage 3M — Release operations dashboard: [docs/frontend/stage-3m-release-operations-dashboard.md](./stage-3m-release-operations-dashboard.md)

## 3. Verification map

Run these on the target ref:

```bash
npm run preflight:auth-assets
npm run test:smoke-auth-assets
npm run test:e2e-artifacts
npm run preflight:e2e-artifacts
npm run view:e2e-artifacts -- test-results/e2e-nightly-full-artifact-summary.md
npm run test:release-status
npm run test:release-status-privacy
npm run preflight:release-status
npm test -- --run src/lib/release-status-ui.test.ts src/pages/sys/SysReleaseStatusPage.test.tsx
npx playwright test e2e/sys-release-status.pw.ts
node scripts/release-status.mjs --offline
node scripts/release-status.mjs --offline --output test-results/release-status.md
node scripts/release-status.mjs --offline --json --output test-results/release-status.json
node scripts/release-status.mjs --offline --html --output test-results/release-status.html
node scripts/release-status.mjs --offline --output test-results/release-status.md --history test-results/release-history.jsonl
node scripts/check-release-status-privacy.mjs test-results/release-status.md test-results/release-status.json test-results/release-status.html test-results/release-history.jsonl
node scripts/check-stage3-docs.mjs
node scripts/check-no-deno-locks.mjs
git status --short
```

All listed commands must complete cleanly.
The focused Stage 3 docs guard is standalone and does not require
`npm ci` or a lock-file change.

## 4. Release-readiness status

- The documentation chain is indexed through Stage 3M.
- Lovable follow-up suggestions are tracked in Stage 3K before they
  become implementation scope.
- No runtime changes are included in Stage 3I.
- The already-known preserved `M package-lock.json` is expected in
  `git status --short` and must not be deleted, manually regenerated, or
  reverted.
- No `deno.lock` files are allowed anywhere in the repository.
- Real-auth smoke remains optional/local; credential-free CI is the
  default.
- Secrets, signed URLs, storage paths, passwords, access tokens, and
  service-role keys (`SUPABASE_SERVICE_ROLE_KEY`) must not be recorded
  in docs, logs, screenshots, or issue notes.

## 5. Maintenance rule

- Future work must create a new stage instead of editing this completed
  readiness chain for unrelated feature work.
- Only documentation corrections or link fixes should touch Stage 3
  docs after handoff.

## 6. GitHub to Lovable sync pilot

- Codex-authored changes should land in GitHub first, then sync into
  Lovable from the connected repository.
- For default Lovable sync, merge the reviewed branch into `main`.
- If Lovable branch switching is enabled, verify the branch directly
  before merging.
- Lovable should confirm synced files only; it should not rewrite,
  regenerate, or expand the synced change.

## 7. Pilot result

- PR #1 merged the pilot note into `main`.
- Lovable confirmed the synced section exists in this document.
- No sync conflicts were reported.
- Use the same GitHub-first workflow for future Codex-authored changes.

## 8. Documentation section checklist

- [x] Stage document map is present.
- [x] Verification commands are present.
- [x] Stage 3 heading and local-link guard is present.
- [x] Release-readiness status is present.
- [x] Maintenance rule is present.
- [x] GitHub to Lovable sync workflow is present.
- [x] Pilot result is present.
- [x] GitHub-first working mode is linked.
- [x] Lovable suggestions backlog is linked.
- [x] Nightly artifacts report is linked.
- [x] Release operations dashboard is linked.
- [x] Release operations dashboard file output, JSON output, and CI workflow
  are documented.
- [x] Release operations dashboard HTML output, release-history JSONL,
  privacy detector, and focused local preflight are documented.
- [x] System admin release-status UI viewer and e2e smoke coverage are
  documented.

## 9. Sync changelog

- PR #1: established the GitHub to Lovable sync pilot note.
- PR #2: recorded the successful pilot result after Lovable confirmed
  the synced section and no sync conflicts.
- PR #3: added this documentation checklist and sync changelog.
- PR #4: added the standalone Stage 3 docs guard.
- PR #22: added the Lovable suggestions backlog and triage rule.
- PR #23: added the Lovable suggestions triage checklist template.
- PR #24: recorded repeated real patient creation/deletion suggestions
  as deferred backend-stage work.
- PR #25: recorded backend wiring for patient create/delete as deferred
  persistence-stage work.
- PR #26: recorded patient form, create/delete verification, and
  real-flow status logging triage.
- PR #27: added UX-review rationale for keeping real patient
  create/delete out of the current demo UI.
- PR #28: recorded demo-only patient action guard/status suggestions
  in the Lovable backlog.
- PR #29: surfaced patient action gate feedback in the demo UI and
  recorded demo e2e triage.
- PR #30: added Playwright coverage for the patient demo flow and
  confirmed the patient action gate is exposed through accessible roles
  and status announcements.
- PR #31: added reload coverage for local patient demo changes and
  hardened patient action live-region announcements.
- PR #32: linked the patient create CTA to the demo gate note and
  added keyboard accessibility coverage for demo patient actions.
- PR #51: added the nightly artifacts report and hardened Stage 3 docs
  checks for the nightly full e2e artifact bundle.
- PR #52: added the generated nightly artifact summary writer, workflow
  wiring, and log-safety tests for the nightly artifact report.
- PR #53: hardened nightly artifact summaries with report entry links,
  expanded redaction coverage, artifact size checks, and a focused local
  e2e artifact preflight.
- PR #54: added a sanitized CLI viewer for generated e2e artifact summaries,
  expanded redaction rules again, and made focused preflight print step
  results.
- Main update `da2bdd7`: added the Stage 3M release operations dashboard CLI
  (`scripts/release-status.mjs`, `npm run release:status`) with sanitized
  output, offline mode, and log-safety tests, plus cross-links from
  Stage 3I and Stage 3L.
- PR #55: extended Stage 3M with markdown/JSON file output,
  `.github/workflows/release-status.yml`, GitHub step-summary reporting,
  uploaded release-status artifacts, and stricter privacy coverage.
- PR #56: extended Stage 3M with HTML visual reports, release-history
  JSONL, a focused privacy detector, `npm run preflight:release-status`,
  and CI upload of markdown/JSON/HTML/history artifacts.
- PR #57: added `/sys/release-status`, browser-side release-status preview
  and export, privacy scan feedback, local preflight command handoff, and
  fast-smoke coverage via `e2e/sys-release-status.pw.ts`.
- Future Codex-authored changes should use the same GitHub-first
  handoff and a short Lovable confirmation prompt.

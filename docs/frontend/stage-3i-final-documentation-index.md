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

## 3. Verification map

Run these on the target ref:

```bash
npm run preflight:auth-assets
npm run test:smoke-auth-assets
node scripts/check-no-deno-locks.mjs
git status --short
```

All four must complete cleanly.

## 4. Release-readiness status

- The documentation chain is complete through Stage 3I.
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
- [x] Release-readiness status is present.
- [x] Maintenance rule is present.
- [x] GitHub to Lovable sync workflow is present.
- [x] Pilot result is present.

## 9. Sync changelog

- PR #1: established the GitHub to Lovable sync pilot note.
- PR #2: recorded the successful pilot result after Lovable confirmed
  the synced section and no sync conflicts.
- Future Codex-authored changes should use the same GitHub-first
  handoff and a short Lovable confirmation prompt.

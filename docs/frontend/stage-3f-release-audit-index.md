# Stage 3F — Release audit index for auth/assets readiness

## 1. Purpose

This document is the single entry point for auditing a release of the
auth/assets readiness scope. It collects the operational stage docs, the
evidence commands a reviewer must run, the invariants the release must
preserve, and a reviewer checklist with a final audit outcome block.

It is documentation only. It does not change runtime code, CI workflows,
tests, scripts, or backend configuration.

## 2. Stage document map

- Stage 3A — Deployment runbook: [docs/frontend/stage-3a-deployment-runbook.md](./stage-3a-deployment-runbook.md)
- Stage 3B — Rollback drill: [docs/frontend/stage-3b-rollback-drill.md](./stage-3b-rollback-drill.md)
- Stage 3C — Production smoke checklist: [docs/frontend/stage-3c-production-smoke.md](./stage-3c-production-smoke.md)
- Stage 3D — Incident response: [docs/frontend/stage-3d-incident-response.md](./stage-3d-incident-response.md)
- Stage 3E — Release decision record: [docs/frontend/stage-3e-release-decision-record.md](./stage-3e-release-decision-record.md)

## 3. Evidence commands

Run these on the target ref before signing off:

```bash
npm run preflight:auth-assets
npm run test:smoke-auth-assets
node scripts/check-no-deno-locks.mjs
git status --short
```

All four must complete cleanly. `git status --short` must show no
unexpected modifications (notably no regenerated `package-lock.json` and
no new `deno.lock` files).

## 4. Release invariants

- No `deno.lock` files exist anywhere in the repository.
- `package-lock.json` is preserved and not manually regenerated as part
  of this documentation stage.
- No secrets, passwords, access tokens, signed URLs, storage paths, or
  service-role keys are recorded in docs, screenshots, logs, or issue
  notes.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must not appear in
  frontend env, config, or bundles.
- Real-auth smoke remains local/optional unless explicitly approved for
  a specific release.
- Credential-free CI remains the default.

## 5. Reviewer checklist

- [ ] Stage 3A deployment steps reviewed.
- [ ] Stage 3B rollback path reviewed.
- [ ] Stage 3C production smoke path reviewed.
- [ ] Stage 3D incident response path reviewed.
- [ ] Stage 3E go/no-go decision evidence reviewed.
- [ ] Preflight and deno-lock checks verified on target ref.

## 6. Audit outcome

- Target ref:
- Audit date:
- Reviewer:
- Outcome: GO / NO-GO / DEFERRED

Notes that contain secrets or sensitive screenshots are kept outside the
repository.

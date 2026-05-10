# Stage 3D — Production incident response for auth/assets readiness

## 1. Purpose

- Response checklist for production incidents involving auth/assets frontend behavior.
- Does not change runtime behavior.
- Complements Stage 3A deploy, Stage 3B rollback drill, Stage 3C smoke.

## 2. Severity triggers

- Sev1:
  - login unavailable for all users.
  - protected routes expose app content to anonymous users.
  - visible secret/token/signed URL/storage path exposure.
- Sev2:
  - doctor assets panel unusable for configured doctors.
  - preview unavailable for all assets but safe errors render.
  - logout broken for authenticated users.
- Sev3:
  - isolated asset row failure.
  - non-blocking warnings only.
  - smoke optional preview check fails on one visit but safe errors render.

## 3. First response

1. Stop rollout/promotion if active.
2. Capture safe facts:
   - route
   - browser
   - timestamp
   - user role
   - screenshot with no secrets
3. Do not paste passwords, tokens, signed URLs, storage paths, or service-role keys (`SUPABASE_SERVICE_ROLE_KEY`) into notes.
4. Run/inspect:
   - `frontend-auth-assets` workflow status
   - `auth-assets-smoke-skip` workflow status
   - `npm run preflight:auth-assets` locally if reproducible
   - `node scripts/check-no-deno-locks.mjs`
5. Determine if issue is:
   - frontend deploy
   - frontend env config
   - backend/Edge Function
   - Supabase auth/session
   - test account/credential issue

## 4. Decision tree

- If secrets/signed URLs/storage paths are visible: treat as Sev1, stop rollout, rollback per Stage 3B, do not share screenshots broadly.
- If env vars are missing/wrong (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`): fix env config first, redeploy/restart as needed.
- If backend/Edge Function outage but frontend safe errors render: route to backend incident; frontend rollback may not help.
- If auth routing broken: use Stage 3B rollback drill.
- If only non-blocking warnings (React Router future flags, Browserslist age, Vite chunk size): do not rollback.

## 5. Verification after mitigation

- Run Stage 3C production smoke path.
- Confirm `/login`.
- Confirm protected route redirect.
- Confirm return-to.
- Confirm doctor imaging assets panel safe state/rows.
- Confirm preview has no signed URL visible text.
- Confirm logout.
- Confirm no forbidden text:
  - `storageObjectPath`
  - `storage_object_path`
  - `exif`
  - raw storage path
- Confirm incident notes contain no secrets.

## 6. Escalation contacts placeholders

- Release owner: recorded outside repo.
- Rollback owner: recorded outside repo.
- Backend/Supabase owner: recorded outside repo.
- Security/privacy reviewer: recorded outside repo.

## 7. Incident closure

- User-visible behavior restored.
- CI status known.
- Root cause category recorded.
- Follow-up stage created if code/doc changes are needed.
- No emergency `deno.lock` or `package-lock.json` churn committed.
- Sensitive artifacts/screenshots handled outside repo.
- Release decision and incident-readiness evidence are recorded in docs/frontend/stage-3e-release-decision-record.md.

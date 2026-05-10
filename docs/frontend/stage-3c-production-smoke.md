# Stage 3C — Production smoke checklist for auth/assets readiness

## 1. Purpose

- Manual production smoke checklist after deploying the auth/assets readiness slice.
- Does not replace CI/preflight.
- Does not require writing secrets into docs/logs.

## 2. Preconditions

- `frontend-auth-assets` workflow green on deployed ref.
- `auth-assets-smoke-skip` workflow green/skipped as expected.
- `npm run preflight:auth-assets` green before deploy.
- `node scripts/check-no-deno-locks.mjs` green.
- Frontend env configured:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- No `SUPABASE_SERVICE_ROLE_KEY` in frontend env.
- Doctor test account available; credentials handled outside repo/docs.

## 3. Smoke path

1. Open `/login`.
2. Sign in as doctor user.
3. Confirm redirect to doctor home.
4. Open a protected doctor route while signed out in a fresh session; confirm redirect to `/login`.
5. Confirm login return-to works for an allowed doctor route.
6. Open a doctor visit imaging tab.
7. Confirm assets panel is not in demo/unconfigured mode when env/auth are configured.
8. Confirm assets panel shows one of:
   - asset rows,
   - safe empty state,
   - safe configured error state.
9. Open preview on an asset if available.
10. Confirm no signed URL appears in visible text.
11. Confirm no raw storage path / `storageObjectPath` / `storage_object_path` / `exif` appears.
12. Logout and confirm return to `/login`.

## 4. Optional real-auth smoke command

- `npm run smoke:auth-assets`
- Required env vars:
  - `E2E_DOCTOR_EMAIL`
  - `E2E_DOCTOR_PASSWORD`
  - `E2E_VISIT_ROUTE`
- Optional env vars:
  - `E2E_EXPECT_ASSET_ROW=1`
  - `E2E_TRY_PREVIEW=1`
- Never paste credentials, tokens, or signed URLs into logs or issues.

## 5. Pass criteria

- Auth works.
- Protected route redirect works.
- Return-to works.
- Assets panel leaves demo mode when configured.
- Assets safe state or rows render.
- Preview safe.
- Logout works.
- No forbidden text visible.
- No secrets recorded.

## 6. Fail criteria and next step

- If smoke fails due to env config, fix env first.
- If smoke fails due to frontend behavior, stop rollout and use Stage 3B rollback drill (docs/frontend/stage-3b-rollback-drill.md).
- If backend/Edge Function outage returns safe frontend errors, assess backend separately.
- Do not commit emergency `deno.lock` / `package-lock.json` churn.

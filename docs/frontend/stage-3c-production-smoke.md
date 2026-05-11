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
- If production smoke fails after release, use docs/frontend/stage-3d-incident-response.md.
- Smoke result (pass / fail / deferred) is recorded in docs/frontend/stage-3e-release-decision-record.md.

## 7. Fast e2e smoke vs full e2e

- Fast smoke: `npm run e2e:smoke` runs the stable subset
  (`operator-status-badge-smoke`, `patients-demo-flow`, `sys-access-events`,
  `auth-assets-smoke`). Use for pre-merge sanity, post-deploy check, and
  release decision (Stage 3E). Excludes visual-regression screenshot specs.
- Full e2e: `npx playwright test` runs every `e2e/*.pw.ts` including
  visual-regression baselines (Linux-only, see
  `e2e/admin-analytics-visual-regression.pw.ts`). Use before tagging a
  release or when touching shared UI primitives.
- `auth-assets-smoke` skips itself when credential env vars are missing;
  a pure skip is a pass for the fast smoke.

## 8. CI fast smoke workflow

- GitHub Actions workflow: `.github/workflows/e2e-smoke.yml`.
- Default mode: `auth_smoke=skip`. The workflow runs `npm run e2e:smoke`,
  includes `auth-assets-smoke`, and provides no `E2E_DOCTOR_*` secrets; the
  credential-gated auth spec should skip cleanly.
- Manual mode: `auth_smoke=off`. The workflow runs
  `npm run e2e:smoke:no-auth`, excluding the credential-gated auth spec.
- The workflow starts local Vite on `127.0.0.1:8080` and uploads
  `playwright-report/`, `test-results/`, and the Vite log as an
  `e2e-smoke-report-*` artifact.
- CI runs the fast smoke with one retry and retains Playwright traces on
  failures so flaky failures still leave diagnosable artifacts.
- Pull requests receive a sticky `e2e-smoke summary` comment with result,
  mode, retry count, artifact name, and run URL.
- Use the artifact when diagnosing smoke failures. Do not add production
  credentials or signed URLs to the workflow logs.

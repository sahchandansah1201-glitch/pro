# Stage 1I — Auth + Assets UI readiness checklist

Concise, project-local checklist for verifying the finished Stage 1E–1I
chain (assets backend + real-auth frontend + assets UI) without changing
any runtime behavior. Pair this with `docs/backend/stage-1e-runbook.md`
for the backend half.

---

## Quick index

- Stage 2E assets UI release checklist — Section 9
- CI alignment and summaries — Section 10
- Final local release runbook — Section 11
- Troubleshooting — Section 12
- Local deterministic guard — `npm run preflight:auth-assets`
- Optional real-auth smoke — `npm run smoke:auth-assets`
- Smoke runner log-safety test — `npm run test:smoke-auth-assets`
- E2E artifact summary log-safety test — `npm run test:e2e-artifacts`
- Focused e2e artifact preflight — `npm run preflight:e2e-artifacts`

---

## 1. What is now covered

Backend (Stage 1E):
- `GET  /functions/v1/api-read/doctor/visits/:visitId/assets` — list visit assets.
- `POST /functions/v1/api-write/doctor/visits/:visitId/assets/upload` — upload an asset.
- `GET  /functions/v1/api-read/doctor/assets/:assetId/download-url` — signed download URL.
- Safe DTO contract: no `storageObjectPath`, no `storage_object_path`,
  no `exif`, and no raw storage paths (`clinic/<id>/visit/<id>/...`)
  ever leave the API or are rendered in the UI.

Frontend auth (Stage 1F–1H):
- Real Supabase auth client (`src/lib/supabase-client.ts`) gated on
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `AuthProvider` / `useAuth` (`src/context/AuthContext.tsx`).
- `LoginForm` (`src/components/auth/LoginForm.tsx`) + role mapping
  (`src/lib/auth-role.ts`: `app_metadata.role` → `user_metadata.role`
  → fallback `"doctor"`, accepted only from `src/lib/roles.ts`).
- Logout affordance + error/disabled-state hardening in
  `src/components/shell/RoleSwitcher.tsx`.
- `RoleGuard` redirects anonymous configured users to `/login`
  with `state.from`.
- `LoginPage` honors `state.from` after login when the role can
  access it (`canRoleAccess`), otherwise falls back to the role's
  home (`ROLE_BY_ID[role].home`). Same-origin absolute paths only.

Frontend assets UI (Stage 1I):
- `useApiSession` exposes `{ apiToken, apiBaseUrl }` to the doctor
  workspace; the assets panel leaves demo mode only when both are set.
- `VisitImagingTab` API panel calls Stage 1E endpoints with
  `Authorization: Bearer <jwt>`, never touches `fetch`/storage/device
  APIs directly (all network goes through `src/lib/clinical-assets-api.ts`).
- Signed-download flow: `Открыть` → `getAssetDownloadUrl` →
  `window.open(downloadUrl, "_blank", "noopener,noreferrer")`.
- Error UX is context-specific and non-leaky for list / download /
  upload (1I-B), with hostile error bodies scrubbed of
  `storageObjectPath` / `storage_object_path` / `exif` / raw storage
  paths before rendering.
- Retry UX: `Повторить` is rendered **only** for list errors and
  re-runs the list request without affecting download/upload state
  (1I-C).

---

## 2. Required environment variables

Frontend (Vite, public build-time vars):
- `VITE_SUPABASE_URL` — origin of the Supabase project
  (e.g. `https://<project>.supabase.co`).
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable / anon key.

Explicitly **not** in the frontend:
- ❌ `SUPABASE_SERVICE_ROLE_KEY` — never ship the service role key
  in the browser bundle. It belongs only to Edge Functions / server
  contexts.

Demo mode: when either of the two `VITE_*` vars is missing, the app
stays in demo mode. The role switcher works, the assets panel shows
the “API клинических ассетов не сконфигурирован” notice, and no
network request is made.

---

## 3. Manual smoke checklist

Pre-req: real Supabase project configured with Stage 1E migrations
applied; a doctor user exists with `app_metadata.role = "doctor"`
(or `user_metadata.role = "doctor"`).

1. **Login** — go to `/login`, sign in with the doctor's email +
   password. Expect redirect to `/desk` (doctor home).
2. **Open a visit imaging tab** — navigate to a visit and switch to
   the "Снимки" tab.
3. **Leave demo mode** — confirm the API panel header shows the
   asset count or `загрузка…` (not `демо-режим`) and that the
   "API клинических ассетов не сконфигурирован" notice is gone.
4. **List loads or safe error** — assets list either renders rows
   or shows one of the canned messages
   (`Недостаточно прав для просмотра ассетов.`,
   `Визит или ассеты не найдены.`,
   `Сбой сети при загрузке ассетов.`,
   `Не удалось загрузить ассеты.`) with a `Повторить` button.
5. **Upload an image** — click `Загрузить снимок`, pick a small
   JPEG/PNG. Expect `Снимок загружен.` status and the new row
   appearing after the implicit reload. On 422 expect
   `Проверьте файл и параметры снимка.` and the existing rows
   stay visible.
6. **Open signed URL** — click `Открыть` on a row. A new tab opens
   the signed URL. On 404 expect `Снимок не найден.` and **no**
   new tab.
7. **Logout** — use `Выйти` in the role switcher. Expect redirect
   to `/login`. Disabled state during the call and an inline error
   on failure are both expected.
8. **Protected route redirect** — while signed out, visit any
   protected app-shell URL (e.g. `/patients`). Expect redirect to
   `/login` with `state.from` preserved; after a successful login
   the app navigates back to that URL when the role can access it,
   otherwise to the role's home.

Throughout the smoke, inspect the DOM and the network responses:
no `storageObjectPath` / `storage_object_path` / `exif` / raw
`clinic/<id>/visit/<id>/...` strings should appear anywhere.

---

## 4. Verification commands

Run from the project root:

```bash
# Auth + session foundations
npm test -- --run src/lib/supabase-client.test.ts
npm test -- --run src/context/AuthContext.test.tsx
npm test -- --run src/components/auth/LoginForm.test.tsx
npm test -- --run src/pages/Login.test.tsx
npm test -- --run src/components/shell/RoleGuard.test.tsx
npm test -- --run src/components/shell/RoleSwitcher.test.tsx
npm test -- --run src/lib/use-api-session.test.tsx
npm test -- --run src/lib/auth-role.test.ts

# Assets adapter + doctor surfaces
npm test -- --run src/lib/clinical-assets-api.test.ts
npm test -- --run src/pages/doctor/VisitWorkspacePage.test.tsx
npm test -- --run src/pages/doctor/VisitImagingTab.test.tsx
npm test -- --run src/pages/doctor/VisitImagingTab.hygiene.test.ts

# Project-wide guards
node scripts/scan-doctor-forbidden.mjs
node scripts/check-no-deno-locks.mjs
npm run build
git status --short
```

Expected outcome:
- All test files pass.
- `scan-doctor-forbidden.mjs` reports no matches.
- `check-no-deno-locks.mjs` prints `OK (no deno.lock files)`.
- `npm run build` succeeds.
- `git status --short` shows only the expected changes (the
  `package-lock.json` modification from the
  `@supabase/supabase-js` install is preserved and **not**
  reverted; no `deno.lock` files appear).

---

## 5. Stage 1E–1K Handoff

### Completion summary

- **Stage 1E** — Asset metadata table, upload endpoint, signed
  download URL endpoint, and the safe DTO contract enforced in
  both `api-read` and `api-write` Edge Functions.
- **Stage 1F–1H** — Real Supabase auth in the browser:
  `supabase-client` singleton, `AuthProvider`/`useAuth`,
  `LoginForm`, role mapping (`app_metadata.role` →
  `user_metadata.role` → `"doctor"`), logout affordance in the
  role switcher, `RoleGuard` redirects to `/login` with
  `state.from`, and `LoginPage` honors the return-to target when
  the resolved role can access it.
- **Stage 1I** — Authenticated assets UI smoke in
  `VisitImagingTab`: real list/upload/signed-download against
  Stage 1E endpoints (1I-A), context-specific non-leaky error UX
  for list/download/upload (1I-B), and a list-only `Повторить`
  retry control that re-runs the list request without disturbing
  download/upload state (1I-C).
- **Stage 1K** — In-app signed image preview dialog
  (`Открыть` → signed URL → `<img>` in a Radix dialog), with the
  external "Открыть в новой вкладке" action made explicit (1K-A),
  plus accessibility hardening (named title, descriptive alt,
  Escape-to-close) and an `onError` fallback message when the
  signed image fails to render (1K-B).

### Final verification snapshot

The final frontend sweep ran green across:

- `src/lib/supabase-client.test.ts`
- `src/context/AuthContext.test.tsx`
- `src/components/auth/LoginForm.test.tsx`
- `src/pages/Login.test.tsx`
- `src/components/shell/RoleGuard.test.tsx`
- `src/components/shell/RoleSwitcher.test.tsx`
- `src/lib/use-api-session.test.tsx`
- `src/lib/auth-role.test.ts`
- `src/lib/clinical-assets-api.test.ts`
- `src/pages/doctor/VisitWorkspacePage.test.tsx`
- `src/pages/doctor/VisitImagingTab.test.tsx`
- `src/pages/doctor/VisitImagingTab.hygiene.test.ts`
- `node scripts/scan-doctor-forbidden.mjs`
- `npm run build`
- `node scripts/check-no-deno-locks.mjs`

### Commit hygiene

- **Keep** `package-lock.json` — it reflects the
  `@supabase/supabase-js` install required by Stage 1G and must
  ship with this work.
- **Do not** commit any `deno.lock` files; the
  `check-no-deno-locks.mjs` guard enforces this.
- The following warnings are observed but **non-blocking** and
  should not be treated as regressions:
  - React Router v7 future-flag warnings.
  - Vite "chunk size > 500 kB" warning on `npm run build`.
  - Browserslist "caniuse-lite is X months old" warning.

### Deferred work (out of scope for Stage 1E–1K)

- Self-serve signup and password reset flows.
- Real auth wiring for patient / operator / admin roles beyond
  the existing demo role switcher.
- Asset delete endpoint and corresponding UI control.
- Bulk asset operations (multi-select upload/download/delete).
- Production bundle splitting / dynamic imports to address the
  Vite chunk size warning.

---

## 6. Optional Stage 2A live smoke

`e2e/auth-assets-smoke.pw.ts` is an **opt-in** Playwright smoke that
exercises the real-auth doctor assets flow end-to-end against a
configured Supabase environment. It is skipped automatically when
the required env vars are not set, so CI without credentials stays
green.

Required env vars:

- `E2E_DOCTOR_EMAIL` — doctor account email.
- `E2E_DOCTOR_PASSWORD` — doctor account password.
- `E2E_VISIT_ROUTE` — doctor visit route, e.g.
  `/patients/<patientId>/visits/<visitId>?tab=imaging`. The test
  also clicks the «Снимки» tab if it is not already active.

Optional env vars:

- `E2E_EXPECT_ASSET_ROW=1` — require at least one
  `Открыть снимок …` button (fails if the visit has no assets).
- `E2E_TRY_PREVIEW=1` — click the first row and assert that either
  the «Просмотр снимка» dialog opens (with no signed URL /
  `storageObjectPath` / `storage_object_path` / `exif` leakage in
  visible text), or one of the safe download error messages
  appears (`Снимок не найден.`,
  `Недостаточно прав для открытия снимка.`, etc.).

The test is read-only: it never uploads, deletes, or otherwise
mutates assets, and never logs tokens, signed URLs, or raw storage
paths.

Run it locally:

```bash
# terminal 1
npm run dev -- --host 0.0.0.0 --port 8080

# terminal 2
E2E_DOCTOR_EMAIL="doctor@example.com" \
E2E_DOCTOR_PASSWORD="..." \
E2E_VISIT_ROUTE="/patients/<patientId>/visits/<visitId>?tab=imaging" \
npx playwright test e2e/auth-assets-smoke.pw.ts
```

To also assert preview behavior on a visit known to have assets:

```bash
E2E_DOCTOR_EMAIL="doctor@example.com" \
E2E_DOCTOR_PASSWORD="..." \
E2E_VISIT_ROUTE="/patients/<patientId>/visits/<visitId>?tab=imaging" \
E2E_EXPECT_ASSET_ROW=1 \
E2E_TRY_PREVIEW=1 \
npx playwright test e2e/auth-assets-smoke.pw.ts
```

`PW_CHROMIUM_PATH` is honored to pin a Chromium binary, matching
the convention used by other `e2e/*.pw.ts` tests.

---

## 7. Guardrails

- CI workflow `.github/workflows/no-deno-locks.yml` runs
  `node scripts/check-no-deno-locks.mjs` on every push, pull request,
  and manual dispatch — including frontend-only changes. The existing
  `backend-guardrails.yml` keeps its own copy of the check; duplicate
  protection is intentional.
- Husky `pre-commit` and `pre-push` run `check-no-deno-locks` **before**
  the doctor hygiene scan so generated `deno.lock` files fail fast with
  a clear message before any other check runs.
- Playwright artifacts under `test-results/` (and `playwright-report/`)
  are gitignored and must not be committed.
- `package-lock.json` is expected in the tree because
  `@supabase/supabase-js` was installed for Stage 1G; do not revert it.

---

## 8. CI split

- `.github/workflows/frontend-auth-assets.yml` runs the key auth /
  assets frontend test suites, the doctor forbidden-patterns scan,
  the Vite build, and `check-no-deno-locks` on PRs/pushes that touch
  the frontend auth/assets surface. It uses `npm ci` and never starts
  Supabase, Deno, or Playwright, and does not require real Supabase
  env vars.
- The Stage 2A Playwright real-auth smoke (`auth-assets-smoke.pw.ts`)
  remains opt-in / manual: it only runs locally when the
  `E2E_DOCTOR_*` env vars are set.
- Backend guardrails (`backend-guardrails.yml`) and the global
  `no-deno-locks.yml` workflow remain separate; duplicate
  `check-no-deno-locks` coverage is intentional.
- `.github/workflows/auth-assets-smoke-skip.yml` validates that the
  opt-in `e2e/auth-assets-smoke.pw.ts` imports and skips cleanly
  without credentials (syntax/skip guard only). The real smoke still
  requires manual `E2E_DOCTOR_*` env vars and a running Vite dev
  server as described in §6.

## 9. Stage 2E assets UI release checklist

### 9.1 Upload UX

- Accepted formats helper text: `JPEG, PNG, WebP или HEIC`.
- Accepted MIME types: `image/jpeg`, `image/jpg`, `image/png`,
  `image/webp`, `image/heic`, `image/heif`.
- Invalid file message: `Выберите файл изображения: JPEG, PNG, WebP или HEIC.`
- Pending upload status: `Загружаем: <filename>`.
- Busy indicator copy: `Идёт загрузка…`.
- No fake upload percentage / progress bar is rendered.

### 9.2 Drag & drop

- Drop target visible copy: `Перетащите снимок сюда`.
- Drop path reuses the same client-side validation and upload
  pipeline as the file input.
- Only the first dropped file is uploaded; additional files are
  ignored.
- Drops are ignored while an upload is already in flight (no
  duplicate POST).

### 9.3 Accessibility

- Dropzone `aria-label` is exactly `Перетащите снимок сюда для загрузки`.
- Dropzone is keyboard-activatable: Enter and Space open the file
  picker.
- Status messages render in a polite live region
  (`role="status"`, `aria-live="polite"`).
- Error messages render as assertive alerts
  (`role="alert"`, `aria-live="assertive"`).
- Closing the asset preview dialog returns focus to the opener
  (`Открыть снимок …`) button.
- Retry focus behavior after `Повторить загрузку ассетов`:
  - success with rows → focus first `Открыть снимок …` button;
  - success with empty list → focus the API assets region
    (`tabIndex={-1}` container);
  - failure → focus the re-rendered retry button.

### 9.4 Safety & hygiene

- No delete control is rendered in the doctor assets UI.
- No signed download URL is shown in visible text.
- No raw storage path / `storageObjectPath` / `storage_object_path` /
  `exif` is shown in visible text or alert bodies.
- `src/pages/doctor/**` does not call browser storage / device APIs
  directly (`fetch`, `localStorage`, `sessionStorage`,
  `mediaDevices`, `Date.now`, `new Date`); the doctor hygiene scan
  enforces this.

### 9.5 Verification commands

Run from the repo root:

```bash
npm test -- --run src/pages/doctor/VisitImagingTab.test.tsx
npm test -- --run src/pages/doctor/VisitWorkspacePage.test.tsx
npm test -- --run src/pages/doctor/VisitImagingTab.hygiene.test.ts
node scripts/scan-doctor-forbidden.mjs
npm run build
node scripts/check-no-deno-locks.mjs
git status --short
```

Expected at the close of Stage 2E-H:

- 69 + 25 + 6 = 100 targeted tests green.
- No React `act(...)` warnings in the imaging suite.
- Doctor forbidden-patterns scan is clean.
- Vite build is green.
- No `deno.lock` files anywhere in the repo.
- `package-lock.json` is preserved (not regenerated or removed).

## 10. CI alignment

The `frontend-auth-assets` GitHub Actions workflow is the deterministic
CI guard for the auth/assets unit and hygiene checks. On every PR or
push touching the auth/assets surface (including this readiness doc
and `scripts/preflight-auth-assets.mjs`), it delegates to a single
step:

```yaml
- name: Auth/assets preflight
  run: npm run preflight:auth-assets
```

Local and CI deterministic auth/assets checks therefore share the
same command — `npm run preflight:auth-assets` — which runs the full
unit-test set listed in §9.5, the doctor forbidden-patterns scan,
the Vite build, and the `deno.lock` guard.

The `auth-assets-smoke-skip` workflow remains a separate, opt-in
guard. It installs Playwright Chromium and runs
`npx playwright test e2e/auth-assets-smoke.pw.ts` without any
`E2E_DOCTOR_*` credentials. The smoke spec is expected to skip /
no-op cleanly when real credentials are absent, which verifies that
the spec remains syntactically runnable and skippable in a
credential-free CI environment. No real Supabase env vars are
provisioned in CI, and Playwright is intentionally not added to
`frontend-auth-assets`.

The Stage 2E release checklist expects the local targeted run to
report 69 + 25 + 6 = 100 targeted tests green
(`VisitImagingTab.test.tsx` + `VisitWorkspacePage.test.tsx` +
`VisitImagingTab.hygiene.test.ts`). The shared preflight command
additionally executes the broader auth/assets unit suites
(`supabase-client`, `AuthContext`, `LoginForm`, `Login` page,
`RoleGuard`, `RoleSwitcher`, `use-api-session`, `auth-role`,
`clinical-assets-api`) so the green signal is a strict superset of
the local Stage 2E checklist.

### 10.1 Local preflight

The full local equivalent of the `frontend-auth-assets` CI guard is:

```bash
npm run preflight:auth-assets
```

This runs `scripts/preflight-auth-assets.mjs`, which sequentially
executes every unit suite, the doctor forbidden-patterns scan, the
smoke runner log-safety tests (`npm run test:smoke-auth-assets`,
which verify missing-env and dry-run redaction behavior without
launching Playwright), the e2e artifact summary log-safety tests
(`npm run test:e2e-artifacts`, which verify the generated artifact
summary without launching Playwright), the Vite build, and the
`deno.lock` guard, stopping at the first failure and ending with
`[preflight-auth-assets] OK` on success. It requires no network
access, no Supabase env vars, no Deno, and no Playwright. The
Playwright real-auth smoke (`auth-assets-smoke-skip`) remains an
opt-in, separate workflow.

For focused nightly-artifact iterations, use:

```bash
npm run preflight:e2e-artifacts
```

This narrower local preflight runs the e2e artifact summary tests,
the Stage 3 documentation guard, and the `deno.lock` guard without
running the full auth/assets unit suite.

### 10.2 CI step summaries

Both workflows write a concise GitHub Actions step summary to
`$GITHUB_STEP_SUMMARY`:

- `frontend-auth-assets` writes a deterministic preflight summary
  (command, coverage, environment, result).
- `auth-assets-smoke-skip` writes an opt-in smoke-skip summary
  (command, expected skip behavior without `E2E_DOCTOR_*`, result).

The summaries are informational only and do not change test or
build behavior.

### 10.3 Local real-auth smoke

Two complementary local commands:

```bash
# Deterministic, credential-free, mirrors CI guard:
npm run preflight:auth-assets

# Opt-in real-auth Playwright smoke (requires credentials):
npm run smoke:auth-assets
```

Required environment variables for `npm run smoke:auth-assets`:

- `E2E_DOCTOR_EMAIL`
- `E2E_DOCTOR_PASSWORD`
- `E2E_VISIT_ROUTE` (e.g. `/doctor/visits/<visit-id>`)

Optional environment variables (passed through unchanged):

- `E2E_EXPECT_ASSET_ROW=1`
- `E2E_TRY_PREVIEW=1`
- `PW_CHROMIUM_PATH`

If any required variable is missing, `scripts/smoke-auth-assets.mjs`
prints the missing names and an example invocation, then exits with
code `1` without launching Playwright.

The smoke is read-only: it does not upload, delete, or mutate
assets, and it must not log access tokens or signed URLs. CI
intentionally does not provide `E2E_DOCTOR_*` credentials; the
`auth-assets-smoke-skip` workflow only verifies that the spec
remains runnable/skippable in a credential-free environment. Real
credentials stay local and outside CI.

### 10.4 Smoke runner dry run

To validate env presence and command wiring without launching
Playwright:

```bash
SMOKE_AUTH_ASSETS_DRY_RUN=1 npm run smoke:auth-assets
# or:
npm run smoke:auth-assets:dry-run
```

With all required env vars present, the dry run prints
`[smoke-auth-assets] DRY RUN: would run Playwright smoke.` plus the
exact command (`npx playwright test e2e/auth-assets-smoke.pw.ts`)
and exits 0 without spawning Playwright. With required env vars
missing, the dry run still exits 1 and lists the missing names,
identical to the non-dry-run path.

The runner never prints environment variable values: not
`E2E_DOCTOR_PASSWORD`, not access tokens, not signed URLs. The
example invocation in error output uses a placeholder
(`E2E_DOCTOR_PASSWORD='***'`) only.

### 10.5 Smoke runner log-safety tests

A small Node-only test suite verifies the runner's exit codes and
log safety:

```bash
npm run test:smoke-auth-assets
```

It uses only Node built-ins (`node:test`, `node:assert/strict`,
`node:child_process`) and never launches Playwright. The tests
assert that:

- with required env vars missing, the runner exits 1 and lists
  `E2E_DOCTOR_EMAIL`, `E2E_DOCTOR_PASSWORD`, `E2E_VISIT_ROUTE`;
- with `SMOKE_AUTH_ASSETS_DRY_RUN=1` and required env vars present,
  the runner exits 0, prints the `DRY RUN` banner and the command
  `npx playwright test e2e/auth-assets-smoke.pw.ts`, and does not
  print the email or password values.

## 11. Final local release runbook

This section is the canonical local checklist before tagging or
promoting the auth/assets readiness slice. It mirrors what CI runs
and is intentionally short.

### 11.1 Deterministic preflight

Run the full preflight, the deno-lock guard, and confirm a clean
working tree:

```bash
npm run preflight:auth-assets
node scripts/check-no-deno-locks.mjs
git status --short
```

Expected:

- `npm run preflight:auth-assets` ends with
  `[preflight-auth-assets] OK` and includes the `smoke runner
  log-safety` and `e2e artifact summary log-safety` steps (which run
  `npm run test:smoke-auth-assets` and `npm run test:e2e-artifacts`
  without launching Playwright).
- `npm run preflight:e2e-artifacts` ends with
  `[preflight-e2e-artifacts] OK` for focused artifact-summary changes.
- `node scripts/check-no-deno-locks.mjs` exits 0 and prints no
  `deno.lock` paths.
- `git status --short` shows no unexpected modifications. The
  already-known preserved `M package-lock.json` is acceptable, and new
  docs changes are acceptable until committed. No `deno.lock`,
  generated artifacts, test reports, Playwright reports, or unrelated
  source/config changes should appear. `package-lock.json` must not be
  deleted, manually regenerated, or reverted.

### 11.2 Opt-in smoke verification

The real-auth Playwright smoke stays local and opt-in. Before a
release, verify the runner's guardrails without needing real
credentials:

```bash
node scripts/smoke-auth-assets.mjs
npm run smoke:auth-assets:dry-run
```

Expected:

- The first command exits 1 and lists missing
  `E2E_DOCTOR_EMAIL`, `E2E_DOCTOR_PASSWORD`, `E2E_VISIT_ROUTE`,
  without spawning Playwright and without leaking env values.
- The dry run exits 0, prints
  `[smoke-auth-assets] DRY RUN: would run Playwright smoke.` and
  the command `npx playwright test e2e/auth-assets-smoke.pw.ts`,
  and never prints password or email values.

Running the real smoke (`npm run smoke:auth-assets` with
`E2E_DOCTOR_EMAIL`, `E2E_DOCTOR_PASSWORD`, `E2E_VISIT_ROUTE` set)
remains a manual, local-only step and is not required for release.

### 11.3 Repository invariants

- `package-lock.json` is preserved and must not be reverted or
  regenerated as part of this slice.
- No `deno.lock` files exist anywhere in the repo; the
  `no-deno-locks` workflow and `scripts/check-no-deno-locks.mjs`
  enforce this.
- The `auth-assets-smoke-skip` workflow remains separate and
  credential-free; it only verifies that the smoke spec is
  runnable and skippable without secrets.

### 11.4 CI alignment

CI and local use the same entry point:

- `.github/workflows/frontend-auth-assets.yml` runs
  `npm run preflight:auth-assets`, the same command used locally.
- Both `frontend-auth-assets` and `auth-assets-smoke-skip`
  workflows write a short summary to `GITHUB_STEP_SUMMARY` so the
  release reviewer can confirm status without reading full logs.

When all three subsections (11.1, 11.2, 11.3) pass locally and
both workflows are green on the target ref, the auth/assets
readiness slice is ready for release.

## 12. Troubleshooting

Operational notes for common signals seen while running the
auth/assets preflight and smoke. None of these, on their own, are
release blockers unless explicitly stated.

1. `rg: command not found`
   - Use the `grep -nE` fallback for any documented `rg` command.
   - Missing `rg` is an environment gap, not a project failure.

2. React Router future-flag warnings
   - Non-blocking informational warnings.
   - Do not fail the release for these.

3. Browserslist `caniuse-lite` outdated warning
   - Non-blocking.
   - Do not update the browserslist DB as part of this slice
     unless that update is explicitly scheduled.

4. Vite chunk size warning
   - Non-blocking.
   - Bundle splitting / `manualChunks` is deferred and out of
     scope for this slice.

5. `test-results/` or `playwright-report/` appears in the worktree
   - Generated locally by Playwright runs.
   - Remove before commit; do not commit Playwright artifacts.

6. A `deno.lock` file appears
   - Must be removed before commit.
   - Re-run `node scripts/check-no-deno-locks.mjs` to confirm a
     clean state.
   - Do not commit any `deno.lock` files in this slice.

7. `package-lock.json` appears modified
   - Expected if the Supabase dependency install is still
     uncommitted in the working tree.
   - Preserve it as-is; do not revert or regenerate it.

8. Smoke runner missing env exits 1
   - Expected behavior of `scripts/smoke-auth-assets.mjs`.
   - Output lists only the missing env var names, never values.
   - To verify wiring without real credentials, use the dry run
     (`npm run smoke:auth-assets:dry-run`) with placeholder local
     env vars.

9. Real-auth smoke fails when run locally
   - Check, in order:
     - the dev server is running and reachable;
     - `E2E_DOCTOR_EMAIL`, `E2E_DOCTOR_PASSWORD`, and
       `E2E_VISIT_ROUTE` are set in the shell;
     - `E2E_VISIT_ROUTE` points to a route a doctor account can
       actually reach (typically a visit imaging tab);
     - the Supabase `VITE_*` env vars are configured for the dev
       server.
   - Never paste secrets, tokens, or signed URLs into logs, docs,
     or issue threads.

10. Preflight fails
    - The first failing section in the output is the one to
      inspect; later sections did not run.
    - Re-run only that section's underlying command while
      iterating, then re-run the full preflight before declaring
      success.
    - Do not skip `check-no-deno-locks`; it is part of the
      deterministic guard.

## 13. Final readiness snapshot

1. Current local gate
   - `npm run preflight:auth-assets`
   - Expected ending: `[preflight-auth-assets] OK`

2. Included checks
   - auth/session unit suites
   - doctor assets API adapter tests
   - VisitWorkspacePage tests
   - VisitImagingTab tests
   - VisitImagingTab hygiene tests
   - doctor forbidden scan
   - smoke runner log-safety tests
   - Vite build
   - no-deno-lock guard

3. Current targeted count
   - `VisitImagingTab.test.tsx`: 69 tests
   - `VisitWorkspacePage.test.tsx`: 25 tests
   - `VisitImagingTab.hygiene.test.ts`: 6 tests
   - total targeted doctor assets surface: 100 tests

4. Repository invariants
   - `package-lock.json` preserved.
   - no `deno.lock` files.
   - no Playwright artifacts committed.
   - real-auth smoke is opt-in/local only.

5. Non-blocking warnings
   - React Router v7 future-flag warnings.
   - Browserslist caniuse-lite warning.
   - Vite chunk size warning.

6. Done definition
   - preflight green.
   - no-deno-lock guard green.
   - smoke runner log-safety green.
   - workflows green on target ref.
   - no secrets in logs/docs.

## 14. Release-ready freeze note

Auth/assets readiness is considered release-ready when:

- `npm run preflight:auth-assets` is green.
- `node scripts/check-no-deno-locks.mjs` is green.
- `frontend-auth-assets` workflow is green.
- `auth-assets-smoke-skip` workflow is green/skipped as expected.

Further changes to upload UX, preview UX, auth routing, CI, or smoke behavior should be opened as a new stage, not mixed into this readiness slice.

- `package-lock.json` must remain preserved.
- `deno.lock` files must not be committed.
- Real-auth smoke remains optional/local; credential-free CI remains the default.

Deployment steps live in docs/frontend/stage-3a-deployment-runbook.md. Rollback drill: docs/frontend/stage-3b-rollback-drill.md. Production smoke: docs/frontend/stage-3c-production-smoke.md. Incident response: docs/frontend/stage-3d-incident-response.md. Final go/no-go release decision record: docs/frontend/stage-3e-release-decision-record.md.

Release audit index: docs/frontend/stage-3f-release-audit-index.md. Final handoff summary: docs/frontend/stage-3g-final-handoff-summary.md. Release reviewer FAQ: docs/frontend/stage-3h-release-reviewer-faq.md. Final documentation index: docs/frontend/stage-3i-final-documentation-index.md. GitHub/Lovable working mode: docs/frontend/stage-3j-github-lovable-working-mode.md. Lovable suggestions backlog: docs/frontend/stage-3k-lovable-suggestions-backlog.md. Nightly artifacts report: docs/frontend/stage-3l-nightly-artifacts-report.md.

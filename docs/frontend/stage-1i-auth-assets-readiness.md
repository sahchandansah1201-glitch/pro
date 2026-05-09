# Stage 1I — Auth + Assets UI readiness checklist

Concise, project-local checklist for verifying the finished Stage 1E–1I
chain (assets backend + real-auth frontend + assets UI) without changing
any runtime behavior. Pair this with `docs/backend/stage-1e-runbook.md`
for the backend half.

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

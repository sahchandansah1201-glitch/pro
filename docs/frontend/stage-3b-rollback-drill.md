# Stage 3B — Rollback drill checklist for auth/assets readiness

## 1. Purpose

- Defines a rehearsal checklist for rolling back an auth/assets frontend deploy.
- Does not change runtime behavior.
- Used before production promotion or after a failed deploy.

## 2. Drill prerequisites

- Target deploy/ref identified.
- Previous known-good deploy/ref identified.
- Release owner and rollback owner named.
- Frontend env vars captured without exposing secret values:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- No `SUPABASE_SERVICE_ROLE_KEY` in frontend env.
- `npm run preflight:auth-assets` green before the drill.
- `node scripts/check-no-deno-locks.mjs` green.

## 3. Failure triggers

- Login fails for known doctor user.
- Anonymous protected doctor route does not redirect to `/login`.
- Login return-to breaks for allowed doctor route.
- Imaging assets panel exposes demo mode despite configured auth/env.
- Assets list shows raw storage path / `storageObjectPath` / `storage_object_path` / `exif`.
- Preview exposes signed URL in visible text.
- Logout does not return to `/login`.
- Frontend build/deploy artifact fails to load.

## 4. Rollback steps

1. Stop promotion / pause rollout.
2. Capture failing URL, browser, timestamp, and safe screenshots only.
3. Do not paste passwords, tokens, signed URLs, or storage paths into notes.
4. Revert hosting/deploy artifact to previous known-good ref.
5. Confirm frontend env vars are still correct.
6. Run smoke-level manual checks after rollback:
   - `/login`
   - protected doctor route redirect
   - doctor visit imaging tab
   - assets safe list/empty/error state
   - logout
7. Run:
   - `node scripts/check-no-deno-locks.mjs`
   - `git status --short`
8. Record rollback result.

## 5. Post-rollback checks

- User can log in again.
- Doctor protected routes behave.
- Assets panel no longer exposes the failure.
- No raw storage path / signed URL visible text.
- CI status on rollback ref known.
- Incident notes contain no secrets.

## 6. When not to rollback code

- Missing/wrong `VITE_SUPABASE_URL`.
- Missing/wrong `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Backend/Edge Function outage where frontend shows safe errors.
- Playwright local credential issue.
- Non-blocking warnings: React Router future flags, Browserslist age, Vite chunk size.

## 7. Drill completion criteria

- Rollback path known.
- Owner names recorded outside repo.
- Previous good ref confirmed.
- No secret values recorded.
- No `deno.lock` files.
- `package-lock.json` preserved.
- Release decision documented.
- After rollback, rerun the smoke checklist in docs/frontend/stage-3c-production-smoke.md.
- If a rollback is triggered by a live incident, use docs/frontend/stage-3d-incident-response.md first.

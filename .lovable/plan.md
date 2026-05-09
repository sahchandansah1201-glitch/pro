## Stage 1F — Frontend API Session Wiring

Goal: when (and only when) a real Supabase access token is available, pass `apiToken` and `apiBaseUrl` into the existing `VisitImagingTab` so its API panel can list, upload, and open signed download URLs against the live Stage 1E endpoints. When no token is available, behavior stays exactly as today (demo mode, muted "not configured" status).

### Constraints honored

- No DB / migrations / Edge Functions changes.
- No new npm dependencies (no `@supabase/supabase-js`).
- No delete UI, no raw storage path / EXIF exposure, no service role.
- No `fetch` / `localStorage` / `sessionStorage` / `mediaDevices` introduced inside `src/pages/doctor/**`. The new helper lives in `src/lib/`, which is outside the doctor hygiene scan target.
- No backend live tests run from this slice.

### Current state recap

- `src/lib/clinical-assets-api.ts` already implements list / upload / download-url calls and safe DTO mapping.
- `VisitImagingTab` already accepts optional `apiToken` and `apiBaseUrl` props and renders a non-blocking "не настроено" status when either is missing.
- `VisitWorkspacePage` mounts `<VisitImagingTab>` without these two props.
- No Supabase JS client exists in the repo. The demo `Login` page only flips a role in `localStorage` via `RoleContext`. There is no real session yet.

### Approach

Introduce a tiny, dependency-free session helper in `src/lib/` that:

1. Reads `import.meta.env.VITE_SUPABASE_URL` for `apiBaseUrl` (or returns `null` if unset / empty).
2. Reads the current Supabase access token from the standard browser storage key used by `@supabase/supabase-js` v2: `sb-<projectRef>-auth-token` in `localStorage`. The project ref is derived from `VITE_SUPABASE_URL` (`https://<ref>.supabase.co`). If the key is missing, malformed, or the token is expired (`expires_at` in the parsed JSON is in the past), the helper returns `null`.
3. Exposes a React hook `useApiSession()` that returns `{ apiToken: string | null, apiBaseUrl: string | null }` and re-evaluates on:
   - mount,
   - the `storage` window event (cross-tab token changes),
   - a custom `dermpro:auth-changed` window event (so a future in-app login can notify without reload).
4. Never throws; on any parse / env error it falls back to `{ null, null }` so the UI keeps demo behavior.

Then wire it in `VisitWorkspacePage` only:

- Import `useApiSession` from `@/lib/api-session`.
- Call it once in the page component.
- Pass `apiToken={session.apiToken}` and `apiBaseUrl={session.apiBaseUrl}` to `<VisitImagingTab>`.

No other doctor page is touched. The hygiene scan stays clean because the helper itself lives in `src/lib/api-session.ts`, and `VisitWorkspacePage` only imports a hook (no new forbidden tokens).

### Files

```text
NEW   src/lib/api-session.ts                # readSupabaseSession(), useApiSession()
NEW   src/lib/api-session.test.ts           # unit tests for parser + null/expired/missing paths
EDIT  src/pages/doctor/VisitWorkspacePage.tsx
        - import useApiSession
        - pass apiToken, apiBaseUrl into <VisitImagingTab/>
EDIT  src/pages/doctor/VisitWorkspacePage.test.tsx (if needed)
        - assert that, given a stubbed session, props are forwarded;
          and that with no session the panel stays in demo mode.
```

No edits to `clinical-assets-api.ts`, `VisitImagingTab.tsx`, backend, migrations, CI, or `package.json`.

### Tests

1. `src/lib/api-session.test.ts`
   - returns `{null,null}` when `VITE_SUPABASE_URL` is empty.
   - returns `{null,null}` when no `sb-*-auth-token` entry exists.
   - returns `{null,null}` when JSON is malformed or `access_token` missing.
   - returns `{null,null}` when `expires_at` is in the past.
   - returns `{ apiToken, apiBaseUrl }` when a well-formed unexpired token exists.
   - hook re-reads on `storage` and `dermpro:auth-changed` events.

2. `src/pages/doctor/VisitWorkspacePage.test.tsx`
   - With no session: existing assertions hold; imaging tab still renders demo state (no behavior regression).
   - With a stubbed session (mock `useApiSession`): `VisitImagingTab` receives non-null `apiToken` / `apiBaseUrl`. Use vi.mock on `@/lib/api-session`.

3. Existing `VisitImagingTab.hygiene.test.ts`, `scripts/scan-doctor-forbidden.mjs`, and full vitest suite must remain green.

### Verification commands

```text
npm test -- --run src/lib/api-session.test.ts
npm test -- --run src/pages/doctor/VisitWorkspacePage.test.tsx
npm test -- --run src/pages/doctor/VisitImagingTab.hygiene.test.ts
node scripts/scan-doctor-forbidden.mjs
npm run build
node scripts/check-no-deno-locks.mjs
git status --short
```

Done when all of the above pass and `git status` is clean.

### Out of scope (explicitly deferred)

- Building a real login page / sign-up / password reset.
- Adding `@supabase/supabase-js` (would be a dep change).
- Delete endpoint or delete UI.
- Operator / patient / admin pages — only doctor visit workspace consumes the helper in this slice.

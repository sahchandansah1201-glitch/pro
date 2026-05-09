# Stage 1C · Live API contract tests for `api-write`

These tests exercise the running `supabase/functions/api-write` Edge Function
over a local Supabase stack. JWTs are minted locally (HS256) from the same
secret the function reads (`API_READ_JWT_SECRET`, falling back to
`SUPABASE_JWT_SECRET`). Stage 1A + Stage 1C RLS and write-guard triggers are
the security boundary. **No service role, no admin client, no password sign-in.**

> Why `API_READ_JWT_SECRET` and not `SUPABASE_JWT_SECRET`?
> The Supabase CLI strips env vars whose name starts with `SUPABASE_` from
> `--env-file`. We pass the same secret under a non-reserved name. The
> function-side code accepts either (`API_READ_JWT_SECRET` first,
> `SUPABASE_JWT_SECRET` as fallback for hosted environments).

## Local prerequisites (developer machine)

```bash
# 1. Start Supabase locally.
npx supabase start

# 2. Apply Stage 1A schema/RLS/seed + Stage 1C migration.
npx supabase db reset

# 3. Confirm pgTAP is still green: must report Files=2, Tests=96.
npx supabase test db

# 4. Put the JWT secret into ./supabase/.env.local under a non-reserved name:
#      API_READ_JWT_SECRET=<local JWT secret from `supabase status`>

# 5. Serve the function (JWT gateway verification disabled — function returns
#    canonical auth errors).
npx supabase functions serve api-write \
  --env-file ./supabase/.env.local --no-verify-jwt
```

Required environment for the test runner:

```
SUPABASE_URL=http://127.0.0.1:54321
API_READ_JWT_SECRET=<local JWT secret>
# SUPABASE_JWT_SECRET also accepted as fallback.
# Optional: API_WRITE_BASE_URL=http://127.0.0.1:54321/functions/v1/api-write
```

## Run the tests

```bash
deno test --allow-env --allow-net --allow-read --no-check \
  --config tests/api-write/live/deno.json \
  tests/api-write/live/contract.test.ts
```

## What the tests assert

* Canonical error envelope on missing/invalid auth (401), unknown route (404),
  invalid uuid path (422), unknown body key (422), server-controlled key (422),
  out-of-range mapX/mapY (422), invalid `revoked` status (422).
* Every non-doctor role (patient, assistant, clinic_admin, operator,
  system_admin) hitting any `/doctor/*` route returns 403.
* Full doctor happy path:
  patient → patch patient → visit → patch visit (`in_progress`) →
  lesion → patch lesion → assessment → conclusion →
  report (duplicate visit_id → 409) →
  report version (draft) → finalize (draft→final) →
  patch report `currentVersionId` → reject final→final (409 lock) →
  amend (final→amended) → reject any further patch on amended (409 terminal).
* Conflict: duplicate patient code in the same clinic returns 409.
* 404: PATCH on unknown patient id, POST visit on unknown patient id, and
  doctor patching a cross-clinic (private) patient all return 404 with the
  canonical `not_found` envelope (never 500).
* Every response carries an `x-correlation-id` uuid header.
* Recursive forbidden-key scanner runs on every successful response and trips
  on any snake_case leak (e.g. `patient_safe_text`, `clinic_id`).

## Stop conditions

Abort and report immediately if any of the following is observed:

1. Any forbidden snake_case field appears in any response.
2. Cross-clinic write succeeds for a doctor.
3. Service role would be required.
4. Stage 1A or Stage 1C pgTAP regresses (`npx supabase test db` < Files=2,
   Tests=96).
5. Hygiene scan regresses (`node scripts/scan-doctor-forbidden.mjs` > 0).
6. Projection unit tests regress
   (`deno test --allow-env --no-check supabase/functions/api-write/_tests/projections.test.ts`).

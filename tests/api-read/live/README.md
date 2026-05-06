# Stage 1B-B · Live API contract tests

Tests-only slice. They exercise the running `supabase/functions/api-read`
Edge Function over a local Supabase stack, using HS256 JWTs minted locally
from `SUPABASE_JWT_SECRET` for the seeded demo `auth.users.id` values.
Stage 1A RLS remains the security boundary. There is no service-role usage,
no admin client, and no password sign-in.

## Local prerequisites (developer machine)

```bash
# 1. Start the local Supabase stack.
npx supabase start

# 2. Apply Stage 1A schema/RLS/seed.
npx supabase db reset

# 3. Confirm Stage 1A is still green.
npx supabase test db   # must report 39/39

# 4. Serve the function with JWT gateway verification disabled, so the
#    function itself returns canonical auth errors.
npx supabase functions serve api-read \
  --env-file ./supabase/.env.local --no-verify-jwt
```

Required environment for the test runner:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_JWT_SECRET=<local JWT secret, printed by `supabase status`>
# optional:
# API_READ_BASE_URL=http://127.0.0.1:54321/functions/v1/api-read
```

No service-role key or anon key is required by these tests.

## Run the tests

```bash
deno test --allow-env --allow-net --allow-read --no-check \
  --config tests/api-read/live/deno.json \
  tests/api-read/live/contract.test.ts
```

## What the tests assert

* Canonical error envelope on missing/invalid auth (401), unknown route
  (404), invalid uuid path (422). `x-correlation-id` is a uuid and is
  echoed when the client supplies one.
* `/me` returns the right roles + clinicId + `hasPatientLink` for every
  seeded role, with no forbidden fields.
* Patient surface: linked patient is `p-001`; `/patient/reports` returns
  exactly the one final report; `/patient/reports/:id/versions` returns
  one final version exposing `text` only (no `doctor_text`,
  no `patientSafeText`).
* Doctor surface: `/doctor/patients` returns only own-clinic patients
  (main + north), never the private-clinic patient. Cross-clinic detail
  (`p-006`) → 404. Own-clinic detail (`p-004`) → 200 with `riskFactors`.
  Doctor report-versions expose both `doctorText` and `patientText`.
* Cross-surface: patient access to ANY `/doctor/*` endpoint
  (`/doctor/patients`, `/doctor/patients/:id`, etc.) MUST return
  `403 forbidden` with the canonical error envelope — NOT `200` with an
  empty list. Private doctor cannot read a main-clinic patient (404).
* Recursive forbidden-field scanner runs on every response and trips on
  any leak.

## Stop conditions (still active)

Abort and report immediately if any of the following is observed:

1. Forbidden field appears in any response (scanner trips).
2. Cross-clinic read succeeds for a doctor.
3. Patient sees another patient's data.
4. Stage 1A db tests regress (`npx supabase test db` < 39/39).
5. Frontend tests regress (`npm test -- --run` < 321/321).
6. Hygiene scan regresses (`node scripts/scan-doctor-forbidden.mjs` > 0).
7. Projection unit tests regress
   (`deno test --allow-env --no-check supabase/functions/api-read/_tests/projections.test.ts`
   < 9/9).

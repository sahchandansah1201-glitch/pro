# Stage 1B-B · Live API contract tests

Tests-only slice. They exercise the running `supabase/functions/api-read`
Edge Function over a local Supabase stack, using JWTs minted by signing in
as the seeded demo users. Stage 1A RLS is the security boundary; the
service role is used ONLY in test setup to assign demo passwords to
already-seeded users (their `auth.users.id` is never mutated).

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

`./supabase/.env.local` must export:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local anon JWT, printed by `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<local service role JWT, printed by `supabase status`>
```

The same three variables must be present in your shell when running tests:

```bash
export $(grep -v '^#' supabase/.env.local | xargs)
```

## Run the tests

```bash
deno test --allow-env --allow-net --no-check \
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
* Cross-surface: patient hitting `/doctor/patients` sees an empty list
  under RLS; private doctor cannot read a main-clinic patient (404).
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

# Stage 1B-A — Read-only API (smallest slice)

Status: scaffolded. Pure unit tests passing locally. Live integration
tests against the Supabase stack must be run locally — they are NOT
executed in CI on this stage.

## Scope

Single Supabase Edge Function `supabase/functions/api-read` exposing
read-only routes over the Stage 1A database. RLS is the security
boundary. The projection layer is the response-shape contract.

### Routes

All routes require `Authorization: Bearer <jwt>`.

| Method | Path                                       | Surface  |
|--------|--------------------------------------------|----------|
| GET    | `/me`                                      | any auth |
| GET    | `/patient/me`                              | patient  |
| GET    | `/patient/reports`                         | patient  |
| GET    | `/patient/reports/:reportId/versions`      | patient  |
| GET    | `/doctor/patients`                         | doctor   |
| GET    | `/doctor/patients/:patientId`              | doctor   |
| GET    | `/doctor/reports/:reportId/versions`       | doctor   |

### Response shapes

* List endpoints: `{ "data": [...], "nextCursor": null }`
* Single endpoints: `{ "data": { ... } }`
* Errors:
  ```json
  {
    "error": {
      "code": "unauthenticated|forbidden|not_found|validation_error|internal_error",
      "message": "string",
      "details": {},
      "correlationId": "uuid"
    }
  }
  ```

Every response (success or error) carries an `x-correlation-id` header.
If the request supplies a valid uuid in `x-correlation-id`, it is
echoed; otherwise the function generates one.

## File layout

```
supabase/functions/api-read/
  index.ts                     # router + Deno.serve
  auth.ts                      # per-request Supabase client from caller JWT
  cors.ts
  correlation.ts
  errors.ts                    # HttpError + canonical envelope
  validators.ts                # hand-written (no Zod in this slice)
  projections.ts               # DTO functions (allow-list)
  _tests/
    forbidden-fields.ts        # SoT for forbidden-key scanner
    projections.test.ts        # pure unit tests (no DB)
```

## Local verification

### Type-check (`deno check`)

The function uses `@supabase/supabase-js` via an esm.sh import map declared
in `supabase/functions/api-read/deno.json`. This avoids needing a
`node_modules` directory or any change to root `package.json` /
`package-lock.json`.

```bash
deno check --config supabase/functions/api-read/deno.json \
  supabase/functions/api-read/index.ts
```

Result on this commit: **passes** (single `Check supabase/functions/api-read/index.ts` line, no errors).

### Projection unit tests (no DB, no JWT)

```bash
deno test --allow-env --no-check \
  supabase/functions/api-read/_tests/projections.test.ts
```

Result on this commit: **9 passed / 0 failed**.

These are **projection unit tests only**. They prove:
* every DTO returns ONLY allow-listed keys,
* forbidden fields injected into raw rows are stripped,
* the patient report-version DTO exposes `text` (not the long-form key),
* the forbidden-field scanner detects nested leaks,
* the uuid validator rejects junk,
* `/me` roles are deduped and sorted.

**Live API/RLS contract tests are deferred to Stage 1B-B.** They require
a running local Supabase stack and seeded JWTs, and are not run as part
of Stage 1B-A acceptance.

### Live integration (Stage 1B-B, not run here)

```bash
npx supabase start
npx supabase db reset
npx supabase functions serve api-read --env-file ./supabase/.env
```

## Constraints honoured in this slice

* No changes under `src/**`.
* No frontend wiring.
* No write endpoints.
* No report generation, no signed-link verification, no token issuance.
* No Device Bridge, AI worker, CRM/MIS, operator, admin, sys endpoints.
* No Stage 1A migration changes.
* No new package dependencies in `package.json` / `package-lock.json`.
* No Zod — hand-written validator only.
* Service role key is never used in request handling.

## Stop conditions (still active)

Abort and report immediately if observed during follow-up work:

1. Forbidden field appears in any response (scanner trips).
2. Cross-clinic read succeeds for a doctor.
3. Patient sees another patient's data.
4. Stage 1A db tests regress (`npx supabase test db` < 39/39).
5. Frontend tests regress (`npm test -- --run` < 321/321).
6. Hygiene scan regresses (`node scripts/scan-doctor-forbidden.mjs` > 0).

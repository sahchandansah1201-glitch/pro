# Stage 1D Runbook — Audit Logging + CI Guardrails

## Summary

Stage 1D adds clinical-write audit logging for `api-write` and a CI guardrail
workflow that runs every check the project relies on (db reset, pgTAP, deno
check, projection tests, hygiene scan, byte-identity, no `deno.lock`).

It is split into two independently revertible slices:

- **Slice 1D-A** — DB RPC `public.log_clinical_write` + Edge Function wiring.
- **Slice 1D-B** — `.github/workflows/backend-guardrails.yml` + helper scripts.

## Slice 1D-A — Audit logging

### What it does

After every successful `api-write` create/update, the function calls the
SECURITY DEFINER RPC `public.log_clinical_write` (per-request user-JWT client,
no service role). The RPC inserts a row into `public.audit_logs` only if the
caller is a doctor in the target clinic and the payload passes the denylist +
size cap. Direct `INSERT INTO public.audit_logs` by doctors is still rejected
by Stage 1A RLS — the RPC is the only sanctioned path.

### What is logged

| Endpoint | action | entity |
|---|---|---|
| POST /doctor/patients | create | patient |
| PATCH /doctor/patients/:id | update | patient |
| POST /doctor/.../visits | create | visit |
| PATCH /doctor/visits/:id | update | visit |
| POST /doctor/.../lesions | create | lesion |
| PATCH /doctor/lesions/:id | update | lesion |
| POST /doctor/visits/:id/assessments | create | assessment |
| POST /doctor/visits/:id/conclusions | create | conclusion |
| POST /doctor/visits/:id/reports | create | report |
| PATCH /doctor/reports/:id (currentVersionId) | set_current_version | report |
| POST /doctor/reports/:id/versions | create | report_version |
| PATCH /doctor/report-versions/:id (status=final) | finalize | report_version |
| PATCH /doctor/report-versions/:id (status=amended) | amend | report_version |
| PATCH /doctor/report-versions/:id (other) | update | report_version |

### Safe payload shape

Top-level keys are an allow-list:

- `correlation_id` (string)
- `route` (e.g. `POST /doctor/patients`)
- `changed_fields` (camelCase field names — names only, no values)
- `prev_state` / `next_state` (report_version transitions only)
- `parent_ids` (UUID parent references)

Free clinical text is **never** copied into the payload. The DB enforces this
with a denylist on top-level keys and a 4096-byte cap. The Edge Function
applies the same denylist as defence in depth.

### Failure semantics

If the RPC returns an error (auth/clinic/payload/size), `recordWrite` throws
`HttpError("internal_error")` and the response is **500**. An unlogged
clinical write violates the audit guarantee, so the write is reported as a
failure to the caller. The DB write itself has already committed — a proper
compensating workflow is out of scope for Stage 1D and tracked separately.

#### Degraded mode

If RPC failures appear in production unrelated to a real audit-policy issue,
flip the documented `AUDIT_FAIL_OPEN` decision in `audit.ts` to log-and-
continue. This is an explicit, time-boxed exception and must be accompanied
by an incident ticket.

### Local verification

```bash
npx supabase db reset
npx supabase test db                                  # expect Files=3, PASS

deno check --config supabase/functions/api-write/deno.json \
  supabase/functions/api-write/index.ts
deno test --no-check \
  --config supabase/functions/api-write/deno.json \
  supabase/functions/api-write/_tests/                # projections + audit

node scripts/scan-doctor-forbidden.mjs                # hygiene + byte-identity
```

Live contracts (require a running Supabase stack + JWT secret):

```bash
deno test --allow-env --allow-net --allow-read --no-check \
  --config tests/api-write/live/deno.json \
  tests/api-write/live/contract.test.ts
```

## Slice 1D-B — CI guardrails

`.github/workflows/backend-guardrails.yml` runs on every push and pull request
touching backend paths. It performs:

1. `node scripts/check-no-deno-locks.mjs` — fails if any `deno.lock` exists.
2. `node scripts/check-canonical-install-identity.mjs` — fails if any
   `db/<stage>/migrations/<file>` differs from `supabase/migrations/<file>`,
   same for `db/<stage>/tests` ↔ `supabase/tests`.
3. `node scripts/scan-doctor-forbidden.mjs` — doctor + api-write hygiene.
4. `npx supabase db reset` + `npx supabase test db` (must be `PASS`).
5. `deno check` for both `api-read` and `api-write`.
6. Projection tests for both functions.

Live contract suites are **not** wired into CI — they require seeded JWTs and a
running Supabase stack. They remain local-only as documented.

## Rollback

- Slice 1D-A: revert the commit. Optionally apply `drop function if exists
  public.log_clinical_write(uuid,text,text,uuid,jsonb)`. `audit_logs` schema
  is unchanged; existing rows can be retained or removed by a `system_admin`.
- Slice 1D-B: delete the workflow + helper scripts; husky lines are gated by
  script presence.


# Stage 1D Plan — Audit Logging + CI Guardrails

## 1. Exact scope

Both candidates, in two independently revertible slices:

- **Slice 1D-A — Clinical write audit logging for `api-write`:**
  - One additive migration introducing a single `SECURITY DEFINER` RPC `public.log_clinical_write(...)`.
  - `api-write` calls the RPC after each successful write, using the per-request user-JWT client (no service role).
  - New pgTAP suite covering RPC behavior + RLS posture for `audit_logs`.
  - New Deno unit tests for the payload builder.
  - Additive live-contract cases verifying audit visibility for `clinic_admin` and invisibility for `doctor`.

- **Slice 1D-B — CI / local guardrails:**
  - New GitHub Actions workflow `backend-guardrails.yml` running: `supabase db reset`, `supabase test db`, `deno check` for both functions, api-read + api-write projection tests, doctor hygiene scan, canonical↔install byte-identity check, and a "no tracked/working `deno.lock`" check.
  - Two new helper scripts (`check-canonical-install-identity.mjs`, `check-no-deno-locks.mjs`).
  - Optional additive `.husky/pre-push` extension that calls the same scripts locally.
  - Live contracts for api-read / api-write are **not** added to CI in this stage (they need a running Supabase stack and seeded JWTs); they remain documented as local-only and are still runnable from the existing `tests/api-*/live` suites.

## 2. Explicit exclusions

- No frontend changes.
- No in-place edits of Stage 1A or Stage 1C migrations or tests.
- No service-role usage anywhere in the request path.
- No new packages, lockfile changes, or `tsconfig`/`vite.config`/`package.json` edits beyond husky-script registration if needed.
- No `supabase db push`.
- No DELETE grants and no widening of any existing RLS policy.
- No raw clinical text in audit payloads (no `patient_safe_text`, `notes`, `summary`, freeform ABCD fields, dictation transcripts).
- No backfill of historical audit rows.
- Live contract suites are not wired into CI in Stage 1D.
- No changes to `audit_logs` table schema or its existing Stage 1A SELECT policies.

## 3. DB / RLS changes

All additive. One new migration: `db/stage1d/migrations/20260508000001_stage1d_audit.sql` (canonical) + byte-identical install copy in `supabase/migrations/`.

### 3.1 New SECURITY DEFINER RPC

```text
public.log_clinical_write(
  _clinic_id  uuid,
  _action     text,   -- 'create' | 'update' | 'finalize' | 'amend' | 'set_current_version'
  _entity     text,   -- 'patient'|'visit'|'lesion'|'assessment'|'conclusion'|'report'|'report_version'
  _entity_id  uuid,
  _payload    jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
```

Behavior:

1. If `auth.uid()` is null → fail with `errcode '42501'`.
2. If `_action` or `_entity` not in their allow-list → fail.
3. If `public.is_clinic_doctor(auth.uid(), _clinic_id)` is false → fail (`42501`). Reuses the existing Stage 1C helper; no new role logic.
4. If `_payload` contains any key in the denylist (`patient_safe_text`, `notes`, `summary`, `recommendation_text`, any `*_freeform`, `dictation_*`, `raw_text`) → fail (`P0001`). Enforced via `jsonb_object_keys` scan.
5. If `octet_length(_payload::text) > 4096` → fail.
6. Insert into `public.audit_logs` with `clinic_id=_clinic_id`, `actor_id=auth.uid()`; return the new `id`.

`grant execute on function public.log_clinical_write(...) to authenticated;` — no other grants.

### 3.2 Why this does NOT weaken RLS

- The function performs exactly one parameter-bound `INSERT` into `audit_logs`. No `GRANT INSERT ON public.audit_logs` is added; direct INSERT remains forbidden.
- All Stage 1A SELECT policies on `audit_logs` are unchanged; doctors still cannot read it. Only `system_admin` and same-clinic `clinic_admin` can read.
- Authorization is gated by the same `is_clinic_doctor(auth.uid(), _clinic_id)` predicate that gates Stage 1C writes, so the function cannot be used to forge rows for a clinic the caller has no doctor role in.
- `set search_path = public` blocks search-path injection.
- The denylist + size cap forbid using the function as a side channel to leak free clinical text into a less-restricted projection.

### 3.3 Logged events (Stage 1D scope)

| Endpoint | action | entity |
|---|---|---|
| POST /doctor/patients | create | patient |
| PATCH /doctor/patients | update | patient |
| POST /doctor/visits | create | visit |
| PATCH /doctor/visits | update | visit |
| POST /doctor/lesions | create | lesion |
| PATCH /doctor/lesions | update | lesion |
| POST /doctor/assessments | create | assessment |
| POST /doctor/conclusions | create | conclusion |
| POST /doctor/reports | create | report |
| PATCH /doctor/reports (sets `current_version_id`) | set_current_version | report |
| POST /doctor/report-versions | create | report_version |
| PATCH /doctor/report-versions (draft→final) | finalize | report_version |
| PATCH /doctor/report-versions (final→amended) | amend | report_version |

### 3.4 Safe payload schema

Allow-listed top-level keys only:

- `correlation_id` (string)
- `route` (e.g. `POST /doctor/visits`)
- `changed_fields` (array of camelCase field names — names only, never values)
- `prev_state` / `next_state` (only for `report_version` transitions; enum strings)
- `parent_ids` (object of UUIDs: `patientId`, `visitId`, `lesionId`, `reportId`)

The Edge Function builds the payload from request metadata + diff keys; it never copies request body values into the payload. The DB denylist is the second line of defense.

## 4. Edge Function changes

`supabase/functions/api-write/`:

- **New** `audit.ts` exporting `recordWrite(client, ctx, params)` that calls `client.rpc('log_clinical_write', { ... })` on the per-request user-JWT client. On RPC error, throws `HttpError("internal_error", ...)` so the response is 500 — unlogged clinical writes violate the audit guarantee. (Decision documented in the runbook; alternative log-and-continue mode is feature-flagged off.)
- `index.ts`: after each successful insert/update, call `recordWrite` with the resolved `clinic_id`, action, entity, returned id, and computed safe payload. No second client. No service role.
- `mapping.ts` / `validators.ts` / `projections.ts`: unchanged.
- No new external imports; reuse existing `@supabase/supabase-js` client.

`supabase/functions/api-read/`: **no changes**.

## 5. Test plan

### 5.1 pgTAP — `db/stage1d/tests/stage1d_audit.test.sql` (+ install copy)

- ✓ `log_clinical_write` exists with the expected signature and is `security definer`.
- ✓ Anonymous (no `auth.uid()`) call → `42501`.
- ✓ Patient role call → fails (not clinic doctor).
- ✓ Doctor in clinic A, `_clinic_id` = clinic B → fails.
- ✓ Doctor in clinic A, `_clinic_id` = clinic A → inserts one row visible to that clinic's `clinic_admin`, invisible to clinic B's `clinic_admin`, invisible to the doctor.
- ✓ Disallowed `_action` / `_entity` → fails.
- ✓ Payload with any denylist key → fails.
- ✓ Oversized payload → fails.
- ✓ Direct `INSERT INTO public.audit_logs` as a doctor still fails (RLS unchanged).
- ✓ Doctor still cannot SELECT from `audit_logs` (RLS unchanged).

Expected aggregate after Stage 1D: `Files=3, Tests = 96 + ~12, PASS`.

### 5.2 Deno unit tests

`supabase/functions/api-write/_tests/audit.test.ts`: payload builder behavior (changed_fields extraction, denylist filter, parent_ids resolution, size cap) without DB.

Existing api-write `projections.test.ts` (18) and api-read `projections.test.ts` (9) remain unchanged and must stay green.

### 5.3 Live contracts (local only)

`tests/api-write/live/contract.test.ts` adds:

- After a successful create/update, a `clinic_admin` JWT can SELECT a matching `audit_logs` row (via direct PostgREST in `helpers.ts`, since api-read does not expose audit logs).
- A failed write (e.g. validation 400) produces zero new audit rows.
- A doctor JWT receives the successful write response but cannot SELECT from `audit_logs` (control case).

Existing 22 api-write + 23 api-read contracts remain unchanged and must still pass.

### 5.4 How audit insertion is tested without granting INSERT

- pgTAP tests authenticate as a doctor via `set local role` + `set local request.jwt.claims` and call the RPC; the privileged INSERT happens inside `SECURITY DEFINER`. They then re-auth as `clinic_admin` to SELECT and assert the row is visible. This proves the function works without ever granting the doctor direct INSERT.
- Live contract tests use the JWT-bound user-client to call api-write; no service-role key is used.

## 6. Static / hygiene checks

- `deno check` for both `api-read` and `api-write`.
- `node scripts/scan-doctor-forbidden.mjs` — extend `scripts/forbidden-patterns.mjs` to flag any direct `from("audit_logs").insert(...)` in Edge Function code (must go via RPC).
- New `scripts/check-canonical-install-identity.mjs`: byte-equality between `db/stage1a/migrations/*` ↔ `supabase/migrations/*`, same for stage1c and stage1d, and the same for `db/*/tests/*` ↔ `supabase/tests/*`.
- New `scripts/check-no-deno-locks.mjs`: fails if any `deno.lock` exists in the working tree.

## 7. File plan

Created (Slice 1D-A):

- `db/stage1d/README.md`
- `db/stage1d/migrations/20260508000001_stage1d_audit.sql`
- `db/stage1d/tests/stage1d_audit.test.sql`
- `supabase/migrations/20260508000001_stage1d_audit.sql` — byte-identical install copy
- `supabase/tests/stage1d_audit.test.sql` — byte-identical install copy
- `supabase/functions/api-write/audit.ts`
- `supabase/functions/api-write/_tests/audit.test.ts`
- `docs/backend/stage-1d-runbook.md`

Created (Slice 1D-B):

- `scripts/check-canonical-install-identity.mjs`
- `scripts/check-no-deno-locks.mjs`
- `.github/workflows/backend-guardrails.yml`

Modified (additive only):

- `supabase/functions/api-write/index.ts` — add `recordWrite` calls per route.
- `scripts/forbidden-patterns.mjs` — add `audit_logs` direct-insert pattern.
- `tests/api-write/live/contract.test.ts` and `tests/api-write/live/helpers.ts` — add audit visibility cases.
- `.husky/pre-push` — optional, additive invocation of the two new scripts.

Untouched:

- All Stage 1A and Stage 1C migrations and tests (must remain byte-identical).
- All `src/**` frontend code.
- `package.json`, lockfiles, vite/tsconfig, `supabase/functions/api-read/**`.

## 8. Rollback plan

- Slice 1D-A: revert the commit. Optional cleanup migration `drop function if exists public.log_clinical_write(uuid,text,text,uuid,jsonb);` — `audit_logs` schema is unchanged, so no data migration is required. Existing audit rows can be retained or deleted by a `system_admin` if desired.
- Slice 1D-B: delete the workflow file and the two helper scripts; the optional husky lines are gated by script presence.
- Degraded mode: if RPC failures appear in production, flip the documented `AUDIT_FAIL_OPEN` flag in `audit.ts` to log-and-continue temporarily, while investigating. The runbook documents this as an explicit, time-boxed exception.

## 9. Stop conditions

Halt and request guidance if any of the following occur:

- Stage 1A or Stage 1C pgTAP regress from `Files=2, Tests=96, PASS`.
- api-read live contracts drop below 23/23.
- api-write live contracts drop below 22/22.
- api-read projection tests drop below 9/9; api-write below 18/18.
- Doctor hygiene scan reports any new violation.
- Canonical/install byte-identity check fails for any Stage 1A/1C file.
- Any change is required in `supabase/functions/api-read/**`.
- Any change is required to a Stage 1A or Stage 1C migration body.
- The audit RPC cannot be implemented without granting direct INSERT on `audit_logs` or without service role.
- A required event (e.g. report finalize) cannot be logged without including clinical free text.
- Any generated `deno.lock` is staged or appears in `git status` after the run.

## 10. Recommended implementation slicing

**Slice 1D-A — Audit logging (DB + Edge Function):**

1. Add the canonical migration + install copy.
2. Add the canonical pgTAP test + install copy.
3. `npx supabase db reset` then `npx supabase test db` → expect `Files=3, PASS`.
4. Add `audit.ts` and wire `recordWrite` calls in `api-write/index.ts`.
5. Add the Deno `audit.test.ts`; run `deno check` + unit tests.
6. Run hygiene scan, both projection suites, both live contract suites locally.
7. Commit: `Stage 1D-A: clinical write audit logging`.

**Slice 1D-B — CI guardrails:**

1. Add `scripts/check-canonical-install-identity.mjs` + `scripts/check-no-deno-locks.mjs`; verify locally.
2. Add `.github/workflows/backend-guardrails.yml`.
3. Optionally extend `.husky/pre-push`.
4. Commit: `Stage 1D-B: CI backend guardrails`.

Each slice is independently revertible and ships only after its own verification gate passes.

---

Plan complete; ready for implementation prompt.

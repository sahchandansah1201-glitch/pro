# Stage 1C · DB write RLS + write-guard triggers

Slice 1 of Stage 1C. Database layer only. No edge function, no live API tests.

## Scope

Additive over Stage 1A. Does not mutate any Stage 1A migration, seed, or RLS file.

Implements:

- `public.is_clinic_doctor(_user_id uuid, _clinic_id uuid)` — SECURITY DEFINER, doctor/private_doctor membership in a clinic.
- `public.is_clinic_staff(_user_id uuid, _clinic_id uuid)` — SECURITY DEFINER, same-clinic staff membership for `assistant_id` validation (assistant/doctor/private_doctor/clinic_admin).
- Column-level `INSERT`/`UPDATE` grants on `patients`, `visits`, `lesions`, `assessments`, `conclusions`, `reports`, `report_versions`. No broad table grants. No `DELETE` grants. No grants on `assets`, `consents`, `audit_logs`, `*_signed_links`, `clinics`, `profiles`, `user_roles`, `patient_user_link`.
- `INSERT`/`UPDATE` RLS policies for `doctor` and `private_doctor` only. `assessments` and `conclusions` are insert-only.
- BEFORE INSERT/UPDATE write-guard triggers that:
  - force server-controlled fields (`clinic_id`, `created_by`, `doctor_id`, `decided_by`, `decided_at`, `version`, `signed_by`, `signed_at`);
  - reject mutation of immutable fields (`code`, `clinic_id`, `patient_id`, `started_at`, `first_seen_at`, `created_at`, `report_id`, `version`, `created_by`);
  - enforce visit status state machine (`scheduled → in_progress → closed`, `* → cancelled` from non-closed) and `closed ↔ closed_at` invariant;
  - enforce assistant same-clinic staff membership;
  - enforce assessment lesion belongs to the visit's patient AND clinic;
  - enforce `reports.current_version_id` points to a version of the same report and clinic, with status `final` or `amended`;
  - enforce `report_versions` Stage 1C transitions: `draft → final`, `final → amended`. `amended` is terminal. Any transition to/from `revoked` is rejected.

## File layout

Canonical (source of truth):

- `db/stage1c/migrations/20260507000001_stage1c_writes.sql`
- `db/stage1c/tests/stage1c_writes.test.sql`
- `db/stage1c/README.md` (this file)

Synced install copies (consumed by local Supabase via `npx supabase db reset` / `npx supabase test db`):

- `supabase/migrations/20260507000001_stage1c_writes.sql`
- `supabase/tests/stage1c_writes.test.sql`

Sync rule: the two pairs must be byte-identical. Verify with:

```
diff db/stage1c/migrations/20260507000001_stage1c_writes.sql supabase/migrations/20260507000001_stage1c_writes.sql
diff db/stage1c/tests/stage1c_writes.test.sql supabase/tests/stage1c_writes.test.sql
```

Both must produce no output.

## Verification

```
npx supabase db reset
npx supabase test db
```

Expected: Stage 1A 39/39 + Stage 1C 53/53 pgTAP assertions pass.

## Out of scope (Slice 2+)

- `supabase/functions/api-write/**` edge function.
- Live HTTP contract tests under `tests/api-write/live/**`.
- `assets` / `consents` / `*_signed_links` writes.
- `audit_logs` write helper (direct inserts remain denied).
- `revoked` report_version transitions.

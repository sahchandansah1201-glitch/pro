# Stage 1C runbook — Slice 1 (DB write RLS)

## What ships in Slice 1

Database-only: column-level write grants, doctor/private_doctor INSERT/UPDATE RLS, and BEFORE INSERT/UPDATE write-guard triggers across `patients`, `visits`, `lesions`, `assessments`, `conclusions`, `reports`, `report_versions`. No edge function in this slice.

See `db/stage1c/README.md` for the full feature list.

## Local apply

```
npx supabase db reset       # applies Stage 1A + Stage 1C migrations + seed
npx supabase test db        # runs Stage 1A (39) + Stage 1C (53) pgTAP suites
```

Do **not** run `supabase db push`.

## Sync invariant

The canonical files under `db/stage1c/` and the install copies under `supabase/migrations/` and `supabase/tests/` must be byte-identical. CI/dev hygiene check:

```
diff db/stage1c/migrations/20260507000001_stage1c_writes.sql supabase/migrations/20260507000001_stage1c_writes.sql
diff db/stage1c/tests/stage1c_writes.test.sql               supabase/tests/stage1c_writes.test.sql
```

Both diffs must be empty.

## Rollback

The migration is fully additive. Rollback path:

1. Drop Stage 1C policies on each affected table (`*_doctor_insert`, `*_doctor_update`).
2. Drop Stage 1C triggers and trigger functions:
   `tg_patients_write_guard`, `tg_visits_write_guard`, `tg_lesions_write_guard`,
   `tg_assessments_write_guard`, `tg_conclusions_write_guard`,
   `tg_reports_write_guard`, `tg_report_versions_write_guard`.
3. `revoke` the column-level `INSERT`/`UPDATE` grants from `authenticated`.
4. `drop function public.is_clinic_doctor(uuid, uuid)`,
   `drop function public.is_clinic_staff(uuid, uuid)`.

No Stage 1A object is altered, so removal is symmetric. Easiest dev rollback: delete the migration file and `npx supabase db reset`.

## Notes for Slice 2 (`api-write`)

- Edge function must construct its Supabase client from the caller's JWT — never the service role key.
- Strip server-controlled keys (`clinicId`, `doctorId`, `createdBy`, `createdAt`, `decidedBy`, `decidedAt`, `version`, `signedBy`, `signedAt`, `id`, and `currentVersionId` outside `PATCH /reports/:id`) at the validator with HTTP 422 `validation_error`.
- Map Postgres errors:
  - `42501` → 403 `forbidden`
  - `23505` → 409 `conflict`
  - `23503` → 404 `not_found` (or 409 if FK is to a sibling row)
  - `P0001` → 409 `conflict`
- Auth failures use code `unauthenticated` (HTTP 401). Authorization failures use `forbidden` (HTTP 403).

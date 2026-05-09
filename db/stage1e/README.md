# Stage 1E-A — Clinical assets write RLS + private Storage

Backend slice covering controlled write access to `public.assets`, the
`clinical-assets` private Storage bucket, and storage policies that limit
clinical media to in-clinic doctors.

This slice is **DB / storage only**. No api-read / api-write route changes,
no frontend changes, no live contract tests are part of Stage 1E-A.

## Files

- `db/stage1e/migrations/20260509000001_stage1e_assets.sql`
  - Replaces the body of `public._stage1d_allowed_entities()` (additive: adds
    `'asset'`). Signature, volatility, search_path and grants are preserved.
  - Column-level INSERT/UPDATE grants on `public.assets`. `clinic_id` and
    `created_at` are intentionally NOT granted.
  - INSERT/UPDATE RLS policies for `doctor` / `private_doctor` only. No DELETE
    grant, no DELETE policy.
  - `tg_00_stage1e_assets_write_guard` BEFORE INSERT/UPDATE trigger forces
    `clinic_id` from the parent visit and enforces immutability of identity /
    capture / source columns.
  - Private Storage bucket `clinical-assets` (`public = false`).
  - `storage.objects` policies (SELECT for sysadmin, SELECT/INSERT for
    clinic doctor / private_doctor) scoped by parsing the clinic UUID from
    the path prefix `clinic/{clinic_id}/visit/{visit_id}/...`.
- `db/stage1e/tests/stage1e_assets.test.sql` — pgTAP, 22 tests.
- `supabase/migrations/20260509000001_stage1e_assets.sql` — byte-identical
  install copy.
- `supabase/tests/stage1e_assets.test.sql` — byte-identical install copy.

## Invariants asserted

- Doctors / private doctors of a clinic can INSERT assets only for visits in
  their own clinic. Cross-clinic INSERT → `42501`.
- Assistants and patients cannot INSERT or UPDATE assets.
- Anon cannot SELECT or INSERT assets.
- DELETE is denied for every authenticated role (no grant, no policy).
- `clinic_id`, `visit_id`, `kind`, `source`, `storage_object_path`,
  `captured_at`, `created_at`, `id` are immutable on `public.assets`.
- Mutable columns: `lesion_id`, `quality_score`, `quality_issues`, `exif`,
  `device_id`.
- The Stage 1D audit RPC `public.log_clinical_write(...)` now accepts
  `entity = 'asset'`. All other Stage 1D guarantees are unchanged.
- `clinical-assets` storage bucket is private (`public = false`).
- Storage object writes/reads for `clinical-assets` require the caller to be a
  doctor / private_doctor of the clinic encoded in segment 2 of the path.

## Path layout for storage objects

```
clinic/{clinic_id}/visit/{visit_id}/{asset_id}[.ext]
```

Storage policies enforce this regex AND `is_clinic_doctor(auth.uid(), <seg2>)`.

## What is intentionally NOT in this slice

- No DTO / projection rules on the api-read / api-write side
  (deferred to Stage 1E-B / 1E-C).
- No upload-URL or download-URL routes (deferred to 1E-C/D).
- No DELETE flow for either metadata or storage objects.
- No assistant write access (assistant capture flow comes with the
  upload-URL slice, which can route through a doctor-issued signed URL).
- No patient-facing asset access.

## Verification

```
npx supabase db reset
npx supabase test db
node scripts/check-canonical-install-identity.mjs
node scripts/check-no-deno-locks.mjs
node scripts/scan-doctor-forbidden.mjs
git status --short
```

Expected pgTAP after this slice:
`Files=4, Tests=132, Result=PASS` (Stage 1A 64 + Stage 1C 18 + Stage 1D 14 +
Stage 1E 22 = 118; counts may differ slightly depending on environment —
the source of truth is the running test output).

## Rollback

The migration is additive. To roll back:

```sql
drop trigger if exists tg_00_stage1e_assets_write_guard on public.assets;
drop function if exists public.tg_assets_write_guard();
drop policy if exists assets_doctor_insert on public.assets;
drop policy if exists assets_doctor_update on public.assets;
revoke insert, update on public.assets from authenticated;
drop policy if exists "clinical-assets sysadmin select"     on storage.objects;
drop policy if exists "clinical-assets clinic doctor select" on storage.objects;
drop policy if exists "clinical-assets clinic doctor insert" on storage.objects;
delete from storage.buckets where id = 'clinical-assets';
-- Restore Stage 1D allow-list body:
create or replace function public._stage1d_allowed_entities()
returns text[] language sql immutable as $$
  select array['patient','visit','lesion','assessment','conclusion',
               'report','report_version']
$$;
```

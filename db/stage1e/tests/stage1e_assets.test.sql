-- Stage 1E-A · pgTAP tests for assets write RLS, write-guard, audit allow-list
-- extension and clinical-assets storage bucket policies.
-- Run via: npx supabase test db
-- Conventions match Stage 1A / 1C / 1D test files.

begin;
create extension if not exists pgtap;

select plan(22);

-- ── Helpers (mirror Stage 1C / 1D) ─────────────────────────────────────────
create or replace function _act_as(_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claim.sub', _uid::text, true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub',_uid,'role','authenticated')::text,
                     true);
  set local role authenticated;
end $$;

create or replace function _act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims','{}', true);
  set local role anon;
end $$;

create or replace function _reset_role() returns void
language plpgsql as $$
begin
  reset role;
end $$;

-- Seed-stable UUIDs (see Stage 1A/1C tests for the full legend):
--   doctor d001       → a0000000-0000-0000-0000-00000000d001 (clinics 1111+2222)
--   assistant a001    → a0000000-0000-0000-0000-00000000a001 (clinics 1111+2222)
--   private_doc d2    → a0000000-0000-0000-0000-0000000000d2 (clinic 3333)
--   patient b001      → a0000000-0000-0000-0000-00000000b001
--   clinic 1111       → 11111111-1111-1111-1111-111111111111
--   clinic 2222       → 22222222-2222-2222-2222-222222222222
--   clinic 3333       → 33333333-3333-3333-3333-333333333333
--   visit v-001       → 70000000-0000-0000-0000-000000000001 (clinic 1111)
--   visit v-005       → 70000000-0000-0000-0000-000000000005 (clinic 2222)
--   visit v-007       → 70000000-0000-0000-0000-000000000007 (clinic 3333)
--   asset i-010       → 90000000-0000-0000-0000-000000000010 (clinic 2222)
--   lesion l-007      → 80000000-0000-0000-0000-000000000007 (clinic 2222)

-- ── 1. Schema-level invariants ─────────────────────────────────────────────

-- 1a) column-level INSERT grants: clinic_id and created_at must NOT be granted.
select ok(
  not has_column_privilege('authenticated','public.assets','clinic_id','INSERT'),
  'authenticated has NO INSERT grant on assets.clinic_id'
);
select ok(
  not has_column_privilege('authenticated','public.assets','created_at','INSERT'),
  'authenticated has NO INSERT grant on assets.created_at'
);

-- 1b) granted columns are present.
select ok(
  has_column_privilege('authenticated','public.assets','visit_id','INSERT'),
  'authenticated CAN INSERT assets.visit_id'
);
select ok(
  has_column_privilege('authenticated','public.assets','quality_score','UPDATE'),
  'authenticated CAN UPDATE assets.quality_score'
);

-- 1c) DELETE remains denied at the table level.
select ok(
  not has_table_privilege('authenticated','public.assets','DELETE'),
  'authenticated has NO DELETE privilege on public.assets'
);

-- 1d) RLS policies present, and there is NO doctor delete policy.
select policies_are('public','assets',
  array[
    'assets_sysadmin_select',
    'assets_clinic_select',
    'assets_doctor_insert',
    'assets_doctor_update'
  ],
  'assets has the expected RLS policies (no delete policy)'
);

-- 1e) write-guard trigger is installed.
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.assets'::regclass
      and tgname = 'tg_00_stage1e_assets_write_guard'
      and not tgisinternal
  ),
  'tg_00_stage1e_assets_write_guard trigger exists on public.assets'
);

-- ── 2. Doctor in own clinic can INSERT (happy path) ────────────────────────
select _act_as('a0000000-0000-0000-0000-00000000d001');
select lives_ok(
  $$insert into public.assets
      (id, visit_id, lesion_id, kind, source,
       storage_object_path, captured_at, quality_score, quality_issues, exif)
    values
      ('90000000-0000-0000-0000-0000000000a1',
       '70000000-0000-0000-0000-000000000001',
       null, 'overview', 'phone',
       'clinic/11111111-1111-1111-1111-111111111111/visit/70000000-0000-0000-0000-000000000001/90000000-0000-0000-0000-0000000000a1.jpg',
       '2026-04-01T09:00:00Z',
       0.900, array[]::text[], '{"width":4032,"height":3024}'::jsonb)$$,
  'doctor in clinic 1111 can INSERT asset for own-clinic visit'
);

-- The trigger must have forced clinic_id from the visit, not from any client value.
select is(
  (select clinic_id from public.assets
    where id = '90000000-0000-0000-0000-0000000000a1'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'write-guard set assets.clinic_id from the parent visit'
);
select _reset_role();

-- ── 3. Private doctor can INSERT in their clinic (clinic 3333) ─────────────
select _act_as('a0000000-0000-0000-0000-0000000000d2');
select lives_ok(
  $$insert into public.assets
      (id, visit_id, lesion_id, kind, source,
       storage_object_path, captured_at, quality_score, quality_issues, exif)
    values
      ('90000000-0000-0000-0000-0000000000a2',
       '70000000-0000-0000-0000-000000000007',
       null, 'dermoscopy', 'device_bridge',
       'clinic/33333333-3333-3333-3333-333333333333/visit/70000000-0000-0000-0000-000000000007/90000000-0000-0000-0000-0000000000a2.jpg',
       '2026-04-01T10:00:00Z',
       0.880, array[]::text[], '{}'::jsonb)$$,
  'private_doctor in clinic 3333 can INSERT asset for own-clinic visit'
);
select _reset_role();

-- ── 4. Doctor cannot INSERT into another clinic's visit ────────────────────
-- d001 is NOT a doctor in clinic 3333. RLS WITH CHECK rejects (42501).
select _act_as('a0000000-0000-0000-0000-00000000d001');
select throws_ok(
  $$insert into public.assets
      (id, visit_id, lesion_id, kind, source,
       storage_object_path, captured_at, quality_score, quality_issues, exif)
    values
      (gen_random_uuid(),
       '70000000-0000-0000-0000-000000000007',
       null, 'overview', 'phone',
       'clinic/33333333-3333-3333-3333-333333333333/visit/70000000-0000-0000-0000-000000000007/x.jpg',
       '2026-04-01T11:00:00Z',
       0.800, array[]::text[], '{}'::jsonb)$$,
  '42501', null,
  'doctor cannot INSERT asset into a clinic where they are not a doctor'
);
select _reset_role();

-- ── 5. Assistant cannot INSERT (no doctor role) ────────────────────────────
-- assistant a001 is in clinic 1111 (assistant role only). Trigger rejects 42501.
select _act_as('a0000000-0000-0000-0000-00000000a001');
select throws_ok(
  $$insert into public.assets
      (id, visit_id, lesion_id, kind, source,
       storage_object_path, captured_at, quality_score, quality_issues, exif)
    values
      (gen_random_uuid(),
       '70000000-0000-0000-0000-000000000001',
       null, 'overview', 'phone',
       'clinic/11111111-1111-1111-1111-111111111111/visit/70000000-0000-0000-0000-000000000001/x.jpg',
       '2026-04-01T11:00:00Z',
       0.800, array[]::text[], '{}'::jsonb)$$,
  '42501', null,
  'assistant cannot INSERT asset (no doctor role)'
);
select _reset_role();

-- ── 6. Patient cannot INSERT ───────────────────────────────────────────────
select _act_as('a0000000-0000-0000-0000-00000000b001');
select throws_ok(
  $$insert into public.assets
      (id, visit_id, lesion_id, kind, source,
       storage_object_path, captured_at, quality_score, quality_issues, exif)
    values
      (gen_random_uuid(),
       '70000000-0000-0000-0000-000000000001',
       null, 'overview', 'phone',
       'clinic/11111111-1111-1111-1111-111111111111/visit/70000000-0000-0000-0000-000000000001/x.jpg',
       '2026-04-01T11:00:00Z',
       0.800, array[]::text[], '{}'::jsonb)$$,
  '42501', null,
  'patient cannot INSERT asset'
);
-- Patient also cannot SELECT asset metadata (Stage 1A invariant preserved).
select is(
  (select count(*)::int from public.assets
    where id = '90000000-0000-0000-0000-000000000010'),
  0,
  'patient still cannot SELECT asset rows'
);
select _reset_role();

-- ── 7. Anon cannot read or write ──────────────────────────────────────────
select _act_as_anon();
select is(
  (select count(*)::int from public.assets), 0,
  'anon cannot SELECT any asset rows'
);
select throws_ok(
  $$insert into public.assets
      (id, visit_id, lesion_id, kind, source,
       storage_object_path, captured_at, quality_score, quality_issues, exif)
    values
      (gen_random_uuid(),
       '70000000-0000-0000-0000-000000000001',
       null, 'overview', 'phone',
       'clinic/11111111-1111-1111-1111-111111111111/visit/70000000-0000-0000-0000-000000000001/x.jpg',
       '2026-04-01T11:00:00Z',
       0.800, array[]::text[], '{}'::jsonb)$$,
  '42501', null,
  'anon cannot INSERT asset'
);
select _reset_role();

-- ── 8. DELETE is denied for doctors (no grant, no policy) ─────────────────
select _act_as('a0000000-0000-0000-0000-00000000d001');
select throws_ok(
  $$delete from public.assets
     where id = '90000000-0000-0000-0000-000000000010'$$,
  '42501', null,
  'doctor cannot DELETE assets (no grant)'
);
select _reset_role();

-- ── 9. UPDATE write-guard: identity / capture columns are immutable ───────
select _act_as('a0000000-0000-0000-0000-00000000d001');

select throws_ok(
  $$update public.assets
       set clinic_id = '11111111-1111-1111-1111-111111111111'
     where id = '90000000-0000-0000-0000-000000000010'$$,
  'P0001', null,
  'cannot UPDATE assets.clinic_id (write-guard)'
);

select throws_ok(
  $$update public.assets
       set storage_object_path = 'clinic/22222222-2222-2222-2222-222222222222/visit/70000000-0000-0000-0000-000000000005/tampered.jpg'
     where id = '90000000-0000-0000-0000-000000000010'$$,
  '42501', null,
  'cannot UPDATE assets.storage_object_path (column not granted)'
);

-- 9c) UPDATE allowed columns succeeds.
select lives_ok(
  $$update public.assets
       set quality_score = 0.910,
           quality_issues = array['retest']
     where id = '90000000-0000-0000-0000-000000000010'$$,
  'doctor can UPDATE allowed columns (quality_score, quality_issues)'
);
select _reset_role();

-- ── 10. log_clinical_write accepts entity='asset' (Stage 1E allow-list) ───
select _act_as('a0000000-0000-0000-0000-00000000d001');
select lives_ok(
  $$select public.log_clinical_write(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'create','asset',
      '90000000-0000-0000-0000-0000000000a1'::uuid,
      '{"correlation_id":"cid-asset-1","route":"POST /doctor/visits/:id/assets",
        "changed_fields":["kind","source","capturedAt","qualityScore"]}'::jsonb)$$,
  'log_clinical_write accepts entity=asset'
);
select _reset_role();

-- ── 11. Storage bucket exists and is private ──────────────────────────────
select ok(
  exists (select 1 from storage.buckets
           where id = 'clinical-assets' and public = false),
  'storage bucket clinical-assets exists and is PRIVATE (public=false)'
);

-- ── 12. storage.objects has the three Stage 1E policies (and only those) ──
-- We assert presence. Other policies on storage.objects from default Supabase
-- setup may exist; we only check our policies are installed.
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname = 'clinical-assets sysadmin select'),
  'storage.objects has policy: clinical-assets sysadmin select'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname = 'clinical-assets clinic doctor select'),
  'storage.objects has policy: clinical-assets clinic doctor select'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname = 'clinical-assets clinic doctor insert'),
  'storage.objects has policy: clinical-assets clinic doctor insert'
);

-- 12d) No UPDATE/DELETE policies on storage.objects for the clinical-assets
-- bucket — defense-in-depth check that we did NOT accidentally create them.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'clinical-assets%'
      and cmd in ('UPDATE','DELETE')),
  0,
  'no UPDATE/DELETE policies for clinical-assets exist on storage.objects'
);

select * from finish();
rollback;

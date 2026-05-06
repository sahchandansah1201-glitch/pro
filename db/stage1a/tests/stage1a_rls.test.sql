-- Stage 1A · pgTAP RLS, seed integrity, link safety, audit policy tests.
-- Run with: npx supabase test db
-- Uses set_config('request.jwt.claim.sub', <uuid>, true) + set role authenticated
-- to simulate auth.uid() under RLS.

begin;
create extension if not exists pgtap;

select plan(34);

-- ── Helpers ─────────────────────────────────────────────────────────────────
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

-- Stable UUID constants from seed.
-- doctor:        a0000000-0000-0000-0000-00000000d001
-- assistant:     a0000000-0000-0000-0000-00000000a001
-- clinic_admin:  a0000000-0000-0000-0000-00000000c001
-- private_doc:   a0000000-0000-0000-0000-0000000000d2
-- operator:      a0000000-0000-0000-0000-00000000f001
-- system_admin:  a0000000-0000-0000-0000-00000000e001
-- patient:       a0000000-0000-0000-0000-00000000b001

-- ── 1. Schema sanity ────────────────────────────────────────────────────────
select has_table('public','clinics','clinics table exists');
select has_table('public','user_roles','user_roles table exists');
select has_table('public','patient_user_link','patient_user_link table exists');
select has_table('public','patients','patients table exists');
select has_table('public','audit_logs','audit_logs table exists');
select hasnt_column('public','public_signed_links','token','no raw token column on public_signed_links');
select hasnt_column('public','protected_analysis_links','token','no raw token column on protected_analysis_links');
select has_column('public','public_signed_links','token_hash','public_signed_links has token_hash');
select has_column('public','protected_analysis_links','token_hash','protected_analysis_links has token_hash');

-- ── 2. Seed integrity ──────────────────────────────────────────────────────
select is((select count(*) from public.clinics)::int, 3, 'seed has 3 clinics');
select is((select count(distinct purpose) from public.consents
           where patient_id = '50000000-0000-0000-0000-000000000001')::int, 6,
         'all 6 consent purposes present for demo patient');
select is((select count(*) from public.lesions
           where patient_id = '50000000-0000-0000-0000-000000000004')::int, 2,
         'p-004 has 2 lesions (l-007, l-008)');
select is((select count(*) from public.assets
           where visit_id = '70000000-0000-0000-0000-000000000005')::int, 3,
         'v-005 has 3 image-metadata rows');
select is((select clinic_id from public.reports
           where id = 'c1000000-0000-0000-0000-000000000001'),
          (select clinic_id from public.report_versions
           where id = 'd1000000-0000-0000-0000-000000000001'),
         'report and current version share clinic_id');

-- Hash-format sanity (covered also by CHECK constraints, but assert here).
select ok((select bool_and(token_hash ~ '^[a-f0-9]{64}$')
           from public.public_signed_links), 'public_signed_links: hex digests only');
select ok((select bool_and(token_hash ~ '^[a-f0-9]{64}$')
           from public.protected_analysis_links), 'protected_analysis_links: hex digests only');

-- ── 3. RLS · system_admin reads everything ─────────────────────────────────
select _act_as('a0000000-0000-0000-0000-00000000e001');
select is((select count(*) from public.patients)::int, 3, 'sysadmin sees all patients');
select is((select count(*) from public.visits)::int, 3, 'sysadmin sees all visits');
select is((select count(*) from public.audit_logs)::int, 2, 'sysadmin sees all audit_logs');
select _reset_role();

-- ── 4. RLS · doctor sees same-clinic only ──────────────────────────────────
-- doctor has roles in main + north (1 + 2). Should NOT see private clinic (3).
select _act_as('a0000000-0000-0000-0000-00000000d001');
select is((select count(*) from public.patients
           where clinic_id = '33333333-3333-3333-3333-333333333333')::int, 0,
         'doctor cannot read private-clinic patients');
select is((select count(*) from public.visits
           where clinic_id in ('11111111-1111-1111-1111-111111111111',
                               '22222222-2222-2222-2222-222222222222'))::int, 2,
         'doctor reads visits across own clinics (main + north)');
select is((select count(*) from public.lesions
           where patient_id = '50000000-0000-0000-0000-000000000004')::int, 2,
         'doctor reads lesions for p-004 in north clinic');
select _reset_role();

-- ── 5. RLS · clinic_admin scoped to one clinic ─────────────────────────────
select _act_as('a0000000-0000-0000-0000-00000000c001');
select is((select count(*) from public.patients)::int, 1,
         'clinic_admin (main) sees only main-clinic patients');
select is((select count(*) from public.visits
           where clinic_id <> '11111111-1111-1111-1111-111111111111')::int, 0,
         'clinic_admin (main) cannot see other-clinic visits');
select is((select count(*) from public.audit_logs
           where clinic_id <> '11111111-1111-1111-1111-111111111111')::int, 0,
         'clinic_admin (main) cannot see other-clinic audit_logs');
select _reset_role();

-- ── 6. RLS · patient self-read only via patient_user_link ──────────────────
select _act_as('a0000000-0000-0000-0000-00000000b001');
select is((select count(*) from public.patients)::int, 1,
         'patient sees only linked patient row');
select is((select id from public.patients), '50000000-0000-0000-0000-000000000001'::uuid,
         'patient sees exactly p-001');
select is((select count(*) from public.consents)::int, 6,
         'patient sees own 6 consents');
select is((select count(*) from public.report_versions
           where status = 'final')::int, 1,
         'patient sees the one final report version');
select is((select count(*) from public.assets)::int, 0,
         'patient cannot read raw asset metadata in Stage 1A');
select _reset_role();

-- ── 7. RLS · operator has no direct clinical reads ─────────────────────────
select _act_as('a0000000-0000-0000-0000-00000000f001');
select is((select count(*) from public.patients)::int, 0, 'operator: no patients');
select is((select count(*) from public.visits)::int,   0, 'operator: no visits');
select is((select count(*) from public.assets)::int,   0, 'operator: no assets');
select is((select count(*) from public.audit_logs)::int,0,'operator: no audit_logs');
select _reset_role();

-- ── 8. RLS · anon (public) sees nothing ────────────────────────────────────
select _act_as_anon();
select is((select count(*) from public.patients)::int, 0, 'anon: no patients');
select is((select count(*) from public.public_signed_links)::int, 0, 'anon: no public_signed_links');
select _reset_role();

-- ── 9. Writes denied for non-system roles in Stage 1A ──────────────────────
select _act_as('a0000000-0000-0000-0000-00000000d001');
select throws_ok(
  $$insert into public.patients (clinic_id, code, full_name, birth_date, sex, phototype)
    values ('11111111-1111-1111-1111-111111111111','DP-X','X','2000-01-01','male','II')$$,
  '42501', null,
  'doctor cannot INSERT into patients (RLS deny)');
select throws_ok(
  $$insert into public.audit_logs (clinic_id, action, entity)
    values ('11111111-1111-1111-1111-111111111111','x','y')$$,
  '42501', null,
  'doctor cannot INSERT into audit_logs');
select _reset_role();

select _act_as('a0000000-0000-0000-0000-00000000b001');
select throws_ok(
  $$update public.patients set full_name='hacker'
    where id = '50000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'patient cannot UPDATE patients');
select _reset_role();

select * from finish();
rollback;

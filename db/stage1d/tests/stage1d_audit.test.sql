-- Stage 1D · pgTAP tests for log_clinical_write RPC and audit RLS posture.
-- Run via: npx supabase test db
-- Conventions match Stage 1A and Stage 1C test files.

begin;
create extension if not exists pgtap;

select plan(14);

-- ── Helpers (mirror Stage 1C) ──────────────────────────────────────────────
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

-- Seed-stable UUIDs used below (see Stage 1C tests for the full legend):
--   doctor d001        → a0000000-0000-0000-0000-00000000d001 (clinic 1111+2222)
--   private_doc d2     → a0000000-0000-0000-0000-0000000000d2 (clinic 3333)
--   clinic_admin c001  → a0000000-0000-0000-0000-00000000c001 (clinic 1111)
--   patient b001       → a0000000-0000-0000-0000-00000000b001
--   clinic 1111        → 11111111-1111-1111-1111-111111111111
--   clinic 2222        → 22222222-2222-2222-2222-222222222222
--   clinic 3333        → 33333333-3333-3333-3333-333333333333
--   patient row p-001  → 50000000-0000-0000-0000-000000000001 (clinic 1111)

-- ── 1. RPC presence + signature ────────────────────────────────────────────
select has_function('public','log_clinical_write',
                    array['uuid','text','text','uuid','jsonb'],
                    'log_clinical_write exists');
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='log_clinical_write' and p.prosecdef
  ),
  'log_clinical_write is SECURITY DEFINER'
);

-- ── 2. anon caller → 42501 ────────────────────────────────────────────────
select _act_as_anon();
select throws_ok(
  $$select public.log_clinical_write(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'create','patient',
      '50000000-0000-0000-0000-000000000001'::uuid,
      '{}'::jsonb)$$,
  '42501', null,
  'anon cannot call log_clinical_write');
select _reset_role();

-- ── 3. patient role → not clinic doctor → 42501 ───────────────────────────
select _act_as('a0000000-0000-0000-0000-00000000b001');
select throws_ok(
  $$select public.log_clinical_write(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'create','patient',
      '50000000-0000-0000-0000-000000000001'::uuid,
      '{}'::jsonb)$$,
  '42501', null,
  'patient cannot call log_clinical_write');
select _reset_role();

-- ── 4. doctor in another clinic → 42501 ──────────────────────────────────
-- d001 is in clinics 1111 and 2222, not 3333.
select _act_as('a0000000-0000-0000-0000-00000000d001');
select throws_ok(
  $$select public.log_clinical_write(
      '33333333-3333-3333-3333-333333333333'::uuid,
      'create','patient',
      '50000000-0000-0000-0000-000000000006'::uuid,
      '{}'::jsonb)$$,
  '42501', null,
  'doctor cannot log into a clinic where they are not a doctor');

-- ── 5. invalid action / entity ────────────────────────────────────────────
select throws_ok(
  $$select public.log_clinical_write(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'delete','patient',
      '50000000-0000-0000-0000-000000000001'::uuid,
      '{}'::jsonb)$$,
  '22023', null,
  'unknown _action is rejected');
select throws_ok(
  $$select public.log_clinical_write(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'create','dictation_blob',
      '50000000-0000-0000-0000-000000000001'::uuid,
      '{}'::jsonb)$$,
  '22023', null,
  'unknown _entity is rejected');

-- ── 6. denylisted payload key ─────────────────────────────────────────────
select throws_ok(
  $$select public.log_clinical_write(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'create','conclusion',
      '50000000-0000-0000-0000-000000000001'::uuid,
      '{"doctorText":"raw text leak"}'::jsonb)$$,
  'P0001', null,
  'doctorText payload key is denied');
select throws_ok(
  $$select public.log_clinical_write(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'create','assessment',
      '50000000-0000-0000-0000-000000000001'::uuid,
      '{"abcd_freeform_notes":"x"}'::jsonb)$$,
  'P0001', null,
  '*freeform* payload key is denied');

-- ── 7. oversized payload ──────────────────────────────────────────────────
select throws_ok(
  format(
    $sql$select public.log_clinical_write(
       '11111111-1111-1111-1111-111111111111'::uuid,
       'create','patient',
       '50000000-0000-0000-0000-000000000001'::uuid,
       jsonb_build_object('blob', %L))$sql$,
    repeat('x', 5000)),
  '22023', null,
  'oversized payload is rejected');

-- ── 8. happy path: doctor in clinic → row appears, isolated by clinic ────
select lives_ok(
  $$select public.log_clinical_write(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'create','patient',
      '50000000-0000-0000-0000-000000000001'::uuid,
      '{"correlation_id":"cid-1","route":"POST /doctor/patients",
        "changed_fields":["fullName","birthDate"]}'::jsonb)$$,
  'doctor logs a clinical write through the RPC');
select _reset_role();

-- ── 9. visibility: clinic_admin sees their clinic's row ──────────────────
select _act_as('a0000000-0000-0000-0000-00000000c001');  -- clinic_admin in 1111
select ok(
  exists (
    select 1 from public.audit_logs
    where clinic_id = '11111111-1111-1111-1111-111111111111'
      and entity = 'patient'
      and (payload->>'correlation_id') = 'cid-1'
  ),
  'clinic_admin sees the audit row written for their clinic');
select _reset_role();

-- ── 10. doctor still cannot SELECT audit_logs (RLS unchanged) ────────────
select _act_as('a0000000-0000-0000-0000-00000000d001');
select is(
  (select count(*)::int from public.audit_logs
    where (payload->>'correlation_id') = 'cid-1'),
  0,
  'doctor cannot SELECT the audit_logs row (Stage 1A RLS preserved)');

-- ── 11. doctor still cannot directly INSERT audit_logs ────────────────────
select throws_ok(
  $$insert into public.audit_logs (clinic_id, action, entity)
    values ('11111111-1111-1111-1111-111111111111','create','patient')$$,
  '42501', null,
  'doctor cannot directly INSERT audit_logs (Stage 1A RLS preserved)');
select _reset_role();

select * from finish();
rollback;

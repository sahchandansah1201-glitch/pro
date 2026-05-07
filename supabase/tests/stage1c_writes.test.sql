-- Stage 1C · pgTAP write-RLS / write-guard tests.
-- Run with: npx supabase test db
-- Conventions match Stage 1A test file.

begin;
create extension if not exists pgtap;

select plan(56);

-- ── Helpers ────────────────────────────────────────────────────────────────
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

-- Stable UUIDs (from seed).
-- doctor d001       in clinic 1111 + 2222   profile.clinic = 1111
-- assistant a001    in clinic 1111 + 2222
-- clinic_admin c001 in clinic 1111
-- private_doc d2    in clinic 3333          profile.clinic = 3333
-- operator f001     no clinic
-- system_admin e001 no clinic
-- patient b001      no clinic, linked to p-001
-- patients: p-001 clinic 1111; p-004 clinic 2222; p-006 clinic 3333
-- visits:   v-001/1111, v-005/2222, v-007/3333  (all 'closed')
-- lesions:  l-007 patient p-004 clinic 2222
--           l-008 patient p-004 clinic 2222
--           l-009 patient p-006 clinic 3333
-- reports:  c1...001 (visit v-005, clinic 2222)
--           c1...002 (visit v-001, clinic 1111)
-- versions: d1...001 (report c1...001, clinic 2222, status=final)
--           d1...002 (report c1...002, clinic 1111, status=final)

-- ── 1. Function/trigger presence ───────────────────────────────────────────
select has_function('public','is_clinic_doctor', array['uuid','uuid'],
                    'is_clinic_doctor exists');
select has_function('public','is_clinic_staff',  array['uuid','uuid'],
                    'is_clinic_staff exists');
select ok(
  exists (select 1 from pg_trigger where tgname = 'tg_00_stage1c_patients_write_guard'),
  'patients write-guard trigger exists');
select ok(
  exists (select 1 from pg_trigger where tgname = 'tg_00_stage1c_report_versions_write_guard'),
  'report_versions write-guard trigger exists');

-- ── 2. Doctor happy paths (clinic 1111) ────────────────────────────────────
select _act_as('a0000000-0000-0000-0000-00000000d001');

-- 2.1 patient insert
select lives_ok(
  $$insert into public.patients (code, full_name, birth_date, sex, phototype)
    values ('DP-2026-9001','Тест Один','1990-01-01','female','II')$$,
  'doctor inserts patient (server stamps clinic_id + created_by)');

-- 2.2 patient update (granted columns only)
select lives_ok(
  $$update public.patients set full_name = 'Тест Один (правка)'
    where code = 'DP-2026-9001'$$,
  'doctor updates patient full_name');

-- 2.3 visit insert against existing patient p-001 (clinic 1111)
select lives_ok(
  $$insert into public.visits (patient_id, started_at, complaint)
    values ('50000000-0000-0000-0000-000000000001','2026-04-01T10:00:00Z','контроль')$$,
  'doctor inserts visit against own-clinic patient');

-- capture the new visit id for later steps
create temporary table _t1c (k text primary key, v uuid);
insert into _t1c values
  ('visit_new', (select id from public.visits
                 where patient_id='50000000-0000-0000-0000-000000000001'
                   and started_at='2026-04-01T10:00:00Z'));

-- 2.4 lesion insert against p-001 (clinic 1111)
select lives_ok(
  $$insert into public.lesions
      (patient_id, body_zone, map_view, map_x, map_y, label, first_seen_at)
    values ('50000000-0000-0000-0000-000000000001','Спина','back',0.5,0.5,
            'L-9001','2026-04-01T10:05:00Z')$$,
  'doctor inserts lesion against own-clinic patient');

insert into _t1c values
  ('lesion_new', (select id from public.lesions where label = 'L-9001'));

-- 2.5 assessment insert (uses seed v-005 + l-007, both clinic 2222 same patient p-004)
select lives_ok(
  $$insert into public.assessments
      (visit_id, lesion_id, abcd, seven_point)
    values ('70000000-0000-0000-0000-000000000005',
            '80000000-0000-0000-0000-000000000007',
            '{"a":1}'::jsonb, '{"m":1}'::jsonb)$$,
  'doctor inserts assessment for matching visit/lesion');

-- 2.6 conclusion insert against same v-005
select lives_ok(
  $$insert into public.conclusions (visit_id, doctor_text)
    values ('70000000-0000-0000-0000-000000000005','Доп. заключение.')$$,
  'doctor inserts conclusion');

-- 2.7 report insert against the new visit
select lives_ok(
  $$insert into public.reports (visit_id)
    select v from _t1c where k='visit_new'$$,
  'doctor inserts report against new visit');

insert into _t1c values
  ('report_new', (select id from public.reports
                  where visit_id = (select v from _t1c where k='visit_new')));

-- 2.8 report_version insert (auto version=1, status=draft)
select lives_ok(
  $$insert into public.report_versions (report_id, patient_safe_text, doctor_text)
    select v, 'safe text', 'doctor text' from _t1c where k='report_new'$$,
  'doctor inserts report_version (version+status auto-stamped)');

select _reset_role();

-- ── 3. private_doctor happy path (clinic 3333) ─────────────────────────────
select _act_as('a0000000-0000-0000-0000-0000000000d2');
select lives_ok(
  $$insert into public.patients (code, full_name, birth_date, sex, phototype)
    values ('DP-2026-9002','Тест Два','1985-05-05','male','III')$$,
  'private_doctor inserts patient in own clinic');
select _reset_role();

-- ── 4. Server-controlled column spoofing (column-privilege denial 42501) ──
select _act_as('a0000000-0000-0000-0000-00000000d001');

select throws_ok(
  $$insert into public.patients (code, full_name, birth_date, sex, phototype, clinic_id)
    values ('DP-X','Spoof','1990-01-01','female','II',
            '22222222-2222-2222-2222-222222222222')$$,
  '42501', null,
  'patient INSERT spoofing clinic_id denied (no column grant)');

select throws_ok(
  $$insert into public.patients (code, full_name, birth_date, sex, phototype, created_by)
    values ('DP-X','Spoof','1990-01-01','female','II',
            'a0000000-0000-0000-0000-00000000e001')$$,
  '42501', null,
  'patient INSERT spoofing created_by denied');

select throws_ok(
  $$insert into public.visits (patient_id, started_at, doctor_id)
    values ('50000000-0000-0000-0000-000000000001','2026-04-02T10:00:00Z',
            'a0000000-0000-0000-0000-00000000e001')$$,
  '42501', null,
  'visit INSERT spoofing doctor_id denied');

select throws_ok(
  $$insert into public.visits (patient_id, started_at, clinic_id)
    values ('50000000-0000-0000-0000-000000000001','2026-04-02T10:00:00Z',
            '22222222-2222-2222-2222-222222222222')$$,
  '42501', null,
  'visit INSERT spoofing clinic_id denied');

select throws_ok(
  $$insert into public.assessments (visit_id, lesion_id, abcd, seven_point, decided_by)
    values ('70000000-0000-0000-0000-000000000005',
            '80000000-0000-0000-0000-000000000007',
            '{}'::jsonb, '{}'::jsonb,
            'a0000000-0000-0000-0000-00000000e001')$$,
  '42501', null,
  'assessment INSERT spoofing decided_by denied');

select throws_ok(
  $$insert into public.report_versions (report_id, patient_safe_text, doctor_text, version)
    select v,'x','y',99 from _t1c where k='report_new'$$,
  '42501', null,
  'report_version INSERT spoofing version denied');

-- ── 5. Immutable column updates (column-privilege denial 42501) ────────────
select throws_ok(
  $$update public.patients set code='HIJACKED' where code='DP-2026-9001'$$,
  '42501', null,
  'patient UPDATE of code denied (immutable / not granted)');

select throws_ok(
  $$update public.visits set patient_id='50000000-0000-0000-0000-000000000004'
    where id=(select v from _t1c where k='visit_new')$$,
  '42501', null,
  'visit UPDATE of patient_id denied (immutable)');

select throws_ok(
  $$update public.lesions set patient_id='50000000-0000-0000-0000-000000000004'
    where id=(select v from _t1c where k='lesion_new')$$,
  '42501', null,
  'lesion UPDATE of patient_id denied (immutable)');

select throws_ok(
  $$update public.report_versions set version=99
    where report_id=(select v from _t1c where k='report_new')$$,
  '42501', null,
  'report_version UPDATE of version denied (immutable)');

-- ── 6. Visit status transitions ────────────────────────────────────────────
select lives_ok(
  $$update public.visits set status='in_progress'
    where id=(select v from _t1c where k='visit_new')$$,
  'visit transition scheduled→in_progress allowed');

select throws_ok(
  $$update public.visits set status='closed'
    where id=(select v from _t1c where k='visit_new')$$,
  'P0001', null,
  'visit close without closed_at rejected');

select lives_ok(
  $$update public.visits set status='closed', closed_at='2026-04-01T11:00:00Z'
    where id=(select v from _t1c where k='visit_new')$$,
  'visit close with closed_at allowed');

select throws_ok(
  $$update public.visits set status='scheduled'
    where id=(select v from _t1c where k='visit_new')$$,
  'P0001', null,
  'visit transition closed→scheduled rejected');

-- ── 7. Assistant validation ────────────────────────────────────────────────
-- 7.1 same-clinic assistant accepted (assistant a001 in clinic 1111)
select lives_ok(
  $$insert into public.visits (patient_id, started_at, assistant_id)
    values ('50000000-0000-0000-0000-000000000001','2026-04-03T10:00:00Z',
            'a0000000-0000-0000-0000-00000000a001')$$,
  'visit with same-clinic assistant accepted');

-- 7.2 cross-clinic user as assistant rejected (private_doc d2 only in clinic 3333)
select throws_ok(
  $$insert into public.visits (patient_id, started_at, assistant_id)
    values ('50000000-0000-0000-0000-000000000001','2026-04-03T11:00:00Z',
            'a0000000-0000-0000-0000-0000000000d2')$$,
  'P0001', null,
  'visit with cross-clinic assistant rejected');

-- 7.3 patient user as assistant rejected
select throws_ok(
  $$insert into public.visits (patient_id, started_at, assistant_id)
    values ('50000000-0000-0000-0000-000000000001','2026-04-03T12:00:00Z',
            'a0000000-0000-0000-0000-00000000b001')$$,
  'P0001', null,
  'visit with patient-role user as assistant rejected');

-- ── 8. Assessment lesion mismatch ──────────────────────────────────────────
-- v-005 patient p-004; l-009 belongs to p-006 → mismatch
select throws_ok(
  $$insert into public.assessments (visit_id, lesion_id, abcd, seven_point)
    values ('70000000-0000-0000-0000-000000000005',
            '80000000-0000-0000-0000-000000000009',
            '{}'::jsonb, '{}'::jsonb)$$,
  'P0001', null,
  'assessment with cross-patient lesion rejected');

-- v-005 patient p-004; l-008 same patient → OK (additional append)
select lives_ok(
  $$insert into public.assessments (visit_id, lesion_id, abcd, seven_point)
    values ('70000000-0000-0000-0000-000000000005',
            '80000000-0000-0000-0000-000000000008',
            '{}'::jsonb, '{}'::jsonb)$$,
  'assessment with matching-patient lesion accepted');

-- ── 9. report_versions transitions ─────────────────────────────────────────
-- We finalize the new draft created earlier.
select lives_ok(
  $$update public.report_versions set status='final', patient_safe_text='final safe'
    where report_id=(select v from _t1c where k='report_new') and version=1$$,
  'report_version draft→final allowed (text editable in same statement)');

-- signed_by/at must now be stamped
select is(
  (select signed_by from public.report_versions
   where report_id=(select v from _t1c where k='report_new') and version=1),
  'a0000000-0000-0000-0000-00000000d001'::uuid,
  'finalize stamps signed_by = auth.uid()');

-- text edit while final without status change rejected
select throws_ok(
  $$update public.report_versions set patient_safe_text='late edit'
    where report_id=(select v from _t1c where k='report_new') and version=1$$,
  'P0001', null,
  'text edit while status=final without transition rejected');

-- final → amended allowed; text editable
select lives_ok(
  $$update public.report_versions set status='amended', doctor_text='amended doctor text'
    where report_id=(select v from _t1c where k='report_new') and version=1$$,
  'report_version final→amended allowed');

-- amended is terminal — amended → final rejected
select throws_ok(
  $$update public.report_versions set status='final'
    where report_id=(select v from _t1c where k='report_new') and version=1$$,
  'P0001', null,
  'report_version amended→final rejected (amended is terminal)');

-- amended → amended (no-op UPDATE on amended row) rejected
select throws_ok(
  $$update public.report_versions set patient_safe_text=patient_safe_text
    where report_id=(select v from _t1c where k='report_new') and version=1$$,
  'P0001', null,
  'report_version amended→amended (no-op UPDATE) rejected');

-- draft → amended rejected (use a new draft on report c1...002 — clinic 1111)
select lives_ok(
  $$insert into public.report_versions (report_id, patient_safe_text, doctor_text)
    values ('c1000000-0000-0000-0000-000000000002','draft2','draft2 doctor')$$,
  'doctor inserts second draft on existing report');

select throws_ok(
  $$update public.report_versions set status='amended'
    where report_id='c1000000-0000-0000-0000-000000000002'
      and version=(select max(version) from public.report_versions
                   where report_id='c1000000-0000-0000-0000-000000000002')$$,
  'P0001', null,
  'report_version draft→amended rejected');

-- any transition to revoked rejected
select throws_ok(
  $$update public.report_versions set status='revoked'
    where report_id='c1000000-0000-0000-0000-000000000002'
      and version=(select max(version) from public.report_versions
                   where report_id='c1000000-0000-0000-0000-000000000002')$$,
  'P0001', null,
  'report_version transition to revoked rejected in Stage 1C');

-- ── 10. reports.current_version_id guard ───────────────────────────────────
-- pointing at draft version → rejected
select throws_ok(
  $$update public.reports set current_version_id=(
    select id from public.report_versions
    where report_id='c1000000-0000-0000-0000-000000000002'
      and version=(select max(version) from public.report_versions
                   where report_id='c1000000-0000-0000-0000-000000000002'))
    where id='c1000000-0000-0000-0000-000000000002'$$,
  'P0001', null,
  'reports.current_version_id pointing at draft rejected');

-- pointing at version of a different report rejected
-- (d1...001 belongs to report c1...001, clinic 2222; we try setting on c1...002 in clinic 1111)
select throws_ok(
  $$update public.reports
    set current_version_id='d1000000-0000-0000-0000-000000000001'
    where id='c1000000-0000-0000-0000-000000000002'$$,
  'P0001', null,
  'reports.current_version_id pointing at wrong report rejected');

-- pointing at final version of same report → OK
-- finalize draft2 first, then point.
select lives_ok(
  $test$do $body$
    declare _vid uuid;
    begin
      update public.report_versions set status='final'
        where report_id='c1000000-0000-0000-0000-000000000002'
          and status='draft'
        returning id into _vid;
      update public.reports set current_version_id=_vid
        where id='c1000000-0000-0000-0000-000000000002';
    end $body$;$test$,
  'reports.current_version_id pointing at final version of same report accepted');

-- final → final rejected (locked once finalized; only final→amended is allowed)
select throws_ok(
  $$update public.report_versions set status='final'
    where report_id='c1000000-0000-0000-0000-000000000002' and status='final'$$,
  'P0001', null,
  'report_version final→final rejected (finalized version is locked)');

-- clearing current_version_id back to NULL is rejected
select throws_ok(
  $$update public.reports set current_version_id=null
    where id='c1000000-0000-0000-0000-000000000002'$$,
  'P0001', null,
  'reports.current_version_id cannot be cleared to NULL');

select _reset_role();

-- ── 11. Non-doctor INSERT denial (RLS WITH CHECK fails, 42501) ─────────────
select _act_as('a0000000-0000-0000-0000-00000000b001');  -- patient
select throws_ok(
  $$insert into public.patients (code, full_name, birth_date, sex, phototype)
    values ('DP-X1','x','1990-01-01','female','II')$$,
  '42501', null,
  'patient role cannot INSERT patients');
select _reset_role();

select _act_as('a0000000-0000-0000-0000-00000000f001');  -- operator
select throws_ok(
  $$insert into public.patients (code, full_name, birth_date, sex, phototype)
    values ('DP-X2','x','1990-01-01','female','II')$$,
  '42501', null,
  'operator cannot INSERT patients');
select _reset_role();

select _act_as('a0000000-0000-0000-0000-00000000a001');  -- assistant
select throws_ok(
  $$insert into public.visits (patient_id, started_at)
    values ('50000000-0000-0000-0000-000000000001','2026-04-04T10:00:00Z')$$,
  '42501', null,
  'assistant cannot INSERT visits');
select _reset_role();

select _act_as('a0000000-0000-0000-0000-00000000c001');  -- clinic_admin
select throws_ok(
  $$insert into public.lesions
      (patient_id, body_zone, map_view, map_x, map_y, label, first_seen_at)
    values ('50000000-0000-0000-0000-000000000001','x','back',0.1,0.1,'X','2026-04-04T10:00:00Z')$$,
  '42501', null,
  'clinic_admin cannot INSERT lesions');
select _reset_role();

select _act_as('a0000000-0000-0000-0000-00000000e001');  -- system_admin
select throws_ok(
  $$insert into public.assessments (visit_id, lesion_id, abcd, seven_point)
    values ('70000000-0000-0000-0000-000000000005',
            '80000000-0000-0000-0000-000000000007',
            '{}'::jsonb, '{}'::jsonb)$$,
  '42501', null,
  'system_admin cannot INSERT assessments (no doctor role)');
select _reset_role();

-- ── 12. anon denial ────────────────────────────────────────────────────────
select _act_as_anon();
select throws_ok(
  $$insert into public.patients (code, full_name, birth_date, sex, phototype)
    values ('DP-X3','x','1990-01-01','female','II')$$,
  '42501', null,
  'anon cannot INSERT patients');
select _reset_role();

-- ── 13. DELETE denied everywhere (no DELETE grants) ───────────────────────
select _act_as('a0000000-0000-0000-0000-00000000d001');
select throws_ok(
  $$delete from public.patients where code='DP-2026-9001'$$,
  '42501', null,
  'doctor cannot DELETE patients');
select throws_ok(
  $$delete from public.visits where id=(select v from _t1c where k='visit_new')$$,
  '42501', null,
  'doctor cannot DELETE visits');
select throws_ok(
  $$delete from public.report_versions where report_id=(select v from _t1c where k='report_new')$$,
  '42501', null,
  'doctor cannot DELETE report_versions');

-- ── 14. audit_logs direct insert denied ────────────────────────────────────
select throws_ok(
  $$insert into public.audit_logs (clinic_id, action, entity)
    values ('11111111-1111-1111-1111-111111111111','x','y')$$,
  '42501', null,
  'doctor cannot directly INSERT into audit_logs');
select _reset_role();

select * from finish();
rollback;

-- pgTAP tests for public.access_events_admin.

begin;
create extension if not exists pgtap;

select plan(8);

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

create or replace function _reset_role() returns void
language plpgsql as $$
begin
  reset role;
end $$;

select has_view('public', 'access_events_admin', 'access_events_admin view exists');
select has_column('public', 'access_events_admin', 'clinic_name', 'view exposes clinic context');
select has_column('public', 'access_events_admin', 'actor_email', 'view exposes actor context');
select has_column('public', 'access_events_admin', 'patient_code', 'view exposes patient context');
select has_column('public', 'access_events_admin', 'visit_id', 'view exposes visit context');

select ok(
  pg_get_viewdef('public.access_events_admin'::regclass, true)
    like '%has_role(auth.uid(),%system_admin%',
  'view definition filters with has_role(auth.uid(), system_admin)'
);

select _act_as('a0000000-0000-0000-0000-00000000c001'); -- clinic_admin
select is(
  (select count(*)::int from public.access_events_admin),
  0,
  'clinic_admin cannot read admin access events'
);
select _reset_role();

select _act_as('a0000000-0000-0000-0000-00000000e001'); -- system_admin
select is(
  (select count(*)::int from public.access_events_admin),
  (select count(*)::int from public.audit_logs),
  'system_admin can read all access events'
);
select _reset_role();

select * from finish();
rollback;

-- Stage 3L: capped, rate-limited access-events reader for system admins.
--
-- The raw view remains available to authenticated clients with its
-- system_admin filter, but production UI should prefer this RPC so query
-- volume is bounded and auditable.

create table if not exists public.access_events_admin_requests (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  result_limit int not null,
  result_offset int not null,
  request_kind text not null default 'list'
);

create index if not exists access_events_admin_requests_actor_time_idx
  on public.access_events_admin_requests(actor_id, requested_at desc);

alter table public.access_events_admin_requests enable row level security;

revoke all on table public.access_events_admin_requests from public;
revoke all on table public.access_events_admin_requests from anon;
revoke all on table public.access_events_admin_requests from authenticated;

drop policy if exists access_events_admin_requests_sysadmin_select
  on public.access_events_admin_requests;
create policy access_events_admin_requests_sysadmin_select
  on public.access_events_admin_requests
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'system_admin'));

create or replace function public.list_access_events_admin(
  _limit int default 50,
  _offset int default 0
)
returns table (
  id uuid,
  created_at timestamptz,
  clinic_id uuid,
  clinic_name text,
  actor_id uuid,
  actor_email text,
  actor_full_name text,
  action text,
  entity text,
  entity_id uuid,
  payload jsonb,
  patient_id uuid,
  patient_code text,
  patient_full_name text,
  visit_id uuid,
  lesion_id uuid,
  lesion_label text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _safe_limit int := least(greatest(coalesce(_limit, 50), 1), 200);
  _safe_offset int := greatest(coalesce(_offset, 0), 0);
  _recent_count int;
begin
  if _uid is null or not public.has_role(_uid, 'system_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*)::int
    into _recent_count
    from public.access_events_admin_requests r
   where r.actor_id = _uid
     and r.requested_at > now() - interval '1 minute';

  if _recent_count >= 30 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;

  insert into public.access_events_admin_requests (
    actor_id,
    result_limit,
    result_offset,
    request_kind
  ) values (
    _uid,
    _safe_limit,
    _safe_offset,
    'list'
  );

  return query
    select
      v.id,
      v.created_at,
      v.clinic_id,
      v.clinic_name,
      v.actor_id,
      v.actor_email,
      v.actor_full_name,
      v.action,
      v.entity,
      v.entity_id,
      v.payload,
      v.patient_id,
      v.patient_code,
      v.patient_full_name,
      v.visit_id,
      v.lesion_id,
      v.lesion_label
    from public.access_events_admin v
    order by v.created_at desc
    limit _safe_limit
    offset _safe_offset;
end;
$$;

revoke all on function public.list_access_events_admin(int, int) from public;
revoke all on function public.list_access_events_admin(int, int) from anon;
grant execute on function public.list_access_events_admin(int, int) to authenticated;

-- Stage 4I · stale clinical asset upload recovery.
-- Expired pending reservations may be reclaimed only by an exact tenant-scoped
-- retry. The reservation-owned object key remains stable across recovery.

alter table clinical_asset_upload_requests
  add column if not exists last_claimed_at timestamptz,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists recovery_count integer not null default 0;

update clinical_asset_upload_requests
set last_claimed_at = created_at
where last_claimed_at is null;

update clinical_asset_upload_requests
set lease_expires_at = coalesce(completed_at, created_at) + interval '15 minutes'
where lease_expires_at is null;

alter table clinical_asset_upload_requests
  alter column last_claimed_at set default now(),
  alter column last_claimed_at set not null,
  alter column lease_expires_at set default (now() + interval '15 minutes'),
  alter column lease_expires_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinical_asset_upload_requests_recovery_count_check'
      and conrelid = 'clinical_asset_upload_requests'::regclass
  ) then
    alter table clinical_asset_upload_requests
      add constraint clinical_asset_upload_requests_recovery_count_check
      check (recovery_count >= 0);
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinical_asset_upload_requests_lease_order_check'
      and conrelid = 'clinical_asset_upload_requests'::regclass
  ) then
    alter table clinical_asset_upload_requests
      add constraint clinical_asset_upload_requests_lease_order_check
      check (lease_expires_at >= last_claimed_at);
  end if;
end $$;

create index if not exists clinical_asset_upload_requests_pending_lease_idx
  on clinical_asset_upload_requests (lease_expires_at)
  where state = 'pending';

comment on column clinical_asset_upload_requests.lease_expires_at is
  'Database-clock lease boundary for exact stale pending upload recovery.';

comment on column clinical_asset_upload_requests.recovery_count is
  'Number of successful atomic stale reservation reclaims; no patient-facing data.';

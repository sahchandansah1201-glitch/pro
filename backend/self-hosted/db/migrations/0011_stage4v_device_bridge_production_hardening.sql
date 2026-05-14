-- Stage 4V self-hosted Device Bridge production hardening.
-- Adds backend-owned lifecycle metadata for idempotent worker updates, poll
-- backoff, queue observability, and retention planning.

alter table device_bridge_commands
  add column if not exists idempotency_key text,
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists lifecycle_revision integer not null default 0 check (lifecycle_revision >= 0),
  add column if not exists last_polled_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists cleanup_after timestamptz,
  add column if not exists last_worker_error text;

create unique index if not exists device_bridge_commands_idempotency_idx
  on device_bridge_commands(bridge_id, idempotency_key)
  where idempotency_key is not null and bridge_id is not null;

create index if not exists device_bridge_commands_worker_backoff_idx
  on device_bridge_commands(bridge_id, status, next_attempt_at, created_at)
  where status in ('queued', 'acknowledged');

create index if not exists device_bridge_commands_worker_retention_idx
  on device_bridge_commands(status, cleanup_after, completed_at)
  where status in ('completed', 'failed', 'cancelled');

update device_bridge_commands
set cleanup_after = coalesce(cleanup_after, completed_at + interval '30 days')
where completed_at is not null
  and status in ('completed', 'failed', 'cancelled');

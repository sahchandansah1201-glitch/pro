-- 0089 Stage 6 · Repair Device Bridge columns on existing self-hosted PostgreSQL volumes.
-- Earlier initdb-only migrations do not run again when Docker keeps the database
-- volume. These idempotent ALTERs make /sys/devices safe after ordinary updates.

alter table device_bridges
  add column if not exists worker_status text not null default 'unknown'
    check (worker_status in ('unknown', 'online', 'degraded', 'offline')),
  add column if not exists worker_last_seen_at timestamptz,
  add column if not exists worker_version text,
  add column if not exists worker_metadata_json jsonb not null default '{}'::jsonb;

alter table device_bridge_commands
  add column if not exists dispatched_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists idempotency_key text,
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists lifecycle_revision integer not null default 0 check (lifecycle_revision >= 0),
  add column if not exists last_polled_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists cleanup_after timestamptz,
  add column if not exists last_worker_error text,
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists recovery_action text
    check (recovery_action is null or recovery_action in ('reschedule', 'cancel')),
  add column if not exists recovery_reason text,
  add column if not exists recovery_requested_at timestamptz,
  add column if not exists recovered_by uuid references app_users(id) on delete set null,
  add column if not exists replay_of_command_id uuid references device_bridge_commands(id) on delete set null,
  add column if not exists replay_requested_at timestamptz,
  add column if not exists replay_requested_by uuid references app_users(id) on delete set null,
  add column if not exists replay_policy text not null default 'manual_system_admin';

create index if not exists device_bridges_worker_status_idx
  on device_bridges(worker_status, worker_last_seen_at desc);

create unique index if not exists device_bridge_commands_idempotency_idx
  on device_bridge_commands(bridge_id, idempotency_key)
  where idempotency_key is not null and bridge_id is not null;

create index if not exists device_bridge_commands_worker_queue_idx
  on device_bridge_commands(bridge_id, status, created_at)
  where status in ('queued', 'acknowledged');

create index if not exists device_bridge_commands_worker_result_idx
  on device_bridge_commands(status, completed_at desc)
  where status in ('completed', 'failed');

create index if not exists device_bridge_commands_worker_backoff_idx
  on device_bridge_commands(bridge_id, status, next_attempt_at, created_at)
  where status in ('queued', 'acknowledged');

create index if not exists device_bridge_commands_worker_retention_idx
  on device_bridge_commands(status, cleanup_after, completed_at)
  where status in ('completed', 'failed', 'cancelled');

create index if not exists device_bridge_commands_worker_lease_idx
  on device_bridge_commands(bridge_id, status, lease_expires_at, next_attempt_at)
  where status in ('queued', 'acknowledged');

create index if not exists device_bridge_commands_recovery_idx
  on device_bridge_commands(status, recovery_action, recovery_requested_at desc)
  where status in ('queued', 'acknowledged', 'failed', 'cancelled');

create index if not exists device_bridge_commands_stuck_scan_idx
  on device_bridge_commands(status, last_polled_at, created_at)
  where status in ('queued', 'acknowledged', 'failed');

create index if not exists device_bridge_commands_replay_idx
  on device_bridge_commands(replay_of_command_id, created_at desc)
  where replay_of_command_id is not null;

create index if not exists audit_log_device_bridge_command_idx
  on audit_log(entity_type, action, created_at desc)
  where entity_type = 'device_bridge_command';

update device_bridge_commands
set cleanup_after = coalesce(cleanup_after, completed_at + interval '30 days')
where completed_at is not null
  and status in ('completed', 'failed', 'cancelled');

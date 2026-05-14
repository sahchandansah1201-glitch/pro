-- Stage 4W self-hosted Device Bridge command safety.
-- Adds backend-owned worker leases and recovery metadata. No browser hardware
-- access or external managed runtime participates in command recovery.

alter table device_bridge_commands
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists recovery_action text
    check (recovery_action is null or recovery_action in ('reschedule', 'cancel')),
  add column if not exists recovery_reason text,
  add column if not exists recovery_requested_at timestamptz,
  add column if not exists recovered_by uuid references app_users(id) on delete set null;

create index if not exists device_bridge_commands_worker_lease_idx
  on device_bridge_commands(bridge_id, status, lease_expires_at, next_attempt_at)
  where status in ('queued', 'acknowledged');

create index if not exists device_bridge_commands_recovery_idx
  on device_bridge_commands(status, recovery_action, recovery_requested_at desc)
  where status in ('queued', 'acknowledged', 'failed', 'cancelled');

create index if not exists device_bridge_commands_stuck_scan_idx
  on device_bridge_commands(status, last_polled_at, created_at)
  where status in ('queued', 'acknowledged', 'failed');

-- Stage 4S self-hosted Device Bridge worker contract.
-- Adds worker lifecycle metadata while command binaries/hardware access remain backend/worker owned.

alter table device_bridges
  add column if not exists worker_status text not null default 'unknown'
    check (worker_status in ('unknown', 'online', 'degraded', 'offline')),
  add column if not exists worker_last_seen_at timestamptz,
  add column if not exists worker_version text,
  add column if not exists worker_metadata_json jsonb not null default '{}'::jsonb;

create index if not exists device_bridges_worker_status_idx
  on device_bridges(worker_status, worker_last_seen_at desc);

create index if not exists device_bridge_commands_worker_queue_idx
  on device_bridge_commands(bridge_id, status, created_at)
  where status in ('queued', 'acknowledged');

create index if not exists device_bridge_commands_worker_result_idx
  on device_bridge_commands(status, completed_at desc)
  where status in ('completed', 'failed');

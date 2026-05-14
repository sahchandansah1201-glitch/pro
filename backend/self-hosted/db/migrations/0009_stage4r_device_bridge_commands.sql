-- Stage 4R self-hosted Device Bridge command queue.
-- Browser clients request safe commands through the backend only. A local
-- Device Bridge worker can later poll this table and execute hardware work.

create table if not exists device_bridge_commands (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  bridge_id uuid references device_bridges(id) on delete set null,
  device_id uuid references medical_devices(id) on delete set null,
  command_type text not null check (
    command_type in (
      'bridge_health_check',
      'device_calibration_request',
      'device_stream_open_request'
    )
  ),
  status text not null default 'queued' check (
    status in ('queued', 'acknowledged', 'completed', 'failed', 'cancelled')
  ),
  requested_by uuid references app_users(id) on delete set null,
  reason text,
  payload_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dispatched_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz
);

create index if not exists device_bridge_commands_clinic_status_idx
  on device_bridge_commands (clinic_id, status, created_at desc);

create index if not exists device_bridge_commands_bridge_idx
  on device_bridge_commands (bridge_id, created_at desc)
  where bridge_id is not null;

create index if not exists device_bridge_commands_device_idx
  on device_bridge_commands (device_id, created_at desc)
  where device_id is not null;

drop trigger if exists device_bridge_commands_touch_updated_at on device_bridge_commands;
create trigger device_bridge_commands_touch_updated_at
before update on device_bridge_commands
for each row execute function touch_updated_at();

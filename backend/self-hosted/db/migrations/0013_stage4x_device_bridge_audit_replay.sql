-- Stage 4X · Device Bridge command audit and replay policy.
-- Replay is backend-owned: UI never receives raw command payloads or worker secrets.

alter table device_bridge_commands
  add column if not exists replay_of_command_id uuid references device_bridge_commands(id) on delete set null,
  add column if not exists replay_requested_at timestamptz,
  add column if not exists replay_requested_by uuid references app_users(id) on delete set null,
  add column if not exists replay_policy text not null default 'manual_system_admin';

create index if not exists device_bridge_commands_replay_idx
  on device_bridge_commands(replay_of_command_id, created_at desc)
  where replay_of_command_id is not null;

create index if not exists audit_log_device_bridge_command_idx
  on audit_log(entity_type, action, created_at desc)
  where entity_type = 'device_bridge_command';

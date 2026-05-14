-- Stage 4Q self-hosted Device Bridge registry.
-- Browser clients read device state through backend APIs only. Direct
-- WebUSB/WebBluetooth/WebSerial access remains out of the frontend runtime.

create table if not exists device_bridges (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  bridge_code text not null,
  host_name text not null,
  lan_status text not null default 'offline' check (lan_status in ('online', 'degraded', 'offline')),
  version text not null,
  last_heartbeat_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, bridge_code)
);

create table if not exists medical_devices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  bridge_id uuid references device_bridges(id) on delete set null,
  model text not null,
  serial text not null,
  firmware text not null,
  magnification text not null,
  polarization text not null check (polarization in ('polarized', 'non_polarized', 'both')),
  calibration_profile text not null,
  calibration_due_at date,
  status text not null default 'offline' check (status in ('connected', 'standby', 'offline')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (clinic_id, serial)
);

create index if not exists device_bridges_clinic_status_idx
  on device_bridges (clinic_id, lan_status, last_heartbeat_at desc);

create index if not exists medical_devices_clinic_status_idx
  on medical_devices (clinic_id, status, last_seen_at desc)
  where deleted_at is null;

create index if not exists medical_devices_bridge_idx
  on medical_devices (bridge_id)
  where deleted_at is null;

drop trigger if exists device_bridges_touch_updated_at on device_bridges;
create trigger device_bridges_touch_updated_at
before update on device_bridges
for each row execute function touch_updated_at();

drop trigger if exists medical_devices_touch_updated_at on medical_devices;
create trigger medical_devices_touch_updated_at
before update on medical_devices
for each row execute function touch_updated_at();

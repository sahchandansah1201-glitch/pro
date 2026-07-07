-- Stage 6 · production clinic services catalog.
-- Stores operational service settings only. No patient rows, clinical
-- conclusions, photo paths, tokens, or object-storage details are stored here.

create table if not exists clinic_services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  name text not null,
  category text not null check (category in ('consult', 'procedure', 'imaging')),
  duration_min integer not null check (duration_min between 5 and 720),
  price_min integer not null check (price_min >= 0),
  price_max integer not null check (price_max >= price_min),
  consent_note text not null default '',
  online_booking boolean not null default false,
  active boolean not null default true,
  created_by_user_id uuid references app_users(id) on delete set null,
  updated_by_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_clinic_services_clinic_created
  on clinic_services (clinic_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_clinic_services_active
  on clinic_services (clinic_id, active)
  where deleted_at is null;

drop trigger if exists trg_clinic_services_touch_updated_at on clinic_services;
create trigger trg_clinic_services_touch_updated_at
before update on clinic_services
for each row execute function touch_updated_at();

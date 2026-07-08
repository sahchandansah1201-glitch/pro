-- Stage 6 · production clinic integrations and bot settings.
-- Stores operational routing settings only. No raw patient identifiers, photo
-- paths, access tokens, signed links, clinical conclusions, or bot credentials
-- are stored here.

create table if not exists clinic_integrations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  provider text not null,
  kind text not null check (kind in ('crm', 'erp', 'mis', 'messenger', 'telephony')),
  status text not null default 'draft' check (status in ('draft', 'connected', 'disabled', 'error')),
  safe_summary_enabled boolean not null default true,
  protected_link_enabled boolean not null default true,
  field_map jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  created_by_user_id uuid references app_users(id) on delete set null,
  updated_by_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_clinic_integrations_clinic_created
  on clinic_integrations (clinic_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_clinic_integrations_status
  on clinic_integrations (clinic_id, status)
  where deleted_at is null;

drop trigger if exists trg_clinic_integrations_touch_updated_at on clinic_integrations;
create trigger trg_clinic_integrations_touch_updated_at
before update on clinic_integrations
for each row execute function touch_updated_at();

create table if not exists clinic_bot_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references clinics(id) on delete restrict,
  enabled boolean not null default true,
  intake_steps jsonb not null default '{"consent":true,"location":true,"timeline":true,"photo":true,"booking":true}'::jsonb,
  templates jsonb not null default '{}'::jsonb,
  last_dry_run_at timestamptz,
  updated_by_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_clinic_bot_settings_touch_updated_at on clinic_bot_settings;
create trigger trg_clinic_bot_settings_touch_updated_at
before update on clinic_bot_settings
for each row execute function touch_updated_at();

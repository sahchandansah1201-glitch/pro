-- Stage 6 admin lifecycle controls.
-- Adds reversible status controls for clinics/cabinets and role bindings.

alter table clinics
  add column if not exists status text not null default 'active',
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists deleted_at timestamptz;

alter table clinics
  drop constraint if exists clinics_status_check;

alter table clinics
  add constraint clinics_status_check check (status in ('active', 'suspended', 'archived'));

create index if not exists clinics_status_idx on clinics (status) where deleted_at is null;

alter table user_roles
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text,
  add column if not exists disabled_by_user_id uuid references app_users(id) on delete set null;

create index if not exists user_roles_active_idx on user_roles (user_id, clinic_id, role) where disabled_at is null;

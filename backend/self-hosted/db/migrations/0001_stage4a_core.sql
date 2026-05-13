-- Stage 4A self-hosted foundation schema.
-- PostgreSQL-owned deployment. Authorization is enforced by the backend.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type app_role as enum (
  'system_admin',
  'clinic_admin',
  'doctor',
  'assistant',
  'operator'
);

create type visit_status as enum (
  'draft',
  'in_progress',
  'signed',
  'cancelled'
);

create type asset_kind as enum (
  'overview_photo',
  'dermoscopy',
  'report_attachment'
);

create table clinics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  display_name text not null,
  password_hash text,
  mfa_enabled boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  clinic_id uuid references clinics(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, clinic_id, role)
);

create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  code text not null,
  full_name text not null,
  birth_date date,
  sex text check (sex in ('female', 'male', 'other', 'unknown')),
  phototype text check (phototype in ('I', 'II', 'III', 'IV', 'V', 'VI')),
  imaging_consent boolean not null default false,
  notes text,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (clinic_id, code)
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  doctor_user_id uuid references app_users(id) on delete set null,
  status visit_status not null default 'draft',
  started_at timestamptz,
  signed_at timestamptz,
  chief_complaint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lesions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  visit_id uuid references visits(id) on delete set null,
  label text not null,
  body_zone text,
  body_surface text,
  status text not null default 'active',
  risk_level text check (risk_level in ('low', 'moderate', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clinical_assets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  visit_id uuid references visits(id) on delete set null,
  lesion_id uuid references lesions(id) on delete set null,
  kind asset_kind not null,
  object_bucket text not null,
  object_key text not null,
  content_type text not null,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  checksum_sha256 text,
  captured_at timestamptz,
  uploaded_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (object_bucket, object_key)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  visit_id uuid not null references visits(id) on delete restrict,
  doctor_user_id uuid references app_users(id) on delete set null,
  status text not null default 'draft',
  physician_text text,
  patient_safe_text text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete set null,
  actor_user_id uuid references app_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  correlation_id text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index patients_clinic_name_idx on patients (clinic_id, full_name);
create index visits_patient_started_idx on visits (patient_id, started_at desc);
create index lesions_patient_idx on lesions (patient_id);
create index clinical_assets_visit_idx on clinical_assets (visit_id);
create index audit_log_created_idx on audit_log (created_at desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clinics_touch_updated_at
before update on clinics
for each row execute function touch_updated_at();

create trigger app_users_touch_updated_at
before update on app_users
for each row execute function touch_updated_at();

create trigger patients_touch_updated_at
before update on patients
for each row execute function touch_updated_at();

create trigger visits_touch_updated_at
before update on visits
for each row execute function touch_updated_at();

create trigger lesions_touch_updated_at
before update on lesions
for each row execute function touch_updated_at();

create trigger reports_touch_updated_at
before update on reports
for each row execute function touch_updated_at();

create or replace function block_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update
before update or delete on audit_log
for each row execute function block_audit_log_mutation();

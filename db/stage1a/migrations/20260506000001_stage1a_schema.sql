-- Stage 1A · schema (clinics, profiles, roles, clinical tables, links, audit).
-- Read-only mirror of mock data. RLS added in 20260506000002_stage1a_rls.sql.
--
-- Conventions:
--   * Every protected clinical table carries non-null clinic_id.
--   * Composite (id, clinic_id) unique keys enable child→parent clinic FK enforcement.
--   * No raw tokens stored anywhere — only token_hash columns.
--   * No INSERT/UPDATE/DELETE policies for app roles in Stage 1A.

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin create type public.app_role as enum (
  'patient','doctor','private_doctor','assistant','operator','clinic_admin','system_admin'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.partner_tier as enum ('owned','partner','external');
  exception when duplicate_object then null; end $$;
do $$ begin create type public.sex as enum ('male','female');
  exception when duplicate_object then null; end $$;
do $$ begin create type public.phototype as enum ('I','II','III','IV','V','VI');
  exception when duplicate_object then null; end $$;
do $$ begin create type public.visit_status as enum ('scheduled','in_progress','closed','cancelled');
  exception when duplicate_object then null; end $$;
do $$ begin create type public.lesion_status as enum ('active','monitoring','removed','archived');
  exception when duplicate_object then null; end $$;
do $$ begin create type public.image_kind as enum ('overview','dermoscopy','macro','body_map');
  exception when duplicate_object then null; end $$;
do $$ begin create type public.image_source as enum ('phone','file','camera','device_bridge','local_transfer');
  exception when duplicate_object then null; end $$;
do $$ begin create type public.risk_level as enum ('low','moderate','high','urgent');
  exception when duplicate_object then null; end $$;
do $$ begin create type public.consent_purpose as enum (
  'pdn','imaging','ai_processing','telemed','share_external','public_link'
); exception when duplicate_object then null; end $$;
do $$ begin create type public.consent_status as enum ('granted','revoked','pending');
  exception when duplicate_object then null; end $$;
do $$ begin create type public.report_version_status as enum ('draft','final','amended','revoked');
  exception when duplicate_object then null; end $$;

-- ── Clinics & identity ─────────────────────────────────────────────────────
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text not null,
  partner_tier public.partner_tier not null default 'owned',
  routing_priority int not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  clinic_id uuid references public.clinics(id) on delete set null,
  locale text not null default 'ru-RU',
  created_at timestamptz not null default now()
);
create index if not exists profiles_clinic_idx on public.profiles(clinic_id);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  clinic_id uuid references public.clinics(id) on delete cascade,
  granted_at timestamptz not null default now(),
  unique (user_id, role, clinic_id)
);
create index if not exists user_roles_user_idx on public.user_roles(user_id);
create index if not exists user_roles_role_idx on public.user_roles(role);

-- ── Helper functions (role checks; only depend on user_roles) ─────────────
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
                 where user_id = _user_id and role = _role)
$$;

create or replace function public.has_clinic_access(_user_id uuid, _clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
                 where user_id = _user_id
                   and clinic_id = _clinic_id
                   and role in ('doctor','private_doctor','assistant','clinic_admin'))
$$;

-- is_linked_patient is defined AFTER public.patient_user_link is created.

-- ── Patients ───────────────────────────────────────────────────────────────
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  code text not null,
  full_name text not null,
  birth_date date not null,
  sex public.sex not null,
  phototype public.phototype not null,
  risk_factors text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (clinic_id, code),
  unique (id, clinic_id)
);
create index if not exists patients_clinic_idx on public.patients(clinic_id);

create table if not exists public.patient_user_link (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (patient_id, user_id)
);
create index if not exists patient_user_link_user_idx
  on public.patient_user_link(user_id) where revoked_at is null;

-- Now is_linked_patient body matches an existing table — recreate to be safe.
create or replace function public.is_linked_patient(_user_id uuid, _patient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.patient_user_link
                 where user_id = _user_id
                   and patient_id = _patient_id
                   and revoked_at is null)
$$;

-- ── Visits ─────────────────────────────────────────────────────────────────
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  patient_id uuid not null,
  doctor_id uuid references auth.users(id) on delete set null,
  assistant_id uuid references auth.users(id) on delete set null,
  status public.visit_status not null default 'scheduled',
  started_at timestamptz not null,
  closed_at timestamptz,
  complaint text not null default '',
  created_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete restrict
);
create index if not exists visits_clinic_idx on public.visits(clinic_id);
create index if not exists visits_patient_idx on public.visits(patient_id);

-- ── Lesions ────────────────────────────────────────────────────────────────
create table if not exists public.lesions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  patient_id uuid not null,
  body_zone text not null,
  map_view text not null check (map_view in ('front','back','left','right','scalp')),
  map_x numeric(5,4) not null check (map_x >= 0 and map_x <= 1),
  map_y numeric(5,4) not null check (map_y >= 0 and map_y <= 1),
  label text not null,
  first_seen_at timestamptz not null,
  status public.lesion_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete restrict
);
create index if not exists lesions_patient_idx on public.lesions(patient_id);

-- ── Assets (image metadata, no binaries) ───────────────────────────────────
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  visit_id uuid not null,
  lesion_id uuid,
  kind public.image_kind not null,
  source public.image_source not null,
  storage_object_path text not null,
  captured_at timestamptz not null,
  device_id uuid,
  quality_score numeric(4,3) not null check (quality_score >= 0 and quality_score <= 1),
  quality_issues text[] not null default '{}',
  exif jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (visit_id, clinic_id) references public.visits(id, clinic_id) on delete restrict,
  foreign key (lesion_id, clinic_id) references public.lesions(id, clinic_id) on delete set null
);
create index if not exists assets_visit_idx on public.assets(visit_id);
create index if not exists assets_lesion_idx on public.assets(lesion_id);

-- ── Assessments ────────────────────────────────────────────────────────────
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  visit_id uuid not null,
  lesion_id uuid not null,
  abcd jsonb not null,
  seven_point jsonb not null,
  ai_risk public.risk_level,
  ai_confidence numeric(4,3) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  ai_features text[] not null default '{}',
  ai_uncertainty_notes text[] not null default '{}',
  ai_xai_notes text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (visit_id, clinic_id) references public.visits(id, clinic_id) on delete restrict,
  foreign key (lesion_id, clinic_id) references public.lesions(id, clinic_id) on delete restrict
);
create index if not exists assessments_visit_idx on public.assessments(visit_id);

-- ── Conclusions ────────────────────────────────────────────────────────────
create table if not exists public.conclusions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  visit_id uuid not null,
  doctor_text text not null,
  follow_up_plan text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (visit_id, clinic_id) references public.visits(id, clinic_id) on delete restrict
);
create index if not exists conclusions_visit_idx on public.conclusions(visit_id);

-- ── Reports + versions ─────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  visit_id uuid not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (visit_id),
  foreign key (visit_id, clinic_id) references public.visits(id, clinic_id) on delete restrict
);

create table if not exists public.report_versions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  report_id uuid not null,
  version int not null check (version >= 1),
  status public.report_version_status not null default 'draft',
  patient_safe_text text not null,
  doctor_text text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  unique (report_id, version),
  unique (id, clinic_id),
  foreign key (report_id, clinic_id) references public.reports(id, clinic_id) on delete cascade
);
create index if not exists report_versions_report_idx on public.report_versions(report_id);

alter table public.reports drop constraint if exists reports_current_version_fk;
alter table public.reports add constraint reports_current_version_fk
  foreign key (current_version_id, clinic_id)
  references public.report_versions(id, clinic_id)
  deferrable initially deferred;

-- ── Signed link tables (token HASH only) ───────────────────────────────────
create table if not exists public.public_signed_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  report_version_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (report_version_id, clinic_id)
    references public.report_versions(id, clinic_id) on delete cascade,
  -- Hard guard: token_hash must look like a hex digest, never a raw token.
  constraint public_signed_links_hash_format
    check (token_hash ~ '^[a-f0-9]{64}$')
);

create table if not exists public.protected_analysis_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  scope text not null default 'analysis_card',
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, clinic_id),
  constraint protected_analysis_links_hash_format
    check (token_hash ~ '^[a-f0-9]{64}$')
);

-- ── Consents ───────────────────────────────────────────────────────────────
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  patient_id uuid not null,
  purpose public.consent_purpose not null,
  status public.consent_status not null default 'granted',
  granted_at timestamptz,
  revoked_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (patient_id, purpose),
  unique (id, clinic_id),
  foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete cascade
);
create index if not exists consents_patient_idx on public.consents(patient_id);

-- ── Audit logs ─────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_clinic_idx on public.audit_logs(clinic_id);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);

-- ── clinic_id non-null guard trigger (defence in depth) ────────────────────
create or replace function public.tg_assert_clinic_match()
returns trigger language plpgsql as $$
begin
  if NEW.clinic_id is null then
    raise exception 'clinic_id must not be null on %', TG_TABLE_NAME;
  end if;
  return NEW;
end $$;

do $$
declare t text;
begin
  for t in select unnest(array[
      'patients','visits','lesions','assets','assessments','conclusions',
      'reports','report_versions','public_signed_links','protected_analysis_links',
      'consents','audit_logs'
  ]) loop
    execute format('drop trigger if exists tg_%1$s_clinic_check on public.%1$s;', t);
    execute format(
      'create trigger tg_%1$s_clinic_check before insert or update on public.%1$s
       for each row execute function public.tg_assert_clinic_match();', t);
  end loop;
end $$;

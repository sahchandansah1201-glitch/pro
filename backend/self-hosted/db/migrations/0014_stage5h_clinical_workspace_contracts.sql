-- Stage 5H · Production clinical workspace backend contracts.
-- Operator-owned PostgreSQL tables for assessment/conclusion plus a stable
-- report lookup contract. No managed runtime or managed database dependency.

create table if not exists clinical_assessments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  visit_id uuid not null references visits(id),
  doctor_user_id uuid references app_users(id),
  status text not null default 'draft' check (status in ('draft', 'ready', 'signed')),
  risk_level text check (risk_level in ('low', 'moderate', 'high', 'urgent')),
  abcd_total numeric(5,2),
  seven_point_total integer,
  summary text,
  recommendation text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id)
);

create table if not exists clinical_conclusions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  visit_id uuid not null references visits(id),
  doctor_user_id uuid references app_users(id),
  status text not null default 'draft' check (status in ('draft', 'ready', 'signed')),
  summary text,
  next_step text,
  follow_up_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id)
);

create unique index if not exists reports_visit_id_unique_idx on reports (visit_id);

create index if not exists clinical_assessments_clinic_visit_idx
  on clinical_assessments (clinic_id, visit_id);

create index if not exists clinical_conclusions_clinic_visit_idx
  on clinical_conclusions (clinic_id, visit_id);

drop trigger if exists clinical_assessments_touch_updated_at on clinical_assessments;
create trigger clinical_assessments_touch_updated_at
  before update on clinical_assessments
  for each row execute function touch_updated_at();

drop trigger if exists clinical_conclusions_touch_updated_at on clinical_conclusions;
create trigger clinical_conclusions_touch_updated_at
  before update on clinical_conclusions
  for each row execute function touch_updated_at();

comment on table clinical_assessments is
  'Stage 5H self-hosted clinical assessment contract. Owned by the local PostgreSQL database.';

comment on table clinical_conclusions is
  'Stage 5H self-hosted clinical conclusion contract. Owned by the local PostgreSQL database.';

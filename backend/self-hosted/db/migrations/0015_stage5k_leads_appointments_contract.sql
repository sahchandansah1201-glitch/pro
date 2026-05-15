-- Stage 5K · Production leads/appointments contracts.
-- Operator-owned PostgreSQL table for intake leads. Appointments are derived
-- from visits so the production schedule stays inside the same local database.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  patient_id uuid references patients(id) on delete set null,
  source text not null default 'operator'
    check (source in ('telegram', 'whatsapp', 'site', 'operator', 'phone', 'portal', 'other')),
  status text not null default 'new'
    check (status in ('new', 'qualified', 'booked', 'lost')),
  safe_summary text,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists leads_clinic_status_created_idx
  on leads (clinic_id, status, created_at desc)
  where deleted_at is null;

create index if not exists leads_patient_idx
  on leads (patient_id)
  where deleted_at is null;

drop trigger if exists leads_touch_updated_at on leads;
create trigger leads_touch_updated_at
  before update on leads
  for each row execute function touch_updated_at();

comment on table leads is
  'Stage 5K self-hosted lead intake contract. Owned by the local PostgreSQL database; no managed CRM/runtime dependency.';

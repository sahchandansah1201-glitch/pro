-- Stage 5Q · External intake import contracts.
-- External ad/CRM systems may push sanitized payloads into this self-hosted
-- backend. The product stores only local metadata and never depends on a
-- third-party managed runtime being available.

create table if not exists external_booking_import_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  imported_by_user_id uuid references app_users(id) on delete set null,
  source_system text not null
    check (source_system in ('clinic_crm', 'ads', 'site', 'manual', 'other')),
  source_reference text,
  status text not null default 'completed'
    check (status in ('completed', 'completed_with_rejections', 'rejected')),
  item_count integer not null default 0 check (item_count >= 0),
  accepted_booking_count integer not null default 0 check (accepted_booking_count >= 0),
  accepted_slot_count integer not null default 0 check (accepted_slot_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  summary_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists external_booking_import_batches_clinic_created_idx
  on external_booking_import_batches (clinic_id, created_at desc);

create table if not exists clinic_available_slots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  doctor_user_id uuid references app_users(id) on delete set null,
  source_system text not null
    check (source_system in ('clinic_crm', 'ads', 'site', 'manual', 'other')),
  external_slot_id text not null,
  started_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 720),
  status text not null default 'available'
    check (status in ('available', 'held', 'booked', 'cancelled')),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, source_system, external_slot_id)
);

create index if not exists clinic_available_slots_clinic_started_idx
  on clinic_available_slots (clinic_id, started_at)
  where status = 'available';

drop trigger if exists clinic_available_slots_touch_updated_at
  on clinic_available_slots;
create trigger clinic_available_slots_touch_updated_at
  before update on clinic_available_slots
  for each row execute function touch_updated_at();

comment on table external_booking_import_batches is
  'Stage 5Q: local import metadata for external ad/CRM intake. Do not store raw CRM payloads, tokens, URLs, or managed-service IDs.';
comment on column external_booking_import_batches.summary_json is
  'Stage 5Q: import summary only; storedRawPayload=false by contract.';

comment on table clinic_available_slots is
  'Stage 5Q: locally cached CRM appointment slots. The backend owns availability after import; UI does not call CRM directly.';

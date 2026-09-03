-- Stage 4I · tenant-scoped clinical asset upload idempotency.
-- A reservation is committed before an object write. Only its owner may
-- create the clinical_assets row and complete the request.

create table if not exists clinical_asset_upload_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  patient_id uuid not null,
  visit_id uuid not null,
  idempotency_key text not null,
  request_hash text not null,
  reservation_token uuid not null,
  object_bucket text not null,
  object_key text not null,
  state text not null default 'pending',
  asset_id uuid references clinical_assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint clinical_asset_upload_requests_scope_unique
    unique (clinic_id, idempotency_key),
  constraint clinical_asset_upload_requests_reservation_token_unique
    unique (reservation_token),
  constraint clinical_asset_upload_requests_object_unique
    unique (object_bucket, object_key),
  constraint clinical_asset_upload_requests_key_check
    check (
      char_length(idempotency_key) between 16 and 128
      and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
    ),
  constraint clinical_asset_upload_requests_hash_check
    check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint clinical_asset_upload_requests_state_check
    check (state in ('pending', 'completed')),
  constraint clinical_asset_upload_requests_completion_check
    check (
      (state = 'pending' and asset_id is null and completed_at is null)
      or
      (state = 'completed' and asset_id is not null and completed_at is not null)
    ),
  constraint clinical_asset_upload_requests_patient_scope_fk
    foreign key (patient_id, clinic_id)
    references patients (id, clinic_id)
    on delete restrict,
  constraint clinical_asset_upload_requests_visit_scope_fk
    foreign key (visit_id, clinic_id, patient_id)
    references visits (id, clinic_id, patient_id)
    on delete restrict
);

create index if not exists clinical_asset_upload_requests_state_created_idx
  on clinical_asset_upload_requests (state, created_at);

create unique index if not exists clinical_asset_upload_requests_asset_unique
  on clinical_asset_upload_requests (asset_id)
  where asset_id is not null;

comment on table clinical_asset_upload_requests is
  'Backend-only tenant-scoped reservations for idempotent clinical asset uploads; contains no patient-facing copy or object bytes.';

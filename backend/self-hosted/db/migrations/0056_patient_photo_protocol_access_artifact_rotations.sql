-- Batch AI · patient photo/protocol access artifact rotation ledger.
-- Stores metadata-only rotation preparation records. Raw credentials, QR
-- values, session identifiers, file paths, and signed links remain outside
-- this table and API contract.

create table if not exists patient_photo_protocol_access_artifact_rotations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  release_id uuid not null references patient_photo_protocol_releases(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete restrict,
  operation text not null
    check (operation in ('prepare_access_artifact_rotation')),
  status text not null default 'prepared'
    check (status in ('prepared', 'blocked', 'revoked')),
  prepared_by_user_id uuid references app_users(id) on delete set null,
  prepared_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patient_photo_protocol_access_artifact_rotations_clinic_idx
  on patient_photo_protocol_access_artifact_rotations (clinic_id, prepared_at desc);

create index if not exists patient_photo_protocol_access_artifact_rotations_release_idx
  on patient_photo_protocol_access_artifact_rotations (release_id, prepared_at desc);

create unique index if not exists patient_photo_protocol_access_artifact_rotations_one_prepared_idx
  on patient_photo_protocol_access_artifact_rotations (release_id, operation)
  where status = 'prepared';

drop trigger if exists patient_photo_protocol_access_artifact_rotations_touch_updated_at
  on patient_photo_protocol_access_artifact_rotations;

create trigger patient_photo_protocol_access_artifact_rotations_touch_updated_at
before update on patient_photo_protocol_access_artifact_rotations
for each row execute function touch_updated_at();

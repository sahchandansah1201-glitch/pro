-- Batch R · patient photo/protocol release ledger.
-- Stores release/revoke metadata only. Raw files, object storage paths, signed
-- URLs, and access tokens remain outside this table and API contract.

create table if not exists patient_photo_protocol_releases (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  visit_id uuid not null references visits(id) on delete restrict,
  report_id uuid references reports(id) on delete set null,
  status text not null default 'blocked'
    check (status in ('blocked', 'prepared', 'revoked')),
  selected_photo_count integer not null default 0 check (selected_photo_count >= 0),
  overview_photo_count integer not null default 0 check (overview_photo_count >= 0),
  dermoscopy_photo_count integer not null default 0 check (dermoscopy_photo_count >= 0),
  report_attachment_count integer not null default 0 check (report_attachment_count >= 0),
  release_blockers text[] not null default '{}'::text[],
  prepared_by_user_id uuid references app_users(id) on delete set null,
  prepared_at timestamptz,
  revoked_by_user_id uuid references app_users(id) on delete set null,
  revoked_at timestamptz,
  revoke_reason text,
  expires_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id)
);

create index if not exists patient_photo_protocol_releases_clinic_visit_idx
  on patient_photo_protocol_releases (clinic_id, visit_id);

create index if not exists patient_photo_protocol_releases_status_idx
  on patient_photo_protocol_releases (clinic_id, status, updated_at desc);

drop trigger if exists patient_photo_protocol_releases_touch_updated_at
  on patient_photo_protocol_releases;

create trigger patient_photo_protocol_releases_touch_updated_at
before update on patient_photo_protocol_releases
for each row execute function touch_updated_at();

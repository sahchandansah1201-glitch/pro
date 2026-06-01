-- Batch AJ · patient photo/protocol access credential hash ledger.
-- Stores only backend-owned credential hashes and fingerprints. Raw credential
-- values, QR values, session identifiers, file paths, and signed links remain
-- outside this table and API contract.

create extension if not exists pgcrypto;

create table if not exists patient_photo_protocol_access_credentials (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  release_id uuid not null references patient_photo_protocol_releases(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete restrict,
  credential_kind text not null
    check (credential_kind in ('patient_photo_protocol_access')),
  status text not null default 'active'
    check (status in ('active', 'blocked', 'expired', 'revoked')),
  credential_hash text not null check (length(credential_hash) >= 32),
  credential_fingerprint text not null check (length(credential_fingerprint) between 8 and 64),
  hash_algorithm text not null default 'hmac-sha256-pgcrypto-v1',
  credential_secret_version text not null default 'app.patient_photo_protocol_credential_pepper',
  issued_by_user_id uuid references app_users(id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb
    check (
      not (metadata_json ? 'rawCredential')
      and not (metadata_json ? 'credentialValue')
      and not (metadata_json ? 'credentialPlaintext')
      and not (metadata_json ? 'qrToken')
      and not (metadata_json ? 'sessionId')
      and not (metadata_json ? 'signedUrl')
      and not (metadata_json ? 'storagePath')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patient_photo_protocol_access_credentials_clinic_idx
  on patient_photo_protocol_access_credentials (clinic_id, issued_at desc);

create index if not exists patient_photo_protocol_access_credentials_release_idx
  on patient_photo_protocol_access_credentials (release_id, issued_at desc);

create unique index if not exists patient_photo_protocol_access_credentials_one_active_idx
  on patient_photo_protocol_access_credentials (release_id, credential_kind)
  where status = 'active';

drop trigger if exists patient_photo_protocol_access_credentials_touch_updated_at
  on patient_photo_protocol_access_credentials;

create trigger patient_photo_protocol_access_credentials_touch_updated_at
before update on patient_photo_protocol_access_credentials
for each row execute function touch_updated_at();

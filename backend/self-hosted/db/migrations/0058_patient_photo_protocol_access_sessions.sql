-- Batch AK · patient photo/protocol access session boundary ledger.
-- Stores only backend-owned session hashes/fingerprints. Raw credentials,
-- credential hashes/fingerprints, raw session identifiers, QR values, file
-- paths, and signed links remain outside this table and API contract.

create table if not exists patient_photo_protocol_access_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  release_id uuid not null references patient_photo_protocol_releases(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  patient_user_id uuid not null references app_users(id) on delete restrict,
  credential_id uuid references patient_photo_protocol_access_credentials(id) on delete set null,
  session_kind text not null
    check (session_kind in ('patient_photo_protocol_access')),
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked', 'blocked')),
  session_hash text not null check (length(session_hash) >= 32),
  session_fingerprint text not null check (length(session_fingerprint) between 8 and 64),
  hash_algorithm text not null default 'hmac-sha256-node-v1',
  session_secret_version text not null default 'PATIENT_PHOTO_PROTOCOL_SESSION_PEPPER',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb
    check (
      not (metadata_json ? 'rawCredential')
      and not (metadata_json ? 'credentialValue')
      and not (metadata_json ? 'credentialPlaintext')
      and not (metadata_json ? 'credentialHash')
      and not (metadata_json ? 'credentialFingerprint')
      and not (metadata_json ? 'rawSessionId')
      and not (metadata_json ? 'sessionId')
      and not (metadata_json ? 'sessionToken')
      and not (metadata_json ? 'sessionValue')
      and not (metadata_json ? 'sessionHash')
      and not (metadata_json ? 'sessionFingerprint')
      and not (metadata_json ? 'qrToken')
      and not (metadata_json ? 'signedUrl')
      and not (metadata_json ? 'storagePath')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patient_photo_protocol_access_sessions_clinic_idx
  on patient_photo_protocol_access_sessions (clinic_id, issued_at desc);

create index if not exists patient_photo_protocol_access_sessions_release_idx
  on patient_photo_protocol_access_sessions (release_id, issued_at desc);

create index if not exists patient_photo_protocol_access_sessions_user_idx
  on patient_photo_protocol_access_sessions (patient_user_id, issued_at desc);

create unique index if not exists patient_photo_protocol_access_sessions_one_active_idx
  on patient_photo_protocol_access_sessions (release_id, patient_user_id, session_kind)
  where status = 'active';

drop trigger if exists patient_photo_protocol_access_sessions_touch_updated_at
  on patient_photo_protocol_access_sessions;

create trigger patient_photo_protocol_access_sessions_touch_updated_at
before update on patient_photo_protocol_access_sessions
for each row execute function touch_updated_at();

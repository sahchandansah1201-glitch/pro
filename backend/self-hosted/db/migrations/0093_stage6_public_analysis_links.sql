-- Stage 6 · public analysis links.
-- Stores only a hash of the public link secret. The raw URL token, files,
-- signed URLs, storage paths, physician-only text, and sessions stay outside
-- this table and API contract.

create table if not exists public_analysis_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  report_id uuid not null references reports(id) on delete restrict,
  token_hash text not null unique
    check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  expires_at timestamptz not null,
  created_by_user_id uuid references app_users(id) on delete set null,
  revoked_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb
    check (
      not (metadata_json ? 'rawToken')
      and not (metadata_json ? 'token')
      and not (metadata_json ? 'accessToken')
      and not (metadata_json ? 'qrToken')
      and not (metadata_json ? 'sessionId')
      and not (metadata_json ? 'signedUrl')
      and not (metadata_json ? 'storagePath')
      and not (metadata_json ? 'physicianText')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_analysis_links_clinic_idx
  on public_analysis_links (clinic_id, created_at desc);

create index if not exists public_analysis_links_status_expiry_idx
  on public_analysis_links (status, expires_at);

drop trigger if exists public_analysis_links_touch_updated_at
  on public_analysis_links;

create trigger public_analysis_links_touch_updated_at
before update on public_analysis_links
for each row execute function touch_updated_at();

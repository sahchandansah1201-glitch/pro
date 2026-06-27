-- Stage 6 · production service keys.
-- Stores only hashes and public masks. Raw service keys are returned once by
-- the API response that creates or rotates the key and are never persisted.

create table if not exists service_api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  owner text not null,
  secret_prefix text not null,
  secret_hint text not null,
  secret_sha256 text not null unique,
  scopes text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  expires_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_api_keys_status_created
  on service_api_keys (status, created_at desc);

drop trigger if exists trg_service_api_keys_touch_updated_at on service_api_keys;
create trigger trg_service_api_keys_touch_updated_at
before update on service_api_keys
for each row execute function touch_updated_at();

-- Stage 5N · production patient portal contracts.
-- Adds a local patient role and explicit user→patient ownership links.

alter type app_role add value if not exists 'patient';

create table if not exists patient_user_links (
  user_id uuid not null references app_users(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, patient_id)
);

create index if not exists patient_user_links_patient_idx
  on patient_user_links (patient_id);

comment on table patient_user_links is
  'Stage 5N: self-hosted patient portal ownership links. No managed auth/database dependency.';

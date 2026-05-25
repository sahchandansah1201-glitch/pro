-- Stage 36A-36Z - local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt.
-- Stores clinic-local archive closure receipt handoff receipt metadata only; it does not establish external governance approval, legal archive sufficiency, or medical correctness.

alter table clinical_follow_up_tasks
  add column if not exists stage36_archive_handoff_receipt_state text not null default 'not_started',
  add column if not exists stage36_archive_handoff_receipt_note text,
  add column if not exists stage36_archive_handoff_received_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists stage36_archive_handoff_received_at timestamptz;

alter table clinical_follow_up_tasks
  drop constraint if exists chk_cfut_stage36_archive_handoff_receipt_state;

alter table clinical_follow_up_tasks
  add constraint chk_cfut_stage36_archive_handoff_receipt_state
  check (stage36_archive_handoff_receipt_state in ('not_started', 'ready', 'received', 'receipt_exception', 'needs_rework'));

create index if not exists idx_cfut_stage36_archive_handoff_receipt
  on clinical_follow_up_tasks (clinic_id, stage36_archive_handoff_receipt_state, updated_at desc);

create table if not exists clinical_follow_up_stage36_archive_handoff_receipt_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  archive_handoff_receipt_state text not null,
  archive_receipt_handoff_state text not null,
  archive_closure_receipt_state text not null,
  archive_closure_state text not null,
  archive_readiness_state text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cfut_stage36_handoff_receipt_events_follow_up
  on clinical_follow_up_stage36_archive_handoff_receipt_events (follow_up_id, created_at desc);

create index if not exists idx_cfut_stage36_handoff_receipt_events_clinic
  on clinical_follow_up_stage36_archive_handoff_receipt_events (clinic_id, created_at desc);

-- Stage 40A-40Z - local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness.
-- Stores clinic-local archive readiness metadata only; it does not establish external governance approval, legal archive sufficiency, or medical correctness.

alter table clinical_follow_up_tasks
  add column if not exists stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state text not null default 'not_started',
  add column if not exists stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_note text,
  add column if not exists stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_readied_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_readied_at timestamptz;

alter table clinical_follow_up_tasks
  drop constraint if exists chk_cfut_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state;

alter table clinical_follow_up_tasks
  add constraint chk_cfut_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state
  check (stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state in ('not_started', 'ready', 'archived', 'archive_exception', 'needs_rework'));

create index if not exists idx_cfut_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness
  on clinical_follow_up_tasks (clinic_id, stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state, updated_at desc);

create table if not exists clinical_follow_up_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state text not null,
  archive_handoff_receipt_reconciliation_closure_receipt_state text not null,
  archive_handoff_receipt_reconciliation_closure_state text not null,
  archive_handoff_receipt_reconciliation_state text not null,
  archive_handoff_receipt_state text not null,
  archive_receipt_handoff_state text not null,
  archive_closure_receipt_state text not null,
  archive_closure_state text not null,
  archive_readiness_state text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cfut_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_events_follow_up
  on clinical_follow_up_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_events (follow_up_id, created_at desc);

create index if not exists idx_cfut_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_events_clinic
  on clinical_follow_up_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_events (clinic_id, created_at desc);

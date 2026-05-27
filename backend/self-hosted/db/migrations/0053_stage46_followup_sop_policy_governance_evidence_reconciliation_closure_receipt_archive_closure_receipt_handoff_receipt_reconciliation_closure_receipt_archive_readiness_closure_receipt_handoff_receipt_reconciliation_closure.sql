-- Stage 46A-46Z - local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure.
-- Stores clinic-local archive readiness closure receipt handoff receipt reconciliation closure metadata only; it does not establish external governance approval, legal archive sufficiency, or medical correctness.

alter table clinical_follow_up_tasks
  add column if not exists stage46_archive_handoff_receipt_reconciliation_closure_state text not null default 'not_started',
  add column if not exists stage46_archive_handoff_receipt_reconciliation_closure_note text,
  add column if not exists stage46_archive_handoff_receipt_recon_closed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists stage46_archive_handoff_receipt_recon_closed_at timestamptz;

alter table clinical_follow_up_tasks
  drop constraint if exists chk_cfut_stage46_archive_handoff_receipt_recon_closure_state;

alter table clinical_follow_up_tasks
  add constraint chk_cfut_stage46_archive_handoff_receipt_recon_closure_state
  check (stage46_archive_handoff_receipt_reconciliation_closure_state in ('not_started', 'ready', 'closed', 'closure_exception', 'needs_rework'));

create index if not exists idx_cfut_stage46_archive_handoff_receipt_recon_closure
  on clinical_follow_up_tasks (clinic_id, stage46_archive_handoff_receipt_reconciliation_closure_state, updated_at desc);

create table if not exists clinical_follow_up_stage46_handoff_receipt_recon_closure_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  archive_handoff_receipt_reconciliation_closure_state text not null,
  stage45_archive_handoff_receipt_reconciliation_state text not null,
  stage44_archive_handoff_receipt_state text not null,
  stage43_archive_receipt_handoff_state text not null,
  stage42_archive_closure_receipt_state text not null,
  stage41_archive_closure_state text not null,
  stage40_archive_readiness_state text not null,
  stage39_closure_receipt_state text not null,
  stage38_reconciliation_closure_state text not null,
  stage37_reconciliation_state text not null,
  stage36_handoff_receipt_state text not null,
  stage35_receipt_handoff_state text not null,
  stage34_archive_closure_receipt_state text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cfut_stage46_handoff_receipt_recon_closure_events_fu
  on clinical_follow_up_stage46_handoff_receipt_recon_closure_events (follow_up_id, created_at desc);

create index if not exists idx_cfut_stage46_handoff_receipt_recon_closure_events_clinic
  on clinical_follow_up_stage46_handoff_receipt_recon_closure_events (clinic_id, created_at desc);

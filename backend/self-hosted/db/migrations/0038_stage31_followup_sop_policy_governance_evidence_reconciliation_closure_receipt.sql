-- Stage 31A-31Z · local SOP policy governance evidence reconciliation closure receipt.
-- This stores clinic-local receipt metadata only; no external governance approval is implied.

alter table clinical_follow_up_tasks
  add column if not exists sop_policy_governance_evidence_reconciliation_closure_receipt_state text not null default 'not_started',
  add column if not exists sop_policy_governance_evidence_reconciliation_closure_receipt_note text,
  add column if not exists sop_policy_governance_evidence_reconciliation_closure_received_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists sop_policy_governance_evidence_reconciliation_closure_received_at timestamptz;

alter table clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_sop_policy_governance_evidence_reconciliation_closure_receipt_state_check;

alter table clinical_follow_up_tasks
  add constraint clinical_follow_up_tasks_sop_policy_governance_evidence_reconciliation_closure_receipt_state_check
  check (sop_policy_governance_evidence_reconciliation_closure_receipt_state in ('not_started', 'ready', 'received', 'receipt_exception', 'needs_rework'));

create index if not exists idx_clinical_follow_up_tasks_sop_policy_governance_evidence_reconciliation_closure_receipt
  on clinical_follow_up_tasks (clinic_id, sop_policy_governance_evidence_reconciliation_closure_receipt_state, updated_at desc);

create table if not exists clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  closure_receipt_state text not null,
  reconciliation_closure_state text not null,
  reconciliation_state text not null,
  evidence_state text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events_follow_up
  on clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events (follow_up_id, created_at desc);

create index if not exists idx_clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events_clinic
  on clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events (clinic_id, created_at desc);

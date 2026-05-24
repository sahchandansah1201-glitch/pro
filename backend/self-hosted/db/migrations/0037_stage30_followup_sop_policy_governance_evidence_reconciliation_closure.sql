-- Stage 30A-30Z · local SOP policy governance evidence reconciliation closure.
-- This stores clinic-local closure metadata only; no external governance approval is implied.

alter table clinical_follow_up_tasks
  add column if not exists sop_policy_governance_evidence_reconciliation_closure_state text not null default 'not_started',
  add column if not exists sop_policy_governance_evidence_reconciliation_closure_note text,
  add column if not exists sop_policy_governance_evidence_reconciliation_closed_by_user_id uuid references users(id),
  add column if not exists sop_policy_governance_evidence_reconciliation_closed_at timestamptz;

alter table clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_sop_policy_governance_evidence_reconciliation_closure_state_check;

alter table clinical_follow_up_tasks
  add constraint clinical_follow_up_tasks_sop_policy_governance_evidence_reconciliation_closure_state_check
  check (sop_policy_governance_evidence_reconciliation_closure_state in ('not_started', 'ready', 'closed', 'closure_exception', 'needs_rework'));

create index if not exists idx_clinical_follow_up_tasks_sop_policy_governance_evidence_reconciliation_closure
  on clinical_follow_up_tasks (clinic_id, sop_policy_governance_evidence_reconciliation_closure_state, updated_at desc);

create table if not exists clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  actor_user_id uuid references users(id),
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  reconciliation_closure_state text not null,
  reconciliation_state text not null,
  evidence_state text not null,
  governance_closure_state text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events_follow_up
  on clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events (follow_up_id, created_at desc);

create index if not exists idx_clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events_clinic
  on clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events (clinic_id, created_at desc);

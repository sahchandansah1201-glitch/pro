-- Stage 28A-28Z · Clinical follow-up SOP policy governance evidence export.
-- Local PostgreSQL metadata only; external governance approvals stay outside this product boundary.

alter table clinical_follow_up_tasks
  add column if not exists sop_policy_governance_evidence_state text not null default 'not_started',
  add column if not exists sop_policy_governance_evidence_note text,
  add column if not exists sop_policy_governance_evidence_reviewed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists sop_policy_governance_evidence_reviewed_at timestamptz;

alter table clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_sop_policy_governance_evidence_state_check;

alter table clinical_follow_up_tasks
  add constraint clinical_follow_up_tasks_sop_policy_governance_evidence_state_check
  check (sop_policy_governance_evidence_state in ('not_started', 'ready', 'exported', 'needs_followup'));

create index if not exists idx_clinical_follow_up_tasks_sop_policy_governance_evidence
  on clinical_follow_up_tasks (clinic_id, sop_policy_governance_evidence_state, updated_at desc);

create table if not exists clinical_follow_up_sop_policy_governance_evidence_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  evidence_state text not null default 'not_started',
  closure_state text not null default 'not_started',
  governance_state text not null default 'not_started',
  audit_state text not null default 'not_started',
  drift_state text not null default 'not_checked',
  exception_state text not null default 'none',
  validation_state text not null default 'not_required',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_sop_policy_governance_evidence_events_follow_up
  on clinical_follow_up_sop_policy_governance_evidence_events (follow_up_id, created_at desc);

create index if not exists idx_clinical_follow_up_sop_policy_governance_evidence_events_clinic
  on clinical_follow_up_sop_policy_governance_evidence_events (clinic_id, created_at desc);

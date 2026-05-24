-- Stage 27A-27Z · Clinical follow-up local SOP policy governance closure.
-- Adds local clinic governance closure metadata without external approval claims.

alter table clinical_follow_up_tasks
  add column if not exists sop_policy_governance_closure_state text not null default 'not_started',
  add column if not exists sop_policy_governance_closure_note text,
  add column if not exists sop_policy_governance_closed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists sop_policy_governance_closed_at timestamptz;

alter table clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_sop_policy_governance_closure_state_check,
  add constraint clinical_follow_up_tasks_sop_policy_governance_closure_state_check
    check (sop_policy_governance_closure_state in ('not_started', 'ready', 'closed', 'needs_followup'));

create index if not exists idx_clinical_follow_up_tasks_sop_policy_governance_closure
  on clinical_follow_up_tasks (
    clinic_id,
    sop_policy_governance_closure_state,
    sop_policy_governance_state,
    sop_policy_audit_state,
    updated_at desc
  );

create table if not exists clinical_follow_up_sop_policy_governance_closure_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  closure_state text not null default 'not_started',
  governance_state text not null default 'not_started',
  audit_state text not null default 'not_started',
  drift_state text not null default 'not_checked',
  exception_state text not null default 'none',
  validation_state text not null default 'not_required',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_sop_policy_governance_closure_events_follow_up
  on clinical_follow_up_sop_policy_governance_closure_events (follow_up_id, created_at desc);

create index if not exists idx_clinical_follow_up_sop_policy_governance_closure_events_clinic
  on clinical_follow_up_sop_policy_governance_closure_events (clinic_id, created_at desc);

-- Stage 24A-24Z · local SOP policy exception closure for follow-up validation.
-- Closes local drift and exception review metadata inside self-hosted PostgreSQL only.

alter table clinical_follow_up_tasks
  add column if not exists sop_policy_exception_state text not null default 'none',
  add column if not exists sop_policy_exception_reason text,
  add column if not exists sop_policy_exception_resolution text,
  add column if not exists sop_policy_exception_closed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists sop_policy_exception_closed_at timestamptz;

alter table clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_sop_policy_exception_state_check,
  add constraint clinical_follow_up_tasks_sop_policy_exception_state_check
    check (sop_policy_exception_state in ('none', 'open', 'accepted', 'rejected', 'closed'));

create index if not exists idx_clinical_follow_up_tasks_sop_policy_exception
  on clinical_follow_up_tasks (
    clinic_id,
    sop_policy_exception_state,
    sop_policy_drift_state,
    updated_at desc
  );

create table if not exists clinical_follow_up_sop_policy_exception_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  exception_state text not null,
  drift_state text,
  validation_state text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_sop_policy_exception_events_follow_up
  on clinical_follow_up_sop_policy_exception_events (follow_up_id, created_at desc);

create index if not exists idx_clinical_follow_up_sop_policy_exception_events_clinic
  on clinical_follow_up_sop_policy_exception_events (clinic_id, created_at desc);

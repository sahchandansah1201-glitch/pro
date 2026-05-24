-- Stage 23A-23Z · local SOP policy template application and drift review.
-- Applies local clinic SOP policy template metadata to follow-up validation only.

alter table clinical_follow_up_tasks
  add column if not exists sop_policy_template_id uuid references clinical_follow_up_sop_policy_templates(id) on delete set null,
  add column if not exists sop_policy_template_code text,
  add column if not exists sop_policy_drift_state text not null default 'not_checked',
  add column if not exists sop_policy_drift_reason text,
  add column if not exists sop_policy_applied_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists sop_policy_applied_at timestamptz,
  add column if not exists sop_policy_drift_reviewed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists sop_policy_drift_reviewed_at timestamptz;

alter table clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_sop_policy_drift_state_check,
  add constraint clinical_follow_up_tasks_sop_policy_drift_state_check
    check (sop_policy_drift_state in ('not_checked', 'in_sync', 'drifted', 'missing_template', 'review_required'));

create index if not exists idx_clinical_follow_up_tasks_sop_policy_drift
  on clinical_follow_up_tasks (
    clinic_id,
    sop_policy_drift_state,
    sop_policy_version,
    updated_at desc
  );

create table if not exists clinical_follow_up_sop_policy_application_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  template_id uuid references clinical_follow_up_sop_policy_templates(id) on delete set null,
  clinic_id uuid not null references clinics(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  sop_policy_version text,
  drift_state text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_sop_policy_application_events_follow_up
  on clinical_follow_up_sop_policy_application_events (follow_up_id, created_at desc);

create index if not exists idx_clinical_follow_up_sop_policy_application_events_template
  on clinical_follow_up_sop_policy_application_events (template_id, created_at desc);

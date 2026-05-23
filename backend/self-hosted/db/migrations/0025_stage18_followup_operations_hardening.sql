-- Stage 18A-18Z · Clinical follow-up operations hardening.
-- Adds self-hosted triage/SLA/escalation state without any managed
-- notification provider dependency.

alter table clinical_follow_up_tasks
  add column if not exists triage_state text not null default 'new'
    check (triage_state in ('new', 'queued', 'in_review', 'waiting_patient', 'escalated', 'resolved', 'blocked')),
  add column if not exists escalation_level text not null default 'none'
    check (escalation_level in ('none', 'watch', 'clinic_admin', 'urgent')),
  add column if not exists sla_due_at timestamptz,
  add column if not exists delivery_state text not null default 'not_required'
    check (delivery_state in ('not_required', 'pending', 'delivered', 'failed', 'deferred')),
  add column if not exists delivery_attempts integer not null default 0
    check (delivery_attempts >= 0),
  add column if not exists last_delivery_attempt_at timestamptz,
  add column if not exists delivery_evidence jsonb not null default '{}'::jsonb,
  add column if not exists operations_note text,
  add column if not exists resolved_by_user_id uuid references app_users(id),
  add column if not exists resolved_at timestamptz;

create table if not exists clinical_follow_up_operations_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references clinical_follow_up_tasks(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  actor_user_id uuid references app_users(id),
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_tasks_ops_queue
  on clinical_follow_up_tasks (clinic_id, triage_state, sla_due_at, due_at)
  where status not in ('completed', 'cancelled');

create index if not exists idx_clinical_follow_up_tasks_ops_escalation
  on clinical_follow_up_tasks (clinic_id, escalation_level, due_at)
  where escalation_level <> 'none';

create index if not exists idx_clinical_follow_up_tasks_ops_overdue
  on clinical_follow_up_tasks (clinic_id, sla_due_at)
  where sla_due_at is not null
    and status not in ('completed', 'cancelled')
    and triage_state not in ('resolved', 'blocked');

create index if not exists idx_clinical_follow_up_operations_events_follow_up
  on clinical_follow_up_operations_events (follow_up_id, created_at desc);

-- Stage 20A-20Z · clinical follow-up retention and clinic review.
-- Self-hosted PostgreSQL only; review readiness is local metadata, not external proof.

alter table public.clinical_follow_up_tasks
  add column if not exists retention_review_state text not null default 'not_due',
  add column if not exists retention_review_note text,
  add column if not exists retention_reviewed_by_user_id uuid references app_users(id),
  add column if not exists retention_reviewed_at timestamptz,
  add column if not exists clinic_review_state text not null default 'not_scheduled',
  add column if not exists clinic_review_note text,
  add column if not exists clinic_reviewed_by_user_id uuid references app_users(id),
  add column if not exists clinic_reviewed_at timestamptz;

alter table public.clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_retention_review_state_check,
  add constraint clinical_follow_up_tasks_retention_review_state_check
    check (retention_review_state in ('not_due', 'due', 'reviewed', 'archived'));

alter table public.clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_clinic_review_state_check,
  add constraint clinical_follow_up_tasks_clinic_review_state_check
    check (clinic_review_state in ('not_scheduled', 'scheduled', 'completed', 'needs_policy_review'));

create index if not exists idx_clinical_follow_up_tasks_retention_review_queue
  on public.clinical_follow_up_tasks (
    clinic_id,
    retention_review_state,
    clinic_review_state,
    updated_at desc
  );

create table if not exists public.clinical_follow_up_retention_review_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.clinical_follow_up_tasks(id),
  clinic_id uuid not null references public.clinics(id),
  actor_user_id uuid references app_users(id),
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_retention_review_events_follow_up
  on public.clinical_follow_up_retention_review_events (follow_up_id, created_at desc);

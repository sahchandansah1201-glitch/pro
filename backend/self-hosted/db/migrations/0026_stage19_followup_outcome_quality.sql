-- Stage 19A-19Z · clinical follow-up outcome and quality review.
-- Self-hosted PostgreSQL only; no managed notification provider or external runtime.

alter table public.clinical_follow_up_tasks
  add column if not exists resolution_outcome text not null default 'not_reviewed',
  add column if not exists quality_review_state text not null default 'pending',
  add column if not exists quality_review_note text,
  add column if not exists quality_reviewed_by_user_id uuid references public.users(id),
  add column if not exists quality_reviewed_at timestamptz;

alter table public.clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_resolution_outcome_check,
  add constraint clinical_follow_up_tasks_resolution_outcome_check
    check (resolution_outcome in (
      'not_reviewed',
      'patient_reached',
      'patient_unreachable',
      'clinical_escalation',
      'administrative_close'
    ));

alter table public.clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_quality_review_state_check,
  add constraint clinical_follow_up_tasks_quality_review_state_check
    check (quality_review_state in ('pending', 'reviewed', 'needs_attention'));

create index if not exists idx_clinical_follow_up_tasks_quality_queue
  on public.clinical_follow_up_tasks (
    clinic_id,
    quality_review_state,
    resolution_outcome,
    updated_at desc
  );

create table if not exists public.clinical_follow_up_quality_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.clinical_follow_up_tasks(id),
  clinic_id uuid not null references public.clinics(id),
  actor_user_id uuid references public.users(id),
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_quality_events_follow_up
  on public.clinical_follow_up_quality_events (follow_up_id, created_at desc);

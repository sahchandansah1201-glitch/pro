-- Stage 21A-21Z · clinical follow-up clinic-specific SOP validation.
-- Self-hosted PostgreSQL only; SOP validation is local clinic metadata, not external clinical proof.

alter table public.clinical_follow_up_tasks
  add column if not exists sop_validation_state text not null default 'not_required',
  add column if not exists sop_policy_version text,
  add column if not exists sop_exception_reason text,
  add column if not exists sop_validated_by_user_id uuid references app_users(id),
  add column if not exists sop_validated_at timestamptz;

alter table public.clinical_follow_up_tasks
  drop constraint if exists clinical_follow_up_tasks_sop_validation_state_check,
  add constraint clinical_follow_up_tasks_sop_validation_state_check
    check (sop_validation_state in ('not_required', 'required', 'validated', 'exception', 'blocked'));

create index if not exists idx_clinical_follow_up_tasks_sop_validation_queue
  on public.clinical_follow_up_tasks (
    clinic_id,
    sop_validation_state,
    clinic_review_state,
    quality_review_state,
    updated_at desc
  );

create table if not exists public.clinical_follow_up_sop_validation_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.clinical_follow_up_tasks(id),
  clinic_id uuid not null references public.clinics(id),
  actor_user_id uuid references app_users(id),
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  sop_policy_version text,
  exception_reason text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_sop_validation_events_follow_up
  on public.clinical_follow_up_sop_validation_events (follow_up_id, created_at desc);

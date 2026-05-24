-- Stage 22A-22Z · local clinic SOP policy templates for follow-up validation.
-- Keeps SOP policy configuration inside the self-hosted PostgreSQL boundary.

create table if not exists clinical_follow_up_sop_policy_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  code text not null,
  title text not null,
  version text not null,
  description text,
  applies_to jsonb not null default '{}'::jsonb,
  required_validation_states text[] not null default array['required', 'blocked']::text[],
  default_validation_state text not null default 'required',
  exception_allowed boolean not null default true,
  active boolean not null default true,
  created_by_user_id uuid references app_users(id) on delete set null,
  updated_by_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_follow_up_sop_policy_templates_code_format check (code ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{1,79}$'),
  constraint clinical_follow_up_sop_policy_templates_title_length check (char_length(title) between 2 and 160),
  constraint clinical_follow_up_sop_policy_templates_version_length check (char_length(version) between 1 and 120),
  constraint clinical_follow_up_sop_policy_templates_default_state check (
    default_validation_state in ('not_required', 'required', 'validated', 'exception', 'blocked')
  ),
  constraint clinical_follow_up_sop_policy_templates_required_states check (
    required_validation_states <@ array['not_required', 'required', 'validated', 'exception', 'blocked']::text[]
  ),
  unique (clinic_id, code, version)
);

create index if not exists idx_clinical_follow_up_sop_policy_templates_clinic_active
  on clinical_follow_up_sop_policy_templates (clinic_id, active, updated_at desc);

create table if not exists clinical_follow_up_sop_policy_template_events (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references clinical_follow_up_sop_policy_templates(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_follow_up_sop_policy_template_events_template
  on clinical_follow_up_sop_policy_template_events (template_id, created_at desc);

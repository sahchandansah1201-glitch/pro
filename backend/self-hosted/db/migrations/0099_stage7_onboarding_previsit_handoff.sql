-- Stage 7 · Progressive 2-step onboarding, Split-Vault sanitized pre-visit cases,
-- Telegram first-channel FSM state, Skin Passport activation, and 152-FZ deletion.
-- Strictly PostgreSQL 16 self-hosted (zero managed/external DB dependencies).

-- 1. Allow pre-visit booking requests before a patient portal app_user exists,
--    and enrich clinic booking requests with channel, priority, and handoff metadata
--    (while keeping medical photos and Status localis strictly outside this table).
alter table patient_portal_booking_requests
  alter column requested_by_user_id drop not null;

alter table patient_portal_booking_requests
  add column if not exists channel text
    check (channel is null or channel in ('telegram', 'whatsapp', 'max', 'web')),
  add column if not exists booking_priority text
    check (booking_priority is null or booking_priority in ('PRIORITY_URGENT', 'PLANNED_STANDARD')),
  add column if not exists handoff_case_code text,
  add column if not exists contact_phone text,
  add column if not exists preferred_time_note text;

create index if not exists idx_booking_requests_clinic_priority_created
  on patient_portal_booking_requests (clinic_id, booking_priority, created_at desc);

create unique index if not exists idx_booking_requests_handoff_case_code
  on patient_portal_booking_requests (clinic_id, handoff_case_code)
  where handoff_case_code is not null;

-- 2. Extend patient_user_links with unlimited Skin Passport activation metadata.
alter table patient_user_links
  add column if not exists skin_passport_active boolean not null default false,
  add column if not exists skin_passport_activated_at timestamptz,
  add column if not exists activated_by_visit_id uuid references visits(id) on delete set null;

-- 3. Public / Bot onboarding accounts & subprofiles (SELF / CHILD_UNDER_18 / ADULT_RELATIVE).
--    User-facing quotas are disabled by owner decision (quota_enforced = false),
--    while technical counters are retained passively for early-tester analytics.
create table if not exists onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token_sha256 text not null unique,
  channel text not null default 'web'
    check (channel in ('telegram', 'whatsapp', 'max', 'web')),
  external_chat_id text,
  fsm_state text not null default 'S0_START',
  fsm_context_json jsonb not null default '{}'::jsonb,
  active_profile_id uuid,
  quota_enforced boolean not null default false,
  accepted_photo_count integer not null default 0 check (accepted_photo_count >= 0),
  rejected_photo_count integer not null default 0 check (rejected_photo_count >= 0),
  antifraud_flags_json jsonb not null default '{}'::jsonb,
  linked_patient_id uuid references patients(id) on delete set null,
  skin_passport_active boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_onboarding_sessions_channel_chat
  on onboarding_sessions (channel, external_chat_id)
  where external_chat_id is not null and deleted_at is null;

drop trigger if exists trg_onboarding_sessions_touch_updated_at on onboarding_sessions;
create trigger trg_onboarding_sessions_touch_updated_at
  before update on onboarding_sessions
  for each row execute function touch_updated_at();

create table if not exists onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references onboarding_sessions(id) on delete cascade,
  subject_relation text not null
    check (subject_relation in ('SELF', 'CHILD_UNDER_18', 'ADULT_RELATIVE')),
  label text not null,
  legal_guardian_confirmed boolean not null default false,
  consent_152fz_accepted_at timestamptz not null,
  age_years integer check (age_years is null or (age_years >= 0 and age_years <= 120)),
  age_months integer check (age_months is null or (age_months >= 0 and age_months <= 24)),
  pediatric_u6_active boolean not null default false,
  biological_sex text not null check (biological_sex in ('male', 'female')),
  estimated_fitzpatrick_band text
    check (estimated_fitzpatrick_band is null or estimated_fitzpatrick_band in ('I', 'II', 'III', 'IV', 'V', 'VI')),
  baseline_ita_degrees numeric(6,2),
  risk_factors_json jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_child_guardian_required
    check (subject_relation <> 'CHILD_UNDER_18' or legal_guardian_confirmed = true)
);

create index if not exists idx_onboarding_profiles_session
  on onboarding_profiles (session_id, created_at asc)
  where deleted_at is null;

drop trigger if exists trg_onboarding_profiles_touch_updated_at on onboarding_profiles;
create trigger trg_onboarding_profiles_touch_updated_at
  before update on onboarding_profiles
  for each row execute function touch_updated_at();

-- 4. Onboarding submissions (Split-Vault sanitized frames, PAD-DIQA, U3+U5 answers, queue fallback).
--    Exact GPS coordinates and raw logits/probabilities are NEVER stored here.
create table if not exists onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references onboarding_sessions(id) on delete cascade,
  profile_id uuid not null references onboarding_profiles(id) on delete cascade,
  channel text not null check (channel in ('telegram', 'whatsapp', 'max', 'web')),
  status text not null default 'quality_rejected'
    check (status in (
      'quality_rejected',
      'awaiting_mismatch_confirm',
      'awaiting_micro_survey',
      'queued_gpu',
      'ready',
      'handed_off',
      'deleted'
    )),
  quality_gate_json jsonb not null default '{}'::jsonb,
  optical_exif_json jsonb not null default '{}'::jsonb,
  coarse_uv_belt text,
  ita_degrees numeric(6,2),
  estimated_fitzpatrick_band text
    check (estimated_fitzpatrick_band is null or estimated_fitzpatrick_band in ('I', 'II', 'III', 'IV', 'V', 'VI')),
  profile_mismatch_delta_ita numeric(6,2),
  profile_mismatch_resolution text
    check (profile_mismatch_resolution is null or profile_mismatch_resolution in ('same_person_lighting', 'switched_profile')),
  antifraud_summary_json jsonb not null default '{}'::jsonb,
  sanitized_object_bucket text,
  sanitized_full_image_key text,
  anamnesis_answers_json jsonb not null default '{}'::jsonb,
  routing_category text
    check (routing_category is null or routing_category in (
      'HIGH_URGENT',
      'PLANNED_REVIEW',
      'LOW_OBSERVATION',
      'U5_MODIFIED_SKIN',
      'U6_PEDIATRIC_RED_FLAG'
    )),
  patient_facing_card_json jsonb not null default '{}'::jsonb,
  doctor_only_draft_json jsonb not null default '[]'::jsonb,
  gpu_job_uuid uuid,
  canary_watermark_id text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_onboarding_submissions_session_created
  on onboarding_submissions (session_id, created_at desc)
  where deleted_at is null;

drop trigger if exists trg_onboarding_submissions_touch_updated_at on onboarding_submissions;
create trigger trg_onboarding_submissions_touch_updated_at
  before update on onboarding_submissions
  for each row execute function touch_updated_at();

-- 5. Clinic Pre-visit Handoff Cases (POST /internal/v1/previsit-cases & /clinic-visit-confirmed).
--    Strictly scoped by clinic_id. Doctors read lesions & doctor_only_status_localis_draft;
--    Operators only read patient_portal_booking_requests without medical images or clinical text.
create table if not exists previsit_cases (
  id uuid primary key default gen_random_uuid(),
  handoff_case_code text not null unique,
  clinic_id uuid not null references clinics(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  booking_request_id uuid references patient_portal_booking_requests(id) on delete set null,
  visit_id uuid references visits(id) on delete set null,
  onboarding_session_id uuid references onboarding_sessions(id) on delete set null,
  channel text not null check (channel in ('telegram', 'whatsapp', 'max', 'web')),
  booking_priority text not null check (booking_priority in ('PRIORITY_URGENT', 'PLANNED_STANDARD')),
  subject_relation text not null check (subject_relation in ('SELF', 'CHILD_UNDER_18', 'ADULT_RELATIVE')),
  legal_guardian_confirmed boolean not null default false,
  consent_152fz_accepted_at timestamptz not null,
  subject_profile_json jsonb not null default '{}'::jsonb,
  skin_passport_active boolean not null default false,
  visit_confirmed_at timestamptz,
  visit_confirmed_by_user_id uuid references app_users(id) on delete set null,
  canary_watermark_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_previsit_child_guardian_required
    check (subject_relation <> 'CHILD_UNDER_18' or legal_guardian_confirmed = true)
);

create index if not exists idx_previsit_cases_clinic_created
  on previsit_cases (clinic_id, created_at desc);

create index if not exists idx_previsit_cases_visit
  on previsit_cases (visit_id)
  where visit_id is not null;

create index if not exists idx_previsit_cases_patient
  on previsit_cases (patient_id, created_at desc);

drop trigger if exists trg_previsit_cases_touch_updated_at on previsit_cases;
create trigger trg_previsit_cases_touch_updated_at
  before update on previsit_cases
  for each row execute function touch_updated_at();

create table if not exists previsit_case_lesions (
  id uuid primary key default gen_random_uuid(),
  previsit_case_id uuid not null references previsit_cases(id) on delete cascade,
  lesion_index integer not null check (lesion_index >= 1),
  body_region_code text,
  sanitized_full_image_s3_key text,
  private_crop_card_s3_key text,
  crop_svg_data_url text,
  quality_gate_json jsonb not null default '{}'::jsonb,
  anamnesis_answers_json jsonb not null default '{}'::jsonb,
  doctor_only_status_localis_draft text not null,
  patient_facing_safe_summary text not null,
  physical_mm_per_px numeric(10,5),
  histology_outcome text,
  created_at timestamptz not null default now(),
  unique (previsit_case_id, lesion_index)
);

create index if not exists idx_previsit_case_lesions_case
  on previsit_case_lesions (previsit_case_id, lesion_index asc);

comment on table previsit_cases is
  'Stage 7: Pre-visit cases handed off from public web / Telegram / WhatsApp / MAX onboarding to clinics.';
comment on table previsit_case_lesions is
  'Stage 7: Per-lesion pre-visit data separating doctor_only_status_localis_draft from patient_facing_safe_summary.';

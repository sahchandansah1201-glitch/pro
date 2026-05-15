-- Stage 5O · production patient portal write boundary.
-- Patient-owned writes stay inside the self-hosted PostgreSQL deployment.

create table if not exists patient_portal_booking_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  requested_by_user_id uuid not null references app_users(id) on delete restrict,
  preferred_from timestamptz not null,
  preferred_to timestamptz,
  reason text,
  status text not null default 'requested'
    check (status in ('requested', 'reviewing', 'booked', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patient_portal_booking_requests_patient_created_idx
  on patient_portal_booking_requests (patient_id, created_at desc);

drop trigger if exists patient_portal_booking_requests_touch_updated_at
  on patient_portal_booking_requests;
create trigger patient_portal_booking_requests_touch_updated_at
  before update on patient_portal_booking_requests
  for each row execute function touch_updated_at();

create table if not exists patient_portal_reminder_preferences (
  user_id uuid primary key references app_users(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  appointment_reminders_enabled boolean not null default true,
  report_notifications_enabled boolean not null default true,
  preferred_channel text not null default 'email'
    check (preferred_channel in ('email', 'phone', 'none')),
  updated_at timestamptz not null default now()
);

create index if not exists patient_portal_reminder_preferences_patient_idx
  on patient_portal_reminder_preferences (patient_id);

drop trigger if exists patient_portal_reminder_preferences_touch_updated_at
  on patient_portal_reminder_preferences;
create trigger patient_portal_reminder_preferences_touch_updated_at
  before update on patient_portal_reminder_preferences
  for each row execute function touch_updated_at();

comment on table patient_portal_booking_requests is
  'Stage 5O: patient-owned self-hosted booking requests. Clinic staff convert requests into visits.';

comment on table patient_portal_reminder_preferences is
  'Stage 5O: patient-owned self-hosted reminder preferences. No external notification provider dependency.';

-- Stage 5P · Clinic booking requests intake.
-- Patient-owned booking requests become a clinic/operator-owned intake queue.

alter table patient_portal_booking_requests
  add column if not exists assigned_visit_id uuid references visits(id) on delete set null,
  add column if not exists reviewed_by_user_id uuid references app_users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists clinic_note text;

create index if not exists patient_portal_booking_requests_clinic_status_created_idx
  on patient_portal_booking_requests (clinic_id, status, created_at desc);

create index if not exists patient_portal_booking_requests_assigned_visit_idx
  on patient_portal_booking_requests (assigned_visit_id)
  where assigned_visit_id is not null;

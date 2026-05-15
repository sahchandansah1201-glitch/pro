-- Stage 5P · production clinic booking requests intake.
-- Operator/clinic-side workflow for processing patient_portal_booking_requests
-- created in Stage 5O. All processing stays inside the self-hosted
-- PostgreSQL deployment. No managed runtime/database dependency, no external
-- CRM, no notification provider.

alter table patient_portal_booking_requests
  add column if not exists assigned_visit_id uuid
    references visits(id) on delete set null,
  add column if not exists reviewed_by_user_id uuid
    references app_users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists clinic_note text;

create index if not exists patient_portal_booking_requests_clinic_status_idx
  on patient_portal_booking_requests (clinic_id, status, created_at desc);

create index if not exists patient_portal_booking_requests_assigned_idx
  on patient_portal_booking_requests (assigned_visit_id);

comment on column patient_portal_booking_requests.assigned_visit_id is
  'Stage 5P: visit created from Stage 5L /api/v1/leads/{id}/book-appointment when status=booked.';

comment on column patient_portal_booking_requests.clinic_note is
  'Stage 5P: clinic-internal note. Never exposed to patient portal endpoints.';

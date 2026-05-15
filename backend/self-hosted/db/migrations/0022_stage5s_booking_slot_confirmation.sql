-- Stage 5S · Booking request confirmation from local availability slots.
-- Operators convert patient/CRM/ad booking requests into visits by choosing a
-- locally cached clinic_available_slots row. The backend creates the visit,
-- marks the slot booked, and updates the request inside PostgreSQL only.

create index if not exists patient_portal_booking_requests_open_assignment_idx
  on patient_portal_booking_requests (clinic_id, status, id)
  where assigned_visit_id is null;

create index if not exists clinic_available_slots_available_id_idx
  on clinic_available_slots (clinic_id, id)
  where status = 'available';

comment on index patient_portal_booking_requests_open_assignment_idx is
  'Stage 5S: fast lookup for open booking requests before local slot confirmation.';

comment on index clinic_available_slots_available_id_idx is
  'Stage 5S: confirms appointments only from local cached available slots; no CRM runtime call.';

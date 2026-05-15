-- Stage 5R · Clinic available slots read contract.
-- CRM systems still only push availability into the self-hosted backend.
-- Operators read the local PostgreSQL cache; no browser/backend runtime calls
-- the CRM, ad platform, or other third-party managed service.

create index if not exists clinic_available_slots_clinic_status_started_idx
  on clinic_available_slots (clinic_id, status, started_at, id);

create index if not exists clinic_available_slots_source_started_idx
  on clinic_available_slots (clinic_id, source_system, started_at)
  where status = 'available';

comment on index clinic_available_slots_clinic_status_started_idx is
  'Stage 5R: local availability queue for operator booking decisions.';

comment on index clinic_available_slots_source_started_idx is
  'Stage 5R: source filter remains local; no direct CRM runtime dependency.';


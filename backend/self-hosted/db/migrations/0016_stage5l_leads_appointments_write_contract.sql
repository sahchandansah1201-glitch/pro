-- Stage 5L · Production leads/appointments write contract hardening.
-- Keeps intake writes and booked appointments inside operator-owned PostgreSQL.

create index if not exists leads_created_by_created_idx
  on leads (created_by, created_at desc)
  where deleted_at is null;

create index if not exists visits_doctor_started_stage5l_idx
  on visits (doctor_user_id, started_at)
  where status in ('draft', 'in_progress');

comment on column leads.safe_summary is
  'Patient-safe lead summary. Do not store raw chat transcripts, external CRM payloads, tokens, or managed-service IDs.';

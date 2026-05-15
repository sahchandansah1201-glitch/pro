-- Stage 5T · External intake connector hardening.
-- External CRM/ad adapters may only push sanitized data into the self-hosted
-- backend. This migration adds local idempotency and duplicate accounting so
-- imports remain replay-safe without depending on any third-party runtime.

alter table external_booking_import_batches
  add column if not exists idempotency_key text,
  add column if not exists duplicate_count integer not null default 0 check (duplicate_count >= 0),
  add column if not exists hardening_version text not null default 'stage5t';

create unique index if not exists external_booking_import_batches_idempotency_idx
  on external_booking_import_batches (clinic_id, source_system, idempotency_key)
  where idempotency_key is not null;

alter table patient_portal_booking_requests
  add column if not exists source_system text
    check (source_system is null or source_system in ('clinic_crm', 'ads', 'site', 'manual', 'other')),
  add column if not exists external_request_id text;

create unique index if not exists patient_portal_booking_requests_external_request_idx
  on patient_portal_booking_requests (clinic_id, source_system, external_request_id)
  where external_request_id is not null;

create index if not exists external_booking_import_batches_hardening_status_idx
  on external_booking_import_batches (clinic_id, source_system, status, created_at desc);

comment on column external_booking_import_batches.idempotency_key is
  'Stage 5T: operator-owned adapter idempotency key. It is local metadata only and must not contain raw CRM URLs or secrets.';
comment on column external_booking_import_batches.duplicate_count is
  'Stage 5T: duplicate booking request items skipped by local replay protection.';
comment on column patient_portal_booking_requests.external_request_id is
  'Stage 5T: sanitized source item identifier used only for local deduplication.';

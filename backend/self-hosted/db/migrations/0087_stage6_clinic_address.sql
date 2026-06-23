-- Stage 6 · clinic address for production admin management.
-- Stores the human-readable clinic/cabinet address separately from the service slug.

alter table clinics
  add column if not exists address text not null default '';

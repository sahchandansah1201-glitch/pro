-- Stage 4D patient write API support.
-- Writes are performed only by the self-hosted backend after local JWT/RBAC checks.

create index if not exists patients_active_clinic_code_idx
on patients (clinic_id, code)
where deleted_at is null;

create index if not exists patients_active_updated_idx
on patients (clinic_id, updated_at desc)
where deleted_at is null;

comment on table patients is
  'Patient demographics owned by the self-hosted PostgreSQL deployment; Stage 4D writes are RBAC-gated by backend routes.';

comment on column patients.deleted_at is
  'Soft archive marker. Stage 4D DELETE /api/v1/patients/:id sets this value instead of physically deleting rows.';

insert into audit_log (
  clinic_id,
  actor_user_id,
  action,
  entity_type,
  correlation_id,
  metadata_json
)
values (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000101',
  'stage4d.patient_writes_enabled',
  'patient',
  'stage4d-seed',
  '{"mode":"self-hosted","delete":"soft-archive","supabase_runtime":false}'::jsonb
)
on conflict do nothing;

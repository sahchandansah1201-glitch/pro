-- Stage 4H · Self-hosted visit workspace write support.
-- Adds soft-archive marker for lesions and seeds an audit row marking the stage.

alter table lesions add column if not exists deleted_at timestamptz;

create index if not exists lesions_active_visit_idx
  on lesions (visit_id)
  where deleted_at is null;

comment on column lesions.deleted_at is
  'Soft archive marker. Stage 4H DELETE /api/v1/lesions/:id sets this value instead of physically deleting rows.';

comment on table reports is
  'Visit reports owned by the self-hosted PostgreSQL deployment. Stage 4H PATCH /api/v1/visits/:id/report writes physician_text and patient_safe_text under doctor RBAC.';

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
  'stage4h.visit_workspace_writes_enabled',
  'visit',
  'stage4h-seed',
  '{"mode":"self-hosted","lesion_delete":"soft-archive","supabase_runtime":false}'::jsonb
)
on conflict do nothing;

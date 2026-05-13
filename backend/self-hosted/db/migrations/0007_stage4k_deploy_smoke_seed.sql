-- Stage 4K deploy smoke seed.
-- Harmless local-only visit/lesion rows used by docker-compose smoke checks.

insert into visits (
  id,
  clinic_id,
  patient_id,
  doctor_user_id,
  status,
  started_at,
  chief_complaint
)
values (
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000101',
  'in_progress',
  '2026-05-12T09:00:00Z',
  'Stage 4K local smoke visit'
)
on conflict (id) do nothing;

insert into lesions (
  id,
  clinic_id,
  patient_id,
  visit_id,
  label,
  body_zone,
  body_surface,
  status,
  risk_level
)
values (
  '10000000-0000-4000-8000-000000000401',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000301',
  'L-STAGE4K',
  'спина',
  'front',
  'active',
  'moderate'
)
on conflict (id) do nothing;

-- Stage 4B runtime seed.
-- Local self-hosted installs get harmless demo rows so /api/v1/patients
-- can prove the PostgreSQL read path without entering real patient data.

insert into clinics (id, slug, name, timezone)
values (
  '10000000-0000-4000-8000-000000000001',
  'demo-clinic',
  'Dermatolog Pro Demo Clinic',
  'Europe/Moscow'
)
on conflict (slug) do nothing;

insert into app_users (id, email, display_name)
values (
  '10000000-0000-4000-8000-000000000101',
  'doctor.demo@example.invalid',
  'Demo Doctor'
)
on conflict (email) do nothing;

insert into user_roles (user_id, clinic_id, role)
values (
  '10000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000001',
  'doctor'
)
on conflict (user_id, clinic_id, role) do nothing;

insert into patients (
  id,
  clinic_id,
  code,
  full_name,
  birth_date,
  sex,
  phototype,
  imaging_consent,
  created_by
)
values
  (
    '10000000-0000-4000-8000-000000000201',
    '10000000-0000-4000-8000-000000000001',
    'DP-DEMO-0001',
    'Demo Patient One',
    '1984-02-14',
    'female',
    'II',
    true,
    '10000000-0000-4000-8000-000000000101'
  ),
  (
    '10000000-0000-4000-8000-000000000202',
    '10000000-0000-4000-8000-000000000001',
    'DP-DEMO-0002',
    'Demo Patient Two',
    '1978-09-03',
    'male',
    'III',
    true,
    '10000000-0000-4000-8000-000000000101'
  )
on conflict (clinic_id, code) do nothing;

-- Stage 4C auth seed.
-- The demo password is "demo-password". It is only for local self-hosted
-- smoke checks and must be changed before any real deployment.

update app_users
set password_hash = '$scrypt$16384$8$1$c3RhZ2U0Yy1kZW1vLXNhbHQ$i6mX4poTHhULJX-v5vWS2YDGBGyE9JlUN-HVb-BMChE'
where email = 'doctor.demo@example.invalid'
  and password_hash is null;

insert into audit_log (
  clinic_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  correlation_id,
  metadata_json
)
values (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000101',
  'stage4c.auth_seed',
  'app_user',
  '10000000-0000-4000-8000-000000000101',
  'stage4c-auth-seed',
  '{"demo": true}'::jsonb
);

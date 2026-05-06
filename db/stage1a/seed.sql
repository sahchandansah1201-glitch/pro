-- Stage 1A · deterministic, idempotent seed.
-- Mirrors a minimal slice of mock fixtures needed for read-only Stage 1A.
-- Re-running this script must not change row counts.
--
-- IMPORTANT
--   * Demo auth.users are inserted directly (local dev only). Passwords not set.
--   * No raw tokens stored. token_hash columns hold sha-256 hex digests.
--   * Token plaintexts are never inserted into the database. Tests derive
--     hashes via encode(digest('demo-token-X','sha256'),'hex') in-memory.

-- ── Stable UUIDs ────────────────────────────────────────────────────────────
-- Clinics
-- main:    11111111-1111-1111-1111-111111111111
-- north:   22222222-2222-2222-2222-222222222222
-- private: 33333333-3333-3333-3333-333333333333

-- Users (auth.users.id)
-- doctor:        a0000000-0000-0000-0000-00000000d001
-- assistant:     a0000000-0000-0000-0000-00000000a001
-- clinic_admin:  a0000000-0000-0000-0000-00000000c001
-- private_doc:   a0000000-0000-0000-0000-0000000000d2
-- operator:      a0000000-0000-0000-0000-00000000f001
-- system_admin:  a0000000-0000-0000-0000-00000000e001
-- patient:       a0000000-0000-0000-0000-00000000b001

-- ── auth.users (local dev seed) ─────────────────────────────────────────────
insert into auth.users (id, email, instance_id, aud, role, email_confirmed_at,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select u.id, u.email, '00000000-0000-0000-0000-000000000000'::uuid,
       'authenticated','authenticated', now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from (values
  ('a0000000-0000-0000-0000-00000000d001'::uuid, 'doctor@derma-pro.demo'),
  ('a0000000-0000-0000-0000-00000000a001'::uuid, 'assistant@derma-pro.demo'),
  ('a0000000-0000-0000-0000-00000000c001'::uuid, 'clinicadmin@derma-pro.demo'),
  ('a0000000-0000-0000-0000-0000000000d2'::uuid, 'privatedoc@derma-pro.demo'),
  ('a0000000-0000-0000-0000-00000000f001'::uuid, 'operator@derma-pro.demo'),
  ('a0000000-0000-0000-0000-00000000e001'::uuid, 'sysadmin@derma-pro.demo'),
  ('a0000000-0000-0000-0000-00000000b001'::uuid, 'patient@derma-pro.demo')
) as u(id, email)
on conflict (id) do nothing;

-- ── clinics ─────────────────────────────────────────────────────────────────
insert into public.clinics (id, name, address, phone, partner_tier, routing_priority)
values
  ('11111111-1111-1111-1111-111111111111','Дерма-Про · Центр','Москва, ул. Тверская, 18','+7 (495) 555-01-10','owned',1),
  ('22222222-2222-2222-2222-222222222222','Дерма-Про · Север','Москва, Ленинградский пр-т, 74','+7 (495) 555-02-20','owned',2),
  ('33333333-3333-3333-3333-333333333333','Кабинет Морозова Д. И.','Санкт-Петербург, Невский пр-т, 102','+7 (812) 555-07-07','partner',3)
on conflict (id) do nothing;

-- ── profiles ────────────────────────────────────────────────────────────────
insert into public.profiles (id, full_name, email, clinic_id, locale)
values
  ('a0000000-0000-0000-0000-00000000d001','Соколова Ирина Андреевна','doctor@derma-pro.demo','11111111-1111-1111-1111-111111111111','ru-RU'),
  ('a0000000-0000-0000-0000-00000000a001','Петрова Мария Сергеевна','assistant@derma-pro.demo','11111111-1111-1111-1111-111111111111','ru-RU'),
  ('a0000000-0000-0000-0000-00000000c001','Волков Алексей Дмитриевич','clinicadmin@derma-pro.demo','11111111-1111-1111-1111-111111111111','ru-RU'),
  ('a0000000-0000-0000-0000-0000000000d2','Морозов Дмитрий Игоревич','privatedoc@derma-pro.demo','33333333-3333-3333-3333-333333333333','ru-RU'),
  ('a0000000-0000-0000-0000-00000000f001','Лебедева Екатерина Павловна','operator@derma-pro.demo','11111111-1111-1111-1111-111111111111','ru-RU'),
  ('a0000000-0000-0000-0000-00000000e001','Орлов Сергей Викторович','sysadmin@derma-pro.demo',null,'ru-RU'),
  ('a0000000-0000-0000-0000-00000000b001','Иванова Наталья Олеговна','patient@derma-pro.demo',null,'ru-RU')
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  clinic_id = excluded.clinic_id;

-- ── user_roles ──────────────────────────────────────────────────────────────
-- doctor & assistant work in BOTH main and north clinics (mirrors mock data
-- where v-005 belongs to north clinic but is staffed by the main doctor).
insert into public.user_roles (id, user_id, role, clinic_id)
values
  ('40000001-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000d001','doctor','11111111-1111-1111-1111-111111111111'),
  ('40000001-0000-0000-0000-000000000002','a0000000-0000-0000-0000-00000000d001','doctor','22222222-2222-2222-2222-222222222222'),
  ('40000001-0000-0000-0000-000000000003','a0000000-0000-0000-0000-00000000a001','assistant','11111111-1111-1111-1111-111111111111'),
  ('40000001-0000-0000-0000-000000000004','a0000000-0000-0000-0000-00000000a001','assistant','22222222-2222-2222-2222-222222222222'),
  ('40000001-0000-0000-0000-000000000005','a0000000-0000-0000-0000-00000000c001','clinic_admin','11111111-1111-1111-1111-111111111111'),
  ('40000001-0000-0000-0000-000000000006','a0000000-0000-0000-0000-0000000000d2','private_doctor','33333333-3333-3333-3333-333333333333'),
  ('40000001-0000-0000-0000-000000000007','a0000000-0000-0000-0000-00000000f001','operator',null),
  ('40000001-0000-0000-0000-000000000008','a0000000-0000-0000-0000-00000000e001','system_admin',null),
  ('40000001-0000-0000-0000-000000000009','a0000000-0000-0000-0000-00000000b001','patient',null)
on conflict (id) do nothing;

-- ── patients ────────────────────────────────────────────────────────────────
-- p-001 (main clinic, demo patient is linked to portal user)
-- p-004 (north clinic, has v-005 / l-007 / l-008)
-- p-006 (private clinic, for cross-clinic denial tests)
insert into public.patients (id, clinic_id, code, full_name, birth_date, sex, phototype, risk_factors, created_by, created_at)
values
  ('50000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','DP-2026-0001','Иванова Наталья Олеговна','1984-03-12','female','II',
   array['семейный анамнез меланомы','более 50 невусов'],
   'a0000000-0000-0000-0000-00000000a001','2026-01-12T09:15:00Z'),
  ('50000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','DP-2026-0004','Новиков Артём Сергеевич','1965-05-30','male','IV',
   array['возраст > 60','ранее удалённое образование'],
   'a0000000-0000-0000-0000-00000000a001','2026-02-05T11:20:00Z'),
  ('50000000-0000-0000-0000-000000000006','33333333-3333-3333-3333-333333333333','DP-2026-0006','Тимофеев Игорь Валерьевич','1979-12-01','male','III',
   array[]::text[],
   'a0000000-0000-0000-0000-0000000000d2','2026-02-14T09:30:00Z')
on conflict (id) do nothing;

-- patient portal link (patient user ↔ p-001)
insert into public.patient_user_link (id, patient_id, user_id, granted_at)
values
  ('60000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-00000000b001',
   '2026-01-12T09:20:00Z')
on conflict (id) do nothing;

-- ── visits ──────────────────────────────────────────────────────────────────
insert into public.visits (id, clinic_id, patient_id, doctor_id, assistant_id, status, started_at, closed_at, complaint)
values
  ('70000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-00000000d001','a0000000-0000-0000-0000-00000000a001',
   'closed','2026-03-02T08:30:00Z','2026-03-02T09:10:00Z','Контроль множественных невусов на спине.'),
  ('70000000-0000-0000-0000-000000000005','22222222-2222-2222-2222-222222222222','50000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-00000000d001','a0000000-0000-0000-0000-00000000a001',
   'closed','2026-03-09T09:00:00Z','2026-03-09T09:40:00Z','Плановый осмотр после удаления образования.'),
  ('70000000-0000-0000-0000-000000000007','33333333-3333-3333-3333-333333333333','50000000-0000-0000-0000-000000000006',
   'a0000000-0000-0000-0000-0000000000d2',null,
   'closed','2026-03-12T15:00:00Z','2026-03-12T15:30:00Z','Зуд в области образования на предплечье.')
on conflict (id) do nothing;

-- ── lesions ─────────────────────────────────────────────────────────────────
-- Mirrors l-007 and l-008 on patient p-004 / visit v-005 in north clinic.
insert into public.lesions (id, clinic_id, patient_id, body_zone, map_view, map_x, map_y, label, first_seen_at, status)
values
  ('80000000-0000-0000-0000-000000000007','22222222-2222-2222-2222-222222222222','50000000-0000-0000-0000-000000000004',
   'Спина · L1','back',0.4500,0.5500,'L-007','2026-03-09T09:00:00Z','active'),
  ('80000000-0000-0000-0000-000000000008','22222222-2222-2222-2222-222222222222','50000000-0000-0000-0000-000000000004',
   'Спина · L2','back',0.5500,0.6000,'L-008','2026-03-09T09:00:00Z','monitoring'),
  ('80000000-0000-0000-0000-000000000009','33333333-3333-3333-3333-333333333333','50000000-0000-0000-0000-000000000006',
   'Предплечье','front',0.3000,0.4500,'L-009','2026-03-12T15:00:00Z','active')
on conflict (id) do nothing;

-- ── assets (image metadata only) ────────────────────────────────────────────
insert into public.assets (id, clinic_id, visit_id, lesion_id, kind, source,
                           storage_object_path, captured_at, quality_score, quality_issues, exif)
values
  ('90000000-0000-0000-0000-000000000010','22222222-2222-2222-2222-222222222222',
   '70000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000007',
   'overview','phone','stage1a/v-005/i-010.jpg','2026-03-09T09:05:00Z',
   0.850, array[]::text[], '{"width":4032,"height":3024}'::jsonb),
  ('90000000-0000-0000-0000-000000000011','22222222-2222-2222-2222-222222222222',
   '70000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000008',
   'dermoscopy','device_bridge','stage1a/v-005/i-011.jpg','2026-03-09T09:10:00Z',
   0.790, array['лёгкие блики'], '{"width":2048,"height":2048}'::jsonb),
  ('90000000-0000-0000-0000-000000000012','22222222-2222-2222-2222-222222222222',
   '70000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000008',
   'macro','camera','stage1a/v-005/i-012.jpg','2026-03-09T09:12:00Z',
   0.670, array['размытие','тени'], '{"width":3000,"height":2000}'::jsonb)
on conflict (id) do nothing;

-- ── assessment ──────────────────────────────────────────────────────────────
insert into public.assessments (id, clinic_id, visit_id, lesion_id, abcd, seven_point,
                                ai_risk, ai_confidence, ai_features, ai_uncertainty_notes, ai_xai_notes, decided_by, decided_at)
values
  ('a1000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
   '70000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000008',
   '{"asymmetry":1,"border":2,"color":3,"diameter":4,"total":5.3}'::jsonb,
   '{"major":1,"minor":2,"total":3}'::jsonb,
   'moderate', 0.620, array['неравномерная пигментация'], array['ограничение по качеству фото'],
   'XAI placeholder', 'a0000000-0000-0000-0000-00000000d001','2026-03-09T09:30:00Z')
on conflict (id) do nothing;

-- ── conclusion ──────────────────────────────────────────────────────────────
insert into public.conclusions (id, clinic_id, visit_id, doctor_text, follow_up_plan, decided_by, decided_at)
values
  ('b1000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
   '70000000-0000-0000-0000-000000000005',
   'Образование L-008: динамическое наблюдение, контроль через 3 месяца.',
   'Контроль 2026-06-09. При изменениях — внеплановый визит.',
   'a0000000-0000-0000-0000-00000000d001','2026-03-09T09:35:00Z')
on conflict (id) do nothing;

-- ── report + version ────────────────────────────────────────────────────────
insert into public.reports (id, clinic_id, visit_id)
values
  ('c1000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','70000000-0000-0000-0000-000000000005')
on conflict (id) do nothing;

insert into public.report_versions (id, clinic_id, report_id, version, status,
                                    patient_safe_text, doctor_text, created_by, created_at, signed_by, signed_at)
values
  ('d1000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
   'c1000000-0000-0000-0000-000000000001', 1, 'final',
   'Контроль через 3 месяца. При изменениях обратитесь к врачу.',
   'Образование L-008: динамическое наблюдение, контроль через 3 месяца.',
   'a0000000-0000-0000-0000-00000000d001','2026-03-09T09:38:00Z',
   'a0000000-0000-0000-0000-00000000d001','2026-03-09T09:39:00Z')
on conflict (id) do nothing;

-- Set current_version_id (deferred FK).
update public.reports
set current_version_id = 'd1000000-0000-0000-0000-000000000001'
where id = 'c1000000-0000-0000-0000-000000000001'
  and (current_version_id is null
       or current_version_id <> 'd1000000-0000-0000-0000-000000000001');

-- ── public_signed_links + protected_analysis_links (token HASH only) ───────
-- Hashes are sha-256 of synthetic plaintext labels that are NOT stored.
insert into public.public_signed_links (id, clinic_id, report_version_id, token_hash, expires_at, created_by)
values
  ('e1000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
   'd1000000-0000-0000-0000-000000000001',
   encode(digest('stage1a-public-link-fixture-1','sha256'),'hex'),
   '2027-01-01T00:00:00Z',
   'a0000000-0000-0000-0000-00000000d001')
on conflict (id) do nothing;

insert into public.protected_analysis_links (id, clinic_id, scope, token_hash, expires_at, created_by)
values
  ('f1000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
   'analysis_card',
   encode(digest('stage1a-protected-link-fixture-1','sha256'),'hex'),
   '2027-01-01T00:00:00Z',
   'a0000000-0000-0000-0000-00000000d001')
on conflict (id) do nothing;

-- ── consents (all six purposes for p-001) ──────────────────────────────────
insert into public.consents (id, clinic_id, patient_id, purpose, status, granted_at, recorded_by)
values
  ('11000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','pdn','granted','2026-01-12T09:20:00Z','a0000000-0000-0000-0000-00000000a001'),
  ('11000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','imaging','granted','2026-01-12T09:20:00Z','a0000000-0000-0000-0000-00000000a001'),
  ('11000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','ai_processing','granted','2026-01-12T09:20:00Z','a0000000-0000-0000-0000-00000000a001'),
  ('11000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','telemed','granted','2026-01-12T09:20:00Z','a0000000-0000-0000-0000-00000000a001'),
  ('11000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','share_external','granted','2026-01-12T09:20:00Z','a0000000-0000-0000-0000-00000000a001'),
  ('11000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','50000000-0000-0000-0000-000000000001','public_link','granted','2026-01-12T09:20:00Z','a0000000-0000-0000-0000-00000000a001')
on conflict (id) do nothing;

-- ── audit_logs (safe payload only) ──────────────────────────────────────────
insert into public.audit_logs (id, clinic_id, actor_id, action, entity, entity_id, payload, created_at)
values
  ('12000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
   'a0000000-0000-0000-0000-00000000d001','visit.close','visit',
   '70000000-0000-0000-0000-000000000005','{"status":"closed"}'::jsonb,'2026-03-09T09:40:00Z'),
  ('12000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222',
   'a0000000-0000-0000-0000-00000000d001','report.sign','report_version',
   'd1000000-0000-0000-0000-000000000001','{"version":1,"status":"final"}'::jsonb,'2026-03-09T09:39:00Z')
on conflict (id) do nothing;

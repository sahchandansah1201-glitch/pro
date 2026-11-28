-- Stage 7B · Miro photo-first onboarding funnel, post-photo lead capture,
-- 30-day follow-up timer, 2nd-photo verification link, and Multi-Channel Configurator.
-- Strictly PostgreSQL 16 self-hosted (zero Supabase / external cloud dependencies).

-- 1. Allow progressive post-photo profile enrichment: a photo submission may be
--    accepted first (after 1-tap 152-FZ consent), and contact name/phone + age/sex
--    are captured immediately after photo upload at peak user motivation.
alter table onboarding_profiles
  alter column biological_sex drop not null;

alter table onboarding_profiles
  drop constraint if exists onboarding_profiles_biological_sex_check;

alter table onboarding_profiles
  add constraint onboarding_profiles_biological_sex_check
    check (biological_sex is null or biological_sex in ('male', 'female'));

alter table onboarding_profiles
  add column if not exists contact_name text,
  add column if not exists contact_phone text;

alter table onboarding_sessions
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists consent_152fz_accepted_at timestamptz,
  add column if not exists greeting_variant_index integer not null default 0,
  add column if not exists awaiting_photo_since timestamptz,
  add column if not exists photo_nudge_sent_at timestamptz;

-- 2. Support Miro post-result retention mechanics on submissions:
--    - 30-day follow-up reminder timer on LOW_OBSERVATION (✅)
--    - 2nd-angle verification photo link on PLANNED_REVIEW / MEDIUM (⚠️)
alter table onboarding_submissions
  add column if not exists traffic_light text
    check (traffic_light is null or traffic_light in ('RED_HIGH', 'YELLOW_MEDIUM', 'GREEN_LOW')),
  add column if not exists scheduled_followup_at timestamptz,
  add column if not exists verification_of_submission_id uuid
    references onboarding_submissions(id) on delete set null;

create index if not exists idx_onboarding_submissions_followup_due
  on onboarding_submissions (scheduled_followup_at)
  where scheduled_followup_at is not null and deleted_at is null;

-- 3. Multi-channel communication configurator table (Telegram, MAX, WhatsApp, Web).
create table if not exists omnichannel_communication_configs (
  config_key text primary key default 'default',
  channels_json jsonb not null default '{
    "telegram": { "enabled": true, "transport": "Telegram Bot API Webhook", "botHandle": "@skindoktor_pro_bot" },
    "web": { "enabled": true, "transport": "Встроенный веб-экран /check (без сжатия)", "route": "/check" },
    "max": { "enabled": false, "transport": "@maxhub/max-bot-api (MAX Webhook)", "botHandle": "" },
    "whatsapp": { "enabled": false, "transport": "WAHA / Evolution HTTP API", "instanceName": "" }
  }'::jsonb,
  flow_rules_json jsonb not null default '{
    "photoFirstMode": true,
    "postPhotoLeadCaptureEnabled": true,
    "photoWaitNudgeMinutes": 4,
    "lowRiskFollowupDays": 30,
    "mediumRiskSecondPhotoCheckEnabled": true,
    "persistentMenuEnabled": true
  }'::jsonb,
  greeting_variants_json jsonb not null default '[
    "Ура! Рад помочь — сделайте фото по наглядной памятке ниже и пришлите сюда.",
    "Рад новому обращению! Пожалуйста, пришлите чёткую фотографию участка кожи крупным планом.",
    "Отлично, готов проверить снимок! Точная маршрутизация возможна только по чёткой фотографии с расстояния около 10 см."
  ]'::jsonb,
  updated_by_user_id uuid references app_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into omnichannel_communication_configs (config_key)
values ('default')
on conflict (config_key) do nothing;

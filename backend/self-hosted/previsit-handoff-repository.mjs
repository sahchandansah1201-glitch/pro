// Stage 7 · Pre-visit handoff, progressive 2-step onboarding, Skin Passport,
// and clinic patient portal provisioning SQL repository (PostgreSQL 16 only).

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlNullableUuid(value) {
  return value && UUID_PATTERN.test(String(value)) ? sqlUuid(value) : "null";
}

function sqlNullableText(value) {
  return value == null || value === "" ? "null" : sqlLiteral(value);
}

function sqlNullableNumber(value) {
  const num = Number(value);
  return value == null || !Number.isFinite(num) ? "null" : String(num);
}

function sqlNullableInt(value) {
  const num = Number.parseInt(String(value ?? ""), 10);
  return value == null || !Number.isFinite(num) ? "null" : String(num);
}

function sqlBoolean(value) {
  return value ? "true" : "false";
}

function sqlJsonb(value) {
  return `${sqlLiteral(JSON.stringify(value ?? {}))}::jsonb`;
}

function sqlUuidList(values = []) {
  return values.map((v) => sqlUuid(v)).join(", ");
}

function safeClinicIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(String)
    .filter((v) => UUID_PATTERN.test(v))
    .slice(0, 100);
}

function clinicScopeWhere({ alias = "pc", clinicIds = [], allClinics = false } = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function firstJson(rows) {
  return Array.isArray(rows) ? rows[0] : rows;
}

export function buildVerifyServiceKeySql({ secretSha256 }) {
  return `
with matched as (
  update service_api_keys
  set last_used_at = now()
  where secret_sha256 = ${sqlLiteral(secretSha256)}
    and status = 'active'
    and (expires_at is null or expires_at > now())
  returning id, label, owner, scopes
)
select coalesce((
  select row_to_json(m) from matched m limit 1
), 'null'::json)::text;
`.trim();
}

export function buildUpsertOnboardingSessionSql({
  sessionTokenSha256,
  channel = "web",
  externalChatId = null,
}) {
  if (externalChatId) {
    return `
with upserted as (
  insert into onboarding_sessions (
    session_token_sha256,
    channel,
    external_chat_id,
    quota_enforced
  )
  values (
    ${sqlLiteral(sessionTokenSha256)},
    ${sqlLiteral(channel)},
    ${sqlLiteral(externalChatId)},
    false
  )
  on conflict (channel, external_chat_id)
  where external_chat_id is not null and deleted_at is null
  do update set updated_at = now()
  returning *
)
select jsonb_build_object(
  'session', (
    select jsonb_build_object(
      'id', s.id::text,
      'channel', s.channel,
      'externalChatId', s.external_chat_id,
      'fsmState', s.fsm_state,
      'fsmContext', s.fsm_context_json,
      'activeProfileId', s.active_profile_id::text,
      'contactName', s.contact_name,
      'contactPhone', s.contact_phone,
      'consent152FzAcceptedAt', s.consent_152fz_accepted_at,
      'greetingVariantIndex', s.greeting_variant_index,
      'quotaEnforced', s.quota_enforced,
      'acceptedPhotoCount', s.accepted_photo_count,
      'rejectedPhotoCount', s.rejected_photo_count,
      'skinPassportActive', s.skin_passport_active,
      'createdAt', s.created_at
    )
    from upserted s
  ),
  'profiles', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id::text,
      'subjectRelation', p.subject_relation,
      'label', p.label,
      'legalGuardianConfirmed', p.legal_guardian_confirmed,
      'consent152FzAcceptedAt', p.consent_152fz_accepted_at,
      'ageYears', p.age_years,
      'ageMonths', p.age_months,
      'pediatricU6Active', p.pediatric_u6_active,
      'biologicalSex', p.biological_sex,
      'estimatedFitzpatrickBand', p.estimated_fitzpatrick_band,
      'baselineItaDegrees', p.baseline_ita_degrees,
      'riskFactors', p.risk_factors_json,
      'createdAt', p.created_at
    ) order by p.created_at asc)
    from onboarding_profiles p
    join upserted s on s.id = p.session_id
    where p.deleted_at is null
  ), '[]'::jsonb)
)::text;
`.trim();
  }

  return `
with upserted as (
  insert into onboarding_sessions (
    session_token_sha256,
    channel,
    quota_enforced
  )
  values (
    ${sqlLiteral(sessionTokenSha256)},
    ${sqlLiteral(channel)},
    false
  )
  on conflict (session_token_sha256)
  do update set
    deleted_at = null,
    updated_at = now()
  returning *
)
select jsonb_build_object(
  'session', (
    select jsonb_build_object(
      'id', s.id::text,
      'channel', s.channel,
      'externalChatId', s.external_chat_id,
      'fsmState', s.fsm_state,
      'fsmContext', s.fsm_context_json,
      'activeProfileId', s.active_profile_id::text,
      'contactName', s.contact_name,
      'contactPhone', s.contact_phone,
      'consent152FzAcceptedAt', s.consent_152fz_accepted_at,
      'greetingVariantIndex', s.greeting_variant_index,
      'quotaEnforced', s.quota_enforced,
      'acceptedPhotoCount', s.accepted_photo_count,
      'rejectedPhotoCount', s.rejected_photo_count,
      'skinPassportActive', s.skin_passport_active,
      'createdAt', s.created_at
    )
    from upserted s
  ),
  'profiles', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id::text,
      'subjectRelation', p.subject_relation,
      'label', p.label,
      'legalGuardianConfirmed', p.legal_guardian_confirmed,
      'consent152FzAcceptedAt', p.consent_152fz_accepted_at,
      'ageYears', p.age_years,
      'ageMonths', p.age_months,
      'pediatricU6Active', p.pediatric_u6_active,
      'biologicalSex', p.biological_sex,
      'estimatedFitzpatrickBand', p.estimated_fitzpatrick_band,
      'baselineItaDegrees', p.baseline_ita_degrees,
      'riskFactors', p.risk_factors_json,
      'createdAt', p.created_at
    ) order by p.created_at asc)
    from onboarding_profiles p
    join upserted s on s.id = p.session_id
    where p.deleted_at is null
  ), '[]'::jsonb),
  'clinics', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id::text,
      'slug', c.slug,
      'name', c.name
    ) order by c.created_at asc)
    from clinics c
  ), '[]'::jsonb)
)::text;
`.trim();
}

export function buildUpdateOnboardingSessionStateSql({
  sessionId,
  fsmState,
  fsmContext = {},
  activeProfileId = undefined,
}) {
  const activeAssign =
    activeProfileId === undefined
      ? ""
      : `, active_profile_id = ${sqlNullableUuid(activeProfileId)}`;
  return `
with updated as (
  update onboarding_sessions
  set fsm_state = ${sqlLiteral(fsmState)},
      fsm_context_json = ${sqlJsonb(fsmContext)}
      ${activeAssign}
  where id = ${sqlUuid(sessionId)}
    and deleted_at is null
  returning *
)
select coalesce((
  select jsonb_build_object(
    'id', s.id::text,
    'fsmState', s.fsm_state,
    'fsmContext', s.fsm_context_json,
    'activeProfileId', s.active_profile_id::text
  )
  from updated s
), 'null'::jsonb)::text;
`.trim();
}

export function buildCreateOnboardingProfileSql({
  sessionId,
  subjectRelation,
  label,
  legalGuardianConfirmed,
  consent152FzAcceptedAt,
  ageYears,
  ageMonths,
  pediatricU6Active,
  biologicalSex,
}) {
  return `
with created_profile as (
  insert into onboarding_profiles (
    session_id,
    subject_relation,
    label,
    legal_guardian_confirmed,
    consent_152fz_accepted_at,
    age_years,
    age_months,
    pediatric_u6_active,
    biological_sex
  )
  values (
    ${sqlUuid(sessionId)},
    ${sqlLiteral(subjectRelation)},
    ${sqlLiteral(label)},
    ${sqlBoolean(legalGuardianConfirmed)},
    ${sqlLiteral(consent152FzAcceptedAt)}::timestamptz,
    ${sqlNullableInt(ageYears)},
    ${sqlNullableInt(ageMonths)},
    ${sqlBoolean(pediatricU6Active)},
    ${sqlNullableText(biologicalSex)}
  )
  returning *
),
updated_session as (
  update onboarding_sessions s
  set active_profile_id = cp.id,
      fsm_state = 'S3_AWAIT_PHOTO'
  from created_profile cp
  where s.id = cp.session_id
  returning s.id
)
select jsonb_build_object(
  'id', cp.id::text,
  'sessionId', cp.session_id::text,
  'subjectRelation', cp.subject_relation,
  'label', cp.label,
  'legalGuardianConfirmed', cp.legal_guardian_confirmed,
  'consent152FzAcceptedAt', cp.consent_152fz_accepted_at,
  'ageYears', cp.age_years,
  'ageMonths', cp.age_months,
  'pediatricU6Active', cp.pediatric_u6_active,
  'biologicalSex', cp.biological_sex,
  'estimatedFitzpatrickBand', cp.estimated_fitzpatrick_band,
  'baselineItaDegrees', cp.baseline_ita_degrees,
  'riskFactors', cp.risk_factors_json,
  'createdAt', cp.created_at
)::text
from created_profile cp;
`.trim();
}

export function buildGetOnboardingProfileSql({ sessionId, profileId }) {
  return `
select coalesce((
  select jsonb_build_object(
    'id', p.id::text,
    'sessionId', p.session_id::text,
    'subjectRelation', p.subject_relation,
    'label', p.label,
    'legalGuardianConfirmed', p.legal_guardian_confirmed,
    'consent152FzAcceptedAt', p.consent_152fz_accepted_at,
    'ageYears', p.age_years,
    'ageMonths', p.age_months,
    'pediatricU6Active', p.pediatric_u6_active,
    'biologicalSex', p.biological_sex,
    'estimatedFitzpatrickBand', p.estimated_fitzpatrick_band,
    'baselineItaDegrees', p.baseline_ita_degrees,
    'riskFactors', p.risk_factors_json
  )
  from onboarding_profiles p
  where p.id = ${sqlUuid(profileId)}
    and p.session_id = ${sqlUuid(sessionId)}
    and p.deleted_at is null
  limit 1
), 'null'::jsonb)::text;
`.trim();
}

export function buildUpdateOnboardingProfileRiskFactorsSql({
  sessionId,
  profileId,
  riskFactors,
}) {
  return `
with updated as (
  update onboarding_profiles
  set risk_factors_json = coalesce(risk_factors_json, '{}'::jsonb) || ${sqlJsonb(riskFactors)}
  where id = ${sqlUuid(profileId)}
    and session_id = ${sqlUuid(sessionId)}
    and deleted_at is null
  returning *
)
select coalesce((
  select jsonb_build_object(
    'id', u.id::text,
    'subjectRelation', u.subject_relation,
    'label', u.label,
    'estimatedFitzpatrickBand', u.estimated_fitzpatrick_band,
    'baselineItaDegrees', u.baseline_ita_degrees,
    'riskFactors', u.risk_factors_json
  )
  from updated u
), 'null'::jsonb)::text;
`.trim();
}

export function buildCreateOnboardingSubmissionSql({
  sessionId,
  profileId,
  channel,
  status,
  qualityGate,
  opticalExif,
  coarseUvBelt,
  itaDegrees,
  estimatedFitzpatrickBand,
  profileMismatchDeltaIta,
  antifraudSummary,
  sanitizedObjectBucket,
  sanitizedFullImageKey,
  updateProfileBaselineIta = false,
}) {
  const isAccepted = status !== "quality_rejected";
  return `
with inserted as (
  insert into onboarding_submissions (
    session_id,
    profile_id,
    channel,
    status,
    quality_gate_json,
    optical_exif_json,
    coarse_uv_belt,
    ita_degrees,
    estimated_fitzpatrick_band,
    profile_mismatch_delta_ita,
    antifraud_summary_json,
    sanitized_object_bucket,
    sanitized_full_image_key
  )
  values (
    ${sqlUuid(sessionId)},
    ${sqlUuid(profileId)},
    ${sqlLiteral(channel)},
    ${sqlLiteral(status)},
    ${sqlJsonb(qualityGate)},
    ${sqlJsonb(opticalExif)},
    ${sqlNullableText(coarseUvBelt)},
    ${sqlNullableNumber(itaDegrees)},
    ${sqlNullableText(estimatedFitzpatrickBand)},
    ${sqlNullableNumber(profileMismatchDeltaIta)},
    ${sqlJsonb(antifraudSummary)},
    ${sqlNullableText(sanitizedObjectBucket)},
    ${sqlNullableText(sanitizedFullImageKey)}
  )
  returning *
),
touched_session as (
  update onboarding_sessions
  set accepted_photo_count = accepted_photo_count + ${isAccepted ? 1 : 0},
      rejected_photo_count = rejected_photo_count + ${isAccepted ? 0 : 1}
  where id = ${sqlUuid(sessionId)}
  returning id
),
touched_profile as (
  update onboarding_profiles
  set baseline_ita_degrees = case
        when ${sqlBoolean(updateProfileBaselineIta)} and baseline_ita_degrees is null
        then ${sqlNullableNumber(itaDegrees)}
        else baseline_ita_degrees
      end,
      estimated_fitzpatrick_band = case
        when ${sqlBoolean(updateProfileBaselineIta)} and estimated_fitzpatrick_band is null
        then ${sqlNullableText(estimatedFitzpatrickBand)}
        else estimated_fitzpatrick_band
      end
  where id = ${sqlUuid(profileId)}
  returning id
)
select jsonb_build_object(
  'id', i.id::text,
  'sessionId', i.session_id::text,
  'profileId', i.profile_id::text,
  'channel', i.channel,
  'status', i.status,
  'qualityGate', i.quality_gate_json,
  'itaDegrees', i.ita_degrees,
  'estimatedFitzpatrickBand', i.estimated_fitzpatrick_band,
  'profileMismatchDeltaIta', i.profile_mismatch_delta_ita,
  'createdAt', i.created_at
)::text
from inserted i;
`.trim();
}

export function buildGetOnboardingSubmissionSql({ sessionId, submissionId }) {
  return `
select coalesce((
  select jsonb_build_object(
    'id', sub.id::text,
    'sessionId', sub.session_id::text,
    'profileId', sub.profile_id::text,
    'channel', sub.channel,
    'status', sub.status,
    'qualityGate', sub.quality_gate_json,
    'opticalExif', sub.optical_exif_json,
    'coarseUvBelt', sub.coarse_uv_belt,
    'itaDegrees', sub.ita_degrees,
    'estimatedFitzpatrickBand', sub.estimated_fitzpatrick_band,
    'profileMismatchDeltaIta', sub.profile_mismatch_delta_ita,
    'profileMismatchResolution', sub.profile_mismatch_resolution,
    'sanitizedObjectBucket', sub.sanitized_object_bucket,
    'sanitizedFullImageKey', sub.sanitized_full_image_key,
    'anamnesisAnswers', sub.anamnesis_answers_json,
    'routingCategory', sub.routing_category,
    'patientFacingCard', sub.patient_facing_card_json,
    'doctorOnlyDraft', sub.doctor_only_draft_json,
    'gpuJobUuid', sub.gpu_job_uuid::text,
    'profile', jsonb_build_object(
      'id', p.id::text,
      'subjectRelation', p.subject_relation,
      'label', p.label,
      'legalGuardianConfirmed', p.legal_guardian_confirmed,
      'consent152FzAcceptedAt', p.consent_152fz_accepted_at,
      'ageYears', p.age_years,
      'ageMonths', p.age_months,
      'pediatricU6Active', p.pediatric_u6_active,
      'biologicalSex', p.biological_sex,
      'estimatedFitzpatrickBand', p.estimated_fitzpatrick_band,
      'baselineItaDegrees', p.baseline_ita_degrees,
      'riskFactors', p.risk_factors_json,
      'contactName', p.contact_name,
      'contactPhone', p.contact_phone
    )
  )
  from onboarding_submissions sub
  join onboarding_profiles p on p.id = sub.profile_id
  where sub.id = ${sqlUuid(submissionId)}
    and sub.session_id = ${sqlUuid(sessionId)}
    and sub.deleted_at is null
  limit 1
), 'null'::jsonb)::text;
`.trim();
}

export function buildResolveSubmissionMismatchSql({
  sessionId,
  submissionId,
  resolution,
  targetProfileId,
}) {
  return `
with updated_sub as (
  update onboarding_submissions
  set profile_id = ${sqlUuid(targetProfileId)},
      profile_mismatch_resolution = ${sqlLiteral(resolution)},
      status = 'awaiting_micro_survey'
  where id = ${sqlUuid(submissionId)}
    and session_id = ${sqlUuid(sessionId)}
    and deleted_at is null
  returning *
),
updated_profile as (
  update onboarding_profiles p
  set baseline_ita_degrees = coalesce(p.baseline_ita_degrees, u.ita_degrees),
      estimated_fitzpatrick_band = coalesce(p.estimated_fitzpatrick_band, u.estimated_fitzpatrick_band)
  from updated_sub u
  where p.id = u.profile_id
  returning p.id
),
updated_session as (
  update onboarding_sessions
  set active_profile_id = ${sqlUuid(targetProfileId)}
  where id = ${sqlUuid(sessionId)}
  returning id
)
select coalesce((
  select jsonb_build_object(
    'id', u.id::text,
    'profileId', u.profile_id::text,
    'status', u.status,
    'profileMismatchResolution', u.profile_mismatch_resolution
  )
  from updated_sub u
), 'null'::jsonb)::text;
`.trim();
}

export function buildFinalizeSubmissionSurveySql({
  sessionId,
  submissionId,
  status,
  anamnesisAnswers,
  routingCategory,
  trafficLight = null,
  scheduledFollowupAt = null,
  verificationOfSubmissionId = null,
  patientFacingCard,
  doctorOnlyDraft,
  gpuJobUuid = null,
}) {
  return `
with updated as (
  update onboarding_submissions
  set status = ${sqlLiteral(status)},
      anamnesis_answers_json = ${sqlJsonb(anamnesisAnswers)},
      routing_category = ${sqlNullableText(routingCategory)},
      traffic_light = coalesce(${sqlNullableText(trafficLight)}, traffic_light),
      scheduled_followup_at = coalesce(${scheduledFollowupAt ? `${sqlLiteral(scheduledFollowupAt)}::timestamptz` : "null"}, scheduled_followup_at),
      verification_of_submission_id = coalesce(${sqlNullableUuid(verificationOfSubmissionId)}, verification_of_submission_id),
      patient_facing_card_json = ${sqlJsonb(patientFacingCard)},
      doctor_only_draft_json = ${sqlJsonb(doctorOnlyDraft)},
      gpu_job_uuid = ${sqlNullableUuid(gpuJobUuid)}
  where id = ${sqlUuid(submissionId)}
    and session_id = ${sqlUuid(sessionId)}
    and deleted_at is null
  returning *
)
select coalesce((
  select jsonb_build_object(
    'id', u.id::text,
    'status', u.status,
    'routingCategory', u.routing_category,
    'trafficLight', u.traffic_light,
    'scheduledFollowupAt', u.scheduled_followup_at,
    'patientFacingCard', u.patient_facing_card_json,
    'gpuJobUuid', u.gpu_job_uuid::text
  )
  from updated u
), 'null'::jsonb)::text;
`.trim();
}

export function buildSavePostPhotoLeadAndProfileSql({
  sessionId,
  profileId,
  contactName,
  contactPhone,
  subjectRelation = "SELF",
  label = "Себе",
  legalGuardianConfirmed = false,
  consent152FzAcceptedAt,
  ageYears = null,
  ageMonths = null,
  pediatricU6Active = false,
  biologicalSex = null,
}) {
  return `
with updated_session as (
  update onboarding_sessions
  set contact_name = coalesce(${sqlNullableText(contactName)}, contact_name),
      contact_phone = coalesce(${sqlNullableText(contactPhone)}, contact_phone),
      consent_152fz_accepted_at = coalesce(consent_152fz_accepted_at, ${sqlLiteral(consent152FzAcceptedAt)}::timestamptz),
      active_profile_id = ${sqlUuid(profileId)}
  where id = ${sqlUuid(sessionId)}
    and deleted_at is null
  returning *
),
updated_profile as (
  update onboarding_profiles
  set subject_relation = ${sqlLiteral(subjectRelation)},
      label = ${sqlLiteral(label)},
      legal_guardian_confirmed = ${sqlBoolean(legalGuardianConfirmed)},
      contact_name = coalesce(${sqlNullableText(contactName)}, contact_name),
      contact_phone = coalesce(${sqlNullableText(contactPhone)}, contact_phone),
      age_years = coalesce(${sqlNullableInt(ageYears)}, age_years),
      age_months = ${sqlNullableInt(ageMonths)},
      pediatric_u6_active = ${sqlBoolean(pediatricU6Active)},
      biological_sex = coalesce(${sqlNullableText(biologicalSex)}, biological_sex)
  where id = ${sqlUuid(profileId)}
    and session_id = ${sqlUuid(sessionId)}
    and deleted_at is null
  returning *
)
select coalesce((
  select jsonb_build_object(
    'id', p.id::text,
    'sessionId', p.session_id::text,
    'subjectRelation', p.subject_relation,
    'label', p.label,
    'legalGuardianConfirmed', p.legal_guardian_confirmed,
    'contactName', p.contact_name,
    'contactPhone', p.contact_phone,
    'ageYears', p.age_years,
    'ageMonths', p.age_months,
    'pediatricU6Active', p.pediatric_u6_active,
    'biologicalSex', p.biological_sex,
    'estimatedFitzpatrickBand', p.estimated_fitzpatrick_band,
    'baselineItaDegrees', p.baseline_ita_degrees
  )
  from updated_profile p
), 'null'::jsonb)::text;
`.trim();
}

export function buildGetOmnichannelConfigSql() {
  return `
select coalesce((
  select jsonb_build_object(
    'configKey', c.config_key,
    'channels', c.channels_json,
    'flowRules', c.flow_rules_json,
    'greetingVariants', c.greeting_variants_json,
    'updatedAt', c.updated_at
  )
  from omnichannel_communication_configs c
  where c.config_key = 'default'
  limit 1
), jsonb_build_object(
  'configKey', 'default',
  'channels', '{"telegram":{"enabled":true,"transport":"Telegram Bot API Webhook","botHandle":"@skindoktor_pro_bot"},"web":{"enabled":true,"transport":"Встроенный веб-экран /check (без сжатия)","route":"/check"},"max":{"enabled":false,"transport":"@maxhub/max-bot-api (MAX Webhook)","botHandle":""},"whatsapp":{"enabled":false,"transport":"WAHA / Evolution HTTP API","instanceName":""}}'::jsonb,
  'flowRules', '{"photoFirstMode":true,"postPhotoLeadCaptureEnabled":true,"photoWaitNudgeMinutes":4,"lowRiskFollowupDays":30,"mediumRiskSecondPhotoCheckEnabled":true,"persistentMenuEnabled":true}'::jsonb,
  'greetingVariants', '["Ура! Рад помочь — сделайте фото по наглядной памятке ниже и пришлите сюда.","Рад новому обращению! Пожалуйста, пришлите чёткую фотографию участка кожи крупным планом.","Отлично, готов проверить снимок! Точная маршрутизация возможна только по чёткой фотографии с расстояния около 10 см."]'::jsonb,
  'updatedAt', null
))::text;
`.trim();
}

export function buildUpsertOmnichannelConfigSql({
  channels,
  flowRules,
  greetingVariants,
  updatedByUserId = null,
}) {
  return `
with upserted as (
  insert into omnichannel_communication_configs (
    config_key,
    channels_json,
    flow_rules_json,
    greeting_variants_json,
    updated_by_user_id,
    updated_at
  )
  values (
    'default',
    ${sqlJsonb(channels)},
    ${sqlJsonb(flowRules)},
    ${sqlJsonb(greetingVariants)},
    ${sqlNullableUuid(updatedByUserId)},
    now()
  )
  on conflict (config_key)
  do update set
    channels_json = excluded.channels_json,
    flow_rules_json = excluded.flow_rules_json,
    greeting_variants_json = excluded.greeting_variants_json,
    updated_by_user_id = excluded.updated_by_user_id,
    updated_at = now()
  returning *
)
select jsonb_build_object(
  'configKey', u.config_key,
  'channels', u.channels_json,
  'flowRules', u.flow_rules_json,
  'greetingVariants', u.greeting_variants_json,
  'updatedAt', u.updated_at
)::text
from upserted u;
`.trim();
}

export function buildDeleteOnboardingSessionData152FzSql({ sessionId }) {
  return `
with target_subs as (
  select id, sanitized_object_bucket, sanitized_full_image_key
  from onboarding_submissions
  where session_id = ${sqlUuid(sessionId)}
    and deleted_at is null
    and status <> 'handed_off'
),
deleted_subs as (
  update onboarding_submissions
  set status = 'deleted',
      deleted_at = now(),
      optical_exif_json = '{}'::jsonb,
      anamnesis_answers_json = '{}'::jsonb,
      patient_facing_card_json = '{}'::jsonb,
      doctor_only_draft_json = '[]'::jsonb,
      sanitized_full_image_key = null
  where id in (select id from target_subs)
  returning id
),
deleted_profiles as (
  update onboarding_profiles
  set deleted_at = now(),
      risk_factors_json = '{}'::jsonb
  where session_id = ${sqlUuid(sessionId)}
    and deleted_at is null
  returning id
),
deleted_session as (
  update onboarding_sessions
  set deleted_at = now(),
      active_profile_id = null,
      fsm_state = 'S0_START',
      fsm_context_json = '{}'::jsonb
  where id = ${sqlUuid(sessionId)}
    and deleted_at is null
  returning id
)
select jsonb_build_object(
  'deletedSession', exists(select 1 from deleted_session),
  'deletedProfilesCount', (select count(*)::int from deleted_profiles),
  'deletedSubmissionsCount', (select count(*)::int from deleted_subs),
  'preservedClinicHandoffCount', (
    select count(*)::int
    from onboarding_submissions
    where session_id = ${sqlUuid(sessionId)}
      and status = 'handed_off'
  ),
  'objectsToPurge', coalesce((
    select jsonb_agg(jsonb_build_object(
      'bucket', ts.sanitized_object_bucket,
      'key', ts.sanitized_full_image_key
    ))
    from target_subs ts
    where ts.sanitized_object_bucket is not null
      and ts.sanitized_full_image_key is not null
  ), '[]'::jsonb)
)::text;
`.trim();
}

export function buildUpsertPrevisitCaseSql({
  handoffCaseCode,
  targetClinicSlugOrId,
  channel,
  bookingPriority,
  patientDisplayName,
  patientPhoneE164,
  preferredTimeNote,
  preferredFromIso,
  subjectRelation,
  legalGuardianConfirmed,
  consent152FzAcceptedAt,
  subjectProfile,
  lesionsSummaryForDoctor,
  onboardingSessionId = null,
  patientBirthDate = null,
  patientSex = "unknown",
  patientPhototype = null,
}) {
  const isUuid = UUID_PATTERN.test(String(targetClinicSlugOrId || ""));
  const clinicMatchClause = isUuid
    ? `c.id = ${sqlUuid(targetClinicSlugOrId)} or c.slug = ${sqlLiteral(targetClinicSlugOrId)}`
    : `c.slug = ${sqlLiteral(targetClinicSlugOrId)}`;
  const safeReason =
    bookingPriority === "PRIORITY_URGENT"
      ? "Приоритетный очный осмотр дерматолога (предвизитный маршрут)"
      : "Плановый очный осмотр дерматолога (предвизитный маршрут)";
  const generatedCode = `PV-${String(handoffCaseCode).replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase()}`;

  return `
with target_clinic as (
  select c.id, c.slug, c.name
  from clinics c
  where (${clinicMatchClause})
  order by c.created_at asc
  limit 1
),
fallback_clinic as (
  select id, slug, name from target_clinic
  union all
  select c.id, c.slug, c.name
  from clinics c
  where not exists (select 1 from target_clinic)
  order by created_at asc
  limit 1
),
ensured_patient as (
  insert into patients (
    clinic_id,
    code,
    full_name,
    birth_date,
    sex,
    phototype,
    imaging_consent
  )
  select
    fc.id,
    ${sqlLiteral(generatedCode)},
    ${sqlLiteral(patientDisplayName)},
    ${patientBirthDate ? `${sqlLiteral(patientBirthDate)}::date` : "null"},
    ${sqlLiteral(patientSex)},
    ${sqlNullableText(patientPhototype)},
    true
  from fallback_clinic fc
  on conflict (clinic_id, code)
  do update set
    full_name = excluded.full_name,
    phototype = coalesce(excluded.phototype, patients.phototype),
    imaging_consent = true,
    updated_at = now()
  returning *
),
ensured_booking as (
  insert into patient_portal_booking_requests (
    clinic_id,
    patient_id,
    requested_by_user_id,
    preferred_from,
    reason,
    status,
    source_system,
    external_request_id,
    channel,
    booking_priority,
    handoff_case_code,
    contact_phone,
    preferred_time_note
  )
  select
    ep.clinic_id,
    ep.id,
    null,
    ${sqlLiteral(preferredFromIso)}::timestamptz,
    ${sqlLiteral(safeReason)},
    'requested',
    'site',
    ${sqlLiteral(handoffCaseCode)},
    ${sqlLiteral(channel)},
    ${sqlLiteral(bookingPriority)},
    ${sqlLiteral(handoffCaseCode)},
    ${sqlNullableText(patientPhoneE164)},
    ${sqlNullableText(preferredTimeNote)}
  from ensured_patient ep
  on conflict (clinic_id, handoff_case_code)
  where handoff_case_code is not null
  do update set
    booking_priority = excluded.booking_priority,
    contact_phone = coalesce(excluded.contact_phone, patient_portal_booking_requests.contact_phone),
    preferred_time_note = coalesce(excluded.preferred_time_note, patient_portal_booking_requests.preferred_time_note),
    updated_at = now()
  returning *
),
upserted_case as (
  insert into previsit_cases (
    handoff_case_code,
    clinic_id,
    patient_id,
    booking_request_id,
    visit_id,
    onboarding_session_id,
    channel,
    booking_priority,
    subject_relation,
    legal_guardian_confirmed,
    consent_152fz_accepted_at,
    subject_profile_json
  )
  select
    ${sqlLiteral(handoffCaseCode)},
    eb.clinic_id,
    eb.patient_id,
    eb.id,
    eb.assigned_visit_id,
    ${sqlNullableUuid(onboardingSessionId)},
    ${sqlLiteral(channel)},
    ${sqlLiteral(bookingPriority)},
    ${sqlLiteral(subjectRelation)},
    ${sqlBoolean(legalGuardianConfirmed)},
    ${sqlLiteral(consent152FzAcceptedAt)}::timestamptz,
    ${sqlJsonb(subjectProfile)}
  from ensured_booking eb
  on conflict (handoff_case_code)
  do update set
    booking_priority = excluded.booking_priority,
    subject_profile_json = excluded.subject_profile_json,
    visit_id = coalesce(previsit_cases.visit_id, excluded.visit_id),
    updated_at = now()
  returning *
),
deleted_old_lesions as (
  delete from previsit_case_lesions
  where previsit_case_id in (select id from upserted_case)
  returning id
),
inserted_lesions as (
  insert into previsit_case_lesions (
    previsit_case_id,
    lesion_index,
    body_region_code,
    sanitized_full_image_s3_key,
    private_crop_card_s3_key,
    crop_svg_data_url,
    quality_gate_json,
    anamnesis_answers_json,
    doctor_only_status_localis_draft,
    patient_facing_safe_summary
  )
  select
    uc.id,
    coalesce(item."lesionIndex", 1),
    item."bodyRegionCode",
    item."sanitizedFullImageS3Key",
    item."privateCropCardS3Key",
    item."cropSvgDataUrl",
    coalesce(item."qualityGate", '{}'::jsonb),
    coalesce(item."anamnesisAnswers", '{}'::jsonb),
    item."doctorOnlyStatusLocalisDraft",
    item."patientFacingSafeSummary"
  from upserted_case uc
  cross join jsonb_to_recordset(${sqlJsonb(lesionsSummaryForDoctor)}) as item(
    "lesionIndex" integer,
    "bodyRegionCode" text,
    "sanitizedFullImageS3Key" text,
    "privateCropCardS3Key" text,
    "cropSvgDataUrl" text,
    "qualityGate" jsonb,
    "anamnesisAnswers" jsonb,
    "doctorOnlyStatusLocalisDraft" text,
    "patientFacingSafeSummary" text
  )
  returning id, lesion_index
)
select jsonb_build_object(
  'id', uc.id::text,
  'handoffCaseCode', uc.handoff_case_code,
  'clinicId', uc.clinic_id::text,
  'clinicSlug', fc.slug,
  'clinicName', fc.name,
  'patientId', uc.patient_id::text,
  'bookingRequestId', uc.booking_request_id::text,
  'visitId', uc.visit_id::text,
  'channel', uc.channel,
  'bookingPriority', uc.booking_priority,
  'lesionCount', (select count(*)::int from inserted_lesions),
  'createdAt', uc.created_at
)::text
from upserted_case uc
join fallback_clinic fc on fc.id = uc.clinic_id;
`.trim();
}

export function buildGetDoctorPrevisitCaseByVisitSql({
  visitId,
  clinicIds = [],
  allClinics = false,
}) {
  return `
with target_visit as (
  select v.id, v.clinic_id, v.patient_id
  from visits v
  where v.id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  limit 1
),
matched_case as (
  select pc.*
  from previsit_cases pc
  join target_visit tv on tv.clinic_id = pc.clinic_id and tv.patient_id = pc.patient_id
  where (pc.visit_id = tv.id or pc.visit_id is null)
  order by (case when pc.visit_id = tv.id then 0 else 1 end) asc, pc.created_at desc
  limit 1
)
select coalesce((
  select jsonb_build_object(
    'id', mc.id::text,
    'handoffCaseCode', mc.handoff_case_code,
    'clinicId', mc.clinic_id::text,
    'patientId', mc.patient_id::text,
    'bookingRequestId', mc.booking_request_id::text,
    'visitId', coalesce(mc.visit_id, (select id from target_visit))::text,
    'channel', mc.channel,
    'bookingPriority', mc.booking_priority,
    'subjectRelation', mc.subject_relation,
    'legalGuardianConfirmed', mc.legal_guardian_confirmed,
    'consent152FzAcceptedAt', mc.consent_152fz_accepted_at,
    'subjectProfile', mc.subject_profile_json,
    'skinPassportActive', mc.skin_passport_active,
    'visitConfirmedAt', mc.visit_confirmed_at,
    'createdAt', mc.created_at,
    'lesions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id::text,
        'lesionIndex', l.lesion_index,
        'bodyRegionCode', l.body_region_code,
        'sanitizedFullImageS3Key', l.sanitized_full_image_s3_key,
        'privateCropCardS3Key', l.private_crop_card_s3_key,
        'cropSvgDataUrl', l.crop_svg_data_url,
        'qualityGate', l.quality_gate_json,
        'anamnesisAnswers', l.anamnesis_answers_json,
        'doctorOnlyStatusLocalisDraft', l.doctor_only_status_localis_draft,
        'patientFacingSafeSummary', l.patient_facing_safe_summary
      ) order by l.lesion_index asc)
      from previsit_case_lesions l
      where l.previsit_case_id = mc.id
    ), '[]'::jsonb)
  )
  from matched_case mc
), 'null'::jsonb)::text;
`.trim();
}

export function buildConfirmClinicVisitAndActivatePassportSql({
  visitId = null,
  handoffCaseCode = null,
  confirmedByUserId = null,
  clinicIds = [],
  allClinics = false,
}) {
  const matchClause = visitId
    ? `v.id = ${sqlUuid(visitId)}`
    : `exists (select 1 from previsit_cases pc0 where pc0.handoff_case_code = ${sqlLiteral(handoffCaseCode)} and pc0.patient_id = v.patient_id and pc0.clinic_id = v.clinic_id)`;

  return `
with target_case as (
  select pc.*
  from previsit_cases pc
  where ${
    handoffCaseCode
      ? `pc.handoff_case_code = ${sqlLiteral(handoffCaseCode)}`
      : `pc.visit_id = ${sqlUuid(visitId)} or pc.patient_id = (select patient_id from visits where id = ${sqlUuid(visitId)})`
  }
    ${clinicScopeWhere({ alias: "pc", clinicIds, allClinics })}
  order by pc.created_at desc
  limit 1
),
target_visit as (
  select v.*
  from visits v
  where (${matchClause})
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  order by v.created_at desc
  limit 1
),
updated_case as (
  update previsit_cases pc
  set skin_passport_active = true,
      visit_id = coalesce(pc.visit_id, (select id from target_visit)),
      visit_confirmed_at = coalesce(pc.visit_confirmed_at, now()),
      visit_confirmed_by_user_id = coalesce(${sqlNullableUuid(confirmedByUserId)}, pc.visit_confirmed_by_user_id),
      updated_at = now()
  where pc.id in (select id from target_case)
  returning *
),
updated_links as (
  update patient_user_links pul
  set skin_passport_active = true,
      skin_passport_activated_at = coalesce(pul.skin_passport_activated_at, now()),
      activated_by_visit_id = coalesce(pul.activated_by_visit_id, (select id from target_visit))
  where pul.patient_id in (
    select patient_id from updated_case
    union
    select patient_id from target_visit
  )
  returning pul.user_id, pul.patient_id
),
updated_onboarding as (
  update onboarding_sessions os
  set skin_passport_active = true,
      linked_patient_id = coalesce(os.linked_patient_id, uc.patient_id)
  from updated_case uc
  where os.id = uc.onboarding_session_id
  returning os.id
)
select jsonb_build_object(
  'confirmed', (exists(select 1 from updated_case) or exists(select 1 from target_visit)),
  'handoffCaseCode', (select handoff_case_code from updated_case limit 1),
  'visitId', coalesce((select visit_id::text from updated_case limit 1), (select id::text from target_visit limit 1)),
  'patientId', coalesce((select patient_id::text from updated_case limit 1), (select patient_id::text from target_visit limit 1)),
  'clinicId', coalesce((select clinic_id::text from updated_case limit 1), (select clinic_id::text from target_visit limit 1)),
  'skinPassportActive', true,
  'visitCompletedAt', coalesce((select visit_confirmed_at from updated_case limit 1), now()),
  'linkedPortalUsersUpdated', (select count(*)::int from updated_links)
)::text;
`.trim();
}

export function buildGetPatientPortalAccessStatusSql({
  patientId,
  clinicIds = [],
  allClinics = false,
}) {
  return `
with scoped_patient as (
  select p.id, p.clinic_id, p.code, p.full_name
  from patients p
  where p.id = ${sqlUuid(patientId)}
    and p.deleted_at is null
    ${clinicScopeWhere({ alias: "p", clinicIds, allClinics })}
  limit 1
)
select coalesce((
  select jsonb_build_object(
    'patientId', sp.id::text,
    'clinicId', sp.clinic_id::text,
    'patientCode', sp.code,
    'patientFullName', sp.full_name,
    'linkedAccounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', u.id::text,
        'email', u.email::text,
        'displayName', u.display_name,
        'disabledAt', u.disabled_at,
        'skinPassportActive', coalesce(pul.skin_passport_active, false),
        'skinPassportActivatedAt', pul.skin_passport_activated_at,
        'linkedAt', pul.created_at
      ) order by pul.created_at asc)
      from patient_user_links pul
      join app_users u on u.id = pul.user_id
      where pul.patient_id = sp.id
    ), '[]'::jsonb)
  )
  from scoped_patient sp
), 'null'::jsonb)::text;
`.trim();
}

export function buildProvisionPatientPortalAccessSql({
  patientId,
  email,
  displayName,
  passwordHash,
  activateSkinPassport = false,
  clinicIds = [],
  allClinics = false,
}) {
  return `
with scoped_patient as (
  select p.id, p.clinic_id, p.code, p.full_name
  from patients p
  where p.id = ${sqlUuid(patientId)}
    and p.deleted_at is null
    ${clinicScopeWhere({ alias: "p", clinicIds, allClinics })}
  limit 1
),
upserted_user as (
  insert into app_users (
    email,
    display_name,
    password_hash,
    disabled_at
  )
  select
    ${sqlLiteral(email)},
    ${sqlLiteral(displayName)},
    ${sqlLiteral(passwordHash)},
    null
  from scoped_patient
  on conflict (email)
  do update set
    display_name = excluded.display_name,
    password_hash = excluded.password_hash,
    disabled_at = null,
    updated_at = now()
  returning *
),
ensured_role as (
  insert into user_roles (
    user_id,
    clinic_id,
    role
  )
  select
    uu.id,
    sp.clinic_id,
    'patient'::app_role
  from upserted_user uu
  cross join scoped_patient sp
  on conflict (user_id, clinic_id, role)
  do nothing
  returning id
),
ensured_link as (
  insert into patient_user_links (
    user_id,
    patient_id,
    skin_passport_active,
    skin_passport_activated_at
  )
  select
    uu.id,
    sp.id,
    ${sqlBoolean(activateSkinPassport)},
    case when ${sqlBoolean(activateSkinPassport)} then now() else null end
  from upserted_user uu
  cross join scoped_patient sp
  on conflict (user_id, patient_id)
  do update set
    skin_passport_active = patient_user_links.skin_passport_active or excluded.skin_passport_active,
    skin_passport_activated_at = coalesce(patient_user_links.skin_passport_activated_at, excluded.skin_passport_activated_at)
  returning *
)
select coalesce((
  select jsonb_build_object(
    'patientId', sp.id::text,
    'clinicId', sp.clinic_id::text,
    'patientCode', sp.code,
    'userId', uu.id::text,
    'email', uu.email::text,
    'displayName', uu.display_name,
    'role', 'patient',
    'skinPassportActive', el.skin_passport_active,
    'skinPassportActivatedAt', el.skin_passport_activated_at
  )
  from scoped_patient sp
  join upserted_user uu on true
  join ensured_link el on el.user_id = uu.id and el.patient_id = sp.id
), 'null'::jsonb)::text;
`.trim();
}

export function buildDeletePortalPersonalUploads152FzSql({ userId }) {
  return `
with linked_patients as (
  select patient_id
  from patient_user_links
  where user_id = ${sqlUuid(userId)}
),
target_sessions as (
  select id
  from onboarding_sessions
  where linked_patient_id in (select patient_id from linked_patients)
    and deleted_at is null
),
purged_subs as (
  update onboarding_submissions
  set status = 'deleted',
      deleted_at = now(),
      optical_exif_json = '{}'::jsonb,
      anamnesis_answers_json = '{}'::jsonb,
      patient_facing_card_json = '{}'::jsonb,
      doctor_only_draft_json = '[]'::jsonb,
      sanitized_full_image_key = null
  where session_id in (select id from target_sessions)
    and status <> 'handed_off'
    and deleted_at is null
  returning id
)
select jsonb_build_object(
  'purgedPersonalSubmissionsCount', (select count(*)::int from purged_subs),
  'medicalRecordProtectedBy323Fz', true
)::text;
`.trim();
}

export function createPrevisitHandoffRepository(dbClient) {
  return {
    async verifyServiceKey(params) {
      return firstJson(await dbClient.queryJson(buildVerifyServiceKeySql(params)));
    },
    async upsertOnboardingSession(params) {
      return firstJson(await dbClient.queryJson(buildUpsertOnboardingSessionSql(params)));
    },
    async updateOnboardingSessionState(params) {
      return firstJson(await dbClient.queryJson(buildUpdateOnboardingSessionStateSql(params)));
    },
    async createOnboardingProfile(params) {
      return firstJson(await dbClient.queryJson(buildCreateOnboardingProfileSql(params)));
    },
    async getOnboardingProfile(params) {
      return firstJson(await dbClient.queryJson(buildGetOnboardingProfileSql(params)));
    },
    async updateOnboardingProfileRiskFactors(params) {
      return firstJson(await dbClient.queryJson(buildUpdateOnboardingProfileRiskFactorsSql(params)));
    },
    async createOnboardingSubmission(params) {
      return firstJson(await dbClient.queryJson(buildCreateOnboardingSubmissionSql(params)));
    },
    async getOnboardingSubmission(params) {
      return firstJson(await dbClient.queryJson(buildGetOnboardingSubmissionSql(params)));
    },
    async resolveSubmissionMismatch(params) {
      return firstJson(await dbClient.queryJson(buildResolveSubmissionMismatchSql(params)));
    },
    async finalizeSubmissionSurvey(params) {
      return firstJson(await dbClient.queryJson(buildFinalizeSubmissionSurveySql(params)));
    },
    async deleteOnboardingSessionData152Fz(params) {
      return firstJson(await dbClient.queryJson(buildDeleteOnboardingSessionData152FzSql(params)));
    },
    async upsertPrevisitCase(params) {
      return firstJson(await dbClient.queryJson(buildUpsertPrevisitCaseSql(params)));
    },
    async getDoctorPrevisitCaseByVisit(params) {
      return firstJson(await dbClient.queryJson(buildGetDoctorPrevisitCaseByVisitSql(params)));
    },
    async confirmClinicVisitAndActivatePassport(params) {
      return firstJson(await dbClient.queryJson(buildConfirmClinicVisitAndActivatePassportSql(params)));
    },
    async getPatientPortalAccessStatus(params) {
      return firstJson(await dbClient.queryJson(buildGetPatientPortalAccessStatusSql(params)));
    },
    async provisionPatientPortalAccess(params) {
      return firstJson(await dbClient.queryJson(buildProvisionPatientPortalAccessSql(params)));
    },
    async deletePortalPersonalUploads152Fz(params) {
      return firstJson(await dbClient.queryJson(buildDeletePortalPersonalUploads152FzSql(params)));
    },
    async savePostPhotoLeadAndProfile(params) {
      return firstJson(await dbClient.queryJson(buildSavePostPhotoLeadAndProfileSql(params)));
    },
    async getOmnichannelConfig() {
      return firstJson(await dbClient.queryJson(buildGetOmnichannelConfigSql()));
    },
    async upsertOmnichannelConfig(params) {
      return firstJson(await dbClient.queryJson(buildUpsertOmnichannelConfigSql(params)));
    },
  };
}

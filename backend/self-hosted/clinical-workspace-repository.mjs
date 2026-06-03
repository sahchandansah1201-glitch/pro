// Stage 5H · Self-hosted clinical workspace repository.
// PostgreSQL contracts for assessment, conclusion and report reads/writes.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlNullableText(value) {
  return value == null ? "null" : sqlLiteral(value);
}

function sqlNullableUuid(value) {
  return value == null ? "null" : sqlUuid(value);
}

function sqlNullableTimestamp(value) {
  return value == null ? "null" : `${sqlLiteral(value)}::timestamptz`;
}

function sqlNullableNumber(value) {
  if (value == null || value === "") return "null";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "null";
}

function sqlNullableInteger(value) {
  if (value == null || value === "") return "null";
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : "null";
}

function sqlTextArray(values = []) {
  const items = (Array.isArray(values) ? values : []).map((value) => sqlLiteral(value));
  return `array[${items.join(", ")}]::text[]`;
}

function sqlJsonb(value) {
  return `${sqlLiteral(JSON.stringify(value ?? null))}::jsonb`;
}

function safeLimit(value, fallback = 20, max = 100) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

function safeClinicIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(String)
    .filter((value) => UUID_PATTERN.test(value))
    .slice(0, 100);
}

function clinicScopeWhere({ alias, clinicIds = [], allClinics = false } = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${ids.map(sqlUuid).join(", ")})`;
}

function assessmentColumns(alias = "a") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.visit_id::text as "visitId",
    ${alias}.doctor_user_id::text as "doctorUserId",
    ${alias}.status as "status",
    ${alias}.risk_level as "riskLevel",
    ${alias}.abcd_total as "abcdTotal",
    ${alias}.seven_point_total as "sevenPointTotal",
    ${alias}.summary as "summary",
    ${alias}.recommendation as "recommendation",
    ${alias}.signed_at as "signedAt",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"
  `;
}

function conclusionColumns(alias = "c") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.visit_id::text as "visitId",
    ${alias}.doctor_user_id::text as "doctorUserId",
    ${alias}.status as "status",
    ${alias}.summary as "summary",
    ${alias}.next_step as "nextStep",
    ${alias}.follow_up_at as "followUpAt",
    ${alias}.signed_at as "signedAt",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"
  `;
}

function reportColumns(alias = "r") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.visit_id::text as "visitId",
    ${alias}.doctor_user_id::text as "doctorUserId",
    ${alias}.status as "status",
    ${alias}.physician_text as "physicianText",
    ${alias}.patient_safe_text as "patientSafeText",
    ${alias}.signed_at as "signedAt",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"
  `;
}

function lesionComparisonDraftColumns(alias = "d") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.visit_id::text as "visitId",
    ${alias}.doctor_user_id::text as "doctorUserId",
    ${alias}.lesion_id as "lesionId",
    ${alias}.pair_key as "pairKey",
    ${alias}.image_ids as "imageIds",
    ${alias}.action as "action",
    ${alias}.comparability as "comparability",
    ${alias}.reasons as "reasons",
    ${alias}.patient_delivery_allowed as "patientDeliveryAllowed",
    ${alias}.protected_fields_exposed as "protectedFieldsExposed",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"
  `;
}

export function buildGetVisitAssessmentSql({ visitId, clinicIds = [], allClinics = false } = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${assessmentColumns("a")}
  from clinical_assessments a
  where a.visit_id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "a", clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

export function buildGetVisitConclusionSql({ visitId, clinicIds = [], allClinics = false } = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${conclusionColumns("c")}
  from clinical_conclusions c
  where c.visit_id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "c", clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

export function buildGetVisitReportSql({ visitId, clinicIds = [], allClinics = false } = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${reportColumns("r")}
  from reports r
  where r.visit_id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "r", clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

export function buildGetLesionLongitudinalHistorySql({
  patientId,
  lesionId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with target_lesion as (
    select
      l.id,
      l.clinic_id,
      l.patient_id,
      l.label,
      l.body_zone,
      l.body_surface,
      l.status
    from lesions l
    where l.patient_id = ${sqlUuid(patientId)}
      and l.id = ${sqlUuid(lesionId)}
      ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
    limit 1
  ),
  boundary_flags as (
    select
      false as patient_delivery_allowed,
      false as protected_fields_exposed,
      false as storage_paths_exposed,
      false as signed_urls_issued,
      false as raw_image_bytes_exposed,
      false as doctor_only_text_exposed,
      false as clinical_conclusion_generated
  ),
  lesion_assets as (
    select
      a.id,
      a.clinic_id,
      a.patient_id,
      a.visit_id,
      a.lesion_id,
      a.kind::text as kind,
      a.content_type,
      a.byte_size,
      a.captured_at,
      a.created_at,
      v.status::text as visit_status,
      v.started_at,
      v.signed_at
    from clinical_assets a
    join target_lesion l
      on l.id = a.lesion_id
     and l.patient_id = a.patient_id
     and l.clinic_id = a.clinic_id
    left join visits v
      on v.id = a.visit_id
     and v.patient_id = a.patient_id
     and v.clinic_id = a.clinic_id
    where a.visit_id is not null
      and a.kind in ('overview_photo', 'dermoscopy')
  ),
  visits_rollup as (
    select
      a.visit_id,
      max(a.visit_status) as visit_status,
      min(a.started_at) as started_at,
      max(a.signed_at) as signed_at,
      count(a.id)::int as image_count,
      count(a.id) filter (where a.kind = 'dermoscopy')::int as dermoscopy_count,
      count(a.id) filter (where a.kind = 'overview_photo')::int as overview_count,
      count(distinct ca.id)::int as assessment_count,
      min(a.captured_at) as captured_at_first,
      max(a.captured_at) as captured_at_last
    from lesion_assets a
    left join clinical_assessments ca
      on ca.visit_id = a.visit_id
     and ca.patient_id = a.patient_id
     and ca.clinic_id = a.clinic_id
    group by a.visit_id
  ),
  ordered_assets as (
    select
      a.*,
      lag(a.id) over asset_order as previous_image_id,
      lag(a.visit_id) over asset_order as previous_visit_id,
      lag(a.content_type) over asset_order as previous_content_type,
      lag(a.captured_at) over asset_order as previous_captured_at,
      lag(a.started_at) over asset_order as previous_started_at
    from lesion_assets a
    window asset_order as (
      partition by a.kind
      order by coalesce(a.started_at, a.captured_at, a.created_at) asc nulls last, a.created_at asc, a.id asc
    )
  ),
  candidate_pairs as (
    select
      previous_visit_id,
      visit_id as current_visit_id,
      previous_image_id,
      id as current_image_id,
      kind,
      case
        when content_type not like 'image/%' or previous_content_type not like 'image/%' then 'blocked'
        when captured_at is null or previous_captured_at is null then 'warning'
        else 'ready'
      end as status,
      array_remove(array[
        case when captured_at is null or previous_captured_at is null then 'missing_capture_time' end,
        case when content_type not like 'image/%' or previous_content_type not like 'image/%' then 'non_image_content_type' end
      ]::text[], null) as reasons,
      coalesce(previous_started_at, previous_captured_at) as previous_order_at,
      coalesce(started_at, captured_at) as current_order_at
    from ordered_assets
    where previous_image_id is not null
      and previous_visit_id is distinct from visit_id
  )
  select
    l.clinic_id::text as "clinicId",
    l.patient_id::text as "patientId",
    l.id::text as "lesionId",
    l.label as "label",
    l.body_zone as "bodyZone",
    l.body_surface as "bodySurface",
    l.status as "status",
    jsonb_build_object(
      'visitCount', coalesce((select count(*)::int from visits_rollup), 0),
      'imageCount', coalesce((select sum(image_count)::int from visits_rollup), 0),
      'candidatePairCount', coalesce((select count(*)::int from candidate_pairs), 0),
      'comparablePairCount', coalesce((select count(*)::int from candidate_pairs where status = 'ready'), 0),
      'warningPairCount', coalesce((select count(*)::int from candidate_pairs where status = 'warning'), 0),
      'blockedPairCount', coalesce((select count(*)::int from candidate_pairs where status = 'blocked'), 0),
      'assessmentCount', coalesce((select sum(assessment_count)::int from visits_rollup), 0)
    ) as "summary",
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'visitId', v.visit_id::text,
        'startedAt', v.started_at,
        'signedAt', v.signed_at,
        'status', v.visit_status,
        'imageCount', v.image_count,
        'dermoscopyCount', v.dermoscopy_count,
        'overviewCount', v.overview_count,
        'assessmentCount', v.assessment_count,
        'capturedAtFirst', v.captured_at_first,
        'capturedAtLast', v.captured_at_last
      ) order by v.started_at asc nulls last, v.visit_id asc)
      from visits_rollup v
    ), '[]'::jsonb) as "visits",
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'previousVisitId', p.previous_visit_id::text,
        'currentVisitId', p.current_visit_id::text,
        'previousImageId', p.previous_image_id::text,
        'currentImageId', p.current_image_id::text,
        'kind', p.kind,
        'status', p.status,
        'reasons', p.reasons
      ) order by p.previous_order_at asc nulls last, p.current_order_at asc nulls last)
      from candidate_pairs p
    ), '[]'::jsonb) as "candidatePairs",
    jsonb_build_object(
      'patientDeliveryAllowed', bf.patient_delivery_allowed,
      'protectedFieldsExposed', bf.protected_fields_exposed,
      'storagePathsExposed', bf.storage_paths_exposed,
      'signedUrlsIssued', bf.signed_urls_issued,
      'rawImageBytesExposed', bf.raw_image_bytes_exposed,
      'doctorOnlyTextExposed', bf.doctor_only_text_exposed,
      'clinicalConclusionGenerated', bf.clinical_conclusion_generated
    ) as "boundaries"
  from target_lesion l
  cross join boundary_flags bf
) result;
`.trim();
}

export function buildGetProtectedLesionImageAssetSql({
  patientId,
  lesionId,
  assetId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    a.id::text as "id",
    a.clinic_id::text as "clinicId",
    a.patient_id::text as "patientId",
    a.visit_id::text as "visitId",
    a.lesion_id::text as "lesionId",
    a.kind::text as "kind",
    a.content_type as "contentType",
    a.byte_size as "byteSize",
    a.captured_at as "capturedAt",
    a.object_bucket as "objectBucket",
    a.object_key as "objectKey"
  from clinical_assets a
  join lesions l
    on l.id = a.lesion_id
   and l.patient_id = a.patient_id
   and l.clinic_id = a.clinic_id
  where a.id = ${sqlUuid(assetId)}
    and a.patient_id = ${sqlUuid(patientId)}
    and a.lesion_id = ${sqlUuid(lesionId)}
    and a.kind in ('overview_photo', 'dermoscopy')
    and a.content_type like 'image/%'
    ${clinicScopeWhere({ alias: "a", clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

export function buildGetLesionCaptureMetadataSql({
  patientId,
  lesionId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with target_lesion as (
    select
      l.id,
      l.clinic_id,
      l.patient_id
    from lesions l
    where l.patient_id = ${sqlUuid(patientId)}
      and l.id = ${sqlUuid(lesionId)}
      ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
    limit 1
  ),
  boundary_flags as (
    select
      false as patient_delivery_allowed,
      false as protected_fields_exposed,
      false as storage_paths_exposed,
      false as signed_urls_issued,
      false as raw_image_bytes_exposed,
      false as doctor_only_text_exposed,
      false as clinical_conclusion_generated
  ),
  asset_rows as (
    select
      a.id,
      a.visit_id,
      a.kind::text as kind,
      a.content_type,
      a.captured_at,
      a.created_at,
      m.capture_source,
      m.device_id,
      d.model as device_model,
      d.calibration_profile as device_calibration_profile,
      m.frame_width,
      m.frame_height,
      m.quality_score,
      m.quality_issues,
      m.scale_marker_detected,
      m.millimeters_available,
      case
        when m.asset_id is null then 'missing'
        when m.device_id is null then 'warning'
        when m.frame_width is null or m.frame_height is null then 'warning'
        when coalesce(m.quality_score, 0) < 75 then 'warning'
        when cardinality(coalesce(m.quality_issues, array[]::text[])) > 0 then 'warning'
        else 'ready'
      end as technical_status,
      array_remove(array[
        case when m.asset_id is null then 'missing_capture_metadata' end,
        case when m.asset_id is not null and m.device_id is null then 'device_missing' end,
        case when m.asset_id is not null and (m.frame_width is null or m.frame_height is null) then 'frame_size_missing' end,
        case when m.asset_id is not null and coalesce(m.quality_score, 0) < 75 then 'low_quality' end,
        case when cardinality(coalesce(m.quality_issues, array[]::text[])) > 0 then 'quality_issue' end,
        case when m.asset_id is not null and m.scale_marker_detected = false then 'scale_marker_missing' end
      ]::text[], null) as technical_reasons
    from clinical_assets a
    join target_lesion l
      on l.id = a.lesion_id
     and l.patient_id = a.patient_id
     and l.clinic_id = a.clinic_id
    left join clinical_asset_capture_metadata m
      on m.asset_id = a.id
     and m.patient_id = a.patient_id
     and m.clinic_id = a.clinic_id
    left join medical_devices d
      on d.id = m.device_id
     and d.clinic_id = a.clinic_id
    where a.kind in ('overview_photo', 'dermoscopy')
      and a.content_type like 'image/%'
      ${clinicScopeWhere({ alias: "a", clinicIds, allClinics })}
  )
  select
    l.clinic_id::text as "clinicId",
    l.patient_id::text as "patientId",
    l.id::text as "lesionId",
    jsonb_build_object(
      'assetCount', coalesce((select count(*)::int from asset_rows), 0),
      'metadataCount', coalesce((select count(*)::int from asset_rows where capture_source is not null), 0),
      'missingMetadataCount', coalesce((select count(*)::int from asset_rows where capture_source is null), 0),
      'readyForTechnicalCompareCount', coalesce((select count(*)::int from asset_rows where technical_status = 'ready'), 0),
      'scaleReadyCount', coalesce((select count(*)::int from asset_rows where scale_marker_detected = true and millimeters_available = true), 0)
    ) as "summary",
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'assetId', a.id::text,
        'visitId', a.visit_id::text,
        'kind', a.kind,
        'contentType', a.content_type,
        'capturedAt', a.captured_at,
        'captureSource', coalesce(a.capture_source, 'unknown'),
        'deviceId', a.device_id::text,
        'deviceProfile', nullif(concat_ws(' · ', a.device_model, a.device_calibration_profile), ''),
        'frameWidth', a.frame_width,
        'frameHeight', a.frame_height,
        'qualityScore', a.quality_score,
        'qualityIssues', coalesce(a.quality_issues, array[]::text[]),
        'scaleMarkerDetected', coalesce(a.scale_marker_detected, false),
        'millimetersAvailable', coalesce(a.millimeters_available, false),
        'technicalStatus', a.technical_status,
        'technicalReasons', a.technical_reasons
      ) order by coalesce(a.captured_at, a.created_at) asc nulls last, a.id asc)
      from asset_rows a
    ), '[]'::jsonb) as "items",
    jsonb_build_object(
      'patientDeliveryAllowed', bf.patient_delivery_allowed,
      'protectedFieldsExposed', bf.protected_fields_exposed,
      'storagePathsExposed', bf.storage_paths_exposed,
      'signedUrlsIssued', bf.signed_urls_issued,
      'rawImageBytesExposed', bf.raw_image_bytes_exposed,
      'doctorOnlyTextExposed', bf.doctor_only_text_exposed,
      'clinicalConclusionGenerated', bf.clinical_conclusion_generated
    ) as "boundaries"
  from target_lesion l
  cross join boundary_flags bf
) result;
`.trim();
}

function assessmentUpdateSet(changes = {}) {
  const clauses = [];
  if (Object.hasOwn(changes, "status")) clauses.push(`status = ${sqlLiteral(changes.status)}`);
  if (Object.hasOwn(changes, "riskLevel")) clauses.push(`risk_level = ${sqlNullableText(changes.riskLevel)}`);
  if (Object.hasOwn(changes, "abcdTotal")) clauses.push(`abcd_total = ${sqlNullableNumber(changes.abcdTotal)}`);
  if (Object.hasOwn(changes, "sevenPointTotal")) clauses.push(`seven_point_total = ${sqlNullableNumber(changes.sevenPointTotal)}`);
  if (Object.hasOwn(changes, "summary")) clauses.push(`summary = ${sqlNullableText(changes.summary)}`);
  if (Object.hasOwn(changes, "recommendation")) clauses.push(`recommendation = ${sqlNullableText(changes.recommendation)}`);
  if (Object.hasOwn(changes, "signedAt")) clauses.push(`signed_at = ${sqlNullableTimestamp(changes.signedAt)}`);
  clauses.push("doctor_user_id = excluded.doctor_user_id");
  clauses.push("updated_at = now()");
  return clauses.join(",\n      ");
}

function conclusionUpdateSet(changes = {}) {
  const clauses = [];
  if (Object.hasOwn(changes, "status")) clauses.push(`status = ${sqlLiteral(changes.status)}`);
  if (Object.hasOwn(changes, "summary")) clauses.push(`summary = ${sqlNullableText(changes.summary)}`);
  if (Object.hasOwn(changes, "nextStep")) clauses.push(`next_step = ${sqlNullableText(changes.nextStep)}`);
  if (Object.hasOwn(changes, "followUpAt")) clauses.push(`follow_up_at = ${sqlNullableTimestamp(changes.followUpAt)}`);
  if (Object.hasOwn(changes, "signedAt")) clauses.push(`signed_at = ${sqlNullableTimestamp(changes.signedAt)}`);
  clauses.push("doctor_user_id = excluded.doctor_user_id");
  clauses.push("updated_at = now()");
  return clauses.join(",\n      ");
}

export function buildUpsertVisitAssessmentSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  changes = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const scope = clinicScopeWhere({ alias: "clinical_assessments", clinicIds, allClinics });
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with upserted as (
    insert into clinical_assessments (
      clinic_id, patient_id, visit_id, doctor_user_id, status, risk_level,
      abcd_total, seven_point_total, summary, recommendation, signed_at
    )
    values (
      ${sqlUuid(clinicId)},
      ${sqlUuid(patientId)},
      ${sqlUuid(visitId)},
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(changes.status ?? "draft")},
      ${sqlNullableText(changes.riskLevel ?? null)},
      ${sqlNullableNumber(changes.abcdTotal ?? null)},
      ${sqlNullableNumber(changes.sevenPointTotal ?? null)},
      ${sqlNullableText(changes.summary ?? null)},
      ${sqlNullableText(changes.recommendation ?? null)},
      ${sqlNullableTimestamp(changes.signedAt ?? null)}
    )
    on conflict (visit_id) do update
    set ${assessmentUpdateSet(changes)}
    where true ${scope}
    returning *
  )
  select ${assessmentColumns("a")}
  from upserted a
  limit 1
) result;
`.trim();
}

export function buildUpsertVisitConclusionSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  changes = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const scope = clinicScopeWhere({ alias: "clinical_conclusions", clinicIds, allClinics });
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with upserted as (
    insert into clinical_conclusions (
      clinic_id, patient_id, visit_id, doctor_user_id, status, summary,
      next_step, follow_up_at, signed_at
    )
    values (
      ${sqlUuid(clinicId)},
      ${sqlUuid(patientId)},
      ${sqlUuid(visitId)},
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(changes.status ?? "draft")},
      ${sqlNullableText(changes.summary ?? null)},
      ${sqlNullableText(changes.nextStep ?? null)},
      ${sqlNullableTimestamp(changes.followUpAt ?? null)},
      ${sqlNullableTimestamp(changes.signedAt ?? null)}
    )
    on conflict (visit_id) do update
    set ${conclusionUpdateSet(changes)}
    where true ${scope}
    returning *
  )
  select ${conclusionColumns("c")}
  from upserted c
  limit 1
) result;
`.trim();
}

function lesionComparisonDraftUpdateSet(draft = {}) {
  return [
    `image_ids = ${sqlTextArray(draft.imageIds)}`,
    `action = ${sqlLiteral(draft.action)}`,
    `comparability = ${sqlLiteral(draft.comparability)}`,
    `reasons = ${sqlJsonb(draft.reasons ?? [])}`,
    "patient_delivery_allowed = false",
    "protected_fields_exposed = false",
    `metadata_json = ${sqlJsonb({
      brainstormTask: "SD-MF-026",
      auditBoundary: "metadata_only",
      patientDeliveryAllowed: false,
      protectedFieldsExposed: false,
    })}`,
    "doctor_user_id = excluded.doctor_user_id",
    "updated_at = now()",
  ].join(",\n      ");
}

function assetCaptureMetadataUpdateSet(metadata = {}) {
  return [
    `capture_source = ${sqlLiteral(metadata.captureSource ?? "unknown")}`,
    `device_id = ${sqlNullableUuid(metadata.deviceId ?? null)}`,
    `frame_width = ${sqlNullableInteger(metadata.frameWidth ?? null)}`,
    `frame_height = ${sqlNullableInteger(metadata.frameHeight ?? null)}`,
    `quality_score = ${sqlNullableNumber(metadata.qualityScore ?? null)}`,
    `quality_issues = ${sqlTextArray(metadata.qualityIssues ?? [])}`,
    `scale_marker_detected = ${metadata.scaleMarkerDetected === true ? "true" : "false"}`,
    `millimeters_available = ${metadata.millimetersAvailable === true ? "true" : "false"}`,
    "patient_delivery_allowed = false",
    "protected_fields_exposed = false",
    `metadata_json = ${sqlJsonb({
      brainstormTask: "SD-MF-025/026/028",
      auditBoundary: "metadata_only",
      patientDeliveryAllowed: false,
      protectedFieldsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      rawImageBytesExposed: false,
    })}`,
    "captured_by_user_id = excluded.captured_by_user_id",
    "updated_at = now()",
  ].join(",\n      ");
}

export function buildUpsertAssetCaptureMetadataSql({
  visitId,
  assetId,
  patientId,
  clinicId,
  capturedByUserId = null,
  metadata = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const scope = clinicScopeWhere({ alias: "clinical_asset_capture_metadata", clinicIds, allClinics });
  const assetScope = clinicScopeWhere({ alias: "a", clinicIds, allClinics });
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with target_asset as (
    select
      a.id,
      a.clinic_id,
      a.patient_id,
      a.visit_id,
      a.lesion_id
    from clinical_assets a
    where a.id = ${sqlUuid(assetId)}
      and a.visit_id = ${sqlUuid(visitId)}
      and a.patient_id = ${sqlUuid(patientId)}
      and a.clinic_id = ${sqlUuid(clinicId)}
      ${assetScope}
    limit 1
  ),
  upserted as (
    insert into clinical_asset_capture_metadata (
      clinic_id, patient_id, visit_id, lesion_id, asset_id, captured_by_user_id,
      capture_source, device_id, frame_width, frame_height, quality_score,
      quality_issues, scale_marker_detected, millimeters_available,
      metadata_json, patient_delivery_allowed, protected_fields_exposed
    )
    select
      a.clinic_id,
      a.patient_id,
      a.visit_id,
      a.lesion_id,
      a.id,
      ${sqlNullableUuid(capturedByUserId)},
      ${sqlLiteral(metadata.captureSource ?? "unknown")},
      ${sqlNullableUuid(metadata.deviceId ?? null)},
      ${sqlNullableInteger(metadata.frameWidth ?? null)},
      ${sqlNullableInteger(metadata.frameHeight ?? null)},
      ${sqlNullableNumber(metadata.qualityScore ?? null)},
      ${sqlTextArray(metadata.qualityIssues ?? [])},
      ${metadata.scaleMarkerDetected === true ? "true" : "false"},
      ${metadata.millimetersAvailable === true ? "true" : "false"},
      ${sqlJsonb({
        brainstormTask: "SD-MF-025/026/028",
        auditBoundary: "metadata_only",
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
        storagePathsExposed: false,
        signedUrlsIssued: false,
        rawImageBytesExposed: false,
      })},
      false,
      false
    from target_asset a
    on conflict (asset_id) do update
    set ${assetCaptureMetadataUpdateSet(metadata)}
    where true ${scope}
    returning *
  )
  select
    m.id::text as "id",
    m.clinic_id::text as "clinicId",
    m.patient_id::text as "patientId",
    m.visit_id::text as "visitId",
    m.lesion_id::text as "lesionId",
    m.asset_id::text as "assetId",
    m.capture_source as "captureSource",
    m.device_id::text as "deviceId",
    m.frame_width as "frameWidth",
    m.frame_height as "frameHeight",
    m.quality_score as "qualityScore",
    m.quality_issues as "qualityIssues",
    m.scale_marker_detected as "scaleMarkerDetected",
    m.millimeters_available as "millimetersAvailable",
    m.patient_delivery_allowed as "patientDeliveryAllowed",
    m.protected_fields_exposed as "protectedFieldsExposed",
    m.created_at as "createdAt",
    m.updated_at as "updatedAt"
  from upserted m
  limit 1
) result;
`.trim();
}

export function buildUpsertLesionComparisonDraftSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  draft = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const scope = clinicScopeWhere({ alias: "lesion_comparison_decision_drafts", clinicIds, allClinics });
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with upserted as (
    insert into lesion_comparison_decision_drafts (
      clinic_id, patient_id, visit_id, doctor_user_id, lesion_id, pair_key,
      image_ids, action, comparability, reasons, patient_delivery_allowed,
      protected_fields_exposed, metadata_json
    )
    values (
      ${sqlUuid(clinicId)},
      ${sqlUuid(patientId)},
      ${sqlUuid(visitId)},
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(draft.lesionId)},
      ${sqlLiteral(draft.pairKey)},
      ${sqlTextArray(draft.imageIds)},
      ${sqlLiteral(draft.action)},
      ${sqlLiteral(draft.comparability)},
      ${sqlJsonb(draft.reasons ?? [])},
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-026",
        auditBoundary: "metadata_only",
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      })}
    )
    on conflict (visit_id, lesion_id, pair_key) do update
    set ${lesionComparisonDraftUpdateSet(draft)}
    where true ${scope}
    returning *
  )
  select ${lesionComparisonDraftColumns("d")}
  from upserted d
  limit 1
) result;
`.trim();
}

function lesionComparisonViewerQaUpdateSet(qa = {}) {
  return [
    `image_ids = ${sqlTextArray(qa.imageIds)}`,
    `technical_markers = ${sqlJsonb(qa.technicalMarkers ?? [])}`,
    `calibration_status = ${sqlLiteral(qa.calibrationStatus ?? "not_ready")}`,
    `calibration_reasons = ${sqlJsonb(qa.calibrationReasons ?? [])}`,
    `capture_metadata_status = ${sqlLiteral(qa.captureMetadataStatus ?? "needs_review")}`,
    "review_status = 'unreviewed'",
    "review_reasons = '[]'::jsonb",
    "reviewed_by_user_id = null",
    "reviewed_at = null",
    "medical_measurement_allowed = false",
    "patient_delivery_allowed = false",
    "protected_fields_exposed = false",
    `metadata_json = ${sqlJsonb({
      brainstormTask: "SD-MF-026/028",
      auditBoundary: "metadata_only",
      medicalMeasurementAllowed: false,
      patientDeliveryAllowed: false,
      protectedFieldsExposed: false,
    })}`,
    "doctor_user_id = excluded.doctor_user_id",
    "updated_at = now()",
  ].join(",\n      ");
}

export function buildUpsertLesionComparisonViewerQaSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  qa = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const scope = clinicScopeWhere({ alias: "lesion_comparison_viewer_qa_drafts", clinicIds, allClinics });
  const lesionScope = clinicScopeWhere({ alias: "l", clinicIds, allClinics });
  const assetScope = clinicScopeWhere({ alias: "a", clinicIds, allClinics });
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with target_lesion as (
    select
      l.id::text as lesion_id,
      l.clinic_id,
      l.patient_id,
      l.visit_id
    from lesions l
    where l.id::text = ${sqlLiteral(qa.lesionId)}
      and l.visit_id = ${sqlUuid(visitId)}
      and l.patient_id = ${sqlUuid(patientId)}
      and l.clinic_id = ${sqlUuid(clinicId)}
      ${lesionScope}
    limit 1
  ),
  target_assets as (
    select count(distinct a.id)::int as asset_count
    from clinical_assets a
    join target_lesion l
      on l.lesion_id = a.lesion_id::text
     and l.visit_id = a.visit_id
     and l.patient_id = a.patient_id
     and l.clinic_id = a.clinic_id
    where a.id::text = any(${sqlTextArray(qa.imageIds)})
      and a.kind in ('overview_photo', 'dermoscopy')
      and a.content_type like 'image/%'
      ${assetScope}
  ),
  target_pair as (
    select l.*
    from target_lesion l
    cross join target_assets a
    where a.asset_count = 2
  ),
  upserted as (
    insert into lesion_comparison_viewer_qa_drafts (
      clinic_id, patient_id, visit_id, doctor_user_id, lesion_id, pair_key,
      image_ids, technical_markers, calibration_status, calibration_reasons,
      capture_metadata_status, medical_measurement_allowed, patient_delivery_allowed,
      protected_fields_exposed, metadata_json
    )
    select
      p.clinic_id,
      p.patient_id,
      p.visit_id,
      ${sqlNullableUuid(doctorUserId)},
      p.lesion_id,
      ${sqlLiteral(qa.pairKey)},
      ${sqlTextArray(qa.imageIds)},
      ${sqlJsonb(qa.technicalMarkers ?? [])},
      ${sqlLiteral(qa.calibrationStatus ?? "not_ready")},
      ${sqlJsonb(qa.calibrationReasons ?? [])},
      ${sqlLiteral(qa.captureMetadataStatus ?? "needs_review")},
      false,
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-026/028",
        auditBoundary: "metadata_only",
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      })}
    from target_pair p
    on conflict (visit_id, lesion_id, pair_key) do update
    set ${lesionComparisonViewerQaUpdateSet(qa)}
    where true ${scope}
    returning *
  )
  select
    q.id::text as "id",
    q.clinic_id::text as "clinicId",
    q.patient_id::text as "patientId",
    q.visit_id::text as "visitId",
    q.doctor_user_id::text as "doctorUserId",
    q.lesion_id as "lesionId",
    q.pair_key as "pairKey",
    q.image_ids as "imageIds",
    q.technical_markers as "technicalMarkers",
    q.calibration_status as "calibrationStatus",
    q.calibration_reasons as "calibrationReasons",
    q.capture_metadata_status as "captureMetadataStatus",
    q.review_status as "reviewStatus",
    q.review_reasons as "reviewReasons",
    q.reviewed_by_user_id::text as "reviewedByUserId",
    q.reviewed_at as "reviewedAt",
    q.medical_measurement_allowed as "medicalMeasurementAllowed",
    q.patient_delivery_allowed as "patientDeliveryAllowed",
    q.protected_fields_exposed as "protectedFieldsExposed",
    q.created_at as "createdAt",
    q.updated_at as "updatedAt"
  from upserted q
  limit 1
) result;
`.trim();
}

export function buildReviewLesionComparisonViewerQaSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  review = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const draftScope = clinicScopeWhere({ alias: "q", clinicIds, allClinics });
  const lesionScope = clinicScopeWhere({ alias: "l", clinicIds, allClinics });
  const assetScope = clinicScopeWhere({ alias: "a", clinicIds, allClinics });
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with target_lesion as (
    select
      l.id::text as lesion_id,
      l.clinic_id,
      l.patient_id,
      l.visit_id
    from lesions l
    where l.id::text = ${sqlLiteral(review.lesionId)}
      and l.visit_id = ${sqlUuid(visitId)}
      and l.patient_id = ${sqlUuid(patientId)}
      and l.clinic_id = ${sqlUuid(clinicId)}
      ${lesionScope}
    limit 1
  ),
  target_assets as (
    select count(distinct a.id)::int as asset_count
    from clinical_assets a
    join target_lesion l
      on l.lesion_id = a.lesion_id::text
     and l.visit_id = a.visit_id
     and l.patient_id = a.patient_id
     and l.clinic_id = a.clinic_id
    where a.id::text = any(${sqlTextArray(review.imageIds)})
      and a.kind in ('overview_photo', 'dermoscopy')
      and a.content_type like 'image/%'
      ${assetScope}
  ),
  target_pair as (
    select l.*
    from target_lesion l
    cross join target_assets a
    where a.asset_count = 2
  ),
  reviewed as (
    update lesion_comparison_viewer_qa_drafts q
    set
      review_status = ${sqlLiteral(review.reviewStatus)},
      review_reasons = ${sqlJsonb(review.reviewReasons ?? [])},
      reviewed_by_user_id = ${sqlNullableUuid(doctorUserId)},
      reviewed_at = now(),
      medical_measurement_allowed = false,
      patient_delivery_allowed = false,
      protected_fields_exposed = false,
      metadata_json = q.metadata_json || ${sqlJsonb({
        brainstormTask: "SD-MF-026/028",
        reviewBoundary: "metadata_only",
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      })},
      updated_at = now()
    from target_pair p
    where q.visit_id = p.visit_id
      and q.patient_id = p.patient_id
      and q.clinic_id = p.clinic_id
      and q.lesion_id = p.lesion_id
      and q.pair_key = ${sqlLiteral(review.pairKey)}
      and q.image_ids @> ${sqlTextArray(review.imageIds)}
      and ${sqlTextArray(review.imageIds)} @> q.image_ids
      ${draftScope}
    returning q.*
  )
  select
    q.id::text as "id",
    q.clinic_id::text as "clinicId",
    q.patient_id::text as "patientId",
    q.visit_id::text as "visitId",
    q.doctor_user_id::text as "doctorUserId",
    q.lesion_id as "lesionId",
    q.pair_key as "pairKey",
    q.image_ids as "imageIds",
    q.technical_markers as "technicalMarkers",
    q.calibration_status as "calibrationStatus",
    q.calibration_reasons as "calibrationReasons",
    q.capture_metadata_status as "captureMetadataStatus",
    q.review_status as "reviewStatus",
    q.review_reasons as "reviewReasons",
    q.reviewed_by_user_id::text as "reviewedByUserId",
    q.reviewed_at as "reviewedAt",
    q.medical_measurement_allowed as "medicalMeasurementAllowed",
    q.patient_delivery_allowed as "patientDeliveryAllowed",
    q.protected_fields_exposed as "protectedFieldsExposed",
    q.created_at as "createdAt",
    q.updated_at as "updatedAt"
  from reviewed q
  limit 1
) result;
`.trim();
}

function viewerQaReviewQueueStatuses(status) {
  const value = String(status ?? "actionable");
  if (value === "all") {
    return ["unreviewed", "technical_ready", "needs_recapture", "not_suitable_for_comparison"];
  }
  if (value === "technical_ready") return ["technical_ready"];
  if (value === "needs_recapture") return ["needs_recapture"];
  if (value === "not_suitable_for_comparison") return ["not_suitable_for_comparison"];
  if (value === "unreviewed") return ["unreviewed"];
  return ["unreviewed", "needs_recapture", "not_suitable_for_comparison"];
}

export function buildGetVisitLesionComparisonViewerQaReviewQueueSql({
  visitId,
  patientId,
  clinicId,
  status = "actionable",
  limit = 20,
  clinicIds = [],
  allClinics = false,
} = {}) {
  const safeStatus = String(status ?? "actionable");
  const rowLimit = safeLimit(limit, 20, 100);
  const statuses = viewerQaReviewQueueStatuses(safeStatus);
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with target_visit as (
    select
      v.id,
      v.clinic_id,
      v.patient_id
    from visits v
    where v.id = ${sqlUuid(visitId)}
      and v.patient_id = ${sqlUuid(patientId)}
      and v.clinic_id = ${sqlUuid(clinicId)}
      ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
    limit 1
  ),
  scoped_rows as (
    select
      q.id,
      q.clinic_id,
      q.patient_id,
      q.visit_id,
      q.lesion_id,
      coalesce(l.label, q.lesion_id) as lesion_label,
      l.body_zone,
      l.body_surface,
      q.review_status,
      q.review_reasons,
      q.reviewed_at,
      q.reviewed_by_user_id,
      q.calibration_status,
      q.calibration_reasons,
      q.capture_metadata_status,
      jsonb_array_length(coalesce(q.technical_markers, '[]'::jsonb))::int as technical_marker_count,
      q.updated_at,
      row_number() over (order by q.updated_at desc, q.id asc)::int as queue_number
    from lesion_comparison_viewer_qa_drafts q
    join target_visit v
      on q.visit_id = v.id
     and q.patient_id = v.patient_id
     and q.clinic_id = v.clinic_id
    left join lesions l
      on l.id::text = q.lesion_id
     and l.patient_id = q.patient_id
     and l.clinic_id = q.clinic_id
    where q.review_status = any(${sqlTextArray(statuses)})
      and q.medical_measurement_allowed = false
      and q.patient_delivery_allowed = false
      and q.protected_fields_exposed = false
      ${clinicScopeWhere({ alias: "q", clinicIds, allClinics })}
  ),
  limited_rows as (
    select *
    from scoped_rows
    order by queue_number asc
    limit ${rowLimit}
  )
  select
    v.clinic_id::text as "clinicId",
    v.patient_id::text as "patientId",
    v.id::text as "visitId",
    jsonb_build_object(
      'status', ${sqlLiteral(safeStatus)},
      'limit', ${rowLimit}
    ) as "filters",
    jsonb_build_object('total', coalesce((select count(*)::int from scoped_rows), 0),
      'unreviewed', coalesce((select count(*)::int from scoped_rows where review_status = 'unreviewed'), 0),
      'technicalReady', coalesce((select count(*)::int from scoped_rows where review_status = 'technical_ready'), 0),
      'needsRecapture', coalesce((select count(*)::int from scoped_rows where review_status = 'needs_recapture'), 0),
      'notSuitableForComparison', coalesce((select count(*)::int from scoped_rows where review_status = 'not_suitable_for_comparison'), 0),
      'actionable', coalesce((select count(*)::int from scoped_rows where review_status in ('unreviewed', 'needs_recapture', 'not_suitable_for_comparison')), 0)
    ) as "summary",
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'queueNumber', r.queue_number,
        'lesionId', r.lesion_id,
        'lesionLabel', r.lesion_label,
        'bodyZone', r.body_zone,
        'bodySurface', r.body_surface,
        'review', jsonb_build_object(
          'status', r.review_status,
          'reasons', coalesce(r.review_reasons, '[]'::jsonb),
          'reviewedAt', r.reviewed_at,
          'reviewedByUserId', r.reviewed_by_user_id::text
        ),
        'calibrationStatus', r.calibration_status,
        'calibrationReasons', coalesce(r.calibration_reasons, '[]'::jsonb),
        'captureMetadataStatus', r.capture_metadata_status,
        'technicalMarkerCount', r.technical_marker_count,
        'updatedAt', r.updated_at,
        'nextAction', case
          when r.review_status = 'needs_recapture' then 'request_recapture'
          when r.review_status = 'not_suitable_for_comparison' then 'exclude_from_dynamic_review'
          when r.review_status = 'technical_ready' then 'continue_review'
          else 'review_pair'
        end
      ) order by r.queue_number asc)
      from limited_rows r
    ), '[]'::jsonb) as "items",
    jsonb_build_object(
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'pairKeysExposed', false,
      'imageIdsExposed', false,
      'clinicalConclusionGenerated', false
    ) as "boundaries"
  from target_visit v
) result;
`.trim();
}

function normalizeAssessment(row) {
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: row.visitId ? String(row.visitId) : null,
    doctorUserId: row.doctorUserId ? String(row.doctorUserId) : null,
    status: String(row.status ?? "draft"),
    riskLevel: row.riskLevel ?? null,
    abcdTotal: row.abcdTotal == null ? null : Number(row.abcdTotal),
    sevenPointTotal: row.sevenPointTotal == null ? null : Number(row.sevenPointTotal),
    summary: row.summary ?? null,
    recommendation: row.recommendation ?? null,
    signedAt: row.signedAt ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeConclusion(row) {
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: row.visitId ? String(row.visitId) : null,
    doctorUserId: row.doctorUserId ? String(row.doctorUserId) : null,
    status: String(row.status ?? "draft"),
    summary: row.summary ?? null,
    nextStep: row.nextStep ?? null,
    followUpAt: row.followUpAt ?? null,
    signedAt: row.signedAt ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeReport(row) {
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: row.visitId ? String(row.visitId) : null,
    doctorUserId: row.doctorUserId ? String(row.doctorUserId) : null,
    status: String(row.status ?? "draft"),
    physicianText: row.physicianText ?? null,
    patientSafeText: row.patientSafeText ?? null,
    signedAt: row.signedAt ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function parseStringArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  return value
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((item) => item.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function parseObjectArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeLesionComparisonDraft(row) {
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: row.visitId ? String(row.visitId) : null,
    doctorUserId: row.doctorUserId ? String(row.doctorUserId) : null,
    lesionId: String(row.lesionId ?? ""),
    pairKey: String(row.pairKey ?? ""),
    imageIds: parseStringArray(row.imageIds).slice(0, 2),
    action: String(row.action ?? "retake"),
    comparability: String(row.comparability ?? "not_comparable"),
    reasons: parseJsonArray(row.reasons),
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeAssetCaptureMetadata(row) {
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: row.visitId ? String(row.visitId) : null,
    lesionId: row.lesionId ? String(row.lesionId) : null,
    assetId: String(row.assetId ?? ""),
    captureSource: String(row.captureSource ?? "unknown"),
    deviceId: row.deviceId ? String(row.deviceId) : null,
    frame: {
      width: row.frameWidth == null ? null : Number(row.frameWidth),
      height: row.frameHeight == null ? null : Number(row.frameHeight),
    },
    quality: {
      score: row.qualityScore == null ? null : Number(row.qualityScore),
      issues: parseStringArray(row.qualityIssues),
    },
    calibration: {
      scaleMarkerDetected: Boolean(row.scaleMarkerDetected),
      millimetersAvailable: Boolean(row.millimetersAvailable),
    },
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeCaptureMetadataSummary(value) {
  const source = parseJsonObject(value);
  return {
    assetCount: numberOrZero(source.assetCount),
    metadataCount: numberOrZero(source.metadataCount),
    missingMetadataCount: numberOrZero(source.missingMetadataCount),
    readyForTechnicalCompareCount: numberOrZero(source.readyForTechnicalCompareCount),
    scaleReadyCount: numberOrZero(source.scaleReadyCount),
  };
}

function normalizeCaptureMetadataItem(row) {
  const status = String(row.technicalStatus ?? "missing");
  return {
    assetId: String(row.assetId ?? ""),
    visitId: row.visitId ? String(row.visitId) : null,
    kind: String(row.kind ?? ""),
    contentType: row.contentType ?? null,
    capturedAt: row.capturedAt ?? null,
    captureSource: String(row.captureSource ?? "unknown"),
    deviceId: row.deviceId ? String(row.deviceId) : null,
    deviceProfile: row.deviceProfile ? String(row.deviceProfile) : null,
    frame: {
      width: row.frameWidth == null ? null : Number(row.frameWidth),
      height: row.frameHeight == null ? null : Number(row.frameHeight),
    },
    quality: {
      score: row.qualityScore == null ? null : Number(row.qualityScore),
      issues: parseStringArray(row.qualityIssues),
    },
    calibration: {
      scaleMarkerDetected: Boolean(row.scaleMarkerDetected),
      millimetersAvailable: Boolean(row.millimetersAvailable),
    },
    technicalStatus: status === "ready" || status === "warning" ? status : "missing",
    technicalReasons: parseJsonArray(row.technicalReasons),
  };
}

function normalizeLesionCaptureMetadata(row) {
  return {
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    lesionId: String(row.lesionId ?? ""),
    summary: normalizeCaptureMetadataSummary(row.summary),
    items: parseObjectArray(row.items).map(normalizeCaptureMetadataItem),
    boundaries: {
      patientDeliveryAllowed: false,
      protectedFieldsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      rawImageBytesExposed: false,
      doctorOnlyTextExposed: false,
      clinicalConclusionGenerated: false,
    },
  };
}

function normalizeTechnicalMarker(row) {
  const target = row.target === "B" ? "B" : "A";
  return {
    target,
    xPercent: Number(row.xPercent ?? 0),
    yPercent: Number(row.yPercent ?? 0),
  };
}

function normalizeLesionComparisonViewerQa(row) {
  const calibrationStatus = String(row.calibrationStatus ?? "not_ready");
  const captureMetadataStatus = String(row.captureMetadataStatus ?? "needs_review");
  const reviewStatus = String(row.reviewStatus ?? "unreviewed");
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: row.visitId ? String(row.visitId) : null,
    doctorUserId: row.doctorUserId ? String(row.doctorUserId) : null,
    lesionId: String(row.lesionId ?? ""),
    pairKey: String(row.pairKey ?? ""),
    imageIds: parseStringArray(row.imageIds).slice(0, 2),
    technicalMarkers: parseObjectArray(row.technicalMarkers).slice(0, 2).map(normalizeTechnicalMarker),
    calibrationStatus:
      calibrationStatus === "ready" || calibrationStatus === "limited" ? calibrationStatus : "not_ready",
    calibrationReasons: parseJsonArray(row.calibrationReasons),
    captureMetadataStatus:
      captureMetadataStatus === "ready" || captureMetadataStatus === "missing" ? captureMetadataStatus : "needs_review",
    review: {
      status:
        reviewStatus === "technical_ready"
          || reviewStatus === "needs_recapture"
          || reviewStatus === "not_suitable_for_comparison"
          ? reviewStatus
          : "unreviewed",
      reasons: parseJsonArray(row.reviewReasons),
      reviewedAt: row.reviewedAt ?? null,
      reviewedByUserId: row.reviewedByUserId ? String(row.reviewedByUserId) : null,
    },
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeViewerQaReviewQueueSummary(value) {
  const source = parseJsonObject(value);
  return {
    total: numberOrZero(source.total),
    unreviewed: numberOrZero(source.unreviewed),
    technicalReady: numberOrZero(source.technicalReady),
    needsRecapture: numberOrZero(source.needsRecapture),
    notSuitableForComparison: numberOrZero(source.notSuitableForComparison),
    actionable: numberOrZero(source.actionable),
  };
}

function normalizeViewerQaReviewQueueItem(row) {
  const review = parseJsonObject(row.review);
  const reviewStatus = String(review.status ?? row.reviewStatus ?? "unreviewed");
  const nextAction = String(row.nextAction ?? "review_pair");
  return {
    queueNumber: numberOrZero(row.queueNumber),
    lesionId: String(row.lesionId ?? ""),
    lesionLabel: String(row.lesionLabel ?? row.lesionId ?? ""),
    bodyZone: row.bodyZone ? String(row.bodyZone) : null,
    bodySurface: row.bodySurface ? String(row.bodySurface) : null,
    review: {
      status:
        reviewStatus === "technical_ready"
          || reviewStatus === "needs_recapture"
          || reviewStatus === "not_suitable_for_comparison"
          ? reviewStatus
          : "unreviewed",
      reasons: parseJsonArray(review.reasons ?? row.reviewReasons),
      reviewedAt: review.reviewedAt ?? row.reviewedAt ?? null,
      reviewedByUserId: review.reviewedByUserId || row.reviewedByUserId ? String(review.reviewedByUserId ?? row.reviewedByUserId) : null,
    },
    calibrationStatus: String(row.calibrationStatus ?? "not_ready"),
    calibrationReasons: parseJsonArray(row.calibrationReasons),
    captureMetadataStatus: String(row.captureMetadataStatus ?? "needs_review"),
    technicalMarkerCount: numberOrZero(row.technicalMarkerCount),
    updatedAt: row.updatedAt ?? null,
    nextAction:
      nextAction === "request_recapture"
        || nextAction === "exclude_from_dynamic_review"
        || nextAction === "continue_review"
        ? nextAction
        : "review_pair",
  };
}

function normalizeVisitLesionComparisonViewerQaReviewQueue(row) {
  const filters = parseJsonObject(row.filters);
  const status = String(filters.status ?? "actionable");
  return {
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: String(row.visitId ?? ""),
    filters: {
      status,
      limit: safeLimit(filters.limit, 20, 100),
    },
    summary: normalizeViewerQaReviewQueueSummary(row.summary),
    items: parseObjectArray(row.items).map(normalizeViewerQaReviewQueueItem),
    boundaries: {
      patientDeliveryAllowed: false,
      medicalMeasurementAllowed: false,
      protectedFieldsExposed: false,
      pairKeysExposed: false,
      imageIdsExposed: false,
      clinicalConclusionGenerated: false,
    },
  };
}

function normalizeLongitudinalSummary(value) {
  const source = parseJsonObject(value);
  return {
    visitCount: numberOrZero(source.visitCount),
    imageCount: numberOrZero(source.imageCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    comparablePairCount: numberOrZero(source.comparablePairCount),
    warningPairCount: numberOrZero(source.warningPairCount),
    blockedPairCount: numberOrZero(source.blockedPairCount),
    assessmentCount: numberOrZero(source.assessmentCount),
  };
}

function normalizeLongitudinalVisit(row) {
  return {
    visitId: String(row.visitId ?? ""),
    startedAt: row.startedAt ?? null,
    signedAt: row.signedAt ?? null,
    status: String(row.status ?? "draft"),
    imageCount: numberOrZero(row.imageCount),
    dermoscopyCount: numberOrZero(row.dermoscopyCount),
    overviewCount: numberOrZero(row.overviewCount),
    assessmentCount: numberOrZero(row.assessmentCount),
    capturedAtFirst: row.capturedAtFirst ?? null,
    capturedAtLast: row.capturedAtLast ?? null,
  };
}

function normalizeLongitudinalPair(row) {
  const status = String(row.status ?? "blocked");
  return {
    previousVisitId: String(row.previousVisitId ?? ""),
    currentVisitId: String(row.currentVisitId ?? ""),
    previousImageId: String(row.previousImageId ?? ""),
    currentImageId: String(row.currentImageId ?? ""),
    kind: String(row.kind ?? ""),
    status: status === "ready" || status === "warning" ? status : "blocked",
    reasons: parseJsonArray(row.reasons),
  };
}

function normalizeLesionLongitudinalHistory(row) {
  return {
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    lesionId: String(row.lesionId ?? ""),
    label: row.label ?? null,
    bodyZone: row.bodyZone ?? null,
    bodySurface: row.bodySurface ?? null,
    status: String(row.status ?? "active"),
    summary: normalizeLongitudinalSummary(row.summary),
    visits: parseObjectArray(row.visits).map(normalizeLongitudinalVisit),
    candidatePairs: parseObjectArray(row.candidatePairs).map(normalizeLongitudinalPair),
    boundaries: {
      patientDeliveryAllowed: false,
      protectedFieldsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      rawImageBytesExposed: false,
      doctorOnlyTextExposed: false,
      clinicalConclusionGenerated: false,
    },
  };
}

function normalizeProtectedLesionImageAsset(row) {
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: row.visitId ? String(row.visitId) : null,
    lesionId: row.lesionId ? String(row.lesionId) : null,
    kind: String(row.kind ?? "overview_photo"),
    contentType: row.contentType ?? null,
    byteSize: row.byteSize == null ? null : Number(row.byteSize),
    capturedAt: row.capturedAt ?? null,
    objectBucket: row.objectBucket ? String(row.objectBucket) : "",
    objectKey: row.objectKey ? String(row.objectKey) : "",
    patientDeliveryAllowed: false,
    signedUrlsIssued: false,
    storagePathsExposed: false,
    rawImageBytesExposedInJson: false,
  };
}

async function queryOne(dbClient, sql, normalize) {
  const rows = await dbClient.queryJson(sql);
  return Array.isArray(rows) && rows[0] ? normalize(rows[0]) : null;
}

export function createClinicalWorkspaceRepository(dbClient) {
  return {
    async getAssessment(params) {
      return queryOne(dbClient, buildGetVisitAssessmentSql(params), normalizeAssessment);
    },
    async upsertAssessment(params) {
      return queryOne(dbClient, buildUpsertVisitAssessmentSql(params), normalizeAssessment);
    },
    async getConclusion(params) {
      return queryOne(dbClient, buildGetVisitConclusionSql(params), normalizeConclusion);
    },
    async upsertConclusion(params) {
      return queryOne(dbClient, buildUpsertVisitConclusionSql(params), normalizeConclusion);
    },
    async getReport(params) {
      return queryOne(dbClient, buildGetVisitReportSql(params), normalizeReport);
    },
    async upsertLesionComparisonDraft(params) {
      return queryOne(dbClient, buildUpsertLesionComparisonDraftSql(params), normalizeLesionComparisonDraft);
    },
    async upsertAssetCaptureMetadata(params) {
      return queryOne(dbClient, buildUpsertAssetCaptureMetadataSql(params), normalizeAssetCaptureMetadata);
    },
    async getLesionCaptureMetadata(params) {
      return queryOne(dbClient, buildGetLesionCaptureMetadataSql(params), normalizeLesionCaptureMetadata);
    },
    async upsertLesionComparisonViewerQa(params) {
      return queryOne(dbClient, buildUpsertLesionComparisonViewerQaSql(params), normalizeLesionComparisonViewerQa);
    },
    async reviewLesionComparisonViewerQa(params) {
      return queryOne(dbClient, buildReviewLesionComparisonViewerQaSql(params), normalizeLesionComparisonViewerQa);
    },
    async getVisitLesionComparisonViewerQaReviewQueue(params) {
      return queryOne(
        dbClient,
        buildGetVisitLesionComparisonViewerQaReviewQueueSql(params),
        normalizeVisitLesionComparisonViewerQaReviewQueue,
      );
    },
    async getLesionLongitudinalHistory(params) {
      return queryOne(dbClient, buildGetLesionLongitudinalHistorySql(params), normalizeLesionLongitudinalHistory);
    },
    async getProtectedLesionImageAsset(params) {
      return queryOne(dbClient, buildGetProtectedLesionImageAssetSql(params), normalizeProtectedLesionImageAsset);
    },
  };
}

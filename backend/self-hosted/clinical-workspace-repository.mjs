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

export function buildGetLesionLongitudinalQaSql({
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
      l.label
    from lesions l
    where l.patient_id = ${sqlUuid(patientId)}
      and l.id = ${sqlUuid(lesionId)}
      ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
    limit 1
  ),
  lesion_assets as (
    select
      a.id,
      a.clinic_id,
      a.patient_id,
      a.visit_id,
      a.kind::text as kind,
      a.content_type,
      case
        when a.object_bucket is null or a.object_key is null then 'needs_review'
        when coalesce(a.byte_size, 0) <= 0 then 'needs_review'
        when a.captured_at is null then 'needs_review'
        else 'ready'
      end as production_asset_status,
      a.created_at,
      m.asset_id as metadata_asset_id,
      m.capture_protocol_status,
      case
        when m.asset_id is null or coalesce(m.capture_source, 'unknown') <> 'device_bridge' then 'not_applicable'
        when m.device_id is null then 'needs_review'
        when d.id is null then 'needs_review'
        when d.status <> 'connected' then 'needs_review'
        when d.calibration_due_at is not null and d.calibration_due_at <= current_date then 'needs_review'
        when b.id is null then 'needs_review'
        when b.lan_status <> 'online' then 'needs_review'
        when coalesce(b.worker_status, 'unknown') <> 'online' then 'needs_review'
        when b.worker_last_seen_at is null or b.worker_last_seen_at < now() - interval '15 minutes' then 'needs_review'
        else 'ready'
      end as device_bridge_quality_status,
      case
        when m.asset_id is null then 'missing'
        when m.device_id is null then 'needs_review'
        when m.frame_width is null or m.frame_height is null then 'needs_review'
        when coalesce(m.quality_score, 0) < 75 then 'needs_review'
        when cardinality(coalesce(m.quality_issues, array[]::text[])) > 0 then 'needs_review'
        when coalesce(m.device_evidence_status, 'missing') <> 'ready' then 'needs_review'
        when coalesce(m.capture_protocol_status, 'missing') <> 'ready' then 'needs_review'
        else 'ready'
      end as capture_metadata_status
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
     and d.deleted_at is null
    left join device_bridges b
      on b.id = d.bridge_id
     and b.clinic_id = a.clinic_id
    where a.visit_id is not null
      and a.kind in ('overview_photo', 'dermoscopy')
      and a.content_type like 'image/%'
  ),
  qa_rows as (
    select
      q.review_status,
      q.calibration_status,
      q.capture_metadata_status,
      q.measurement_policy_status,
      q.production_analysis_policy_status,
      q.reviewer_assignment_status,
      q.second_review_status,
      jsonb_array_length(coalesce(q.technical_markers, '[]'::jsonb))::int as technical_marker_count
    from lesion_comparison_viewer_qa_drafts q
    join target_lesion l
      on l.id::text = q.lesion_id
     and l.patient_id = q.patient_id
     and l.clinic_id = q.clinic_id
    where q.medical_measurement_allowed = false
      and q.patient_delivery_allowed = false
      and q.protected_fields_exposed = false
      ${clinicScopeWhere({ alias: "q", clinicIds, allClinics })}
  ),
  rollup as (
    select
      coalesce((select count(distinct visit_id)::int from lesion_assets), 0) as visit_count,
      coalesce((select count(*)::int from lesion_assets), 0) as image_count,
      coalesce((select count(*)::int from qa_rows), 0) as candidate_pair_count,
      coalesce((select count(*)::int from qa_rows where review_status <> 'unreviewed'), 0) as reviewed_pair_count,
      coalesce((select count(*)::int from qa_rows where review_status = 'technical_ready'), 0) as technical_ready_pair_count,
      coalesce((select count(*)::int from qa_rows where review_status = 'needs_recapture'), 0) as needs_recapture_count,
      coalesce((select count(*)::int from qa_rows where review_status = 'not_suitable_for_comparison'), 0) as not_suitable_for_comparison_count,
      coalesce((select count(*)::int from qa_rows where review_status = 'unreviewed'), 0) as unreviewed_pair_count,
      coalesce((select count(*)::int from lesion_assets where production_asset_status <> 'ready'), 0) as production_asset_not_ready_count,
      coalesce((select count(*)::int from lesion_assets where capture_metadata_status = 'missing'), 0) as missing_capture_metadata_count,
      coalesce((select count(*)::int from lesion_assets where metadata_asset_id is not null and capture_metadata_status <> 'ready'), 0) as device_evidence_not_ready_count,
      coalesce((select count(*)::int from lesion_assets where device_bridge_quality_status = 'needs_review'), 0) as device_bridge_quality_not_ready_count,
      coalesce((select count(*)::int from lesion_assets where metadata_asset_id is not null and coalesce(capture_protocol_status, 'missing') <> 'ready'), 0) as capture_protocol_not_ready_count,
      coalesce((select count(*)::int from qa_rows where calibration_status <> 'ready'), 0) as calibration_blocked_count,
      coalesce((select count(*)::int from qa_rows where technical_marker_count < 2), 0) as marker_missing_count,
      coalesce((select count(*)::int from qa_rows where review_status = 'technical_ready' and measurement_policy_status <> 'approved_for_technical_review'), 0) as measurement_policy_not_ready_count,
      coalesce((select count(*)::int from qa_rows where review_status = 'technical_ready' and measurement_policy_status = 'approved_for_technical_review' and production_analysis_policy_status <> 'approved_for_production_analysis'), 0) as production_analysis_policy_not_ready_count,
      coalesce((select count(*)::int from qa_rows where review_status = 'technical_ready' and measurement_policy_status = 'approved_for_technical_review' and production_analysis_policy_status = 'approved_for_production_analysis' and reviewer_assignment_status not in ('assigned', 'second_review_assigned', 'second_review_completed')), 0) as reviewer_assignment_not_ready_count,
      coalesce((select count(*)::int from qa_rows where second_review_status in ('required', 'assigned', 'blocked')), 0) as second_review_not_ready_count
  ),
  readiness as (
    select
      *,
      case
        when candidate_pair_count = 0
          or needs_recapture_count > 0
          or not_suitable_for_comparison_count > 0
          or production_asset_not_ready_count > 0
          or missing_capture_metadata_count > 0
          or device_evidence_not_ready_count > 0
          or device_bridge_quality_not_ready_count > 0
          or capture_protocol_not_ready_count > 0
          or calibration_blocked_count > 0
          or marker_missing_count > 0
          or measurement_policy_not_ready_count > 0
          or production_analysis_policy_not_ready_count > 0
          or reviewer_assignment_not_ready_count > 0
          or second_review_not_ready_count > 0 then 'blocked'
        when unreviewed_pair_count > 0 then 'needs_review'
        else 'technical_ready'
      end as status,
      (
        candidate_pair_count > 0
        and technical_ready_pair_count = candidate_pair_count
        and needs_recapture_count = 0
        and not_suitable_for_comparison_count = 0
        and unreviewed_pair_count = 0
        and production_asset_not_ready_count = 0
        and missing_capture_metadata_count = 0
        and device_evidence_not_ready_count = 0
        and device_bridge_quality_not_ready_count = 0
        and capture_protocol_not_ready_count = 0
        and calibration_blocked_count = 0
        and marker_missing_count = 0
        and measurement_policy_not_ready_count = 0
        and production_analysis_policy_not_ready_count = 0
        and reviewer_assignment_not_ready_count = 0
        and second_review_not_ready_count = 0
      ) as technical_rollout_ready
    from rollup
  )
  select
    l.clinic_id::text as "clinicId",
    l.patient_id::text as "patientId",
    l.id::text as "lesionId",
    l.label as "label",
    jsonb_build_object(
      'status', r.status,
      'visitCount', r.visit_count,
      'imageCount', r.image_count,
      'candidatePairCount', r.candidate_pair_count,
      'reviewedPairCount', r.reviewed_pair_count,
      'technicalReadyPairCount', r.technical_ready_pair_count,
      'needsRecaptureCount', r.needs_recapture_count,
      'notSuitableForComparisonCount', r.not_suitable_for_comparison_count,
      'unreviewedPairCount', r.unreviewed_pair_count,
      'productionAssetNotReadyCount', r.production_asset_not_ready_count,
      'missingCaptureMetadataCount', r.missing_capture_metadata_count,
      'deviceEvidenceNotReadyCount', r.device_evidence_not_ready_count,
      'deviceBridgeQualityNotReadyCount', r.device_bridge_quality_not_ready_count,
      'captureProtocolNotReadyCount', r.capture_protocol_not_ready_count,
      'calibrationBlockedCount', r.calibration_blocked_count,
      'markerMissingCount', r.marker_missing_count,
      'measurementPolicyNotReadyCount', r.measurement_policy_not_ready_count,
      'productionAnalysisPolicyNotReadyCount', r.production_analysis_policy_not_ready_count,
      'reviewerAssignmentNotReadyCount', r.reviewer_assignment_not_ready_count,
      'secondReviewNotReadyCount', r.second_review_not_ready_count,
      'technicalRolloutReady', r.technical_rollout_ready,
      'dynamicConclusionAllowed', false
    ) as "readiness",
    jsonb_build_array(
      jsonb_build_object('code', 'no_candidate_pairs', 'label', 'Нет пар для продольного QA', 'count', case when r.candidate_pair_count = 0 then 1 else 0 end, 'nextAction', 'review_queue'),
      jsonb_build_object('code', 'recapture_required', 'label', 'Нужен переснимок', 'count', r.needs_recapture_count, 'nextAction', 'request_recapture'),
      jsonb_build_object('code', 'not_suitable_for_comparison', 'label', 'Не использовать для динамики', 'count', r.not_suitable_for_comparison_count, 'nextAction', 'exclude_from_dynamic_review'),
      jsonb_build_object('code', 'unreviewed_pairs', 'label', 'Нужен технический review', 'count', r.unreviewed_pair_count, 'nextAction', 'review_queue'),
      jsonb_build_object('code', 'production_asset_not_ready', 'label', 'Production asset требует проверки', 'count', r.production_asset_not_ready_count, 'nextAction', 'verify_production_asset'),
      jsonb_build_object('code', 'missing_capture_metadata', 'label', 'Не хватает metadata съёмки', 'count', r.missing_capture_metadata_count, 'nextAction', 'complete_capture_metadata'),
      jsonb_build_object('code', 'device_metadata_not_ready', 'label', 'Device metadata требует проверки', 'count', r.device_evidence_not_ready_count, 'nextAction', 'complete_device_metadata'),
      jsonb_build_object('code', 'device_bridge_quality_not_ready', 'label', 'Device Bridge требует проверки', 'count', r.device_bridge_quality_not_ready_count, 'nextAction', 'check_device_bridge'),
      jsonb_build_object('code', 'capture_protocol_not_ready', 'label', 'Протокол съёмки требует проверки', 'count', r.capture_protocol_not_ready_count, 'nextAction', 'complete_capture_protocol'),
      jsonb_build_object('code', 'calibration_not_ready', 'label', 'Калибровка не готова', 'count', r.calibration_blocked_count, 'nextAction', 'complete_calibration'),
      jsonb_build_object('code', 'technical_markers_missing', 'label', 'Не хватает технических маркеров', 'count', r.marker_missing_count, 'nextAction', 'place_markers'),
      jsonb_build_object('code', 'measurement_policy_required', 'label', 'Нужна политика измерений', 'count', r.measurement_policy_not_ready_count, 'nextAction', 'approve_measurement_policy'),
      jsonb_build_object('code', 'production_analysis_policy_required', 'label', 'Нужна production analysis policy', 'count', r.production_analysis_policy_not_ready_count, 'nextAction', 'approve_production_analysis_policy'),
      jsonb_build_object('code', 'reviewer_assignment_required', 'label', 'Нужно назначить reviewer', 'count', r.reviewer_assignment_not_ready_count, 'nextAction', 'assign_reviewer'),
      jsonb_build_object('code', 'second_review_required', 'label', 'Нужен второй review', 'count', r.second_review_not_ready_count, 'nextAction', 'complete_second_review')
    ) as "blockers",
    array_remove(array[
      case when r.candidate_pair_count = 0 or r.unreviewed_pair_count > 0 then 'review_queue' end,
      case when r.needs_recapture_count > 0 then 'request_recapture' end,
      case when r.not_suitable_for_comparison_count > 0 then 'exclude_from_dynamic_review' end,
      case when r.production_asset_not_ready_count > 0 then 'verify_production_asset' end,
      case when r.missing_capture_metadata_count > 0 then 'complete_capture_metadata' end,
      case when r.device_evidence_not_ready_count > 0 then 'complete_device_metadata' end,
      case when r.device_bridge_quality_not_ready_count > 0 then 'check_device_bridge' end,
      case when r.capture_protocol_not_ready_count > 0 then 'complete_capture_protocol' end,
      case when r.calibration_blocked_count > 0 then 'complete_calibration' end,
      case when r.marker_missing_count > 0 then 'place_markers' end,
      case when r.measurement_policy_not_ready_count > 0 then 'approve_measurement_policy' end,
      case when r.production_analysis_policy_not_ready_count > 0 then 'approve_production_analysis_policy' end,
      case when r.reviewer_assignment_not_ready_count > 0 then 'assign_reviewer' end,
      case when r.second_review_not_ready_count > 0 then 'complete_second_review' end,
      case when r.technical_rollout_ready then 'continue_review' end
    ]::text[], null) as "nextActions",
    jsonb_build_object(
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'pairKeysExposed', false,
      'imageIdsExposed', false,
      'storagePathsExposed', false,
      'signedUrlsIssued', false,
      'rawImageBytesExposed', false,
      'doctorOnlyTextExposed', false,
      'clinicalConclusionGenerated', false
    ) as "boundaries",
    'lesion_longitudinal_qa.read' as "auditAction"
  from target_lesion l
  cross join readiness r
) result;
`.trim();
}

export function buildGetVisitLongitudinalDatasetValidationSql({
  visitId,
  patientId,
  clinicId,
  clinicIds = [],
  allClinics = false,
} = {}) {
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
  target_lesions as (
    select
      l.id,
      l.clinic_id,
      l.patient_id,
      l.label,
      l.body_zone,
      l.body_surface
    from lesions l
    join target_visit v
      on l.visit_id = v.id
     and l.patient_id = v.patient_id
     and l.clinic_id = v.clinic_id
    ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
  ),
  lesion_assets as (
    select
      a.id,
      a.lesion_id,
      a.visit_id,
      case
        when a.object_bucket is null or a.object_key is null then 'needs_review'
        when coalesce(a.byte_size, 0) <= 0 then 'needs_review'
        when a.captured_at is null then 'needs_review'
        else 'ready'
      end as production_asset_status,
      m.asset_id as metadata_asset_id,
      m.capture_protocol_status,
      case
        when m.asset_id is null or coalesce(m.capture_source, 'unknown') <> 'device_bridge' then 'not_applicable'
        when m.device_id is null then 'needs_review'
        when d.id is null then 'needs_review'
        when d.status <> 'connected' then 'needs_review'
        when d.calibration_due_at is not null and d.calibration_due_at <= current_date then 'needs_review'
        when b.id is null then 'needs_review'
        when b.lan_status <> 'online' then 'needs_review'
        when coalesce(b.worker_status, 'unknown') <> 'online' then 'needs_review'
        when b.worker_last_seen_at is null or b.worker_last_seen_at < now() - interval '15 minutes' then 'needs_review'
        else 'ready'
      end as device_bridge_quality_status,
      case
        when m.asset_id is null then 'missing'
        when m.device_id is null then 'needs_review'
        when m.frame_width is null or m.frame_height is null then 'needs_review'
        when coalesce(m.quality_score, 0) < 75 then 'needs_review'
        when cardinality(coalesce(m.quality_issues, array[]::text[])) > 0 then 'needs_review'
        when coalesce(m.device_evidence_status, 'missing') <> 'ready' then 'needs_review'
        when coalesce(m.capture_protocol_status, 'missing') <> 'ready' then 'needs_review'
        else 'ready'
      end as capture_metadata_status
    from clinical_assets a
    join target_lesions l
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
     and d.deleted_at is null
    left join device_bridges b
      on b.id = d.bridge_id
     and b.clinic_id = a.clinic_id
    where a.kind in ('overview_photo', 'dermoscopy')
      and a.content_type like 'image/%'
      ${clinicScopeWhere({ alias: "a", clinicIds, allClinics })}
  ),
  qa_rows as (
    select
      q.lesion_id,
      q.review_status,
      q.calibration_status,
      q.capture_metadata_status,
      q.reviewer_workflow_status,
      q.measurement_policy_status,
      q.production_analysis_policy_status,
      q.reviewer_assignment_status,
      q.second_review_status,
      jsonb_array_length(coalesce(q.technical_markers, '[]'::jsonb))::int as technical_marker_count
    from lesion_comparison_viewer_qa_drafts q
    join target_lesions l
      on l.id::text = q.lesion_id
     and l.patient_id = q.patient_id
     and l.clinic_id = q.clinic_id
    where q.medical_measurement_allowed = false
      and q.patient_delivery_allowed = false
      and q.protected_fields_exposed = false
      ${clinicScopeWhere({ alias: "q", clinicIds, allClinics })}
  ),
  lesion_rollup as (
    select
      l.id::text as lesion_id,
      coalesce(l.label, l.id::text) as lesion_label,
      l.body_zone,
      l.body_surface,
      coalesce((select count(distinct visit_id)::int from lesion_assets a where a.lesion_id = l.id), 0) as visit_count,
      coalesce((select count(*)::int from lesion_assets a where a.lesion_id = l.id), 0) as image_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text), 0) as candidate_pair_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.review_status <> 'unreviewed'), 0) as reviewed_pair_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.review_status = 'technical_ready'), 0) as technical_ready_pair_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.review_status = 'needs_recapture'), 0) as needs_recapture_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.review_status = 'not_suitable_for_comparison'), 0) as not_suitable_for_comparison_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.review_status = 'unreviewed'), 0) as unreviewed_pair_count,
      coalesce((select count(*)::int from lesion_assets a where a.lesion_id = l.id and a.production_asset_status <> 'ready'), 0) as production_asset_not_ready_count,
      coalesce((select count(*)::int from lesion_assets a where a.lesion_id = l.id and a.capture_metadata_status = 'missing'), 0) as missing_capture_metadata_count,
      coalesce((select count(*)::int from lesion_assets a where a.lesion_id = l.id and a.metadata_asset_id is not null and a.capture_metadata_status <> 'ready'), 0) as device_evidence_not_ready_count,
      coalesce((select count(*)::int from lesion_assets a where a.lesion_id = l.id and a.device_bridge_quality_status = 'needs_review'), 0) as device_bridge_quality_not_ready_count,
      coalesce((select count(*)::int from lesion_assets a where a.lesion_id = l.id and a.metadata_asset_id is not null and coalesce(a.capture_protocol_status, 'missing') <> 'ready'), 0) as capture_protocol_not_ready_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.calibration_status <> 'ready'), 0) as calibration_blocked_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.technical_marker_count < 2), 0) as marker_missing_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.review_status = 'technical_ready' and q.measurement_policy_status <> 'approved_for_technical_review'), 0) as measurement_policy_not_ready_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.review_status = 'technical_ready' and q.measurement_policy_status = 'approved_for_technical_review' and q.production_analysis_policy_status <> 'approved_for_production_analysis'), 0) as production_analysis_policy_not_ready_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.review_status = 'technical_ready' and q.measurement_policy_status = 'approved_for_technical_review' and q.production_analysis_policy_status = 'approved_for_production_analysis' and q.reviewer_assignment_status not in ('assigned', 'second_review_assigned', 'second_review_completed')), 0) as reviewer_assignment_not_ready_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.second_review_status in ('required', 'assigned', 'blocked')), 0) as second_review_not_ready_count,
      coalesce((select count(*)::int from qa_rows q where q.lesion_id = l.id::text and q.reviewer_workflow_status in ('ready_for_reviewer', 'reviewer_accepted')), 0) as reviewer_workflow_ready_count
    from target_lesions l
  ),
  classified as (
    select
      *,
      case
        when candidate_pair_count = 0
          or needs_recapture_count > 0
          or not_suitable_for_comparison_count > 0
          or production_asset_not_ready_count > 0
          or missing_capture_metadata_count > 0
          or device_evidence_not_ready_count > 0
          or device_bridge_quality_not_ready_count > 0
          or capture_protocol_not_ready_count > 0
          or calibration_blocked_count > 0
          or marker_missing_count > 0
          or measurement_policy_not_ready_count > 0
          or production_analysis_policy_not_ready_count > 0
          or reviewer_assignment_not_ready_count > 0
          or second_review_not_ready_count > 0 then 'blocked'
        when unreviewed_pair_count > 0 then 'needs_review'
        else 'ready_for_rollout'
      end as status,
      case
        when candidate_pair_count = 0 or unreviewed_pair_count > 0 then 'review_queue'
        when needs_recapture_count > 0 then 'request_recapture'
        when not_suitable_for_comparison_count > 0 then 'exclude_from_dynamic_review'
        when production_asset_not_ready_count > 0 then 'verify_production_asset'
        when missing_capture_metadata_count > 0 then 'complete_capture_metadata'
        when device_evidence_not_ready_count > 0 then 'complete_device_metadata'
        when device_bridge_quality_not_ready_count > 0 then 'check_device_bridge'
        when capture_protocol_not_ready_count > 0 then 'complete_capture_protocol'
        when calibration_blocked_count > 0 then 'complete_calibration'
        when marker_missing_count > 0 then 'place_markers'
        when measurement_policy_not_ready_count > 0 then 'approve_measurement_policy'
        when production_analysis_policy_not_ready_count > 0 then 'approve_production_analysis_policy'
        when reviewer_assignment_not_ready_count > 0 then 'assign_reviewer'
        when second_review_not_ready_count > 0 then 'complete_second_review'
        else 'continue_review'
      end as next_action
    from lesion_rollup
  ),
  blocker_rows as (
    select 'no_candidate_pairs' as code, 'Нет пар для продольного QA' as label, 'review_queue' as next_action,
      coalesce((select count(*)::int from classified where candidate_pair_count = 0), 0) as count
    union all
    select 'recapture_required', 'Нужен переснимок', 'request_recapture',
      coalesce((select sum(needs_recapture_count)::int from classified), 0)
    union all
    select 'not_suitable_for_comparison', 'Не использовать для динамики', 'exclude_from_dynamic_review',
      coalesce((select sum(not_suitable_for_comparison_count)::int from classified), 0)
    union all
    select 'unreviewed_pairs', 'Нужен технический review', 'review_queue',
      coalesce((select sum(unreviewed_pair_count)::int from classified), 0)
    union all
    select 'production_asset_not_ready', 'Production asset требует проверки', 'verify_production_asset',
      coalesce((select sum(production_asset_not_ready_count)::int from classified), 0)
    union all
    select 'missing_capture_metadata', 'Не хватает metadata съёмки', 'complete_capture_metadata',
      coalesce((select sum(missing_capture_metadata_count)::int from classified), 0)
    union all
    select 'device_metadata_not_ready', 'Device metadata требует проверки', 'complete_device_metadata',
      coalesce((select sum(device_evidence_not_ready_count)::int from classified), 0)
    union all
    select 'device_bridge_quality_not_ready', 'Device Bridge требует проверки', 'check_device_bridge',
      coalesce((select sum(device_bridge_quality_not_ready_count)::int from classified), 0)
    union all
    select 'capture_protocol_not_ready', 'Протокол съёмки требует проверки', 'complete_capture_protocol',
      coalesce((select sum(capture_protocol_not_ready_count)::int from classified), 0)
    union all
    select 'calibration_not_ready', 'Калибровка не готова', 'complete_calibration',
      coalesce((select sum(calibration_blocked_count)::int from classified), 0)
    union all
    select 'technical_markers_missing', 'Не хватает технических маркеров', 'place_markers',
      coalesce((select sum(marker_missing_count)::int from classified), 0)
    union all
    select 'measurement_policy_required', 'Нужна политика измерений', 'approve_measurement_policy',
      coalesce((select sum(measurement_policy_not_ready_count)::int from classified), 0)
    union all
    select 'production_analysis_policy_required', 'Нужна production analysis policy', 'approve_production_analysis_policy',
      coalesce((select sum(production_analysis_policy_not_ready_count)::int from classified), 0)
    union all
    select 'reviewer_assignment_required', 'Нужно назначить reviewer', 'assign_reviewer',
      coalesce((select sum(reviewer_assignment_not_ready_count)::int from classified), 0)
    union all
    select 'second_review_required', 'Нужен второй review', 'complete_second_review',
      coalesce((select sum(second_review_not_ready_count)::int from classified), 0)
  ),
  item_rows as (
    select
      row_number() over (order by c.status asc, c.lesion_label asc, c.lesion_id asc)::int as queue_number,
      c.*
    from classified c
  ),
  latest_rollout as (
    select
      r.id,
      r.clinic_id,
      r.patient_id,
      r.visit_id,
      r.rollout_status,
      r.rollout_reasons,
      r.validation_status,
      r.lesion_count,
      r.ready_timeline_count,
      r.needs_review_timeline_count,
      r.blocked_timeline_count,
      r.candidate_pair_count,
      r.reviewer_workflow_ready_count,
      r.reviewed_at,
      r.created_at,
      r.updated_at
    from visit_longitudinal_timeline_rollout_reviews r
    join target_visit v
      on r.visit_id = v.id
     and r.patient_id = v.patient_id
     and r.clinic_id = v.clinic_id
    where r.patient_delivery_allowed = false
      and r.medical_measurement_allowed = false
      and r.protected_fields_exposed = false
      and r.clinical_output_generated = false
      ${clinicScopeWhere({ alias: "r", clinicIds, allClinics })}
    order by r.updated_at desc
    limit 1
  ),
  latest_sop as (
    select
      s.id,
      s.clinic_id,
      s.patient_id,
      s.visit_id,
      s.sop_status,
      s.sop_reasons,
      s.validation_status,
      s.rollout_status,
      s.dataset_validation_status,
      s.reviewer_operations_status,
      s.rollback_plan_status,
      s.monitoring_plan_status,
      s.rollout_window_status,
      s.owner_ack_status,
      s.lesion_count,
      s.ready_timeline_count,
      s.blocked_timeline_count,
      s.candidate_pair_count,
      s.reviewer_workflow_ready_count,
      s.reviewed_at,
      s.created_at,
      s.updated_at
    from visit_longitudinal_timeline_rollout_sop_reviews s
    join target_visit v
      on s.visit_id = v.id
     and s.patient_id = v.patient_id
     and s.clinic_id = v.clinic_id
    where s.patient_delivery_allowed = false
      and s.medical_measurement_allowed = false
      and s.protected_fields_exposed = false
      and s.clinical_output_generated = false
      ${clinicScopeWhere({ alias: "s", clinicIds, allClinics })}
    order by s.updated_at desc
    limit 1
  ),
  latest_evidence as (
    select
      e.id,
      e.clinic_id,
      e.patient_id,
      e.visit_id,
      e.evidence_status,
      e.evidence_reasons,
      e.sop_status,
      e.validation_status,
      e.rollout_status,
      e.monitoring_evidence_status,
      e.sample_audit_status,
      e.exception_log_status,
      e.rollback_drill_status,
      e.owner_signoff_status,
      e.monitoring_window_days,
      e.sampled_timeline_count,
      e.exception_count,
      e.rollback_drill_count,
      e.lesion_count,
      e.ready_timeline_count,
      e.blocked_timeline_count,
      e.candidate_pair_count,
      e.reviewer_workflow_ready_count,
      e.reviewed_at,
      e.created_at,
      e.updated_at
    from visit_longitudinal_timeline_rollout_evidence_reviews e
    join target_visit v
      on e.visit_id = v.id
     and e.patient_id = v.patient_id
     and e.clinic_id = v.clinic_id
    where e.patient_delivery_allowed = false
      and e.medical_measurement_allowed = false
      and e.protected_fields_exposed = false
      and e.clinical_output_generated = false
      ${clinicScopeWhere({ alias: "e", clinicIds, allClinics })}
    order by e.updated_at desc
    limit 1
  ),
  latest_monitoring as (
    select
      m.id,
      m.clinic_id,
      m.patient_id,
      m.visit_id,
      m.monitoring_status,
      m.monitoring_reasons,
      m.evidence_status,
      m.sop_status,
      m.validation_status,
      m.rollout_status,
      m.outcome_sampling_status,
      m.incident_review_status,
      m.exception_closure_status,
      m.rollback_outcome_status,
      m.owner_final_review_status,
      m.monitoring_window_days,
      m.monitored_timeline_count,
      m.sampled_timeline_count,
      m.incident_count,
      m.unresolved_incident_count,
      m.closed_exception_count,
      m.rollback_execution_count,
      m.lesion_count,
      m.ready_timeline_count,
      m.blocked_timeline_count,
      m.candidate_pair_count,
      m.reviewer_workflow_ready_count,
      m.reviewed_at,
      m.created_at,
      m.updated_at
    from visit_longitudinal_timeline_rollout_monitoring_reviews m
    join target_visit v
      on m.visit_id = v.id
     and m.patient_id = v.patient_id
     and m.clinic_id = v.clinic_id
    where m.patient_delivery_allowed = false
      and m.medical_measurement_allowed = false
      and m.protected_fields_exposed = false
      and m.clinical_output_generated = false
      ${clinicScopeWhere({ alias: "m", clinicIds, allClinics })}
    order by m.updated_at desc
    limit 1
  ),
  latest_incident_procedure as (
    select
      p.id,
      p.clinic_id,
      p.patient_id,
      p.visit_id,
      p.procedure_status,
      p.procedure_reasons,
      p.monitoring_status,
      p.evidence_status,
      p.sop_status,
      p.validation_status,
      p.rollout_status,
      p.real_dataset_status,
      p.outcome_sampling_procedure_status,
      p.incident_triage_status,
      p.escalation_path_status,
      p.rollback_decision_status,
      p.owner_review_status,
      p.real_dataset_timeline_count,
      p.monitored_timeline_count,
      p.sampled_outcome_count,
      p.incident_case_count,
      p.unresolved_incident_count,
      p.escalated_incident_count,
      p.rollback_decision_count,
      p.lesion_count,
      p.ready_timeline_count,
      p.blocked_timeline_count,
      p.candidate_pair_count,
      p.reviewer_workflow_ready_count,
      p.reviewed_at,
      p.created_at,
      p.updated_at
    from visit_longitudinal_timeline_rollout_incident_procedure_reviews p
    join target_visit v
      on p.visit_id = v.id
     and p.patient_id = v.patient_id
     and p.clinic_id = v.clinic_id
    where p.patient_delivery_allowed = false
      and p.medical_measurement_allowed = false
      and p.protected_fields_exposed = false
      and p.clinical_output_generated = false
      ${clinicScopeWhere({ alias: "p", clinicIds, allClinics })}
    order by p.updated_at desc
    limit 1
  ),
  latest_clinical_validation as (
    select
      c.id,
      c.clinic_id,
      c.patient_id,
      c.visit_id,
      c.clinical_validation_status,
      c.clinical_validation_reasons,
      c.incident_procedure_status,
      c.monitoring_status,
      c.evidence_status,
      c.sop_status,
      c.dataset_validation_status,
      c.rollout_status,
      c.real_dataset_lock_status,
      c.validator_training_status,
      c.blinded_sample_status,
      c.adjudication_status,
      c.decision_log_status,
      c.owner_acceptance_status,
      c.real_dataset_timeline_count,
      c.validation_sample_count,
      c.disagreement_case_count,
      c.adjudicated_case_count,
      c.followup_window_days,
      c.blocker_count,
      c.lesion_count,
      c.ready_timeline_count,
      c.blocked_timeline_count,
      c.candidate_pair_count,
      c.reviewer_workflow_ready_count,
      c.reviewed_at,
      c.created_at,
      c.updated_at
    from visit_longitudinal_timeline_rollout_clinical_validation_reviews c
    join target_visit v
      on c.visit_id = v.id
     and c.patient_id = v.patient_id
     and c.clinic_id = v.clinic_id
    where c.patient_delivery_allowed = false
      and c.medical_measurement_allowed = false
      and c.protected_fields_exposed = false
      and c.clinical_output_generated = false
      ${clinicScopeWhere({ alias: "c", clinicIds, allClinics })}
    order by c.updated_at desc
    limit 1
  ),
  latest_post_validation_monitoring as (
    select
      p.id,
      p.clinic_id,
      p.patient_id,
      p.visit_id,
      p.post_validation_monitoring_status,
      p.post_validation_monitoring_reasons,
      p.clinical_validation_status,
      p.incident_procedure_status,
      p.monitoring_status,
      p.evidence_status,
      p.sop_status,
      p.dataset_validation_status,
      p.rollout_status,
      p.monitoring_window_status,
      p.outcome_review_status,
      p.drift_review_status,
      p.incident_followup_status,
      p.validator_recheck_status,
      p.owner_signoff_status,
      p.real_dataset_timeline_count,
      p.clinical_validation_sample_count,
      p.monitored_timeline_count,
      p.sampled_outcome_count,
      p.drift_signal_count,
      p.unresolved_drift_signal_count,
      p.incident_followup_count,
      p.unresolved_incident_followup_count,
      p.validator_recheck_count,
      p.blocker_count,
      p.lesion_count,
      p.ready_timeline_count,
      p.blocked_timeline_count,
      p.candidate_pair_count,
      p.reviewer_workflow_ready_count,
      p.reviewed_at,
      p.created_at,
      p.updated_at
    from visit_longitudinal_timeline_rollout_post_validation_monitoring_reviews p
    join target_visit v
      on p.visit_id = v.id
     and p.patient_id = v.patient_id
     and p.clinic_id = v.clinic_id
    where p.patient_delivery_allowed = false
      and p.medical_measurement_allowed = false
      and p.protected_fields_exposed = false
      and p.clinical_output_generated = false
      ${clinicScopeWhere({ alias: "p", clinicIds, allClinics })}
    order by p.updated_at desc
    limit 1
  ),
  latest_observation_governance as (
    select
      g.id,
      g.clinic_id,
      g.patient_id,
      g.visit_id,
      g.observation_governance_status,
      g.observation_governance_reasons,
      g.post_validation_monitoring_status,
      g.clinical_validation_status,
      g.incident_procedure_status,
      g.monitoring_status,
      g.evidence_status,
      g.sop_status,
      g.dataset_validation_status,
      g.rollout_status,
      g.observation_window_status,
      g.outcome_observation_status,
      g.drift_signal_review_status,
      g.incident_outcome_review_status,
      g.followup_closure_status,
      g.governance_review_status,
      g.owner_signoff_status,
      g.real_dataset_timeline_count,
      g.post_validation_sample_count,
      g.observed_timeline_count,
      g.expected_followup_count,
      g.completed_followup_count,
      g.drift_signal_count,
      g.unresolved_drift_signal_count,
      g.incident_outcome_count,
      g.unresolved_incident_outcome_count,
      g.governance_exception_count,
      g.unresolved_governance_exception_count,
      g.blocker_count,
      g.lesion_count,
      g.ready_timeline_count,
      g.blocked_timeline_count,
      g.candidate_pair_count,
      g.reviewer_workflow_ready_count,
      g.reviewed_at,
      g.created_at,
      g.updated_at
    from visit_longitudinal_timeline_rollout_observation_governance_reviews g
    join target_visit v
      on g.visit_id = v.id
     and g.patient_id = v.patient_id
     and g.clinic_id = v.clinic_id
    where g.patient_delivery_allowed = false
      and g.medical_measurement_allowed = false
      and g.protected_fields_exposed = false
      and g.clinical_output_generated = false
      ${clinicScopeWhere({ alias: "g", clinicIds, allClinics })}
    order by g.updated_at desc
    limit 1
  )
  select
    v.clinic_id::text as "clinicId",
    v.patient_id::text as "patientId",
    v.id::text as "visitId",
    jsonb_build_object(
      'status', case
        when coalesce((select count(*)::int from classified), 0) = 0
          or coalesce((select count(*)::int from classified where status = 'blocked'), 0) > 0 then 'blocked'
        when coalesce((select count(*)::int from classified where status = 'needs_review'), 0) > 0 then 'needs_review'
        else 'ready_for_rollout'
      end,
      'lesionCount', coalesce((select count(*)::int from classified), 0),
      'timelineCandidateCount', coalesce((select count(*)::int from classified where candidate_pair_count > 0), 0),
      'readyTimelineCount', coalesce((select count(*)::int from classified where status = 'ready_for_rollout'), 0),
      'needsReviewTimelineCount', coalesce((select count(*)::int from classified where status = 'needs_review'), 0),
      'blockedTimelineCount', coalesce((select count(*)::int from classified where status = 'blocked'), 0),
      'imageCount', coalesce((select sum(image_count)::int from classified), 0),
      'candidatePairCount', coalesce((select sum(candidate_pair_count)::int from classified), 0),
      'reviewedPairCount', coalesce((select sum(reviewed_pair_count)::int from classified), 0),
      'technicalReadyPairCount', coalesce((select sum(technical_ready_pair_count)::int from classified), 0),
      'productionAssetNotReadyCount', coalesce((select sum(production_asset_not_ready_count)::int from classified), 0),
      'missingCaptureMetadataCount', coalesce((select sum(missing_capture_metadata_count)::int from classified), 0),
      'deviceEvidenceNotReadyCount', coalesce((select sum(device_evidence_not_ready_count)::int from classified), 0),
      'deviceBridgeQualityNotReadyCount', coalesce((select sum(device_bridge_quality_not_ready_count)::int from classified), 0),
      'captureProtocolNotReadyCount', coalesce((select sum(capture_protocol_not_ready_count)::int from classified), 0),
      'calibrationBlockedCount', coalesce((select sum(calibration_blocked_count)::int from classified), 0),
      'markerMissingCount', coalesce((select sum(marker_missing_count)::int from classified), 0),
      'measurementPolicyNotReadyCount', coalesce((select sum(measurement_policy_not_ready_count)::int from classified), 0),
      'productionAnalysisPolicyNotReadyCount', coalesce((select sum(production_analysis_policy_not_ready_count)::int from classified), 0),
      'reviewerAssignmentNotReadyCount', coalesce((select sum(reviewer_assignment_not_ready_count)::int from classified), 0),
      'secondReviewNotReadyCount', coalesce((select sum(second_review_not_ready_count)::int from classified), 0),
      'reviewerWorkflowReadyCount', coalesce((select sum(reviewer_workflow_ready_count)::int from classified), 0),
      'dynamicConclusionAllowed', false
    ) as "readiness",
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'queueNumber', c.queue_number,
        'lesionId', c.lesion_id,
        'lesionLabel', c.lesion_label,
        'bodyZone', c.body_zone,
        'bodySurface', c.body_surface,
        'status', c.status,
        'visitCount', c.visit_count,
        'imageCount', c.image_count,
        'candidatePairCount', c.candidate_pair_count,
        'reviewedPairCount', c.reviewed_pair_count,
        'technicalReadyPairCount', c.technical_ready_pair_count,
        'productionAssetNotReadyCount', c.production_asset_not_ready_count,
        'missingCaptureMetadataCount', c.missing_capture_metadata_count,
        'deviceEvidenceNotReadyCount', c.device_evidence_not_ready_count,
        'deviceBridgeQualityNotReadyCount', c.device_bridge_quality_not_ready_count,
        'captureProtocolNotReadyCount', c.capture_protocol_not_ready_count,
        'calibrationBlockedCount', c.calibration_blocked_count,
        'markerMissingCount', c.marker_missing_count,
        'measurementPolicyNotReadyCount', c.measurement_policy_not_ready_count,
        'productionAnalysisPolicyNotReadyCount', c.production_analysis_policy_not_ready_count,
        'reviewerAssignmentNotReadyCount', c.reviewer_assignment_not_ready_count,
        'secondReviewNotReadyCount', c.second_review_not_ready_count,
        'reviewerWorkflowReadyCount', c.reviewer_workflow_ready_count,
        'nextAction', c.next_action
      ) order by c.status asc, c.lesion_label asc, c.lesion_id asc)
      from item_rows c
    ), '[]'::jsonb) as "items",
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', b.code,
        'label', b.label,
        'count', b.count,
        'nextAction', b.next_action
      ) order by b.code asc)
      from blocker_rows b
      where b.count > 0
    ), '[]'::jsonb) as "blockers",
    jsonb_build_object(
      'id', coalesce((select id::text from latest_rollout), ''),
      'clinicId', coalesce((select clinic_id::text from latest_rollout), v.clinic_id::text),
      'patientId', coalesce((select patient_id::text from latest_rollout), v.patient_id::text),
      'visitId', coalesce((select visit_id::text from latest_rollout), v.id::text),
      'status', coalesce((select rollout_status from latest_rollout), 'not_approved'),
      'reasons', coalesce((select rollout_reasons from latest_rollout), '[]'::jsonb),
      'validationStatus', coalesce((select validation_status from latest_rollout), 'blocked'),
      'lesionCount', coalesce((select lesion_count from latest_rollout), 0),
      'readyTimelineCount', coalesce((select ready_timeline_count from latest_rollout), 0),
      'needsReviewTimelineCount', coalesce((select needs_review_timeline_count from latest_rollout), 0),
      'blockedTimelineCount', coalesce((select blocked_timeline_count from latest_rollout), 0),
      'candidatePairCount', coalesce((select candidate_pair_count from latest_rollout), 0),
      'reviewerWorkflowReadyCount', coalesce((select reviewer_workflow_ready_count from latest_rollout), 0),
      'reviewedAt', (select reviewed_at from latest_rollout),
      'createdAt', (select created_at from latest_rollout),
      'updatedAt', (select updated_at from latest_rollout),
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'clinicalOutputGenerated', false
    ) as "timelineRollout",
    jsonb_build_object(
      'id', coalesce((select id::text from latest_sop), ''),
      'clinicId', coalesce((select clinic_id::text from latest_sop), v.clinic_id::text),
      'patientId', coalesce((select patient_id::text from latest_sop), v.patient_id::text),
      'visitId', coalesce((select visit_id::text from latest_sop), v.id::text),
      'status', coalesce((select sop_status from latest_sop), 'not_started'),
      'reasons', coalesce((select sop_reasons from latest_sop), '[]'::jsonb),
      'validationStatus', coalesce((select validation_status from latest_sop), 'blocked'),
      'rolloutStatus', coalesce((select rollout_status from latest_sop), 'not_approved'),
      'datasetValidationStatus', coalesce((select dataset_validation_status from latest_sop), 'missing'),
      'reviewerOperationsStatus', coalesce((select reviewer_operations_status from latest_sop), 'missing'),
      'rollbackPlanStatus', coalesce((select rollback_plan_status from latest_sop), 'missing'),
      'monitoringPlanStatus', coalesce((select monitoring_plan_status from latest_sop), 'missing'),
      'rolloutWindowStatus', coalesce((select rollout_window_status from latest_sop), 'missing'),
      'ownerAckStatus', coalesce((select owner_ack_status from latest_sop), 'missing'),
      'lesionCount', coalesce((select lesion_count from latest_sop), 0),
      'readyTimelineCount', coalesce((select ready_timeline_count from latest_sop), 0),
      'blockedTimelineCount', coalesce((select blocked_timeline_count from latest_sop), 0),
      'candidatePairCount', coalesce((select candidate_pair_count from latest_sop), 0),
      'reviewerWorkflowReadyCount', coalesce((select reviewer_workflow_ready_count from latest_sop), 0),
      'reviewedAt', (select reviewed_at from latest_sop),
      'createdAt', (select created_at from latest_sop),
      'updatedAt', (select updated_at from latest_sop),
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'clinicalOutputGenerated', false
    ) as "timelineRolloutSop",
    jsonb_build_object(
      'id', coalesce((select id::text from latest_evidence), ''),
      'clinicId', coalesce((select clinic_id::text from latest_evidence), v.clinic_id::text),
      'patientId', coalesce((select patient_id::text from latest_evidence), v.patient_id::text),
      'visitId', coalesce((select visit_id::text from latest_evidence), v.id::text),
      'status', coalesce((select evidence_status from latest_evidence), 'not_started'),
      'reasons', coalesce((select evidence_reasons from latest_evidence), '[]'::jsonb),
      'sopStatus', coalesce((select sop_status from latest_evidence), 'not_started'),
      'validationStatus', coalesce((select validation_status from latest_evidence), 'blocked'),
      'rolloutStatus', coalesce((select rollout_status from latest_evidence), 'not_approved'),
      'monitoringEvidenceStatus', coalesce((select monitoring_evidence_status from latest_evidence), 'missing'),
      'sampleAuditStatus', coalesce((select sample_audit_status from latest_evidence), 'missing'),
      'exceptionLogStatus', coalesce((select exception_log_status from latest_evidence), 'missing'),
      'rollbackDrillStatus', coalesce((select rollback_drill_status from latest_evidence), 'missing'),
      'ownerSignoffStatus', coalesce((select owner_signoff_status from latest_evidence), 'missing'),
      'monitoringWindowDays', coalesce((select monitoring_window_days from latest_evidence), 0),
      'sampledTimelineCount', coalesce((select sampled_timeline_count from latest_evidence), 0),
      'exceptionCount', coalesce((select exception_count from latest_evidence), 0),
      'rollbackDrillCount', coalesce((select rollback_drill_count from latest_evidence), 0),
      'lesionCount', coalesce((select lesion_count from latest_evidence), 0),
      'readyTimelineCount', coalesce((select ready_timeline_count from latest_evidence), 0),
      'blockedTimelineCount', coalesce((select blocked_timeline_count from latest_evidence), 0),
      'candidatePairCount', coalesce((select candidate_pair_count from latest_evidence), 0),
      'reviewerWorkflowReadyCount', coalesce((select reviewer_workflow_ready_count from latest_evidence), 0),
      'reviewedAt', (select reviewed_at from latest_evidence),
      'createdAt', (select created_at from latest_evidence),
      'updatedAt', (select updated_at from latest_evidence),
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'clinicalOutputGenerated', false
    ) as "timelineRolloutEvidence",
    jsonb_build_object(
      'id', coalesce((select id::text from latest_monitoring), ''),
      'clinicId', coalesce((select clinic_id::text from latest_monitoring), v.clinic_id::text),
      'patientId', coalesce((select patient_id::text from latest_monitoring), v.patient_id::text),
      'visitId', coalesce((select visit_id::text from latest_monitoring), v.id::text),
      'status', coalesce((select monitoring_status from latest_monitoring), 'not_started'),
      'reasons', coalesce((select monitoring_reasons from latest_monitoring), '[]'::jsonb),
      'evidenceStatus', coalesce((select evidence_status from latest_monitoring), 'not_started'),
      'sopStatus', coalesce((select sop_status from latest_monitoring), 'not_started'),
      'validationStatus', coalesce((select validation_status from latest_monitoring), 'blocked'),
      'rolloutStatus', coalesce((select rollout_status from latest_monitoring), 'not_approved'),
      'outcomeSamplingStatus', coalesce((select outcome_sampling_status from latest_monitoring), 'missing'),
      'incidentReviewStatus', coalesce((select incident_review_status from latest_monitoring), 'missing'),
      'exceptionClosureStatus', coalesce((select exception_closure_status from latest_monitoring), 'missing'),
      'rollbackOutcomeStatus', coalesce((select rollback_outcome_status from latest_monitoring), 'missing'),
      'ownerFinalReviewStatus', coalesce((select owner_final_review_status from latest_monitoring), 'missing'),
      'monitoringWindowDays', coalesce((select monitoring_window_days from latest_monitoring), 0),
      'monitoredTimelineCount', coalesce((select monitored_timeline_count from latest_monitoring), 0),
      'sampledTimelineCount', coalesce((select sampled_timeline_count from latest_monitoring), 0),
      'incidentCount', coalesce((select incident_count from latest_monitoring), 0),
      'unresolvedIncidentCount', coalesce((select unresolved_incident_count from latest_monitoring), 0),
      'closedExceptionCount', coalesce((select closed_exception_count from latest_monitoring), 0),
      'rollbackExecutionCount', coalesce((select rollback_execution_count from latest_monitoring), 0),
      'lesionCount', coalesce((select lesion_count from latest_monitoring), 0),
      'readyTimelineCount', coalesce((select ready_timeline_count from latest_monitoring), 0),
      'blockedTimelineCount', coalesce((select blocked_timeline_count from latest_monitoring), 0),
      'candidatePairCount', coalesce((select candidate_pair_count from latest_monitoring), 0),
      'reviewerWorkflowReadyCount', coalesce((select reviewer_workflow_ready_count from latest_monitoring), 0),
      'reviewedAt', (select reviewed_at from latest_monitoring),
      'createdAt', (select created_at from latest_monitoring),
      'updatedAt', (select updated_at from latest_monitoring),
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'clinicalOutputGenerated', false
    ) as "timelineRolloutMonitoring",
    jsonb_build_object(
      'id', coalesce((select id::text from latest_incident_procedure), ''),
      'clinicId', coalesce((select clinic_id::text from latest_incident_procedure), v.clinic_id::text),
      'patientId', coalesce((select patient_id::text from latest_incident_procedure), v.patient_id::text),
      'visitId', coalesce((select visit_id::text from latest_incident_procedure), v.id::text),
      'status', coalesce((select procedure_status from latest_incident_procedure), 'not_started'),
      'reasons', coalesce((select procedure_reasons from latest_incident_procedure), '[]'::jsonb),
      'monitoringStatus', coalesce((select monitoring_status from latest_incident_procedure), 'not_started'),
      'evidenceStatus', coalesce((select evidence_status from latest_incident_procedure), 'not_started'),
      'sopStatus', coalesce((select sop_status from latest_incident_procedure), 'not_started'),
      'validationStatus', coalesce((select validation_status from latest_incident_procedure), 'blocked'),
      'rolloutStatus', coalesce((select rollout_status from latest_incident_procedure), 'not_approved'),
      'realDatasetStatus', coalesce((select real_dataset_status from latest_incident_procedure), 'missing'),
      'outcomeSamplingProcedureStatus', coalesce((select outcome_sampling_procedure_status from latest_incident_procedure), 'missing'),
      'incidentTriageStatus', coalesce((select incident_triage_status from latest_incident_procedure), 'missing'),
      'escalationPathStatus', coalesce((select escalation_path_status from latest_incident_procedure), 'missing'),
      'rollbackDecisionStatus', coalesce((select rollback_decision_status from latest_incident_procedure), 'missing'),
      'ownerReviewStatus', coalesce((select owner_review_status from latest_incident_procedure), 'missing'),
      'realDatasetTimelineCount', coalesce((select real_dataset_timeline_count from latest_incident_procedure), 0),
      'monitoredTimelineCount', coalesce((select monitored_timeline_count from latest_incident_procedure), 0),
      'sampledOutcomeCount', coalesce((select sampled_outcome_count from latest_incident_procedure), 0),
      'incidentCaseCount', coalesce((select incident_case_count from latest_incident_procedure), 0),
      'unresolvedIncidentCount', coalesce((select unresolved_incident_count from latest_incident_procedure), 0),
      'escalatedIncidentCount', coalesce((select escalated_incident_count from latest_incident_procedure), 0),
      'rollbackDecisionCount', coalesce((select rollback_decision_count from latest_incident_procedure), 0),
      'lesionCount', coalesce((select lesion_count from latest_incident_procedure), 0),
      'readyTimelineCount', coalesce((select ready_timeline_count from latest_incident_procedure), 0),
      'blockedTimelineCount', coalesce((select blocked_timeline_count from latest_incident_procedure), 0),
      'candidatePairCount', coalesce((select candidate_pair_count from latest_incident_procedure), 0),
      'reviewerWorkflowReadyCount', coalesce((select reviewer_workflow_ready_count from latest_incident_procedure), 0),
      'reviewedAt', (select reviewed_at from latest_incident_procedure),
      'createdAt', (select created_at from latest_incident_procedure),
      'updatedAt', (select updated_at from latest_incident_procedure),
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'clinicalOutputGenerated', false
    ) as "timelineRolloutIncidentProcedure",
    jsonb_build_object(
      'id', coalesce((select id::text from latest_clinical_validation), ''),
      'clinicId', coalesce((select clinic_id::text from latest_clinical_validation), v.clinic_id::text),
      'patientId', coalesce((select patient_id::text from latest_clinical_validation), v.patient_id::text),
      'visitId', coalesce((select visit_id::text from latest_clinical_validation), v.id::text),
      'status', coalesce((select clinical_validation_status from latest_clinical_validation), 'not_started'),
      'reasons', coalesce((select clinical_validation_reasons from latest_clinical_validation), '[]'::jsonb),
      'incidentProcedureStatus', coalesce((select incident_procedure_status from latest_clinical_validation), 'not_started'),
      'monitoringStatus', coalesce((select monitoring_status from latest_clinical_validation), 'not_started'),
      'evidenceStatus', coalesce((select evidence_status from latest_clinical_validation), 'not_started'),
      'sopStatus', coalesce((select sop_status from latest_clinical_validation), 'not_started'),
      'validationStatus', coalesce((select dataset_validation_status from latest_clinical_validation), 'blocked'),
      'rolloutStatus', coalesce((select rollout_status from latest_clinical_validation), 'not_approved'),
      'realDatasetLockStatus', coalesce((select real_dataset_lock_status from latest_clinical_validation), 'missing'),
      'validatorTrainingStatus', coalesce((select validator_training_status from latest_clinical_validation), 'missing'),
      'blindedSampleStatus', coalesce((select blinded_sample_status from latest_clinical_validation), 'missing'),
      'adjudicationStatus', coalesce((select adjudication_status from latest_clinical_validation), 'missing'),
      'decisionLogStatus', coalesce((select decision_log_status from latest_clinical_validation), 'missing'),
      'ownerAcceptanceStatus', coalesce((select owner_acceptance_status from latest_clinical_validation), 'missing'),
      'realDatasetTimelineCount', coalesce((select real_dataset_timeline_count from latest_clinical_validation), 0),
      'validationSampleCount', coalesce((select validation_sample_count from latest_clinical_validation), 0),
      'disagreementCaseCount', coalesce((select disagreement_case_count from latest_clinical_validation), 0),
      'adjudicatedCaseCount', coalesce((select adjudicated_case_count from latest_clinical_validation), 0),
      'followupWindowDays', coalesce((select followup_window_days from latest_clinical_validation), 0),
      'blockerCount', coalesce((select blocker_count from latest_clinical_validation), 0),
      'lesionCount', coalesce((select lesion_count from latest_clinical_validation), 0),
      'readyTimelineCount', coalesce((select ready_timeline_count from latest_clinical_validation), 0),
      'blockedTimelineCount', coalesce((select blocked_timeline_count from latest_clinical_validation), 0),
      'candidatePairCount', coalesce((select candidate_pair_count from latest_clinical_validation), 0),
      'reviewerWorkflowReadyCount', coalesce((select reviewer_workflow_ready_count from latest_clinical_validation), 0),
      'reviewedAt', (select reviewed_at from latest_clinical_validation),
      'createdAt', (select created_at from latest_clinical_validation),
      'updatedAt', (select updated_at from latest_clinical_validation),
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'clinicalOutputGenerated', false
    ) as "timelineRolloutClinicalValidation",
    jsonb_build_object(
      'id', coalesce((select id::text from latest_post_validation_monitoring), ''),
      'clinicId', coalesce((select clinic_id::text from latest_post_validation_monitoring), v.clinic_id::text),
      'patientId', coalesce((select patient_id::text from latest_post_validation_monitoring), v.patient_id::text),
      'visitId', coalesce((select visit_id::text from latest_post_validation_monitoring), v.id::text),
      'status', coalesce((select post_validation_monitoring_status from latest_post_validation_monitoring), 'not_started'),
      'reasons', coalesce((select post_validation_monitoring_reasons from latest_post_validation_monitoring), '[]'::jsonb),
      'clinicalValidationStatus', coalesce((select clinical_validation_status from latest_post_validation_monitoring), 'not_started'),
      'incidentProcedureStatus', coalesce((select incident_procedure_status from latest_post_validation_monitoring), 'not_started'),
      'monitoringStatus', coalesce((select monitoring_status from latest_post_validation_monitoring), 'not_started'),
      'evidenceStatus', coalesce((select evidence_status from latest_post_validation_monitoring), 'not_started'),
      'sopStatus', coalesce((select sop_status from latest_post_validation_monitoring), 'not_started'),
      'validationStatus', coalesce((select dataset_validation_status from latest_post_validation_monitoring), 'blocked'),
      'rolloutStatus', coalesce((select rollout_status from latest_post_validation_monitoring), 'not_approved'),
      'monitoringWindowStatus', coalesce((select monitoring_window_status from latest_post_validation_monitoring), 'missing'),
      'outcomeReviewStatus', coalesce((select outcome_review_status from latest_post_validation_monitoring), 'missing'),
      'driftReviewStatus', coalesce((select drift_review_status from latest_post_validation_monitoring), 'missing'),
      'incidentFollowupStatus', coalesce((select incident_followup_status from latest_post_validation_monitoring), 'missing'),
      'validatorRecheckStatus', coalesce((select validator_recheck_status from latest_post_validation_monitoring), 'missing'),
      'ownerSignoffStatus', coalesce((select owner_signoff_status from latest_post_validation_monitoring), 'missing'),
      'realDatasetTimelineCount', coalesce((select real_dataset_timeline_count from latest_post_validation_monitoring), 0),
      'clinicalValidationSampleCount', coalesce((select clinical_validation_sample_count from latest_post_validation_monitoring), 0),
      'monitoredTimelineCount', coalesce((select monitored_timeline_count from latest_post_validation_monitoring), 0),
      'sampledOutcomeCount', coalesce((select sampled_outcome_count from latest_post_validation_monitoring), 0),
      'driftSignalCount', coalesce((select drift_signal_count from latest_post_validation_monitoring), 0),
      'unresolvedDriftSignalCount', coalesce((select unresolved_drift_signal_count from latest_post_validation_monitoring), 0),
      'incidentFollowupCount', coalesce((select incident_followup_count from latest_post_validation_monitoring), 0),
      'unresolvedIncidentFollowupCount', coalesce((select unresolved_incident_followup_count from latest_post_validation_monitoring), 0),
      'validatorRecheckCount', coalesce((select validator_recheck_count from latest_post_validation_monitoring), 0),
      'blockerCount', coalesce((select blocker_count from latest_post_validation_monitoring), 0),
      'lesionCount', coalesce((select lesion_count from latest_post_validation_monitoring), 0),
      'readyTimelineCount', coalesce((select ready_timeline_count from latest_post_validation_monitoring), 0),
      'blockedTimelineCount', coalesce((select blocked_timeline_count from latest_post_validation_monitoring), 0),
      'candidatePairCount', coalesce((select candidate_pair_count from latest_post_validation_monitoring), 0),
      'reviewerWorkflowReadyCount', coalesce((select reviewer_workflow_ready_count from latest_post_validation_monitoring), 0),
      'reviewedAt', (select reviewed_at from latest_post_validation_monitoring),
      'createdAt', (select created_at from latest_post_validation_monitoring),
      'updatedAt', (select updated_at from latest_post_validation_monitoring),
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'clinicalOutputGenerated', false
    ) as "timelineRolloutPostValidationMonitoring",
    jsonb_build_object(
      'id', coalesce((select id::text from latest_observation_governance), ''),
      'clinicId', coalesce((select clinic_id::text from latest_observation_governance), v.clinic_id::text),
      'patientId', coalesce((select patient_id::text from latest_observation_governance), v.patient_id::text),
      'visitId', coalesce((select visit_id::text from latest_observation_governance), v.id::text),
      'status', coalesce((select observation_governance_status from latest_observation_governance), 'not_started'),
      'reasons', coalesce((select observation_governance_reasons from latest_observation_governance), '[]'::jsonb),
      'postValidationMonitoringStatus', coalesce((select post_validation_monitoring_status from latest_observation_governance), 'not_started'),
      'clinicalValidationStatus', coalesce((select clinical_validation_status from latest_observation_governance), 'not_started'),
      'incidentProcedureStatus', coalesce((select incident_procedure_status from latest_observation_governance), 'not_started'),
      'monitoringStatus', coalesce((select monitoring_status from latest_observation_governance), 'not_started'),
      'evidenceStatus', coalesce((select evidence_status from latest_observation_governance), 'not_started'),
      'sopStatus', coalesce((select sop_status from latest_observation_governance), 'not_started'),
      'validationStatus', coalesce((select dataset_validation_status from latest_observation_governance), 'blocked'),
      'rolloutStatus', coalesce((select rollout_status from latest_observation_governance), 'not_approved'),
      'observationWindowStatus', coalesce((select observation_window_status from latest_observation_governance), 'missing'),
      'outcomeObservationStatus', coalesce((select outcome_observation_status from latest_observation_governance), 'missing'),
      'driftSignalReviewStatus', coalesce((select drift_signal_review_status from latest_observation_governance), 'missing'),
      'incidentOutcomeReviewStatus', coalesce((select incident_outcome_review_status from latest_observation_governance), 'missing'),
      'followupClosureStatus', coalesce((select followup_closure_status from latest_observation_governance), 'missing'),
      'governanceReviewStatus', coalesce((select governance_review_status from latest_observation_governance), 'missing'),
      'ownerSignoffStatus', coalesce((select owner_signoff_status from latest_observation_governance), 'missing'),
      'realDatasetTimelineCount', coalesce((select real_dataset_timeline_count from latest_observation_governance), 0),
      'postValidationSampleCount', coalesce((select post_validation_sample_count from latest_observation_governance), 0),
      'observedTimelineCount', coalesce((select observed_timeline_count from latest_observation_governance), 0),
      'expectedFollowupCount', coalesce((select expected_followup_count from latest_observation_governance), 0),
      'completedFollowupCount', coalesce((select completed_followup_count from latest_observation_governance), 0),
      'driftSignalCount', coalesce((select drift_signal_count from latest_observation_governance), 0),
      'unresolvedDriftSignalCount', coalesce((select unresolved_drift_signal_count from latest_observation_governance), 0),
      'incidentOutcomeCount', coalesce((select incident_outcome_count from latest_observation_governance), 0),
      'unresolvedIncidentOutcomeCount', coalesce((select unresolved_incident_outcome_count from latest_observation_governance), 0),
      'governanceExceptionCount', coalesce((select governance_exception_count from latest_observation_governance), 0),
      'unresolvedGovernanceExceptionCount', coalesce((select unresolved_governance_exception_count from latest_observation_governance), 0),
      'blockerCount', coalesce((select blocker_count from latest_observation_governance), 0),
      'lesionCount', coalesce((select lesion_count from latest_observation_governance), 0),
      'readyTimelineCount', coalesce((select ready_timeline_count from latest_observation_governance), 0),
      'blockedTimelineCount', coalesce((select blocked_timeline_count from latest_observation_governance), 0),
      'candidatePairCount', coalesce((select candidate_pair_count from latest_observation_governance), 0),
      'reviewerWorkflowReadyCount', coalesce((select reviewer_workflow_ready_count from latest_observation_governance), 0),
      'reviewedAt', (select reviewed_at from latest_observation_governance),
      'createdAt', (select created_at from latest_observation_governance),
      'updatedAt', (select updated_at from latest_observation_governance),
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'clinicalOutputGenerated', false
    ) as "timelineRolloutObservationGovernance",
    array_remove(array[
      case when exists(select 1 from classified where candidate_pair_count = 0 or unreviewed_pair_count > 0) then 'review_queue' end,
      case when exists(select 1 from classified where needs_recapture_count > 0) then 'request_recapture' end,
      case when exists(select 1 from classified where not_suitable_for_comparison_count > 0) then 'exclude_from_dynamic_review' end,
      case when exists(select 1 from classified where production_asset_not_ready_count > 0) then 'verify_production_asset' end,
      case when exists(select 1 from classified where missing_capture_metadata_count > 0) then 'complete_capture_metadata' end,
      case when exists(select 1 from classified where device_evidence_not_ready_count > 0) then 'complete_device_metadata' end,
      case when exists(select 1 from classified where device_bridge_quality_not_ready_count > 0) then 'check_device_bridge' end,
      case when exists(select 1 from classified where capture_protocol_not_ready_count > 0) then 'complete_capture_protocol' end,
      case when exists(select 1 from classified where calibration_blocked_count > 0) then 'complete_calibration' end,
      case when exists(select 1 from classified where marker_missing_count > 0) then 'place_markers' end,
      case when exists(select 1 from classified where measurement_policy_not_ready_count > 0) then 'approve_measurement_policy' end,
      case when exists(select 1 from classified where production_analysis_policy_not_ready_count > 0) then 'approve_production_analysis_policy' end,
      case when exists(select 1 from classified where status = 'ready_for_rollout') then 'continue_review' end
    ]::text[], null) as "nextActions",
    jsonb_build_object(
      'patientDeliveryAllowed', false,
      'medicalMeasurementAllowed', false,
      'protectedFieldsExposed', false,
      'pairKeysExposed', false,
      'imageIdsExposed', false,
      'storagePathsExposed', false,
      'signedUrlsIssued', false,
      'rawImageBytesExposed', false,
      'doctorOnlyTextExposed', false,
      'clinicalConclusionGenerated', false
    ) as "boundaries",
    'visit_longitudinal_dataset_validation.read' as "auditAction"
  from target_visit v
) result;
`.trim();
}

export function buildReviewVisitLongitudinalTimelineRolloutSopSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  sop = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const visitScope = clinicScopeWhere({ alias: "v", clinicIds, allClinics });
  const sopScope = clinicScopeWhere({ alias: "visit_longitudinal_timeline_rollout_sop_reviews", clinicIds, allClinics });
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
      ${visitScope}
    limit 1
  ),
  upserted as (
    insert into visit_longitudinal_timeline_rollout_sop_reviews (
      clinic_id,
      patient_id,
      visit_id,
      reviewed_by_user_id,
      sop_status,
      sop_reasons,
      validation_status,
      rollout_status,
      dataset_validation_status,
      reviewer_operations_status,
      rollback_plan_status,
      monitoring_plan_status,
      rollout_window_status,
      owner_ack_status,
      lesion_count,
      ready_timeline_count,
      blocked_timeline_count,
      candidate_pair_count,
      reviewer_workflow_ready_count,
      patient_delivery_allowed,
      medical_measurement_allowed,
      protected_fields_exposed,
      clinical_output_generated,
      metadata_json,
      reviewed_at
    )
    select
      v.clinic_id,
      v.patient_id,
      v.id,
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(sop.sopStatus ?? "not_started")},
      ${sqlJsonb(sop.sopReasons ?? [])},
      ${sqlLiteral(sop.validationStatus ?? "blocked")},
      ${sqlLiteral(sop.rolloutStatus ?? "not_approved")},
      ${sqlLiteral(sop.datasetValidationStatus ?? "missing")},
      ${sqlLiteral(sop.reviewerOperationsStatus ?? "missing")},
      ${sqlLiteral(sop.rollbackPlanStatus ?? "missing")},
      ${sqlLiteral(sop.monitoringPlanStatus ?? "missing")},
      ${sqlLiteral(sop.rolloutWindowStatus ?? "missing")},
      ${sqlLiteral(sop.ownerAckStatus ?? "missing")},
      ${sqlNullableInteger(sop.lesionCount ?? 0)},
      ${sqlNullableInteger(sop.readyTimelineCount ?? 0)},
      ${sqlNullableInteger(sop.blockedTimelineCount ?? 0)},
      ${sqlNullableInteger(sop.candidatePairCount ?? 0)},
      ${sqlNullableInteger(sop.reviewerWorkflowReadyCount ?? 0)},
      false,
      false,
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-025/026/028",
        timelineRolloutSopBoundary: "metadata_only",
        checklistBoundary: "operational_only",
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      now()
    from target_visit v
    on conflict (visit_id) do update
    set
      reviewed_by_user_id = excluded.reviewed_by_user_id,
      sop_status = excluded.sop_status,
      sop_reasons = excluded.sop_reasons,
      validation_status = excluded.validation_status,
      rollout_status = excluded.rollout_status,
      dataset_validation_status = excluded.dataset_validation_status,
      reviewer_operations_status = excluded.reviewer_operations_status,
      rollback_plan_status = excluded.rollback_plan_status,
      monitoring_plan_status = excluded.monitoring_plan_status,
      rollout_window_status = excluded.rollout_window_status,
      owner_ack_status = excluded.owner_ack_status,
      lesion_count = excluded.lesion_count,
      ready_timeline_count = excluded.ready_timeline_count,
      blocked_timeline_count = excluded.blocked_timeline_count,
      candidate_pair_count = excluded.candidate_pair_count,
      reviewer_workflow_ready_count = excluded.reviewer_workflow_ready_count,
      patient_delivery_allowed = false,
      medical_measurement_allowed = false,
      protected_fields_exposed = false,
      clinical_output_generated = false,
      metadata_json = visit_longitudinal_timeline_rollout_sop_reviews.metadata_json || excluded.metadata_json,
      reviewed_at = now(),
      updated_at = now()
    where true ${sopScope}
    returning *
  )
  select
    s.id::text as "id",
    s.clinic_id::text as "clinicId",
    s.patient_id::text as "patientId",
    s.visit_id::text as "visitId",
    s.sop_status as "status",
    s.sop_reasons as "reasons",
    s.validation_status as "validationStatus",
    s.rollout_status as "rolloutStatus",
    s.dataset_validation_status as "datasetValidationStatus",
    s.reviewer_operations_status as "reviewerOperationsStatus",
    s.rollback_plan_status as "rollbackPlanStatus",
    s.monitoring_plan_status as "monitoringPlanStatus",
    s.rollout_window_status as "rolloutWindowStatus",
    s.owner_ack_status as "ownerAckStatus",
    s.lesion_count as "lesionCount",
    s.ready_timeline_count as "readyTimelineCount",
    s.blocked_timeline_count as "blockedTimelineCount",
    s.candidate_pair_count as "candidatePairCount",
    s.reviewer_workflow_ready_count as "reviewerWorkflowReadyCount",
    s.patient_delivery_allowed as "patientDeliveryAllowed",
    s.medical_measurement_allowed as "medicalMeasurementAllowed",
    s.protected_fields_exposed as "protectedFieldsExposed",
    s.clinical_output_generated as "clinicalOutputGenerated",
    s.reviewed_at as "reviewedAt",
    s.created_at as "createdAt",
    s.updated_at as "updatedAt"
  from upserted s
  limit 1
) result;
`.trim();
}

export function buildReviewVisitLongitudinalTimelineRolloutEvidenceSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  evidence = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const visitScope = clinicScopeWhere({ alias: "v", clinicIds, allClinics });
  const evidenceScope = clinicScopeWhere({
    alias: "visit_longitudinal_timeline_rollout_evidence_reviews",
    clinicIds,
    allClinics,
  });
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
      ${visitScope}
    limit 1
  ),
  upserted as (
    insert into visit_longitudinal_timeline_rollout_evidence_reviews (
      clinic_id,
      patient_id,
      visit_id,
      reviewed_by_user_id,
      evidence_status,
      evidence_reasons,
      sop_status,
      validation_status,
      rollout_status,
      monitoring_evidence_status,
      sample_audit_status,
      exception_log_status,
      rollback_drill_status,
      owner_signoff_status,
      monitoring_window_days,
      sampled_timeline_count,
      exception_count,
      rollback_drill_count,
      lesion_count,
      ready_timeline_count,
      blocked_timeline_count,
      candidate_pair_count,
      reviewer_workflow_ready_count,
      patient_delivery_allowed,
      medical_measurement_allowed,
      protected_fields_exposed,
      clinical_output_generated,
      metadata_json,
      reviewed_at
    )
    select
      v.clinic_id,
      v.patient_id,
      v.id,
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(evidence.evidenceStatus ?? "not_started")},
      ${sqlJsonb(evidence.evidenceReasons ?? [])},
      ${sqlLiteral(evidence.sopStatus ?? "not_started")},
      ${sqlLiteral(evidence.validationStatus ?? "blocked")},
      ${sqlLiteral(evidence.rolloutStatus ?? "not_approved")},
      ${sqlLiteral(evidence.monitoringEvidenceStatus ?? "missing")},
      ${sqlLiteral(evidence.sampleAuditStatus ?? "missing")},
      ${sqlLiteral(evidence.exceptionLogStatus ?? "missing")},
      ${sqlLiteral(evidence.rollbackDrillStatus ?? "missing")},
      ${sqlLiteral(evidence.ownerSignoffStatus ?? "missing")},
      ${sqlNullableInteger(evidence.monitoringWindowDays ?? 0)},
      ${sqlNullableInteger(evidence.sampledTimelineCount ?? 0)},
      ${sqlNullableInteger(evidence.exceptionCount ?? 0)},
      ${sqlNullableInteger(evidence.rollbackDrillCount ?? 0)},
      ${sqlNullableInteger(evidence.lesionCount ?? 0)},
      ${sqlNullableInteger(evidence.readyTimelineCount ?? 0)},
      ${sqlNullableInteger(evidence.blockedTimelineCount ?? 0)},
      ${sqlNullableInteger(evidence.candidatePairCount ?? 0)},
      ${sqlNullableInteger(evidence.reviewerWorkflowReadyCount ?? 0)},
      false,
      false,
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-025/026/028",
        timelineRolloutEvidenceBoundary: "metadata_only",
        monitoringBoundary: "aggregate_only",
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      now()
    from target_visit v
    on conflict (visit_id) do update
    set
      reviewed_by_user_id = excluded.reviewed_by_user_id,
      evidence_status = excluded.evidence_status,
      evidence_reasons = excluded.evidence_reasons,
      sop_status = excluded.sop_status,
      validation_status = excluded.validation_status,
      rollout_status = excluded.rollout_status,
      monitoring_evidence_status = excluded.monitoring_evidence_status,
      sample_audit_status = excluded.sample_audit_status,
      exception_log_status = excluded.exception_log_status,
      rollback_drill_status = excluded.rollback_drill_status,
      owner_signoff_status = excluded.owner_signoff_status,
      monitoring_window_days = excluded.monitoring_window_days,
      sampled_timeline_count = excluded.sampled_timeline_count,
      exception_count = excluded.exception_count,
      rollback_drill_count = excluded.rollback_drill_count,
      lesion_count = excluded.lesion_count,
      ready_timeline_count = excluded.ready_timeline_count,
      blocked_timeline_count = excluded.blocked_timeline_count,
      candidate_pair_count = excluded.candidate_pair_count,
      reviewer_workflow_ready_count = excluded.reviewer_workflow_ready_count,
      patient_delivery_allowed = false,
      medical_measurement_allowed = false,
      protected_fields_exposed = false,
      clinical_output_generated = false,
      metadata_json = visit_longitudinal_timeline_rollout_evidence_reviews.metadata_json || excluded.metadata_json,
      reviewed_at = now(),
      updated_at = now()
    where true ${evidenceScope}
    returning *
  )
  select
    e.id::text as "id",
    e.clinic_id::text as "clinicId",
    e.patient_id::text as "patientId",
    e.visit_id::text as "visitId",
    e.evidence_status as "status",
    e.evidence_reasons as "reasons",
    e.sop_status as "sopStatus",
    e.validation_status as "validationStatus",
    e.rollout_status as "rolloutStatus",
    e.monitoring_evidence_status as "monitoringEvidenceStatus",
    e.sample_audit_status as "sampleAuditStatus",
    e.exception_log_status as "exceptionLogStatus",
    e.rollback_drill_status as "rollbackDrillStatus",
    e.owner_signoff_status as "ownerSignoffStatus",
    e.monitoring_window_days as "monitoringWindowDays",
    e.sampled_timeline_count as "sampledTimelineCount",
    e.exception_count as "exceptionCount",
    e.rollback_drill_count as "rollbackDrillCount",
    e.lesion_count as "lesionCount",
    e.ready_timeline_count as "readyTimelineCount",
    e.blocked_timeline_count as "blockedTimelineCount",
    e.candidate_pair_count as "candidatePairCount",
    e.reviewer_workflow_ready_count as "reviewerWorkflowReadyCount",
    e.patient_delivery_allowed as "patientDeliveryAllowed",
    e.medical_measurement_allowed as "medicalMeasurementAllowed",
    e.protected_fields_exposed as "protectedFieldsExposed",
    e.clinical_output_generated as "clinicalOutputGenerated",
    e.reviewed_at as "reviewedAt",
    e.created_at as "createdAt",
    e.updated_at as "updatedAt"
  from upserted e
  limit 1
) result;
`.trim();
}

export function buildReviewVisitLongitudinalTimelineRolloutMonitoringSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  monitoring = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const visitScope = clinicScopeWhere({ alias: "v", clinicIds, allClinics });
  const monitoringScope = clinicScopeWhere({
    alias: "visit_longitudinal_timeline_rollout_monitoring_reviews",
    clinicIds,
    allClinics,
  });
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
      ${visitScope}
    limit 1
  ),
  upserted as (
    insert into visit_longitudinal_timeline_rollout_monitoring_reviews (
      clinic_id,
      patient_id,
      visit_id,
      reviewed_by_user_id,
      monitoring_status,
      monitoring_reasons,
      evidence_status,
      sop_status,
      validation_status,
      rollout_status,
      outcome_sampling_status,
      incident_review_status,
      exception_closure_status,
      rollback_outcome_status,
      owner_final_review_status,
      monitoring_window_days,
      monitored_timeline_count,
      sampled_timeline_count,
      incident_count,
      unresolved_incident_count,
      closed_exception_count,
      rollback_execution_count,
      lesion_count,
      ready_timeline_count,
      blocked_timeline_count,
      candidate_pair_count,
      reviewer_workflow_ready_count,
      patient_delivery_allowed,
      medical_measurement_allowed,
      protected_fields_exposed,
      clinical_output_generated,
      metadata_json,
      reviewed_at
    )
    select
      v.clinic_id,
      v.patient_id,
      v.id,
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(monitoring.monitoringStatus ?? "not_started")},
      ${sqlJsonb(monitoring.monitoringReasons ?? [])},
      ${sqlLiteral(monitoring.evidenceStatus ?? "not_started")},
      ${sqlLiteral(monitoring.sopStatus ?? "not_started")},
      ${sqlLiteral(monitoring.validationStatus ?? "blocked")},
      ${sqlLiteral(monitoring.rolloutStatus ?? "not_approved")},
      ${sqlLiteral(monitoring.outcomeSamplingStatus ?? "missing")},
      ${sqlLiteral(monitoring.incidentReviewStatus ?? "missing")},
      ${sqlLiteral(monitoring.exceptionClosureStatus ?? "missing")},
      ${sqlLiteral(monitoring.rollbackOutcomeStatus ?? "missing")},
      ${sqlLiteral(monitoring.ownerFinalReviewStatus ?? "missing")},
      ${sqlNullableInteger(monitoring.monitoringWindowDays ?? 0)},
      ${sqlNullableInteger(monitoring.monitoredTimelineCount ?? 0)},
      ${sqlNullableInteger(monitoring.sampledTimelineCount ?? 0)},
      ${sqlNullableInteger(monitoring.incidentCount ?? 0)},
      ${sqlNullableInteger(monitoring.unresolvedIncidentCount ?? 0)},
      ${sqlNullableInteger(monitoring.closedExceptionCount ?? 0)},
      ${sqlNullableInteger(monitoring.rollbackExecutionCount ?? 0)},
      ${sqlNullableInteger(monitoring.lesionCount ?? 0)},
      ${sqlNullableInteger(monitoring.readyTimelineCount ?? 0)},
      ${sqlNullableInteger(monitoring.blockedTimelineCount ?? 0)},
      ${sqlNullableInteger(monitoring.candidatePairCount ?? 0)},
      ${sqlNullableInteger(monitoring.reviewerWorkflowReadyCount ?? 0)},
      false,
      false,
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-025/026/028",
        timelineRolloutMonitoringBoundary: "metadata_only",
        outcomeMonitoringBoundary: "aggregate_only",
        incidentEvidenceBoundary: "counts_only",
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      now()
    from target_visit v
    on conflict (visit_id) do update
    set
      reviewed_by_user_id = excluded.reviewed_by_user_id,
      monitoring_status = excluded.monitoring_status,
      monitoring_reasons = excluded.monitoring_reasons,
      evidence_status = excluded.evidence_status,
      sop_status = excluded.sop_status,
      validation_status = excluded.validation_status,
      rollout_status = excluded.rollout_status,
      outcome_sampling_status = excluded.outcome_sampling_status,
      incident_review_status = excluded.incident_review_status,
      exception_closure_status = excluded.exception_closure_status,
      rollback_outcome_status = excluded.rollback_outcome_status,
      owner_final_review_status = excluded.owner_final_review_status,
      monitoring_window_days = excluded.monitoring_window_days,
      monitored_timeline_count = excluded.monitored_timeline_count,
      sampled_timeline_count = excluded.sampled_timeline_count,
      incident_count = excluded.incident_count,
      unresolved_incident_count = excluded.unresolved_incident_count,
      closed_exception_count = excluded.closed_exception_count,
      rollback_execution_count = excluded.rollback_execution_count,
      lesion_count = excluded.lesion_count,
      ready_timeline_count = excluded.ready_timeline_count,
      blocked_timeline_count = excluded.blocked_timeline_count,
      candidate_pair_count = excluded.candidate_pair_count,
      reviewer_workflow_ready_count = excluded.reviewer_workflow_ready_count,
      patient_delivery_allowed = false,
      medical_measurement_allowed = false,
      protected_fields_exposed = false,
      clinical_output_generated = false,
      metadata_json = visit_longitudinal_timeline_rollout_monitoring_reviews.metadata_json || excluded.metadata_json,
      reviewed_at = now(),
      updated_at = now()
    where true ${monitoringScope}
    returning *
  )
  select
    m.id::text as "id",
    m.clinic_id::text as "clinicId",
    m.patient_id::text as "patientId",
    m.visit_id::text as "visitId",
    m.monitoring_status as "status",
    m.monitoring_reasons as "reasons",
    m.evidence_status as "evidenceStatus",
    m.sop_status as "sopStatus",
    m.validation_status as "validationStatus",
    m.rollout_status as "rolloutStatus",
    m.outcome_sampling_status as "outcomeSamplingStatus",
    m.incident_review_status as "incidentReviewStatus",
    m.exception_closure_status as "exceptionClosureStatus",
    m.rollback_outcome_status as "rollbackOutcomeStatus",
    m.owner_final_review_status as "ownerFinalReviewStatus",
    m.monitoring_window_days as "monitoringWindowDays",
    m.monitored_timeline_count as "monitoredTimelineCount",
    m.sampled_timeline_count as "sampledTimelineCount",
    m.incident_count as "incidentCount",
    m.unresolved_incident_count as "unresolvedIncidentCount",
    m.closed_exception_count as "closedExceptionCount",
    m.rollback_execution_count as "rollbackExecutionCount",
    m.lesion_count as "lesionCount",
    m.ready_timeline_count as "readyTimelineCount",
    m.blocked_timeline_count as "blockedTimelineCount",
    m.candidate_pair_count as "candidatePairCount",
    m.reviewer_workflow_ready_count as "reviewerWorkflowReadyCount",
    m.patient_delivery_allowed as "patientDeliveryAllowed",
    m.medical_measurement_allowed as "medicalMeasurementAllowed",
    m.protected_fields_exposed as "protectedFieldsExposed",
    m.clinical_output_generated as "clinicalOutputGenerated",
    m.reviewed_at as "reviewedAt",
    m.created_at as "createdAt",
    m.updated_at as "updatedAt"
  from upserted m
  limit 1
) result;
`.trim();
}

export function buildReviewVisitLongitudinalTimelineRolloutIncidentProcedureSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  procedure = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const visitScope = clinicScopeWhere({ alias: "v", clinicIds, allClinics });
  const procedureScope = clinicScopeWhere({
    alias: "visit_longitudinal_timeline_rollout_incident_procedure_reviews",
    clinicIds,
    allClinics,
  });
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
      ${visitScope}
    limit 1
  ),
  upserted as (
    insert into visit_longitudinal_timeline_rollout_incident_procedure_reviews (
      clinic_id,
      patient_id,
      visit_id,
      reviewed_by_user_id,
      procedure_status,
      procedure_reasons,
      monitoring_status,
      evidence_status,
      sop_status,
      validation_status,
      rollout_status,
      real_dataset_status,
      outcome_sampling_procedure_status,
      incident_triage_status,
      escalation_path_status,
      rollback_decision_status,
      owner_review_status,
      real_dataset_timeline_count,
      monitored_timeline_count,
      sampled_outcome_count,
      incident_case_count,
      unresolved_incident_count,
      escalated_incident_count,
      rollback_decision_count,
      lesion_count,
      ready_timeline_count,
      blocked_timeline_count,
      candidate_pair_count,
      reviewer_workflow_ready_count,
      patient_delivery_allowed,
      medical_measurement_allowed,
      protected_fields_exposed,
      clinical_output_generated,
      metadata_json,
      reviewed_at
    )
    select
      v.clinic_id,
      v.patient_id,
      v.id,
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(procedure.procedureStatus ?? "not_started")},
      ${sqlJsonb(procedure.procedureReasons ?? [])},
      ${sqlLiteral(procedure.monitoringStatus ?? "not_started")},
      ${sqlLiteral(procedure.evidenceStatus ?? "not_started")},
      ${sqlLiteral(procedure.sopStatus ?? "not_started")},
      ${sqlLiteral(procedure.validationStatus ?? "blocked")},
      ${sqlLiteral(procedure.rolloutStatus ?? "not_approved")},
      ${sqlLiteral(procedure.realDatasetStatus ?? "missing")},
      ${sqlLiteral(procedure.outcomeSamplingProcedureStatus ?? "missing")},
      ${sqlLiteral(procedure.incidentTriageStatus ?? "missing")},
      ${sqlLiteral(procedure.escalationPathStatus ?? "missing")},
      ${sqlLiteral(procedure.rollbackDecisionStatus ?? "missing")},
      ${sqlLiteral(procedure.ownerReviewStatus ?? "missing")},
      ${sqlNullableInteger(procedure.realDatasetTimelineCount ?? 0)},
      ${sqlNullableInteger(procedure.monitoredTimelineCount ?? 0)},
      ${sqlNullableInteger(procedure.sampledOutcomeCount ?? 0)},
      ${sqlNullableInteger(procedure.incidentCaseCount ?? 0)},
      ${sqlNullableInteger(procedure.unresolvedIncidentCount ?? 0)},
      ${sqlNullableInteger(procedure.escalatedIncidentCount ?? 0)},
      ${sqlNullableInteger(procedure.rollbackDecisionCount ?? 0)},
      ${sqlNullableInteger(procedure.lesionCount ?? 0)},
      ${sqlNullableInteger(procedure.readyTimelineCount ?? 0)},
      ${sqlNullableInteger(procedure.blockedTimelineCount ?? 0)},
      ${sqlNullableInteger(procedure.candidatePairCount ?? 0)},
      ${sqlNullableInteger(procedure.reviewerWorkflowReadyCount ?? 0)},
      false,
      false,
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-025/026/028",
        timelineRolloutIncidentProcedureBoundary: "metadata_only",
        realClinicalDatasetBoundary: "aggregate_only",
        incidentProcedureBoundary: "counts_only",
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      now()
    from target_visit v
    on conflict (visit_id) do update
    set
      reviewed_by_user_id = excluded.reviewed_by_user_id,
      procedure_status = excluded.procedure_status,
      procedure_reasons = excluded.procedure_reasons,
      monitoring_status = excluded.monitoring_status,
      evidence_status = excluded.evidence_status,
      sop_status = excluded.sop_status,
      validation_status = excluded.validation_status,
      rollout_status = excluded.rollout_status,
      real_dataset_status = excluded.real_dataset_status,
      outcome_sampling_procedure_status = excluded.outcome_sampling_procedure_status,
      incident_triage_status = excluded.incident_triage_status,
      escalation_path_status = excluded.escalation_path_status,
      rollback_decision_status = excluded.rollback_decision_status,
      owner_review_status = excluded.owner_review_status,
      real_dataset_timeline_count = excluded.real_dataset_timeline_count,
      monitored_timeline_count = excluded.monitored_timeline_count,
      sampled_outcome_count = excluded.sampled_outcome_count,
      incident_case_count = excluded.incident_case_count,
      unresolved_incident_count = excluded.unresolved_incident_count,
      escalated_incident_count = excluded.escalated_incident_count,
      rollback_decision_count = excluded.rollback_decision_count,
      lesion_count = excluded.lesion_count,
      ready_timeline_count = excluded.ready_timeline_count,
      blocked_timeline_count = excluded.blocked_timeline_count,
      candidate_pair_count = excluded.candidate_pair_count,
      reviewer_workflow_ready_count = excluded.reviewer_workflow_ready_count,
      patient_delivery_allowed = false,
      medical_measurement_allowed = false,
      protected_fields_exposed = false,
      clinical_output_generated = false,
      metadata_json = visit_longitudinal_timeline_rollout_incident_procedure_reviews.metadata_json || excluded.metadata_json,
      reviewed_at = now(),
      updated_at = now()
    where true ${procedureScope}
    returning *
  )
  select
    p.id::text as "id",
    p.clinic_id::text as "clinicId",
    p.patient_id::text as "patientId",
    p.visit_id::text as "visitId",
    p.procedure_status as "status",
    p.procedure_reasons as "reasons",
    p.monitoring_status as "monitoringStatus",
    p.evidence_status as "evidenceStatus",
    p.sop_status as "sopStatus",
    p.validation_status as "validationStatus",
    p.rollout_status as "rolloutStatus",
    p.real_dataset_status as "realDatasetStatus",
    p.outcome_sampling_procedure_status as "outcomeSamplingProcedureStatus",
    p.incident_triage_status as "incidentTriageStatus",
    p.escalation_path_status as "escalationPathStatus",
    p.rollback_decision_status as "rollbackDecisionStatus",
    p.owner_review_status as "ownerReviewStatus",
    p.real_dataset_timeline_count as "realDatasetTimelineCount",
    p.monitored_timeline_count as "monitoredTimelineCount",
    p.sampled_outcome_count as "sampledOutcomeCount",
    p.incident_case_count as "incidentCaseCount",
    p.unresolved_incident_count as "unresolvedIncidentCount",
    p.escalated_incident_count as "escalatedIncidentCount",
    p.rollback_decision_count as "rollbackDecisionCount",
    p.lesion_count as "lesionCount",
    p.ready_timeline_count as "readyTimelineCount",
    p.blocked_timeline_count as "blockedTimelineCount",
    p.candidate_pair_count as "candidatePairCount",
    p.reviewer_workflow_ready_count as "reviewerWorkflowReadyCount",
    p.patient_delivery_allowed as "patientDeliveryAllowed",
    p.medical_measurement_allowed as "medicalMeasurementAllowed",
    p.protected_fields_exposed as "protectedFieldsExposed",
    p.clinical_output_generated as "clinicalOutputGenerated",
    p.reviewed_at as "reviewedAt",
    p.created_at as "createdAt",
    p.updated_at as "updatedAt"
  from upserted p
  limit 1
) result;
`.trim();
}

export function buildReviewVisitLongitudinalTimelineRolloutClinicalValidationSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  clinicalValidation = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const visitScope = clinicScopeWhere({ alias: "v", clinicIds, allClinics });
  const clinicalValidationScope = clinicScopeWhere({
    alias: "visit_longitudinal_timeline_rollout_clinical_validation_reviews",
    clinicIds,
    allClinics,
  });
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
      ${visitScope}
    limit 1
  ),
  upserted as (
    insert into visit_longitudinal_timeline_rollout_clinical_validation_reviews (
      clinic_id,
      patient_id,
      visit_id,
      reviewed_by_user_id,
      clinical_validation_status,
      clinical_validation_reasons,
      incident_procedure_status,
      monitoring_status,
      evidence_status,
      sop_status,
      dataset_validation_status,
      rollout_status,
      real_dataset_lock_status,
      validator_training_status,
      blinded_sample_status,
      adjudication_status,
      decision_log_status,
      owner_acceptance_status,
      real_dataset_timeline_count,
      validation_sample_count,
      disagreement_case_count,
      adjudicated_case_count,
      followup_window_days,
      blocker_count,
      lesion_count,
      ready_timeline_count,
      blocked_timeline_count,
      candidate_pair_count,
      reviewer_workflow_ready_count,
      patient_delivery_allowed,
      medical_measurement_allowed,
      protected_fields_exposed,
      clinical_output_generated,
      metadata_json,
      reviewed_at
    )
    select
      v.clinic_id,
      v.patient_id,
      v.id,
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(clinicalValidation.clinicalValidationStatus ?? "not_started")},
      ${sqlJsonb(clinicalValidation.clinicalValidationReasons ?? [])},
      ${sqlLiteral(clinicalValidation.incidentProcedureStatus ?? "not_started")},
      ${sqlLiteral(clinicalValidation.monitoringStatus ?? "not_started")},
      ${sqlLiteral(clinicalValidation.evidenceStatus ?? "not_started")},
      ${sqlLiteral(clinicalValidation.sopStatus ?? "not_started")},
      ${sqlLiteral(clinicalValidation.validationStatus ?? "blocked")},
      ${sqlLiteral(clinicalValidation.rolloutStatus ?? "not_approved")},
      ${sqlLiteral(clinicalValidation.realDatasetLockStatus ?? "missing")},
      ${sqlLiteral(clinicalValidation.validatorTrainingStatus ?? "missing")},
      ${sqlLiteral(clinicalValidation.blindedSampleStatus ?? "missing")},
      ${sqlLiteral(clinicalValidation.adjudicationStatus ?? "missing")},
      ${sqlLiteral(clinicalValidation.decisionLogStatus ?? "missing")},
      ${sqlLiteral(clinicalValidation.ownerAcceptanceStatus ?? "missing")},
      ${sqlNullableInteger(clinicalValidation.realDatasetTimelineCount ?? 0)},
      ${sqlNullableInteger(clinicalValidation.validationSampleCount ?? 0)},
      ${sqlNullableInteger(clinicalValidation.disagreementCaseCount ?? 0)},
      ${sqlNullableInteger(clinicalValidation.adjudicatedCaseCount ?? 0)},
      ${sqlNullableInteger(clinicalValidation.followupWindowDays ?? 0)},
      ${sqlNullableInteger(clinicalValidation.blockerCount ?? 0)},
      ${sqlNullableInteger(clinicalValidation.lesionCount ?? 0)},
      ${sqlNullableInteger(clinicalValidation.readyTimelineCount ?? 0)},
      ${sqlNullableInteger(clinicalValidation.blockedTimelineCount ?? 0)},
      ${sqlNullableInteger(clinicalValidation.candidatePairCount ?? 0)},
      ${sqlNullableInteger(clinicalValidation.reviewerWorkflowReadyCount ?? 0)},
      false,
      false,
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-025/026/028",
        timelineRolloutClinicalValidationBoundary: "metadata_only",
        realClinicalDatasetBoundary: "aggregate_only",
        validationReviewBoundary: "counts_only",
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      now()
    from target_visit v
    on conflict (visit_id) do update
    set
      reviewed_by_user_id = excluded.reviewed_by_user_id,
      clinical_validation_status = excluded.clinical_validation_status,
      clinical_validation_reasons = excluded.clinical_validation_reasons,
      incident_procedure_status = excluded.incident_procedure_status,
      monitoring_status = excluded.monitoring_status,
      evidence_status = excluded.evidence_status,
      sop_status = excluded.sop_status,
      dataset_validation_status = excluded.dataset_validation_status,
      rollout_status = excluded.rollout_status,
      real_dataset_lock_status = excluded.real_dataset_lock_status,
      validator_training_status = excluded.validator_training_status,
      blinded_sample_status = excluded.blinded_sample_status,
      adjudication_status = excluded.adjudication_status,
      decision_log_status = excluded.decision_log_status,
      owner_acceptance_status = excluded.owner_acceptance_status,
      real_dataset_timeline_count = excluded.real_dataset_timeline_count,
      validation_sample_count = excluded.validation_sample_count,
      disagreement_case_count = excluded.disagreement_case_count,
      adjudicated_case_count = excluded.adjudicated_case_count,
      followup_window_days = excluded.followup_window_days,
      blocker_count = excluded.blocker_count,
      lesion_count = excluded.lesion_count,
      ready_timeline_count = excluded.ready_timeline_count,
      blocked_timeline_count = excluded.blocked_timeline_count,
      candidate_pair_count = excluded.candidate_pair_count,
      reviewer_workflow_ready_count = excluded.reviewer_workflow_ready_count,
      patient_delivery_allowed = false,
      medical_measurement_allowed = false,
      protected_fields_exposed = false,
      clinical_output_generated = false,
      metadata_json = visit_longitudinal_timeline_rollout_clinical_validation_reviews.metadata_json || excluded.metadata_json,
      reviewed_at = now(),
      updated_at = now()
    where true ${clinicalValidationScope}
    returning *
  )
  select
    c.id::text as "id",
    c.clinic_id::text as "clinicId",
    c.patient_id::text as "patientId",
    c.visit_id::text as "visitId",
    c.clinical_validation_status as "status",
    c.clinical_validation_reasons as "reasons",
    c.incident_procedure_status as "incidentProcedureStatus",
    c.monitoring_status as "monitoringStatus",
    c.evidence_status as "evidenceStatus",
    c.sop_status as "sopStatus",
    c.dataset_validation_status as "validationStatus",
    c.rollout_status as "rolloutStatus",
    c.real_dataset_lock_status as "realDatasetLockStatus",
    c.validator_training_status as "validatorTrainingStatus",
    c.blinded_sample_status as "blindedSampleStatus",
    c.adjudication_status as "adjudicationStatus",
    c.decision_log_status as "decisionLogStatus",
    c.owner_acceptance_status as "ownerAcceptanceStatus",
    c.real_dataset_timeline_count as "realDatasetTimelineCount",
    c.validation_sample_count as "validationSampleCount",
    c.disagreement_case_count as "disagreementCaseCount",
    c.adjudicated_case_count as "adjudicatedCaseCount",
    c.followup_window_days as "followupWindowDays",
    c.blocker_count as "blockerCount",
    c.lesion_count as "lesionCount",
    c.ready_timeline_count as "readyTimelineCount",
    c.blocked_timeline_count as "blockedTimelineCount",
    c.candidate_pair_count as "candidatePairCount",
    c.reviewer_workflow_ready_count as "reviewerWorkflowReadyCount",
    c.patient_delivery_allowed as "patientDeliveryAllowed",
    c.medical_measurement_allowed as "medicalMeasurementAllowed",
    c.protected_fields_exposed as "protectedFieldsExposed",
    c.clinical_output_generated as "clinicalOutputGenerated",
    c.reviewed_at as "reviewedAt",
    c.created_at as "createdAt",
    c.updated_at as "updatedAt"
  from upserted c
  limit 1
) result;
`.trim();
}

export function buildReviewVisitLongitudinalTimelineRolloutPostValidationMonitoringSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  postValidationMonitoring = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const visitScope = clinicScopeWhere({ alias: "v", clinicIds, allClinics });
  const postValidationMonitoringScope = clinicScopeWhere({
    alias: "visit_longitudinal_timeline_rollout_post_validation_monitoring_reviews",
    clinicIds,
    allClinics,
  });
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
      ${visitScope}
    limit 1
  ),
  upserted as (
    insert into visit_longitudinal_timeline_rollout_post_validation_monitoring_reviews (
      clinic_id,
      patient_id,
      visit_id,
      reviewed_by_user_id,
      post_validation_monitoring_status,
      post_validation_monitoring_reasons,
      clinical_validation_status,
      incident_procedure_status,
      monitoring_status,
      evidence_status,
      sop_status,
      dataset_validation_status,
      rollout_status,
      monitoring_window_status,
      outcome_review_status,
      drift_review_status,
      incident_followup_status,
      validator_recheck_status,
      owner_signoff_status,
      real_dataset_timeline_count,
      clinical_validation_sample_count,
      monitored_timeline_count,
      sampled_outcome_count,
      drift_signal_count,
      unresolved_drift_signal_count,
      incident_followup_count,
      unresolved_incident_followup_count,
      validator_recheck_count,
      blocker_count,
      lesion_count,
      ready_timeline_count,
      blocked_timeline_count,
      candidate_pair_count,
      reviewer_workflow_ready_count,
      patient_delivery_allowed,
      medical_measurement_allowed,
      protected_fields_exposed,
      clinical_output_generated,
      metadata_json,
      reviewed_at
    )
    select
      v.clinic_id,
      v.patient_id,
      v.id,
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(postValidationMonitoring.postValidationMonitoringStatus ?? "not_started")},
      ${sqlJsonb(postValidationMonitoring.postValidationMonitoringReasons ?? [])},
      ${sqlLiteral(postValidationMonitoring.clinicalValidationStatus ?? "not_started")},
      ${sqlLiteral(postValidationMonitoring.incidentProcedureStatus ?? "not_started")},
      ${sqlLiteral(postValidationMonitoring.monitoringStatus ?? "not_started")},
      ${sqlLiteral(postValidationMonitoring.evidenceStatus ?? "not_started")},
      ${sqlLiteral(postValidationMonitoring.sopStatus ?? "not_started")},
      ${sqlLiteral(postValidationMonitoring.validationStatus ?? "blocked")},
      ${sqlLiteral(postValidationMonitoring.rolloutStatus ?? "not_approved")},
      ${sqlLiteral(postValidationMonitoring.monitoringWindowStatus ?? "missing")},
      ${sqlLiteral(postValidationMonitoring.outcomeReviewStatus ?? "missing")},
      ${sqlLiteral(postValidationMonitoring.driftReviewStatus ?? "missing")},
      ${sqlLiteral(postValidationMonitoring.incidentFollowupStatus ?? "missing")},
      ${sqlLiteral(postValidationMonitoring.validatorRecheckStatus ?? "missing")},
      ${sqlLiteral(postValidationMonitoring.ownerSignoffStatus ?? "missing")},
      ${sqlNullableInteger(postValidationMonitoring.realDatasetTimelineCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.clinicalValidationSampleCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.monitoredTimelineCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.sampledOutcomeCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.driftSignalCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.unresolvedDriftSignalCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.incidentFollowupCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.unresolvedIncidentFollowupCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.validatorRecheckCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.blockerCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.lesionCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.readyTimelineCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.blockedTimelineCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.candidatePairCount ?? 0)},
      ${sqlNullableInteger(postValidationMonitoring.reviewerWorkflowReadyCount ?? 0)},
      false,
      false,
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-025/026/028",
        timelineRolloutPostValidationMonitoringBoundary: "metadata_only",
        postValidationMonitoringBoundary: "aggregate_only",
        driftReviewBoundary: "counts_only",
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      now()
    from target_visit v
    on conflict (visit_id) do update
    set
      reviewed_by_user_id = excluded.reviewed_by_user_id,
      post_validation_monitoring_status = excluded.post_validation_monitoring_status,
      post_validation_monitoring_reasons = excluded.post_validation_monitoring_reasons,
      clinical_validation_status = excluded.clinical_validation_status,
      incident_procedure_status = excluded.incident_procedure_status,
      monitoring_status = excluded.monitoring_status,
      evidence_status = excluded.evidence_status,
      sop_status = excluded.sop_status,
      dataset_validation_status = excluded.dataset_validation_status,
      rollout_status = excluded.rollout_status,
      monitoring_window_status = excluded.monitoring_window_status,
      outcome_review_status = excluded.outcome_review_status,
      drift_review_status = excluded.drift_review_status,
      incident_followup_status = excluded.incident_followup_status,
      validator_recheck_status = excluded.validator_recheck_status,
      owner_signoff_status = excluded.owner_signoff_status,
      real_dataset_timeline_count = excluded.real_dataset_timeline_count,
      clinical_validation_sample_count = excluded.clinical_validation_sample_count,
      monitored_timeline_count = excluded.monitored_timeline_count,
      sampled_outcome_count = excluded.sampled_outcome_count,
      drift_signal_count = excluded.drift_signal_count,
      unresolved_drift_signal_count = excluded.unresolved_drift_signal_count,
      incident_followup_count = excluded.incident_followup_count,
      unresolved_incident_followup_count = excluded.unresolved_incident_followup_count,
      validator_recheck_count = excluded.validator_recheck_count,
      blocker_count = excluded.blocker_count,
      lesion_count = excluded.lesion_count,
      ready_timeline_count = excluded.ready_timeline_count,
      blocked_timeline_count = excluded.blocked_timeline_count,
      candidate_pair_count = excluded.candidate_pair_count,
      reviewer_workflow_ready_count = excluded.reviewer_workflow_ready_count,
      patient_delivery_allowed = false,
      medical_measurement_allowed = false,
      protected_fields_exposed = false,
      clinical_output_generated = false,
      metadata_json = visit_longitudinal_timeline_rollout_post_validation_monitoring_reviews.metadata_json || excluded.metadata_json,
      reviewed_at = now(),
      updated_at = now()
    where true ${postValidationMonitoringScope}
    returning *
  )
  select
    p.id::text as "id",
    p.clinic_id::text as "clinicId",
    p.patient_id::text as "patientId",
    p.visit_id::text as "visitId",
    p.post_validation_monitoring_status as "status",
    p.post_validation_monitoring_reasons as "reasons",
    p.clinical_validation_status as "clinicalValidationStatus",
    p.incident_procedure_status as "incidentProcedureStatus",
    p.monitoring_status as "monitoringStatus",
    p.evidence_status as "evidenceStatus",
    p.sop_status as "sopStatus",
    p.dataset_validation_status as "validationStatus",
    p.rollout_status as "rolloutStatus",
    p.monitoring_window_status as "monitoringWindowStatus",
    p.outcome_review_status as "outcomeReviewStatus",
    p.drift_review_status as "driftReviewStatus",
    p.incident_followup_status as "incidentFollowupStatus",
    p.validator_recheck_status as "validatorRecheckStatus",
    p.owner_signoff_status as "ownerSignoffStatus",
    p.real_dataset_timeline_count as "realDatasetTimelineCount",
    p.clinical_validation_sample_count as "clinicalValidationSampleCount",
    p.monitored_timeline_count as "monitoredTimelineCount",
    p.sampled_outcome_count as "sampledOutcomeCount",
    p.drift_signal_count as "driftSignalCount",
    p.unresolved_drift_signal_count as "unresolvedDriftSignalCount",
    p.incident_followup_count as "incidentFollowupCount",
    p.unresolved_incident_followup_count as "unresolvedIncidentFollowupCount",
    p.validator_recheck_count as "validatorRecheckCount",
    p.blocker_count as "blockerCount",
    p.lesion_count as "lesionCount",
    p.ready_timeline_count as "readyTimelineCount",
    p.blocked_timeline_count as "blockedTimelineCount",
    p.candidate_pair_count as "candidatePairCount",
    p.reviewer_workflow_ready_count as "reviewerWorkflowReadyCount",
    p.patient_delivery_allowed as "patientDeliveryAllowed",
    p.medical_measurement_allowed as "medicalMeasurementAllowed",
    p.protected_fields_exposed as "protectedFieldsExposed",
    p.clinical_output_generated as "clinicalOutputGenerated",
    p.reviewed_at as "reviewedAt",
    p.created_at as "createdAt",
    p.updated_at as "updatedAt"
  from upserted p
  limit 1
) result;
`.trim();
}

export function buildReviewVisitLongitudinalTimelineRolloutObservationGovernanceSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  observationGovernance = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const visitScope = clinicScopeWhere({ alias: "v", clinicIds, allClinics });
  const observationGovernanceScope = clinicScopeWhere({
    alias: "visit_longitudinal_timeline_rollout_observation_governance_reviews",
    clinicIds,
    allClinics,
  });
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
      ${visitScope}
    limit 1
  ),
  upserted as (
    insert into visit_longitudinal_timeline_rollout_observation_governance_reviews (
      clinic_id,
      patient_id,
      visit_id,
      reviewed_by_user_id,
      observation_governance_status,
      observation_governance_reasons,
      post_validation_monitoring_status,
      clinical_validation_status,
      incident_procedure_status,
      monitoring_status,
      evidence_status,
      sop_status,
      dataset_validation_status,
      rollout_status,
      observation_window_status,
      outcome_observation_status,
      drift_signal_review_status,
      incident_outcome_review_status,
      followup_closure_status,
      governance_review_status,
      owner_signoff_status,
      real_dataset_timeline_count,
      post_validation_sample_count,
      observed_timeline_count,
      expected_followup_count,
      completed_followup_count,
      drift_signal_count,
      unresolved_drift_signal_count,
      incident_outcome_count,
      unresolved_incident_outcome_count,
      governance_exception_count,
      unresolved_governance_exception_count,
      blocker_count,
      lesion_count,
      ready_timeline_count,
      blocked_timeline_count,
      candidate_pair_count,
      reviewer_workflow_ready_count,
      patient_delivery_allowed,
      medical_measurement_allowed,
      protected_fields_exposed,
      clinical_output_generated,
      metadata_json,
      reviewed_at
    )
    select
      v.clinic_id,
      v.patient_id,
      v.id,
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(observationGovernance.observationGovernanceStatus ?? "not_started")},
      ${sqlJsonb(observationGovernance.observationGovernanceReasons ?? [])},
      ${sqlLiteral(observationGovernance.postValidationMonitoringStatus ?? "not_started")},
      ${sqlLiteral(observationGovernance.clinicalValidationStatus ?? "not_started")},
      ${sqlLiteral(observationGovernance.incidentProcedureStatus ?? "not_started")},
      ${sqlLiteral(observationGovernance.monitoringStatus ?? "not_started")},
      ${sqlLiteral(observationGovernance.evidenceStatus ?? "not_started")},
      ${sqlLiteral(observationGovernance.sopStatus ?? "not_started")},
      ${sqlLiteral(observationGovernance.validationStatus ?? "blocked")},
      ${sqlLiteral(observationGovernance.rolloutStatus ?? "not_approved")},
      ${sqlLiteral(observationGovernance.observationWindowStatus ?? "missing")},
      ${sqlLiteral(observationGovernance.outcomeObservationStatus ?? "missing")},
      ${sqlLiteral(observationGovernance.driftSignalReviewStatus ?? "missing")},
      ${sqlLiteral(observationGovernance.incidentOutcomeReviewStatus ?? "missing")},
      ${sqlLiteral(observationGovernance.followupClosureStatus ?? "missing")},
      ${sqlLiteral(observationGovernance.governanceReviewStatus ?? "missing")},
      ${sqlLiteral(observationGovernance.ownerSignoffStatus ?? "missing")},
      ${sqlNullableInteger(observationGovernance.realDatasetTimelineCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.postValidationSampleCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.observedTimelineCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.expectedFollowupCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.completedFollowupCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.driftSignalCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.unresolvedDriftSignalCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.incidentOutcomeCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.unresolvedIncidentOutcomeCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.governanceExceptionCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.unresolvedGovernanceExceptionCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.blockerCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.lesionCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.readyTimelineCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.blockedTimelineCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.candidatePairCount ?? 0)},
      ${sqlNullableInteger(observationGovernance.reviewerWorkflowReadyCount ?? 0)},
      false,
      false,
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-025/026/028",
        timelineRolloutObservationGovernanceBoundary: "metadata_only",
        observationGovernanceBoundary: "aggregate_only",
        incidentOutcomeReviewBoundary: "counts_only",
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      now()
    from target_visit v
    on conflict (visit_id) do update
    set
      reviewed_by_user_id = excluded.reviewed_by_user_id,
      observation_governance_status = excluded.observation_governance_status,
      observation_governance_reasons = excluded.observation_governance_reasons,
      post_validation_monitoring_status = excluded.post_validation_monitoring_status,
      clinical_validation_status = excluded.clinical_validation_status,
      incident_procedure_status = excluded.incident_procedure_status,
      monitoring_status = excluded.monitoring_status,
      evidence_status = excluded.evidence_status,
      sop_status = excluded.sop_status,
      dataset_validation_status = excluded.dataset_validation_status,
      rollout_status = excluded.rollout_status,
      observation_window_status = excluded.observation_window_status,
      outcome_observation_status = excluded.outcome_observation_status,
      drift_signal_review_status = excluded.drift_signal_review_status,
      incident_outcome_review_status = excluded.incident_outcome_review_status,
      followup_closure_status = excluded.followup_closure_status,
      governance_review_status = excluded.governance_review_status,
      owner_signoff_status = excluded.owner_signoff_status,
      real_dataset_timeline_count = excluded.real_dataset_timeline_count,
      post_validation_sample_count = excluded.post_validation_sample_count,
      observed_timeline_count = excluded.observed_timeline_count,
      expected_followup_count = excluded.expected_followup_count,
      completed_followup_count = excluded.completed_followup_count,
      drift_signal_count = excluded.drift_signal_count,
      unresolved_drift_signal_count = excluded.unresolved_drift_signal_count,
      incident_outcome_count = excluded.incident_outcome_count,
      unresolved_incident_outcome_count = excluded.unresolved_incident_outcome_count,
      governance_exception_count = excluded.governance_exception_count,
      unresolved_governance_exception_count = excluded.unresolved_governance_exception_count,
      blocker_count = excluded.blocker_count,
      lesion_count = excluded.lesion_count,
      ready_timeline_count = excluded.ready_timeline_count,
      blocked_timeline_count = excluded.blocked_timeline_count,
      candidate_pair_count = excluded.candidate_pair_count,
      reviewer_workflow_ready_count = excluded.reviewer_workflow_ready_count,
      patient_delivery_allowed = false,
      medical_measurement_allowed = false,
      protected_fields_exposed = false,
      clinical_output_generated = false,
      metadata_json = visit_longitudinal_timeline_rollout_observation_governance_reviews.metadata_json || excluded.metadata_json,
      reviewed_at = now(),
      updated_at = now()
    where true ${observationGovernanceScope}
    returning *
  )
  select
    g.id::text as "id",
    g.clinic_id::text as "clinicId",
    g.patient_id::text as "patientId",
    g.visit_id::text as "visitId",
    g.observation_governance_status as "status",
    g.observation_governance_reasons as "reasons",
    g.post_validation_monitoring_status as "postValidationMonitoringStatus",
    g.clinical_validation_status as "clinicalValidationStatus",
    g.incident_procedure_status as "incidentProcedureStatus",
    g.monitoring_status as "monitoringStatus",
    g.evidence_status as "evidenceStatus",
    g.sop_status as "sopStatus",
    g.dataset_validation_status as "validationStatus",
    g.rollout_status as "rolloutStatus",
    g.observation_window_status as "observationWindowStatus",
    g.outcome_observation_status as "outcomeObservationStatus",
    g.drift_signal_review_status as "driftSignalReviewStatus",
    g.incident_outcome_review_status as "incidentOutcomeReviewStatus",
    g.followup_closure_status as "followupClosureStatus",
    g.governance_review_status as "governanceReviewStatus",
    g.owner_signoff_status as "ownerSignoffStatus",
    g.real_dataset_timeline_count as "realDatasetTimelineCount",
    g.post_validation_sample_count as "postValidationSampleCount",
    g.observed_timeline_count as "observedTimelineCount",
    g.expected_followup_count as "expectedFollowupCount",
    g.completed_followup_count as "completedFollowupCount",
    g.drift_signal_count as "driftSignalCount",
    g.unresolved_drift_signal_count as "unresolvedDriftSignalCount",
    g.incident_outcome_count as "incidentOutcomeCount",
    g.unresolved_incident_outcome_count as "unresolvedIncidentOutcomeCount",
    g.governance_exception_count as "governanceExceptionCount",
    g.unresolved_governance_exception_count as "unresolvedGovernanceExceptionCount",
    g.blocker_count as "blockerCount",
    g.lesion_count as "lesionCount",
    g.ready_timeline_count as "readyTimelineCount",
    g.blocked_timeline_count as "blockedTimelineCount",
    g.candidate_pair_count as "candidatePairCount",
    g.reviewer_workflow_ready_count as "reviewerWorkflowReadyCount",
    g.patient_delivery_allowed as "patientDeliveryAllowed",
    g.medical_measurement_allowed as "medicalMeasurementAllowed",
    g.protected_fields_exposed as "protectedFieldsExposed",
    g.clinical_output_generated as "clinicalOutputGenerated",
    g.reviewed_at as "reviewedAt",
    g.created_at as "createdAt",
    g.updated_at as "updatedAt"
  from upserted g
  limit 1
) result;
`.trim();
}

export function buildReviewVisitLongitudinalTimelineRolloutSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  rollout = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const visitScope = clinicScopeWhere({ alias: "v", clinicIds, allClinics });
  const reviewScope = clinicScopeWhere({ alias: "visit_longitudinal_timeline_rollout_reviews", clinicIds, allClinics });
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
      ${visitScope}
    limit 1
  ),
  upserted as (
    insert into visit_longitudinal_timeline_rollout_reviews (
      clinic_id,
      patient_id,
      visit_id,
      reviewed_by_user_id,
      rollout_status,
      rollout_reasons,
      validation_status,
      lesion_count,
      ready_timeline_count,
      needs_review_timeline_count,
      blocked_timeline_count,
      candidate_pair_count,
      reviewer_workflow_ready_count,
      patient_delivery_allowed,
      medical_measurement_allowed,
      protected_fields_exposed,
      clinical_output_generated,
      metadata_json,
      reviewed_at
    )
    select
      v.clinic_id,
      v.patient_id,
      v.id,
      ${sqlNullableUuid(doctorUserId)},
      ${sqlLiteral(rollout.rolloutStatus ?? "not_approved")},
      ${sqlJsonb(rollout.rolloutReasons ?? [])},
      ${sqlLiteral(rollout.validationStatus ?? "blocked")},
      ${sqlNullableInteger(rollout.lesionCount ?? 0)},
      ${sqlNullableInteger(rollout.readyTimelineCount ?? 0)},
      ${sqlNullableInteger(rollout.needsReviewTimelineCount ?? 0)},
      ${sqlNullableInteger(rollout.blockedTimelineCount ?? 0)},
      ${sqlNullableInteger(rollout.candidatePairCount ?? 0)},
      ${sqlNullableInteger(rollout.reviewerWorkflowReadyCount ?? 0)},
      false,
      false,
      false,
      false,
      ${sqlJsonb({
        brainstormTask: "SD-MF-025/026/028",
        timelineRolloutBoundary: "metadata_only",
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        pairKeysExposed: false,
        imageIdsExposed: false,
      })},
      now()
    from target_visit v
    on conflict (visit_id) do update
    set
      reviewed_by_user_id = excluded.reviewed_by_user_id,
      rollout_status = excluded.rollout_status,
      rollout_reasons = excluded.rollout_reasons,
      validation_status = excluded.validation_status,
      lesion_count = excluded.lesion_count,
      ready_timeline_count = excluded.ready_timeline_count,
      needs_review_timeline_count = excluded.needs_review_timeline_count,
      blocked_timeline_count = excluded.blocked_timeline_count,
      candidate_pair_count = excluded.candidate_pair_count,
      reviewer_workflow_ready_count = excluded.reviewer_workflow_ready_count,
      patient_delivery_allowed = false,
      medical_measurement_allowed = false,
      protected_fields_exposed = false,
      clinical_output_generated = false,
      metadata_json = visit_longitudinal_timeline_rollout_reviews.metadata_json || excluded.metadata_json,
      reviewed_at = now(),
      updated_at = now()
    where true ${reviewScope}
    returning *
  )
  select
    r.id::text as "id",
    r.clinic_id::text as "clinicId",
    r.patient_id::text as "patientId",
    r.visit_id::text as "visitId",
    r.rollout_status as "status",
    r.rollout_reasons as "reasons",
    r.validation_status as "validationStatus",
    r.lesion_count as "lesionCount",
    r.ready_timeline_count as "readyTimelineCount",
    r.needs_review_timeline_count as "needsReviewTimelineCount",
    r.blocked_timeline_count as "blockedTimelineCount",
    r.candidate_pair_count as "candidatePairCount",
    r.reviewer_workflow_ready_count as "reviewerWorkflowReadyCount",
    r.patient_delivery_allowed as "patientDeliveryAllowed",
    r.medical_measurement_allowed as "medicalMeasurementAllowed",
    r.protected_fields_exposed as "protectedFieldsExposed",
    r.clinical_output_generated as "clinicalOutputGenerated",
    r.reviewed_at as "reviewedAt",
    r.created_at as "createdAt",
    r.updated_at as "updatedAt"
  from upserted r
  limit 1
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
      m.device_capture_profile,
      m.lighting_profile,
      m.focus_profile,
      m.distance_profile,
      m.device_calibration_status,
      m.device_calibration_checked_at,
      m.device_evidence_status,
      m.capture_protocol_version,
      m.lens_profile,
      m.polarization_mode,
      m.color_reference_status,
      m.device_clock_sync_status,
      m.capture_protocol_status,
      case
        when a.object_bucket is null or a.object_key is null then 'needs_review'
        when coalesce(a.byte_size, 0) <= 0 then 'needs_review'
        when a.captured_at is null then 'needs_review'
        else 'ready'
      end as production_asset_status,
      array_remove(array[
        case when a.object_bucket is null or a.object_key is null then 'protected_storage_missing' end,
        case when coalesce(a.byte_size, 0) <= 0 then 'byte_size_missing' end,
        case when a.captured_at is null then 'capture_time_missing' end
      ]::text[], null) as production_asset_reasons,
      case
        when m.asset_id is null or coalesce(m.capture_source, 'unknown') <> 'device_bridge' then 'not_applicable'
        when m.device_id is null then 'needs_review'
        when d.id is null then 'needs_review'
        when d.status <> 'connected' then 'needs_review'
        when d.calibration_due_at is not null and d.calibration_due_at <= current_date then 'needs_review'
        when b.id is null then 'needs_review'
        when b.lan_status <> 'online' then 'needs_review'
        when coalesce(b.worker_status, 'unknown') <> 'online' then 'needs_review'
        when b.worker_last_seen_at is null or b.worker_last_seen_at < now() - interval '15 minutes' then 'needs_review'
        else 'ready'
      end as device_bridge_quality_status,
      array_remove(array[
        case when m.asset_id is not null and coalesce(m.capture_source, 'unknown') = 'device_bridge' and m.device_id is null then 'device_missing' end,
        case when m.asset_id is not null and coalesce(m.capture_source, 'unknown') = 'device_bridge' and m.device_id is not null and d.id is null then 'device_not_registered' end,
        case when m.asset_id is not null and coalesce(m.capture_source, 'unknown') = 'device_bridge' and d.id is not null and d.status <> 'connected' then 'device_not_connected' end,
        case when m.asset_id is not null and coalesce(m.capture_source, 'unknown') = 'device_bridge' and d.calibration_due_at is not null and d.calibration_due_at <= current_date then 'device_calibration_due' end,
        case when m.asset_id is not null and coalesce(m.capture_source, 'unknown') = 'device_bridge' and d.id is not null and b.id is null then 'bridge_not_paired' end,
        case when m.asset_id is not null and coalesce(m.capture_source, 'unknown') = 'device_bridge' and b.id is not null and b.lan_status <> 'online' then 'bridge_offline' end,
        case when m.asset_id is not null and coalesce(m.capture_source, 'unknown') = 'device_bridge' and b.id is not null and coalesce(b.worker_status, 'unknown') <> 'online' then 'worker_not_ready' end,
        case when m.asset_id is not null and coalesce(m.capture_source, 'unknown') = 'device_bridge' and b.id is not null and (b.worker_last_seen_at is null or b.worker_last_seen_at < now() - interval '15 minutes') then 'worker_heartbeat_stale' end
      ]::text[], null) as device_bridge_quality_reasons,
      case
        when a.object_bucket is null or a.object_key is null then 'warning'
        when coalesce(a.byte_size, 0) <= 0 then 'warning'
        when a.captured_at is null then 'warning'
        when m.asset_id is null then 'missing'
        when m.device_id is null then 'warning'
        when m.frame_width is null or m.frame_height is null then 'warning'
        when coalesce(m.quality_score, 0) < 75 then 'warning'
        when cardinality(coalesce(m.quality_issues, array[]::text[])) > 0 then 'warning'
        when coalesce(m.device_evidence_status, 'missing') <> 'ready' then 'warning'
        when coalesce(m.capture_protocol_status, 'missing') <> 'ready' then 'warning'
        when coalesce(m.capture_source, 'unknown') = 'device_bridge'
          and (
            m.device_id is null
            or d.id is null
            or d.status <> 'connected'
            or (d.calibration_due_at is not null and d.calibration_due_at <= current_date)
            or b.id is null
            or b.lan_status <> 'online'
            or coalesce(b.worker_status, 'unknown') <> 'online'
            or b.worker_last_seen_at is null
            or b.worker_last_seen_at < now() - interval '15 minutes'
          ) then 'warning'
        else 'ready'
      end as technical_status,
      array_remove(array[
        case when a.object_bucket is null or a.object_key is null then 'production_asset_not_ready' end,
        case when coalesce(a.byte_size, 0) <= 0 then 'production_asset_not_ready' end,
        case when a.captured_at is null then 'production_asset_not_ready' end,
        case when m.asset_id is null then 'missing_capture_metadata' end,
        case when m.asset_id is not null and m.device_id is null then 'device_missing' end,
        case when m.asset_id is not null and (m.frame_width is null or m.frame_height is null) then 'frame_size_missing' end,
        case when m.asset_id is not null and coalesce(m.quality_score, 0) < 75 then 'low_quality' end,
        case when cardinality(coalesce(m.quality_issues, array[]::text[])) > 0 then 'quality_issue' end,
        case when m.asset_id is not null and m.scale_marker_detected = false then 'scale_marker_missing' end,
        case when m.asset_id is not null and coalesce(m.device_evidence_status, 'missing') <> 'ready' then 'device_metadata_not_ready' end,
        case when m.asset_id is not null and coalesce(m.capture_protocol_status, 'missing') <> 'ready' then 'capture_protocol_not_ready' end,
        case when m.asset_id is not null and coalesce(m.capture_source, 'unknown') = 'device_bridge'
          and (
            m.device_id is null
            or d.id is null
            or d.status <> 'connected'
            or (d.calibration_due_at is not null and d.calibration_due_at <= current_date)
            or b.id is null
            or b.lan_status <> 'online'
            or coalesce(b.worker_status, 'unknown') <> 'online'
            or b.worker_last_seen_at is null
            or b.worker_last_seen_at < now() - interval '15 minutes'
          ) then 'device_bridge_quality_not_ready' end
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
     and d.deleted_at is null
    left join device_bridges b
      on b.id = d.bridge_id
     and b.clinic_id = a.clinic_id
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
      'scaleReadyCount', coalesce((select count(*)::int from asset_rows where scale_marker_detected = true and millimeters_available = true), 0),
      'deviceEvidenceReadyCount', coalesce((select count(*)::int from asset_rows where device_evidence_status = 'ready'), 0),
      'deviceEvidenceReviewCount', coalesce((select count(*)::int from asset_rows where device_evidence_status in ('missing', 'needs_review')), 0),
      'productionAssetReadyCount', coalesce((select count(*)::int from asset_rows where production_asset_status = 'ready'), 0),
      'productionAssetReviewCount', coalesce((select count(*)::int from asset_rows where production_asset_status = 'needs_review'), 0),
      'deviceBridgeQualityReadyCount', coalesce((select count(*)::int from asset_rows where device_bridge_quality_status = 'ready'), 0),
      'deviceBridgeQualityReviewCount', coalesce((select count(*)::int from asset_rows where device_bridge_quality_status = 'needs_review'), 0),
      'captureProtocolReadyCount', coalesce((select count(*)::int from asset_rows where capture_protocol_status = 'ready'), 0),
      'captureProtocolReviewCount', coalesce((select count(*)::int from asset_rows where capture_protocol_status in ('missing', 'needs_review')), 0)
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
        'deviceCaptureProfile', coalesce(a.device_capture_profile, 'unknown'),
        'lightingProfile', coalesce(a.lighting_profile, 'unknown'),
        'focusProfile', coalesce(a.focus_profile, 'unknown'),
        'distanceProfile', coalesce(a.distance_profile, 'unknown'),
        'deviceCalibrationStatus', coalesce(a.device_calibration_status, 'unknown'),
        'deviceCalibrationCheckedAt', a.device_calibration_checked_at,
        'deviceEvidenceStatus', coalesce(a.device_evidence_status, 'missing'),
        'captureProtocolVersion', coalesce(a.capture_protocol_version, 'unknown'),
        'lensProfile', coalesce(a.lens_profile, 'unknown'),
        'polarizationMode', coalesce(a.polarization_mode, 'unknown'),
        'colorReferenceStatus', coalesce(a.color_reference_status, 'unknown'),
        'deviceClockSyncStatus', coalesce(a.device_clock_sync_status, 'unknown'),
        'captureProtocolStatus', coalesce(a.capture_protocol_status, 'missing'),
        'productionAssetReadinessStatus', coalesce(a.production_asset_status, 'needs_review'),
        'productionAssetReadinessReasons', coalesce(a.production_asset_reasons, array[]::text[]),
        'deviceBridgeQualityStatus', coalesce(a.device_bridge_quality_status, 'not_applicable'),
        'deviceBridgeQualityReasons', coalesce(a.device_bridge_quality_reasons, array[]::text[]),
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
    `device_capture_profile = ${sqlLiteral(metadata.deviceCaptureProfile ?? "unknown")}`,
    `lighting_profile = ${sqlLiteral(metadata.lightingProfile ?? "unknown")}`,
    `focus_profile = ${sqlLiteral(metadata.focusProfile ?? "unknown")}`,
    `distance_profile = ${sqlLiteral(metadata.distanceProfile ?? "unknown")}`,
    `device_calibration_status = ${sqlLiteral(metadata.deviceCalibrationStatus ?? "unknown")}`,
    `device_calibration_checked_at = ${sqlNullableTimestamp(metadata.deviceCalibrationCheckedAt ?? null)}`,
    `device_evidence_status = ${sqlLiteral(metadata.deviceEvidenceStatus ?? "needs_review")}`,
    `capture_protocol_version = ${sqlLiteral(metadata.captureProtocolVersion ?? "unknown")}`,
    `lens_profile = ${sqlLiteral(metadata.lensProfile ?? "unknown")}`,
    `polarization_mode = ${sqlLiteral(metadata.polarizationMode ?? "unknown")}`,
    `color_reference_status = ${sqlLiteral(metadata.colorReferenceStatus ?? "unknown")}`,
    `device_clock_sync_status = ${sqlLiteral(metadata.deviceClockSyncStatus ?? "unknown")}`,
    `capture_protocol_status = ${sqlLiteral(metadata.captureProtocolStatus ?? "missing")}`,
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
      device_capture_profile, lighting_profile, focus_profile, distance_profile,
      device_calibration_status, device_calibration_checked_at, device_evidence_status,
      capture_protocol_version, lens_profile, polarization_mode, color_reference_status,
      device_clock_sync_status, capture_protocol_status,
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
      ${sqlLiteral(metadata.deviceCaptureProfile ?? "unknown")},
      ${sqlLiteral(metadata.lightingProfile ?? "unknown")},
      ${sqlLiteral(metadata.focusProfile ?? "unknown")},
      ${sqlLiteral(metadata.distanceProfile ?? "unknown")},
      ${sqlLiteral(metadata.deviceCalibrationStatus ?? "unknown")},
      ${sqlNullableTimestamp(metadata.deviceCalibrationCheckedAt ?? null)},
      ${sqlLiteral(metadata.deviceEvidenceStatus ?? "needs_review")},
      ${sqlLiteral(metadata.captureProtocolVersion ?? "unknown")},
      ${sqlLiteral(metadata.lensProfile ?? "unknown")},
      ${sqlLiteral(metadata.polarizationMode ?? "unknown")},
      ${sqlLiteral(metadata.colorReferenceStatus ?? "unknown")},
      ${sqlLiteral(metadata.deviceClockSyncStatus ?? "unknown")},
      ${sqlLiteral(metadata.captureProtocolStatus ?? "missing")},
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
    m.device_capture_profile as "deviceCaptureProfile",
    m.lighting_profile as "lightingProfile",
    m.focus_profile as "focusProfile",
    m.distance_profile as "distanceProfile",
    m.device_calibration_status as "deviceCalibrationStatus",
    m.device_calibration_checked_at as "deviceCalibrationCheckedAt",
    m.device_evidence_status as "deviceEvidenceStatus",
    m.capture_protocol_version as "captureProtocolVersion",
    m.lens_profile as "lensProfile",
    m.polarization_mode as "polarizationMode",
    m.color_reference_status as "colorReferenceStatus",
    m.device_clock_sync_status as "deviceClockSyncStatus",
    m.capture_protocol_status as "captureProtocolStatus",
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
    "measurement_policy_status = 'not_approved'",
    "measurement_policy_reasons = '[]'::jsonb",
    "measurement_policy_reviewed_by_user_id = null",
    "measurement_policy_reviewed_at = null",
    "reviewer_workflow_status = 'technical_gate_blocked'",
    "reviewer_workflow_reasons = '[]'::jsonb",
    "reviewer_workflow_by_user_id = null",
    "reviewer_workflow_at = null",
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
    q.reviewer_workflow_status as "reviewerWorkflowStatus",
    q.reviewer_workflow_reasons as "reviewerWorkflowReasons",
    q.reviewer_workflow_by_user_id::text as "reviewerWorkflowByUserId",
    q.reviewer_workflow_at as "reviewerWorkflowAt",
    q.measurement_policy_status as "measurementPolicyStatus",
    q.measurement_policy_reasons as "measurementPolicyReasons",
    q.measurement_policy_reviewed_by_user_id::text as "measurementPolicyReviewedByUserId",
    q.measurement_policy_reviewed_at as "measurementPolicyReviewedAt",
    q.production_analysis_policy_status as "productionAnalysisPolicyStatus",
    q.production_analysis_policy_reasons as "productionAnalysisPolicyReasons",
    q.production_analysis_policy_reviewed_by_user_id::text as "productionAnalysisPolicyReviewedByUserId",
    q.production_analysis_policy_reviewed_at as "productionAnalysisPolicyReviewedAt",
    q.reviewer_assignment_status as "reviewerAssignmentStatus",
    q.reviewer_assignment_reasons as "reviewerAssignmentReasons",
    q.reviewer_assigned_at as "reviewerAssignedAt",
    q.second_review_status as "secondReviewStatus",
    q.second_review_reasons as "secondReviewReasons",
    q.second_reviewed_at as "secondReviewedAt",
    jsonb_build_object(
      'technicalReviewReady', q.review_status = 'technical_ready',
      'calibrationReady', q.calibration_status = 'ready',
      'captureMetadataReady', q.capture_metadata_status = 'ready',
      'markerGateReady', jsonb_array_length(q.technical_markers) >= 2,
      'measurementPolicyApproved', q.measurement_policy_status = 'approved_for_technical_review',
      'productionAnalysisPolicyApproved', q.production_analysis_policy_status = 'approved_for_production_analysis',
      'reviewerAssignmentReady', q.reviewer_assignment_status in ('assigned', 'second_review_assigned', 'second_review_completed'),
      'secondReviewReady', q.second_review_status in ('not_required', 'completed'),
      'medicalMeasurementAllowed', false,
      'patientDeliveryAllowed', false,
      'clinicalOutputGenerated', false
    ) as "reviewerWorkflowGate",
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
    q.reviewer_workflow_status as "reviewerWorkflowStatus",
    q.reviewer_workflow_reasons as "reviewerWorkflowReasons",
    q.reviewer_workflow_by_user_id::text as "reviewerWorkflowByUserId",
    q.reviewer_workflow_at as "reviewerWorkflowAt",
    q.measurement_policy_status as "measurementPolicyStatus",
    q.measurement_policy_reasons as "measurementPolicyReasons",
    q.measurement_policy_reviewed_by_user_id::text as "measurementPolicyReviewedByUserId",
    q.measurement_policy_reviewed_at as "measurementPolicyReviewedAt",
    q.production_analysis_policy_status as "productionAnalysisPolicyStatus",
    q.production_analysis_policy_reasons as "productionAnalysisPolicyReasons",
    q.production_analysis_policy_reviewed_by_user_id::text as "productionAnalysisPolicyReviewedByUserId",
    q.production_analysis_policy_reviewed_at as "productionAnalysisPolicyReviewedAt",
    q.reviewer_assignment_status as "reviewerAssignmentStatus",
    q.reviewer_assignment_reasons as "reviewerAssignmentReasons",
    q.reviewer_assigned_at as "reviewerAssignedAt",
    q.second_review_status as "secondReviewStatus",
    q.second_review_reasons as "secondReviewReasons",
    q.second_reviewed_at as "secondReviewedAt",
    jsonb_build_object(
      'technicalReviewReady', q.review_status = 'technical_ready',
      'calibrationReady', q.calibration_status = 'ready',
      'captureMetadataReady', q.capture_metadata_status = 'ready',
      'markerGateReady', jsonb_array_length(q.technical_markers) >= 2,
      'measurementPolicyApproved', q.measurement_policy_status = 'approved_for_technical_review',
      'productionAnalysisPolicyApproved', q.production_analysis_policy_status = 'approved_for_production_analysis',
      'reviewerAssignmentReady', q.reviewer_assignment_status in ('assigned', 'second_review_assigned', 'second_review_completed'),
      'secondReviewReady', q.second_review_status in ('not_required', 'completed'),
      'medicalMeasurementAllowed', false,
      'patientDeliveryAllowed', false,
      'clinicalOutputGenerated', false
    ) as "reviewerWorkflowGate",
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

export function buildReviewLesionComparisonViewerQaReviewerWorkflowSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  workflow = {},
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
    where l.id::text = ${sqlLiteral(workflow.lesionId)}
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
    where a.id::text = any(${sqlTextArray(workflow.imageIds)})
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
      reviewer_workflow_status = case
        when q.review_status = 'technical_ready'
          and q.calibration_status = 'ready'
          and q.capture_metadata_status = 'ready'
          and q.measurement_policy_status = 'approved_for_technical_review'
          and q.production_analysis_policy_status = 'approved_for_production_analysis'
          and q.reviewer_assignment_status in ('assigned', 'second_review_assigned', 'second_review_completed')
          and q.second_review_status in ('not_required', 'completed')
          and jsonb_array_length(q.technical_markers) >= 2
        then ${sqlLiteral(workflow.workflowStatus)}
        else 'technical_gate_blocked'
      end,
      reviewer_workflow_reasons = case
        when q.review_status = 'technical_ready'
          and q.calibration_status = 'ready'
          and q.capture_metadata_status = 'ready'
          and q.measurement_policy_status = 'approved_for_technical_review'
          and q.production_analysis_policy_status = 'approved_for_production_analysis'
          and q.reviewer_assignment_status in ('assigned', 'second_review_assigned', 'second_review_completed')
          and q.second_review_status in ('not_required', 'completed')
          and jsonb_array_length(q.technical_markers) >= 2
        then ${sqlJsonb(workflow.workflowReasons ?? [])}
        else case
          when q.measurement_policy_status <> 'approved_for_technical_review'
          then ${sqlJsonb(["measurement_policy_required"])}
          when q.production_analysis_policy_status <> 'approved_for_production_analysis'
          then ${sqlJsonb(["production_analysis_policy_required"])}
          when q.reviewer_assignment_status not in ('assigned', 'second_review_assigned', 'second_review_completed')
          then ${sqlJsonb(["reviewer_assignment_required"])}
          when q.second_review_status not in ('not_required', 'completed')
          then ${sqlJsonb(["second_review_required"])}
          else ${sqlJsonb(["technical_gate_blocked"])}
        end
      end,
      reviewer_workflow_by_user_id = ${sqlNullableUuid(doctorUserId)},
      reviewer_workflow_at = now(),
      medical_measurement_allowed = false,
      patient_delivery_allowed = false,
      protected_fields_exposed = false,
      metadata_json = q.metadata_json || ${sqlJsonb({
        brainstormTask: "SD-MF-026/028",
        reviewerWorkflowBoundary: "metadata_only",
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      updated_at = now()
    from target_pair p
    where q.visit_id = p.visit_id
      and q.patient_id = p.patient_id
      and q.clinic_id = p.clinic_id
      and q.lesion_id = p.lesion_id
      and q.pair_key = ${sqlLiteral(workflow.pairKey)}
      and q.image_ids @> ${sqlTextArray(workflow.imageIds)}
      and ${sqlTextArray(workflow.imageIds)} @> q.image_ids
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
    q.reviewer_workflow_status as "reviewerWorkflowStatus",
    q.reviewer_workflow_reasons as "reviewerWorkflowReasons",
    q.reviewer_workflow_by_user_id::text as "reviewerWorkflowByUserId",
    q.reviewer_workflow_at as "reviewerWorkflowAt",
    q.measurement_policy_status as "measurementPolicyStatus",
    q.measurement_policy_reasons as "measurementPolicyReasons",
    q.measurement_policy_reviewed_by_user_id::text as "measurementPolicyReviewedByUserId",
    q.measurement_policy_reviewed_at as "measurementPolicyReviewedAt",
    q.production_analysis_policy_status as "productionAnalysisPolicyStatus",
    q.production_analysis_policy_reasons as "productionAnalysisPolicyReasons",
    q.production_analysis_policy_reviewed_by_user_id::text as "productionAnalysisPolicyReviewedByUserId",
    q.production_analysis_policy_reviewed_at as "productionAnalysisPolicyReviewedAt",
    q.reviewer_assignment_status as "reviewerAssignmentStatus",
    q.reviewer_assignment_reasons as "reviewerAssignmentReasons",
    q.reviewer_assigned_at as "reviewerAssignedAt",
    q.second_review_status as "secondReviewStatus",
    q.second_review_reasons as "secondReviewReasons",
    q.second_reviewed_at as "secondReviewedAt",
    jsonb_build_object(
      'technicalReviewReady', q.review_status = 'technical_ready',
      'calibrationReady', q.calibration_status = 'ready',
      'captureMetadataReady', q.capture_metadata_status = 'ready',
      'markerGateReady', jsonb_array_length(q.technical_markers) >= 2,
      'measurementPolicyApproved', q.measurement_policy_status = 'approved_for_technical_review',
      'productionAnalysisPolicyApproved', q.production_analysis_policy_status = 'approved_for_production_analysis',
      'reviewerAssignmentReady', q.reviewer_assignment_status in ('assigned', 'second_review_assigned', 'second_review_completed'),
      'secondReviewReady', q.second_review_status in ('not_required', 'completed'),
      'medicalMeasurementAllowed', false,
      'patientDeliveryAllowed', false,
      'clinicalOutputGenerated', false
    ) as "reviewerWorkflowGate",
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

export function buildReviewLesionComparisonMeasurementPolicySql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  policy = {},
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
    where l.id::text = ${sqlLiteral(policy.lesionId)}
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
    where a.id::text = any(${sqlTextArray(policy.imageIds)})
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
      measurement_policy_status = ${sqlLiteral(policy.measurementPolicyStatus)},
      measurement_policy_reasons = ${sqlJsonb(policy.measurementPolicyReasons ?? [])},
      measurement_policy_reviewed_by_user_id = ${sqlNullableUuid(doctorUserId)},
      measurement_policy_reviewed_at = now(),
      reviewer_workflow_status = case
        when ${sqlLiteral(policy.measurementPolicyStatus)} = 'approved_for_technical_review'
        then q.reviewer_workflow_status
        else 'technical_gate_blocked'
      end,
      reviewer_workflow_reasons = case
        when ${sqlLiteral(policy.measurementPolicyStatus)} = 'approved_for_technical_review'
        then q.reviewer_workflow_reasons
        else ${sqlJsonb(["measurement_policy_required"])}
      end,
      medical_measurement_allowed = false,
      patient_delivery_allowed = false,
      protected_fields_exposed = false,
      metadata_json = q.metadata_json || ${sqlJsonb({
        brainstormTask: "SD-MF-026/028",
        measurementPolicyBoundary: "metadata_only",
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      updated_at = now()
    from target_pair p
    where q.visit_id = p.visit_id
      and q.patient_id = p.patient_id
      and q.clinic_id = p.clinic_id
      and q.lesion_id = p.lesion_id
      and q.pair_key = ${sqlLiteral(policy.pairKey)}
      and q.image_ids @> ${sqlTextArray(policy.imageIds)}
      and ${sqlTextArray(policy.imageIds)} @> q.image_ids
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
    q.reviewer_workflow_status as "reviewerWorkflowStatus",
    q.reviewer_workflow_reasons as "reviewerWorkflowReasons",
    q.reviewer_workflow_by_user_id::text as "reviewerWorkflowByUserId",
    q.reviewer_workflow_at as "reviewerWorkflowAt",
    q.measurement_policy_status as "measurementPolicyStatus",
    q.measurement_policy_reasons as "measurementPolicyReasons",
    q.measurement_policy_reviewed_by_user_id::text as "measurementPolicyReviewedByUserId",
    q.measurement_policy_reviewed_at as "measurementPolicyReviewedAt",
    q.production_analysis_policy_status as "productionAnalysisPolicyStatus",
    q.production_analysis_policy_reasons as "productionAnalysisPolicyReasons",
    q.production_analysis_policy_reviewed_by_user_id::text as "productionAnalysisPolicyReviewedByUserId",
    q.production_analysis_policy_reviewed_at as "productionAnalysisPolicyReviewedAt",
    q.reviewer_assignment_status as "reviewerAssignmentStatus",
    q.reviewer_assignment_reasons as "reviewerAssignmentReasons",
    q.reviewer_assigned_at as "reviewerAssignedAt",
    q.second_review_status as "secondReviewStatus",
    q.second_review_reasons as "secondReviewReasons",
    q.second_reviewed_at as "secondReviewedAt",
    jsonb_build_object(
      'technicalReviewReady', q.review_status = 'technical_ready',
      'calibrationReady', q.calibration_status = 'ready',
      'captureMetadataReady', q.capture_metadata_status = 'ready',
      'markerGateReady', jsonb_array_length(q.technical_markers) >= 2,
      'measurementPolicyApproved', q.measurement_policy_status = 'approved_for_technical_review',
      'productionAnalysisPolicyApproved', q.production_analysis_policy_status = 'approved_for_production_analysis',
      'reviewerAssignmentReady', q.reviewer_assignment_status in ('assigned', 'second_review_assigned', 'second_review_completed'),
      'secondReviewReady', q.second_review_status in ('not_required', 'completed'),
      'medicalMeasurementAllowed', false,
      'patientDeliveryAllowed', false,
      'clinicalOutputGenerated', false
    ) as "reviewerWorkflowGate",
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

export function buildReviewLesionComparisonProductionAnalysisPolicySql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  policy = {},
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
    where l.id::text = ${sqlLiteral(policy.lesionId)}
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
    where a.id::text = any(${sqlTextArray(policy.imageIds)})
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
      production_analysis_policy_status = case
        when q.measurement_policy_status = 'approved_for_technical_review'
        then ${sqlLiteral(policy.productionAnalysisPolicyStatus)}
        else 'not_approved'
      end,
      production_analysis_policy_reasons = case
        when q.measurement_policy_status = 'approved_for_technical_review'
        then ${sqlJsonb(policy.productionAnalysisPolicyReasons ?? [])}
        else ${sqlJsonb(["measurement_policy_required"])}
      end,
      production_analysis_policy_reviewed_by_user_id = ${sqlNullableUuid(doctorUserId)},
      production_analysis_policy_reviewed_at = now(),
      reviewer_workflow_status = case
        when q.measurement_policy_status = 'approved_for_technical_review'
          and ${sqlLiteral(policy.productionAnalysisPolicyStatus)} = 'approved_for_production_analysis'
        then q.reviewer_workflow_status
        else 'technical_gate_blocked'
      end,
      reviewer_workflow_reasons = case
        when q.measurement_policy_status <> 'approved_for_technical_review'
        then ${sqlJsonb(["measurement_policy_required"])}
        when ${sqlLiteral(policy.productionAnalysisPolicyStatus)} = 'approved_for_production_analysis'
        then q.reviewer_workflow_reasons
        else ${sqlJsonb(["production_analysis_policy_required"])}
      end,
      medical_measurement_allowed = false,
      patient_delivery_allowed = false,
      protected_fields_exposed = false,
      metadata_json = q.metadata_json || ${sqlJsonb({
        brainstormTask: "SD-MF-026/028",
        productionAnalysisPolicyBoundary: "metadata_only",
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      updated_at = now()
    from target_pair p
    where q.visit_id = p.visit_id
      and q.patient_id = p.patient_id
      and q.clinic_id = p.clinic_id
      and q.lesion_id = p.lesion_id
      and q.pair_key = ${sqlLiteral(policy.pairKey)}
      and q.image_ids @> ${sqlTextArray(policy.imageIds)}
      and ${sqlTextArray(policy.imageIds)} @> q.image_ids
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
    q.reviewer_workflow_status as "reviewerWorkflowStatus",
    q.reviewer_workflow_reasons as "reviewerWorkflowReasons",
    q.reviewer_workflow_by_user_id::text as "reviewerWorkflowByUserId",
    q.reviewer_workflow_at as "reviewerWorkflowAt",
    q.measurement_policy_status as "measurementPolicyStatus",
    q.measurement_policy_reasons as "measurementPolicyReasons",
    q.measurement_policy_reviewed_by_user_id::text as "measurementPolicyReviewedByUserId",
    q.measurement_policy_reviewed_at as "measurementPolicyReviewedAt",
    q.production_analysis_policy_status as "productionAnalysisPolicyStatus",
    q.production_analysis_policy_reasons as "productionAnalysisPolicyReasons",
    q.production_analysis_policy_reviewed_by_user_id::text as "productionAnalysisPolicyReviewedByUserId",
    q.production_analysis_policy_reviewed_at as "productionAnalysisPolicyReviewedAt",
    q.reviewer_assignment_status as "reviewerAssignmentStatus",
    q.reviewer_assignment_reasons as "reviewerAssignmentReasons",
    q.reviewer_assigned_at as "reviewerAssignedAt",
    q.second_review_status as "secondReviewStatus",
    q.second_review_reasons as "secondReviewReasons",
    q.second_reviewed_at as "secondReviewedAt",
    jsonb_build_object(
      'technicalReviewReady', q.review_status = 'technical_ready',
      'calibrationReady', q.calibration_status = 'ready',
      'captureMetadataReady', q.capture_metadata_status = 'ready',
      'markerGateReady', jsonb_array_length(q.technical_markers) >= 2,
      'measurementPolicyApproved', q.measurement_policy_status = 'approved_for_technical_review',
      'productionAnalysisPolicyApproved', q.production_analysis_policy_status = 'approved_for_production_analysis',
      'reviewerAssignmentReady', q.reviewer_assignment_status in ('assigned', 'second_review_assigned', 'second_review_completed'),
      'secondReviewReady', q.second_review_status in ('not_required', 'completed'),
      'medicalMeasurementAllowed', false,
      'patientDeliveryAllowed', false,
      'clinicalOutputGenerated', false
    ) as "reviewerWorkflowGate",
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

export function buildAssignLesionComparisonReviewerSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  assignment = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const draftScope = clinicScopeWhere({ alias: "q", clinicIds, allClinics });
  const lesionScope = clinicScopeWhere({ alias: "l", clinicIds, allClinics });
  const assetScope = clinicScopeWhere({ alias: "a", clinicIds, allClinics });
  const assignedReviewerId = sqlNullableUuid(assignment.assignedReviewerUserId);
  const secondReviewerId = sqlNullableUuid(assignment.secondReviewerUserId);
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
    where l.id::text = ${sqlLiteral(assignment.lesionId)}
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
    where a.id::text = any(${sqlTextArray(assignment.imageIds)})
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
      reviewer_assignment_status = case
        when q.measurement_policy_status <> 'approved_for_technical_review' then 'assignment_blocked'
        when ${assignedReviewerId} is null then 'assignment_blocked'
        when ${assignedReviewerId} is not null
          and ${secondReviewerId} is not null
          and ${assignedReviewerId} = ${secondReviewerId} then 'assignment_blocked'
        else ${sqlLiteral(assignment.assignmentStatus)}
      end,
      reviewer_assignment_reasons = case
        when q.measurement_policy_status <> 'approved_for_technical_review' then ${sqlJsonb(["measurement_policy_required"])}
        when ${assignedReviewerId} is null then ${sqlJsonb(["reviewer_assignment_required"])}
        when ${assignedReviewerId} is not null
          and ${secondReviewerId} is not null
          and ${assignedReviewerId} = ${secondReviewerId} then ${sqlJsonb(["second_reviewer_must_differ"])}
        else ${sqlJsonb(assignment.assignmentReasons ?? [])}
      end,
      assigned_reviewer_user_id = case
        when q.measurement_policy_status = 'approved_for_technical_review' then ${assignedReviewerId}
        else q.assigned_reviewer_user_id
      end,
      reviewer_assigned_by_user_id = ${sqlNullableUuid(doctorUserId)},
      reviewer_assigned_at = now(),
      second_review_status = case
        when q.measurement_policy_status <> 'approved_for_technical_review' then 'blocked'
        when ${assignedReviewerId} is not null
          and ${secondReviewerId} is not null
          and ${assignedReviewerId} = ${secondReviewerId} then 'blocked'
        else ${sqlLiteral(assignment.secondReviewStatus)}
      end,
      second_review_reasons = case
        when q.measurement_policy_status <> 'approved_for_technical_review' then ${sqlJsonb(["measurement_policy_required"])}
        when ${assignedReviewerId} is not null
          and ${secondReviewerId} is not null
          and ${assignedReviewerId} = ${secondReviewerId} then ${sqlJsonb(["second_reviewer_must_differ"])}
        else ${sqlJsonb(assignment.secondReviewReasons ?? [])}
      end,
      second_reviewer_user_id = case
        when q.measurement_policy_status = 'approved_for_technical_review' then ${secondReviewerId}
        else q.second_reviewer_user_id
      end,
      second_reviewed_by_user_id = case
        when ${sqlLiteral(assignment.secondReviewStatus)} = 'completed' then ${sqlNullableUuid(doctorUserId)}
        else q.second_reviewed_by_user_id
      end,
      second_reviewed_at = case
        when ${sqlLiteral(assignment.secondReviewStatus)} = 'completed' then now()
        else q.second_reviewed_at
      end,
      reviewer_workflow_status = case
        when q.measurement_policy_status = 'approved_for_technical_review'
          and ${assignedReviewerId} is not null
          and not (${assignedReviewerId} is not null and ${secondReviewerId} is not null and ${assignedReviewerId} = ${secondReviewerId})
        then q.reviewer_workflow_status
        else 'technical_gate_blocked'
      end,
      reviewer_workflow_reasons = case
        when q.measurement_policy_status = 'approved_for_technical_review'
          and ${assignedReviewerId} is not null
          and not (${assignedReviewerId} is not null and ${secondReviewerId} is not null and ${assignedReviewerId} = ${secondReviewerId})
        then q.reviewer_workflow_reasons
        when q.measurement_policy_status <> 'approved_for_technical_review' then ${sqlJsonb(["measurement_policy_required"])}
        else ${sqlJsonb(["reviewer_assignment_required"])}
      end,
      medical_measurement_allowed = false,
      patient_delivery_allowed = false,
      protected_fields_exposed = false,
      metadata_json = q.metadata_json || ${sqlJsonb({
        brainstormTask: "SD-MF-026/028",
        reviewerAssignmentBoundary: "metadata_only",
        reviewerIdentityExposed: false,
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
      })},
      updated_at = now()
    from target_pair p
    where q.visit_id = p.visit_id
      and q.patient_id = p.patient_id
      and q.clinic_id = p.clinic_id
      and q.lesion_id = p.lesion_id
      and q.pair_key = ${sqlLiteral(assignment.pairKey)}
      and q.image_ids @> ${sqlTextArray(assignment.imageIds)}
      and ${sqlTextArray(assignment.imageIds)} @> q.image_ids
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
    q.reviewer_workflow_status as "reviewerWorkflowStatus",
    q.reviewer_workflow_reasons as "reviewerWorkflowReasons",
    q.reviewer_workflow_by_user_id::text as "reviewerWorkflowByUserId",
    q.reviewer_workflow_at as "reviewerWorkflowAt",
    q.measurement_policy_status as "measurementPolicyStatus",
    q.measurement_policy_reasons as "measurementPolicyReasons",
    q.measurement_policy_reviewed_by_user_id::text as "measurementPolicyReviewedByUserId",
    q.measurement_policy_reviewed_at as "measurementPolicyReviewedAt",
    q.production_analysis_policy_status as "productionAnalysisPolicyStatus",
    q.production_analysis_policy_reasons as "productionAnalysisPolicyReasons",
    q.production_analysis_policy_reviewed_by_user_id::text as "productionAnalysisPolicyReviewedByUserId",
    q.production_analysis_policy_reviewed_at as "productionAnalysisPolicyReviewedAt",
    q.reviewer_assignment_status as "reviewerAssignmentStatus",
    q.reviewer_assignment_reasons as "reviewerAssignmentReasons",
    q.reviewer_assigned_at as "reviewerAssignedAt",
    q.second_review_status as "secondReviewStatus",
    q.second_review_reasons as "secondReviewReasons",
    q.second_reviewed_at as "secondReviewedAt",
    jsonb_build_object(
      'technicalReviewReady', q.review_status = 'technical_ready',
      'calibrationReady', q.calibration_status = 'ready',
      'captureMetadataReady', q.capture_metadata_status = 'ready',
      'markerGateReady', jsonb_array_length(q.technical_markers) >= 2,
      'measurementPolicyApproved', q.measurement_policy_status = 'approved_for_technical_review',
      'productionAnalysisPolicyApproved', q.production_analysis_policy_status = 'approved_for_production_analysis',
      'reviewerAssignmentReady', q.reviewer_assignment_status in ('assigned', 'second_review_assigned', 'second_review_completed'),
      'secondReviewReady', q.second_review_status in ('not_required', 'completed'),
      'medicalMeasurementAllowed', false,
      'patientDeliveryAllowed', false,
      'clinicalOutputGenerated', false
    ) as "reviewerWorkflowGate",
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
  return ["unreviewed", "technical_ready", "needs_recapture", "not_suitable_for_comparison"];
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
      q.measurement_policy_status,
      q.measurement_policy_reasons,
      q.measurement_policy_reviewed_at,
      q.production_analysis_policy_status,
      q.production_analysis_policy_reasons,
      q.production_analysis_policy_reviewed_at,
      q.reviewer_assignment_status,
      q.reviewer_assignment_reasons,
      q.reviewer_assigned_at,
      q.second_review_status,
      q.second_review_reasons,
      q.second_reviewed_at,
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
      'measurementPolicyRequired', coalesce((select count(*)::int from scoped_rows where review_status = 'technical_ready' and measurement_policy_status <> 'approved_for_technical_review'), 0),
      'reviewerAssignmentRequired', coalesce((select count(*)::int from scoped_rows where review_status = 'technical_ready' and measurement_policy_status = 'approved_for_technical_review' and reviewer_assignment_status not in ('assigned', 'second_review_assigned', 'second_review_completed')), 0),
      'secondReviewRequired', coalesce((select count(*)::int from scoped_rows where second_review_status in ('required', 'assigned', 'blocked')), 0),
      'productionAnalysisPolicyRequired', coalesce((select count(*)::int from scoped_rows where review_status = 'technical_ready' and measurement_policy_status = 'approved_for_technical_review' and reviewer_assignment_status in ('assigned', 'second_review_assigned', 'second_review_completed') and second_review_status in ('not_required', 'completed') and production_analysis_policy_status <> 'approved_for_production_analysis'), 0),
      'actionable', coalesce((select count(*)::int from scoped_rows where review_status in ('unreviewed', 'needs_recapture', 'not_suitable_for_comparison') or (review_status = 'technical_ready' and (measurement_policy_status <> 'approved_for_technical_review' or reviewer_assignment_status not in ('assigned', 'second_review_assigned', 'second_review_completed') or second_review_status in ('required', 'assigned', 'blocked') or production_analysis_policy_status <> 'approved_for_production_analysis'))), 0)
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
        'measurementPolicy', jsonb_build_object(
          'status', r.measurement_policy_status,
          'reasons', coalesce(r.measurement_policy_reasons, '[]'::jsonb),
          'reviewedAt', r.measurement_policy_reviewed_at
        ),
        'productionAnalysisPolicy', jsonb_build_object(
          'status', r.production_analysis_policy_status,
          'reasons', coalesce(r.production_analysis_policy_reasons, '[]'::jsonb),
          'reviewedAt', r.production_analysis_policy_reviewed_at,
          'medicalMeasurementAllowed', false,
          'patientDeliveryAllowed', false,
          'clinicalOutputGenerated', false
        ),
        'reviewerAssignment', jsonb_build_object(
          'status', r.reviewer_assignment_status,
          'reasons', coalesce(r.reviewer_assignment_reasons, '[]'::jsonb),
          'assignedAt', r.reviewer_assigned_at,
          'reviewerIdentityExposed', false
        ),
        'secondReview', jsonb_build_object(
          'status', r.second_review_status,
          'reasons', coalesce(r.second_review_reasons, '[]'::jsonb),
          'reviewedAt', r.second_reviewed_at,
          'reviewerIdentityExposed', false
        ),
        'calibrationStatus', r.calibration_status,
        'calibrationReasons', coalesce(r.calibration_reasons, '[]'::jsonb),
        'captureMetadataStatus', r.capture_metadata_status,
        'technicalMarkerCount', r.technical_marker_count,
        'updatedAt', r.updated_at,
        'nextAction', case
          when r.review_status = 'needs_recapture' then 'request_recapture'
          when r.review_status = 'not_suitable_for_comparison' then 'exclude_from_dynamic_review'
          when r.review_status = 'technical_ready'
            and r.measurement_policy_status <> 'approved_for_technical_review' then 'approve_measurement_policy'
          when r.review_status = 'technical_ready'
            and r.reviewer_assignment_status not in ('assigned', 'second_review_assigned', 'second_review_completed') then 'assign_reviewer'
          when r.review_status = 'technical_ready'
            and r.second_review_status in ('required', 'assigned', 'blocked') then 'complete_second_review'
          when r.review_status = 'technical_ready'
            and r.production_analysis_policy_status <> 'approved_for_production_analysis' then 'approve_production_analysis_policy'
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
    deviceEvidence: {
      captureProfile: String(row.deviceCaptureProfile ?? "unknown"),
      lightingProfile: String(row.lightingProfile ?? "unknown"),
      focusProfile: String(row.focusProfile ?? "unknown"),
      distanceProfile: String(row.distanceProfile ?? "unknown"),
      calibrationStatus: String(row.deviceCalibrationStatus ?? "unknown"),
      calibrationCheckedAt: row.deviceCalibrationCheckedAt ?? null,
      status: String(row.deviceEvidenceStatus ?? "missing"),
    },
    captureProtocol: {
      version: String(row.captureProtocolVersion ?? "unknown"),
      lensProfile: String(row.lensProfile ?? "unknown"),
      polarizationMode: String(row.polarizationMode ?? "unknown"),
      colorReferenceStatus: String(row.colorReferenceStatus ?? "unknown"),
      clockSyncStatus: String(row.deviceClockSyncStatus ?? "unknown"),
      status: String(row.captureProtocolStatus ?? "missing"),
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
    deviceEvidenceReadyCount: numberOrZero(source.deviceEvidenceReadyCount),
    deviceEvidenceReviewCount: numberOrZero(source.deviceEvidenceReviewCount),
    productionAssetReadyCount: numberOrZero(source.productionAssetReadyCount),
    productionAssetReviewCount: numberOrZero(source.productionAssetReviewCount),
    deviceBridgeQualityReadyCount: numberOrZero(source.deviceBridgeQualityReadyCount),
    deviceBridgeQualityReviewCount: numberOrZero(source.deviceBridgeQualityReviewCount),
    captureProtocolReadyCount: numberOrZero(source.captureProtocolReadyCount),
    captureProtocolReviewCount: numberOrZero(source.captureProtocolReviewCount),
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
    deviceEvidence: {
      captureProfile: String(row.deviceCaptureProfile ?? "unknown"),
      lightingProfile: String(row.lightingProfile ?? "unknown"),
      focusProfile: String(row.focusProfile ?? "unknown"),
      distanceProfile: String(row.distanceProfile ?? "unknown"),
      calibrationStatus: String(row.deviceCalibrationStatus ?? "unknown"),
      calibrationCheckedAt: row.deviceCalibrationCheckedAt ?? null,
      status: String(row.deviceEvidenceStatus ?? "missing"),
    },
    productionAssetReadiness: {
      status: String(row.productionAssetReadinessStatus ?? "needs_review"),
      reasons: parseStringArray(row.productionAssetReadinessReasons),
    },
    deviceBridgeQuality: {
      status: String(row.deviceBridgeQualityStatus ?? "not_applicable"),
      reasons: parseStringArray(row.deviceBridgeQualityReasons),
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

function normalizeReviewerWorkflowStatus(value) {
  const status = String(value ?? "technical_gate_blocked");
  return status === "ready_for_reviewer" || status === "reviewer_accepted" || status === "reviewer_rejected"
    ? status
    : "technical_gate_blocked";
}

function normalizeReviewerWorkflowGate(value) {
  const gate = parseJsonObject(value);
  return {
    technicalReviewReady: gate.technicalReviewReady === true,
    calibrationReady: gate.calibrationReady === true,
    captureMetadataReady: gate.captureMetadataReady === true,
    markerGateReady: gate.markerGateReady === true,
    measurementPolicyApproved: gate.measurementPolicyApproved === true,
    productionAnalysisPolicyApproved: gate.productionAnalysisPolicyApproved === true,
    reviewerAssignmentReady: gate.reviewerAssignmentReady === true,
    secondReviewReady: gate.secondReviewReady === true,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    clinicalConclusionGenerated: false,
  };
}

function normalizeMeasurementPolicyStatus(value) {
  const status = String(value ?? "not_approved");
  return status === "review_required" || status === "approved_for_technical_review" ? status : "not_approved";
}

function normalizeProductionAnalysisPolicyStatus(value) {
  const status = String(value ?? "not_approved");
  return status === "review_required" || status === "approved_for_production_analysis" ? status : "not_approved";
}

function normalizeReviewerAssignmentStatus(value) {
  const status = String(value ?? "unassigned");
  return status === "assigned"
    || status === "second_review_required"
    || status === "second_review_assigned"
    || status === "second_review_completed"
    || status === "assignment_blocked"
    ? status
    : "unassigned";
}

function normalizeSecondReviewStatus(value) {
  const status = String(value ?? "not_required");
  return status === "required" || status === "assigned" || status === "completed" || status === "blocked"
    ? status
    : "not_required";
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
    reviewerWorkflow: {
      status: normalizeReviewerWorkflowStatus(row.reviewerWorkflowStatus),
      reasons: parseJsonArray(row.reviewerWorkflowReasons),
      reviewedAt: row.reviewerWorkflowAt ?? null,
      reviewedByUserId: row.reviewerWorkflowByUserId ? String(row.reviewerWorkflowByUserId) : null,
      gate: normalizeReviewerWorkflowGate(row.reviewerWorkflowGate),
    },
    measurementPolicy: {
      status: normalizeMeasurementPolicyStatus(row.measurementPolicyStatus),
      reasons: parseJsonArray(row.measurementPolicyReasons),
      reviewedAt: row.measurementPolicyReviewedAt ?? null,
      reviewedByUserId: row.measurementPolicyReviewedByUserId ? String(row.measurementPolicyReviewedByUserId) : null,
      medicalMeasurementAllowed: false,
      patientDeliveryAllowed: false,
      clinicalOutputGenerated: false,
    },
    productionAnalysisPolicy: {
      status: normalizeProductionAnalysisPolicyStatus(row.productionAnalysisPolicyStatus),
      reasons: parseJsonArray(row.productionAnalysisPolicyReasons),
      reviewedAt: row.productionAnalysisPolicyReviewedAt ?? null,
      reviewedByUserId: row.productionAnalysisPolicyReviewedByUserId
        ? String(row.productionAnalysisPolicyReviewedByUserId)
        : null,
      medicalMeasurementAllowed: false,
      patientDeliveryAllowed: false,
      clinicalOutputGenerated: false,
    },
    reviewerAssignment: {
      status: normalizeReviewerAssignmentStatus(row.reviewerAssignmentStatus),
      reasons: parseJsonArray(row.reviewerAssignmentReasons),
      assignedAt: row.reviewerAssignedAt ?? null,
      reviewerIdentityExposed: false,
      patientDeliveryAllowed: false,
      medicalMeasurementAllowed: false,
    },
    secondReview: {
      status: normalizeSecondReviewStatus(row.secondReviewStatus),
      reasons: parseJsonArray(row.secondReviewReasons),
      reviewedAt: row.secondReviewedAt ?? null,
      reviewerIdentityExposed: false,
      patientDeliveryAllowed: false,
      medicalMeasurementAllowed: false,
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
    measurementPolicyRequired: numberOrZero(source.measurementPolicyRequired),
    reviewerAssignmentRequired: numberOrZero(source.reviewerAssignmentRequired),
    secondReviewRequired: numberOrZero(source.secondReviewRequired),
    productionAnalysisPolicyRequired: numberOrZero(source.productionAnalysisPolicyRequired),
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
    measurementPolicy: {
      status: normalizeMeasurementPolicyStatus(row.measurementPolicy?.status ?? row.measurementPolicyStatus),
      reasons: parseJsonArray(row.measurementPolicy?.reasons ?? row.measurementPolicyReasons),
      reviewedAt: row.measurementPolicy?.reviewedAt ?? row.measurementPolicyReviewedAt ?? null,
      medicalMeasurementAllowed: false,
    },
    productionAnalysisPolicy: {
      status: normalizeProductionAnalysisPolicyStatus(
        row.productionAnalysisPolicy?.status ?? row.productionAnalysisPolicyStatus,
      ),
      reasons: parseJsonArray(row.productionAnalysisPolicy?.reasons ?? row.productionAnalysisPolicyReasons),
      reviewedAt: row.productionAnalysisPolicy?.reviewedAt ?? row.productionAnalysisPolicyReviewedAt ?? null,
      medicalMeasurementAllowed: false,
      patientDeliveryAllowed: false,
      clinicalOutputGenerated: false,
    },
    reviewerAssignment: {
      status: normalizeReviewerAssignmentStatus(row.reviewerAssignment?.status ?? row.reviewerAssignmentStatus),
      reasons: parseJsonArray(row.reviewerAssignment?.reasons ?? row.reviewerAssignmentReasons),
      assignedAt: row.reviewerAssignment?.assignedAt ?? row.reviewerAssignedAt ?? null,
      reviewerIdentityExposed: false,
      patientDeliveryAllowed: false,
      medicalMeasurementAllowed: false,
    },
    secondReview: {
      status: normalizeSecondReviewStatus(row.secondReview?.status ?? row.secondReviewStatus),
      reasons: parseJsonArray(row.secondReview?.reasons ?? row.secondReviewReasons),
      reviewedAt: row.secondReview?.reviewedAt ?? row.secondReviewedAt ?? null,
      reviewerIdentityExposed: false,
      patientDeliveryAllowed: false,
      medicalMeasurementAllowed: false,
    },
    calibrationStatus: String(row.calibrationStatus ?? "not_ready"),
    calibrationReasons: parseJsonArray(row.calibrationReasons),
    captureMetadataStatus: String(row.captureMetadataStatus ?? "needs_review"),
    technicalMarkerCount: numberOrZero(row.technicalMarkerCount),
    updatedAt: row.updatedAt ?? null,
    nextAction:
      nextAction === "request_recapture"
        || nextAction === "exclude_from_dynamic_review"
        || nextAction === "approve_measurement_policy"
        || nextAction === "assign_reviewer"
        || nextAction === "complete_second_review"
        || nextAction === "approve_production_analysis_policy"
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

const LONGITUDINAL_QA_STATUS_VALUES = new Set(["blocked", "needs_review", "technical_ready"]);
const LONGITUDINAL_QA_BLOCKER_VALUES = new Set([
  "no_candidate_pairs",
  "recapture_required",
  "not_suitable_for_comparison",
  "unreviewed_pairs",
  "production_asset_not_ready",
  "missing_capture_metadata",
  "device_metadata_not_ready",
  "device_bridge_quality_not_ready",
  "capture_protocol_not_ready",
  "calibration_not_ready",
  "technical_markers_missing",
  "measurement_policy_required",
  "production_analysis_policy_required",
  "reviewer_assignment_required",
  "second_review_required",
]);
const LONGITUDINAL_QA_ACTION_VALUES = new Set([
  "review_queue",
  "request_recapture",
  "exclude_from_dynamic_review",
  "verify_production_asset",
  "complete_capture_metadata",
  "complete_device_metadata",
  "check_device_bridge",
  "complete_capture_protocol",
  "complete_calibration",
  "place_markers",
  "approve_measurement_policy",
  "approve_production_analysis_policy",
  "assign_reviewer",
  "complete_second_review",
  "continue_review",
]);

function normalizeLongitudinalQaStatus(value) {
  const status = String(value ?? "blocked");
  return LONGITUDINAL_QA_STATUS_VALUES.has(status) ? status : "blocked";
}

function normalizeLongitudinalQaAction(value) {
  const action = String(value ?? "");
  return LONGITUDINAL_QA_ACTION_VALUES.has(action) ? action : null;
}

function normalizeLongitudinalQaReadiness(value) {
  const source = parseJsonObject(value);
  return {
    status: normalizeLongitudinalQaStatus(source.status),
    visitCount: numberOrZero(source.visitCount),
    imageCount: numberOrZero(source.imageCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewedPairCount: numberOrZero(source.reviewedPairCount),
    technicalReadyPairCount: numberOrZero(source.technicalReadyPairCount),
    needsRecaptureCount: numberOrZero(source.needsRecaptureCount),
    notSuitableForComparisonCount: numberOrZero(source.notSuitableForComparisonCount),
    unreviewedPairCount: numberOrZero(source.unreviewedPairCount),
    productionAssetNotReadyCount: numberOrZero(source.productionAssetNotReadyCount),
    missingCaptureMetadataCount: numberOrZero(source.missingCaptureMetadataCount),
    deviceEvidenceNotReadyCount: numberOrZero(source.deviceEvidenceNotReadyCount),
    deviceBridgeQualityNotReadyCount: numberOrZero(source.deviceBridgeQualityNotReadyCount),
    captureProtocolNotReadyCount: numberOrZero(source.captureProtocolNotReadyCount),
    calibrationBlockedCount: numberOrZero(source.calibrationBlockedCount),
    markerMissingCount: numberOrZero(source.markerMissingCount),
    measurementPolicyNotReadyCount: numberOrZero(source.measurementPolicyNotReadyCount),
    productionAnalysisPolicyNotReadyCount: numberOrZero(source.productionAnalysisPolicyNotReadyCount),
    reviewerAssignmentNotReadyCount: numberOrZero(source.reviewerAssignmentNotReadyCount),
    secondReviewNotReadyCount: numberOrZero(source.secondReviewNotReadyCount),
    technicalRolloutReady: source.technicalRolloutReady === true,
    dynamicConclusionAllowed: false,
  };
}

function normalizeLongitudinalQaBlocker(row) {
  const code = String(row.code ?? "");
  const count = numberOrZero(row.count);
  const nextAction = normalizeLongitudinalQaAction(row.nextAction);
  if (!LONGITUDINAL_QA_BLOCKER_VALUES.has(code) || count < 1 || !nextAction) return null;
  return {
    code,
    label: String(row.label ?? code),
    count,
    nextAction,
  };
}

function normalizeLongitudinalQaActions(value) {
  const source = parseStringArray(value);
  return [...new Set(source.map(normalizeLongitudinalQaAction).filter(Boolean))];
}

function normalizeLesionLongitudinalQa(row) {
  return {
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    lesionId: String(row.lesionId ?? ""),
    label: row.label ?? null,
    readiness: normalizeLongitudinalQaReadiness(row.readiness),
    blockers: parseObjectArray(row.blockers)
      .map(normalizeLongitudinalQaBlocker)
      .filter(Boolean),
    nextActions: normalizeLongitudinalQaActions(row.nextActions),
    boundaries: {
      patientDeliveryAllowed: false,
      medicalMeasurementAllowed: false,
      protectedFieldsExposed: false,
      pairKeysExposed: false,
      imageIdsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      rawImageBytesExposed: false,
      doctorOnlyTextExposed: false,
      clinicalConclusionGenerated: false,
    },
  };
}

const VISIT_LONGITUDINAL_DATASET_VALIDATION_STATUS_VALUES = new Set([
  "blocked",
  "needs_review",
  "ready_for_rollout",
]);

const VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_STATUS_VALUES = new Set([
  "not_approved",
  "review_required",
  "approved_for_clinical_operations",
]);

const VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_SOP_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_operational_rollout",
]);

const VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_EVIDENCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_monitored_rollout",
]);

const VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_MONITORING_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_production_rollout",
]);

const VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_INCIDENT_PROCEDURE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_clinic_monitoring",
]);

const VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_CLINICAL_VALIDATION_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_clinical_validation",
]);

const VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_POST_VALIDATION_MONITORING_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_post_validation_monitoring",
]);

const VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_OBSERVATION_GOVERNANCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_observation_governance",
]);

const VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES = new Set([
  "missing",
  "needs_review",
  "ready",
]);

function normalizeVisitLongitudinalDatasetValidationStatus(value) {
  const status = String(value ?? "blocked");
  return VISIT_LONGITUDINAL_DATASET_VALIDATION_STATUS_VALUES.has(status) ? status : "blocked";
}

function normalizeVisitLongitudinalTimelineRolloutStatus(value) {
  const status = String(value ?? "not_approved");
  return VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_STATUS_VALUES.has(status) ? status : "not_approved";
}

function normalizeVisitLongitudinalTimelineRolloutSopStatus(value) {
  const status = String(value ?? "not_started");
  return VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_SOP_STATUS_VALUES.has(status) ? status : "not_started";
}

function normalizeVisitLongitudinalTimelineRolloutEvidenceStatus(value) {
  const status = String(value ?? "not_started");
  return VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_EVIDENCE_STATUS_VALUES.has(status) ? status : "not_started";
}

function normalizeVisitLongitudinalTimelineRolloutMonitoringStatus(value) {
  const status = String(value ?? "not_started");
  return VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_MONITORING_STATUS_VALUES.has(status) ? status : "not_started";
}

function normalizeVisitLongitudinalTimelineRolloutIncidentProcedureStatus(value) {
  const status = String(value ?? "not_started");
  return VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_INCIDENT_PROCEDURE_STATUS_VALUES.has(status)
    ? status
    : "not_started";
}

function normalizeVisitLongitudinalTimelineRolloutClinicalValidationStatus(value) {
  const status = String(value ?? "not_started");
  return VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_CLINICAL_VALIDATION_STATUS_VALUES.has(status)
    ? status
    : "not_started";
}

function normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringStatus(value) {
  const status = String(value ?? "not_started");
  return VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_POST_VALIDATION_MONITORING_STATUS_VALUES.has(status)
    ? status
    : "not_started";
}

function normalizeVisitLongitudinalTimelineRolloutObservationGovernanceStatus(value) {
  const status = String(value ?? "not_started");
  return VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_OBSERVATION_GOVERNANCE_STATUS_VALUES.has(status)
    ? status
    : "not_started";
}

function normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(value) {
  const status = String(value ?? "missing");
  return VISIT_LONGITUDINAL_TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(status) ? status : "missing";
}

function normalizeVisitLongitudinalDatasetValidationReadiness(value) {
  const source = parseJsonObject(value);
  return {
    status: normalizeVisitLongitudinalDatasetValidationStatus(source.status),
    lesionCount: numberOrZero(source.lesionCount),
    timelineCandidateCount: numberOrZero(source.timelineCandidateCount),
    readyTimelineCount: numberOrZero(source.readyTimelineCount),
    needsReviewTimelineCount: numberOrZero(source.needsReviewTimelineCount),
    blockedTimelineCount: numberOrZero(source.blockedTimelineCount),
    imageCount: numberOrZero(source.imageCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewedPairCount: numberOrZero(source.reviewedPairCount),
    technicalReadyPairCount: numberOrZero(source.technicalReadyPairCount),
    productionAssetNotReadyCount: numberOrZero(source.productionAssetNotReadyCount),
    missingCaptureMetadataCount: numberOrZero(source.missingCaptureMetadataCount),
    deviceEvidenceNotReadyCount: numberOrZero(source.deviceEvidenceNotReadyCount),
    deviceBridgeQualityNotReadyCount: numberOrZero(source.deviceBridgeQualityNotReadyCount),
    captureProtocolNotReadyCount: numberOrZero(source.captureProtocolNotReadyCount),
    calibrationBlockedCount: numberOrZero(source.calibrationBlockedCount),
    markerMissingCount: numberOrZero(source.markerMissingCount),
    measurementPolicyNotReadyCount: numberOrZero(source.measurementPolicyNotReadyCount),
    productionAnalysisPolicyNotReadyCount: numberOrZero(source.productionAnalysisPolicyNotReadyCount),
    reviewerAssignmentNotReadyCount: numberOrZero(source.reviewerAssignmentNotReadyCount),
    secondReviewNotReadyCount: numberOrZero(source.secondReviewNotReadyCount),
    reviewerWorkflowReadyCount: numberOrZero(source.reviewerWorkflowReadyCount),
    dynamicConclusionAllowed: false,
  };
}

function normalizeVisitLongitudinalDatasetValidationItem(row) {
  const status = normalizeVisitLongitudinalDatasetValidationStatus(row.status);
  const nextAction = normalizeLongitudinalQaAction(row.nextAction) ?? "review_queue";
  return {
    queueNumber: numberOrZero(row.queueNumber),
    lesionId: String(row.lesionId ?? ""),
    lesionLabel: String(row.lesionLabel ?? row.lesionId ?? ""),
    bodyZone: row.bodyZone ? String(row.bodyZone) : null,
    bodySurface: row.bodySurface ? String(row.bodySurface) : null,
    status,
    visitCount: numberOrZero(row.visitCount),
    imageCount: numberOrZero(row.imageCount),
    candidatePairCount: numberOrZero(row.candidatePairCount),
    reviewedPairCount: numberOrZero(row.reviewedPairCount),
    technicalReadyPairCount: numberOrZero(row.technicalReadyPairCount),
    productionAssetNotReadyCount: numberOrZero(row.productionAssetNotReadyCount),
    missingCaptureMetadataCount: numberOrZero(row.missingCaptureMetadataCount),
    deviceEvidenceNotReadyCount: numberOrZero(row.deviceEvidenceNotReadyCount),
    deviceBridgeQualityNotReadyCount: numberOrZero(row.deviceBridgeQualityNotReadyCount),
    captureProtocolNotReadyCount: numberOrZero(row.captureProtocolNotReadyCount),
    calibrationBlockedCount: numberOrZero(row.calibrationBlockedCount),
    markerMissingCount: numberOrZero(row.markerMissingCount),
    measurementPolicyNotReadyCount: numberOrZero(row.measurementPolicyNotReadyCount),
    productionAnalysisPolicyNotReadyCount: numberOrZero(row.productionAnalysisPolicyNotReadyCount),
    reviewerAssignmentNotReadyCount: numberOrZero(row.reviewerAssignmentNotReadyCount),
    secondReviewNotReadyCount: numberOrZero(row.secondReviewNotReadyCount),
    reviewerWorkflowReadyCount: numberOrZero(row.reviewerWorkflowReadyCount),
    nextAction,
  };
}

function normalizeVisitLongitudinalTimelineRollout(row) {
  const source = parseJsonObject(row);
  return {
    id: source.id ? String(source.id) : null,
    clinicId: source.clinicId ? String(source.clinicId) : null,
    patientId: source.patientId ? String(source.patientId) : null,
    visitId: source.visitId ? String(source.visitId) : null,
    status: normalizeVisitLongitudinalTimelineRolloutStatus(source.status),
    reasons: parseJsonArray(source.reasons),
    validationStatus: normalizeVisitLongitudinalDatasetValidationStatus(source.validationStatus),
    lesionCount: numberOrZero(source.lesionCount),
    readyTimelineCount: numberOrZero(source.readyTimelineCount),
    needsReviewTimelineCount: numberOrZero(source.needsReviewTimelineCount),
    blockedTimelineCount: numberOrZero(source.blockedTimelineCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewerWorkflowReadyCount: numberOrZero(source.reviewerWorkflowReadyCount),
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: source.reviewedAt ?? null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
}

function normalizeVisitLongitudinalTimelineRolloutSop(row) {
  const source = parseJsonObject(row);
  return {
    id: source.id ? String(source.id) : null,
    clinicId: source.clinicId ? String(source.clinicId) : null,
    patientId: source.patientId ? String(source.patientId) : null,
    visitId: source.visitId ? String(source.visitId) : null,
    status: normalizeVisitLongitudinalTimelineRolloutSopStatus(source.status),
    reasons: parseJsonArray(source.reasons),
    validationStatus: normalizeVisitLongitudinalDatasetValidationStatus(source.validationStatus),
    rolloutStatus: normalizeVisitLongitudinalTimelineRolloutStatus(source.rolloutStatus),
    datasetValidationStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.datasetValidationStatus),
    reviewerOperationsStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.reviewerOperationsStatus,
    ),
    rollbackPlanStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.rollbackPlanStatus),
    monitoringPlanStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.monitoringPlanStatus),
    rolloutWindowStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.rolloutWindowStatus),
    ownerAckStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.ownerAckStatus),
    lesionCount: numberOrZero(source.lesionCount),
    readyTimelineCount: numberOrZero(source.readyTimelineCount),
    blockedTimelineCount: numberOrZero(source.blockedTimelineCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewerWorkflowReadyCount: numberOrZero(source.reviewerWorkflowReadyCount),
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: source.reviewedAt ?? null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
}

function normalizeVisitLongitudinalTimelineRolloutEvidence(row) {
  const source = parseJsonObject(row);
  return {
    id: source.id ? String(source.id) : null,
    clinicId: source.clinicId ? String(source.clinicId) : null,
    patientId: source.patientId ? String(source.patientId) : null,
    visitId: source.visitId ? String(source.visitId) : null,
    status: normalizeVisitLongitudinalTimelineRolloutEvidenceStatus(source.status),
    reasons: parseJsonArray(source.reasons),
    sopStatus: normalizeVisitLongitudinalTimelineRolloutSopStatus(source.sopStatus),
    validationStatus: normalizeVisitLongitudinalDatasetValidationStatus(source.validationStatus),
    rolloutStatus: normalizeVisitLongitudinalTimelineRolloutStatus(source.rolloutStatus),
    monitoringEvidenceStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.monitoringEvidenceStatus,
    ),
    sampleAuditStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.sampleAuditStatus),
    exceptionLogStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.exceptionLogStatus),
    rollbackDrillStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.rollbackDrillStatus),
    ownerSignoffStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.ownerSignoffStatus),
    monitoringWindowDays: numberOrZero(source.monitoringWindowDays),
    sampledTimelineCount: numberOrZero(source.sampledTimelineCount),
    exceptionCount: numberOrZero(source.exceptionCount),
    rollbackDrillCount: numberOrZero(source.rollbackDrillCount),
    lesionCount: numberOrZero(source.lesionCount),
    readyTimelineCount: numberOrZero(source.readyTimelineCount),
    blockedTimelineCount: numberOrZero(source.blockedTimelineCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewerWorkflowReadyCount: numberOrZero(source.reviewerWorkflowReadyCount),
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: source.reviewedAt ?? null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
}

function normalizeVisitLongitudinalTimelineRolloutMonitoring(row) {
  const source = parseJsonObject(row);
  return {
    id: source.id ? String(source.id) : null,
    clinicId: source.clinicId ? String(source.clinicId) : null,
    patientId: source.patientId ? String(source.patientId) : null,
    visitId: source.visitId ? String(source.visitId) : null,
    status: normalizeVisitLongitudinalTimelineRolloutMonitoringStatus(source.status),
    reasons: parseJsonArray(source.reasons),
    evidenceStatus: normalizeVisitLongitudinalTimelineRolloutEvidenceStatus(source.evidenceStatus),
    sopStatus: normalizeVisitLongitudinalTimelineRolloutSopStatus(source.sopStatus),
    validationStatus: normalizeVisitLongitudinalDatasetValidationStatus(source.validationStatus),
    rolloutStatus: normalizeVisitLongitudinalTimelineRolloutStatus(source.rolloutStatus),
    outcomeSamplingStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.outcomeSamplingStatus),
    incidentReviewStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.incidentReviewStatus),
    exceptionClosureStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.exceptionClosureStatus,
    ),
    rollbackOutcomeStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.rollbackOutcomeStatus),
    ownerFinalReviewStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.ownerFinalReviewStatus),
    monitoringWindowDays: numberOrZero(source.monitoringWindowDays),
    monitoredTimelineCount: numberOrZero(source.monitoredTimelineCount),
    sampledTimelineCount: numberOrZero(source.sampledTimelineCount),
    incidentCount: numberOrZero(source.incidentCount),
    unresolvedIncidentCount: numberOrZero(source.unresolvedIncidentCount),
    closedExceptionCount: numberOrZero(source.closedExceptionCount),
    rollbackExecutionCount: numberOrZero(source.rollbackExecutionCount),
    lesionCount: numberOrZero(source.lesionCount),
    readyTimelineCount: numberOrZero(source.readyTimelineCount),
    blockedTimelineCount: numberOrZero(source.blockedTimelineCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewerWorkflowReadyCount: numberOrZero(source.reviewerWorkflowReadyCount),
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: source.reviewedAt ?? null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
}

function normalizeVisitLongitudinalTimelineRolloutIncidentProcedure(row) {
  const source = parseJsonObject(row);
  return {
    id: source.id ? String(source.id) : null,
    clinicId: source.clinicId ? String(source.clinicId) : null,
    patientId: source.patientId ? String(source.patientId) : null,
    visitId: source.visitId ? String(source.visitId) : null,
    status: normalizeVisitLongitudinalTimelineRolloutIncidentProcedureStatus(source.status),
    reasons: parseJsonArray(source.reasons),
    monitoringStatus: normalizeVisitLongitudinalTimelineRolloutMonitoringStatus(source.monitoringStatus),
    evidenceStatus: normalizeVisitLongitudinalTimelineRolloutEvidenceStatus(source.evidenceStatus),
    sopStatus: normalizeVisitLongitudinalTimelineRolloutSopStatus(source.sopStatus),
    validationStatus: normalizeVisitLongitudinalDatasetValidationStatus(source.validationStatus),
    rolloutStatus: normalizeVisitLongitudinalTimelineRolloutStatus(source.rolloutStatus),
    realDatasetStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.realDatasetStatus),
    outcomeSamplingProcedureStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.outcomeSamplingProcedureStatus,
    ),
    incidentTriageStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.incidentTriageStatus),
    escalationPathStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.escalationPathStatus),
    rollbackDecisionStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.rollbackDecisionStatus,
    ),
    ownerReviewStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.ownerReviewStatus),
    realDatasetTimelineCount: numberOrZero(source.realDatasetTimelineCount),
    monitoredTimelineCount: numberOrZero(source.monitoredTimelineCount),
    sampledOutcomeCount: numberOrZero(source.sampledOutcomeCount),
    incidentCaseCount: numberOrZero(source.incidentCaseCount),
    unresolvedIncidentCount: numberOrZero(source.unresolvedIncidentCount),
    escalatedIncidentCount: numberOrZero(source.escalatedIncidentCount),
    rollbackDecisionCount: numberOrZero(source.rollbackDecisionCount),
    lesionCount: numberOrZero(source.lesionCount),
    readyTimelineCount: numberOrZero(source.readyTimelineCount),
    blockedTimelineCount: numberOrZero(source.blockedTimelineCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewerWorkflowReadyCount: numberOrZero(source.reviewerWorkflowReadyCount),
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: source.reviewedAt ?? null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
}

function normalizeVisitLongitudinalTimelineRolloutClinicalValidation(row) {
  const source = parseJsonObject(row);
  return {
    id: source.id ? String(source.id) : null,
    clinicId: source.clinicId ? String(source.clinicId) : null,
    patientId: source.patientId ? String(source.patientId) : null,
    visitId: source.visitId ? String(source.visitId) : null,
    status: normalizeVisitLongitudinalTimelineRolloutClinicalValidationStatus(source.status),
    reasons: parseJsonArray(source.reasons),
    incidentProcedureStatus: normalizeVisitLongitudinalTimelineRolloutIncidentProcedureStatus(
      source.incidentProcedureStatus,
    ),
    monitoringStatus: normalizeVisitLongitudinalTimelineRolloutMonitoringStatus(source.monitoringStatus),
    evidenceStatus: normalizeVisitLongitudinalTimelineRolloutEvidenceStatus(source.evidenceStatus),
    sopStatus: normalizeVisitLongitudinalTimelineRolloutSopStatus(source.sopStatus),
    validationStatus: normalizeVisitLongitudinalDatasetValidationStatus(source.validationStatus),
    rolloutStatus: normalizeVisitLongitudinalTimelineRolloutStatus(source.rolloutStatus),
    realDatasetLockStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.realDatasetLockStatus,
    ),
    validatorTrainingStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.validatorTrainingStatus,
    ),
    blindedSampleStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.blindedSampleStatus),
    adjudicationStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.adjudicationStatus),
    decisionLogStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.decisionLogStatus),
    ownerAcceptanceStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.ownerAcceptanceStatus),
    realDatasetTimelineCount: numberOrZero(source.realDatasetTimelineCount),
    validationSampleCount: numberOrZero(source.validationSampleCount),
    disagreementCaseCount: numberOrZero(source.disagreementCaseCount),
    adjudicatedCaseCount: numberOrZero(source.adjudicatedCaseCount),
    followupWindowDays: numberOrZero(source.followupWindowDays),
    blockerCount: numberOrZero(source.blockerCount),
    lesionCount: numberOrZero(source.lesionCount),
    readyTimelineCount: numberOrZero(source.readyTimelineCount),
    blockedTimelineCount: numberOrZero(source.blockedTimelineCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewerWorkflowReadyCount: numberOrZero(source.reviewerWorkflowReadyCount),
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: source.reviewedAt ?? null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
}

function normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoring(row) {
  const source = parseJsonObject(row);
  return {
    id: source.id ? String(source.id) : null,
    clinicId: source.clinicId ? String(source.clinicId) : null,
    patientId: source.patientId ? String(source.patientId) : null,
    visitId: source.visitId ? String(source.visitId) : null,
    status: normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringStatus(source.status),
    reasons: parseJsonArray(source.reasons),
    clinicalValidationStatus: normalizeVisitLongitudinalTimelineRolloutClinicalValidationStatus(
      source.clinicalValidationStatus,
    ),
    incidentProcedureStatus: normalizeVisitLongitudinalTimelineRolloutIncidentProcedureStatus(
      source.incidentProcedureStatus,
    ),
    monitoringStatus: normalizeVisitLongitudinalTimelineRolloutMonitoringStatus(source.monitoringStatus),
    evidenceStatus: normalizeVisitLongitudinalTimelineRolloutEvidenceStatus(source.evidenceStatus),
    sopStatus: normalizeVisitLongitudinalTimelineRolloutSopStatus(source.sopStatus),
    validationStatus: normalizeVisitLongitudinalDatasetValidationStatus(source.validationStatus),
    rolloutStatus: normalizeVisitLongitudinalTimelineRolloutStatus(source.rolloutStatus),
    monitoringWindowStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.monitoringWindowStatus,
    ),
    outcomeReviewStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.outcomeReviewStatus),
    driftReviewStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.driftReviewStatus),
    incidentFollowupStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.incidentFollowupStatus,
    ),
    validatorRecheckStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.validatorRecheckStatus,
    ),
    ownerSignoffStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.ownerSignoffStatus),
    realDatasetTimelineCount: numberOrZero(source.realDatasetTimelineCount),
    clinicalValidationSampleCount: numberOrZero(source.clinicalValidationSampleCount),
    monitoredTimelineCount: numberOrZero(source.monitoredTimelineCount),
    sampledOutcomeCount: numberOrZero(source.sampledOutcomeCount),
    driftSignalCount: numberOrZero(source.driftSignalCount),
    unresolvedDriftSignalCount: numberOrZero(source.unresolvedDriftSignalCount),
    incidentFollowupCount: numberOrZero(source.incidentFollowupCount),
    unresolvedIncidentFollowupCount: numberOrZero(source.unresolvedIncidentFollowupCount),
    validatorRecheckCount: numberOrZero(source.validatorRecheckCount),
    blockerCount: numberOrZero(source.blockerCount),
    lesionCount: numberOrZero(source.lesionCount),
    readyTimelineCount: numberOrZero(source.readyTimelineCount),
    blockedTimelineCount: numberOrZero(source.blockedTimelineCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewerWorkflowReadyCount: numberOrZero(source.reviewerWorkflowReadyCount),
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: source.reviewedAt ?? null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
}

function normalizeVisitLongitudinalTimelineRolloutObservationGovernance(row) {
  const source = parseJsonObject(row);
  return {
    id: source.id ? String(source.id) : null,
    clinicId: source.clinicId ? String(source.clinicId) : null,
    patientId: source.patientId ? String(source.patientId) : null,
    visitId: source.visitId ? String(source.visitId) : null,
    status: normalizeVisitLongitudinalTimelineRolloutObservationGovernanceStatus(source.status),
    reasons: parseJsonArray(source.reasons),
    postValidationMonitoringStatus: normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringStatus(
      source.postValidationMonitoringStatus,
    ),
    clinicalValidationStatus: normalizeVisitLongitudinalTimelineRolloutClinicalValidationStatus(
      source.clinicalValidationStatus,
    ),
    incidentProcedureStatus: normalizeVisitLongitudinalTimelineRolloutIncidentProcedureStatus(
      source.incidentProcedureStatus,
    ),
    monitoringStatus: normalizeVisitLongitudinalTimelineRolloutMonitoringStatus(source.monitoringStatus),
    evidenceStatus: normalizeVisitLongitudinalTimelineRolloutEvidenceStatus(source.evidenceStatus),
    sopStatus: normalizeVisitLongitudinalTimelineRolloutSopStatus(source.sopStatus),
    validationStatus: normalizeVisitLongitudinalDatasetValidationStatus(source.validationStatus),
    rolloutStatus: normalizeVisitLongitudinalTimelineRolloutStatus(source.rolloutStatus),
    observationWindowStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.observationWindowStatus,
    ),
    outcomeObservationStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.outcomeObservationStatus,
    ),
    driftSignalReviewStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.driftSignalReviewStatus,
    ),
    incidentOutcomeReviewStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.incidentOutcomeReviewStatus,
    ),
    followupClosureStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.followupClosureStatus,
    ),
    governanceReviewStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(
      source.governanceReviewStatus,
    ),
    ownerSignoffStatus: normalizeVisitLongitudinalTimelineRolloutSopChecklistStatus(source.ownerSignoffStatus),
    realDatasetTimelineCount: numberOrZero(source.realDatasetTimelineCount),
    postValidationSampleCount: numberOrZero(source.postValidationSampleCount),
    observedTimelineCount: numberOrZero(source.observedTimelineCount),
    expectedFollowupCount: numberOrZero(source.expectedFollowupCount),
    completedFollowupCount: numberOrZero(source.completedFollowupCount),
    driftSignalCount: numberOrZero(source.driftSignalCount),
    unresolvedDriftSignalCount: numberOrZero(source.unresolvedDriftSignalCount),
    incidentOutcomeCount: numberOrZero(source.incidentOutcomeCount),
    unresolvedIncidentOutcomeCount: numberOrZero(source.unresolvedIncidentOutcomeCount),
    governanceExceptionCount: numberOrZero(source.governanceExceptionCount),
    unresolvedGovernanceExceptionCount: numberOrZero(source.unresolvedGovernanceExceptionCount),
    blockerCount: numberOrZero(source.blockerCount),
    lesionCount: numberOrZero(source.lesionCount),
    readyTimelineCount: numberOrZero(source.readyTimelineCount),
    blockedTimelineCount: numberOrZero(source.blockedTimelineCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    reviewerWorkflowReadyCount: numberOrZero(source.reviewerWorkflowReadyCount),
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: source.reviewedAt ?? null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
}

function normalizeVisitLongitudinalDatasetValidation(row) {
  return {
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: String(row.visitId ?? ""),
    readiness: normalizeVisitLongitudinalDatasetValidationReadiness(row.readiness),
    items: parseObjectArray(row.items).map(normalizeVisitLongitudinalDatasetValidationItem),
    blockers: parseObjectArray(row.blockers)
      .map(normalizeLongitudinalQaBlocker)
      .filter(Boolean),
    timelineRollout: normalizeVisitLongitudinalTimelineRollout(row.timelineRollout),
    timelineRolloutSop: normalizeVisitLongitudinalTimelineRolloutSop(row.timelineRolloutSop),
    timelineRolloutEvidence: normalizeVisitLongitudinalTimelineRolloutEvidence(row.timelineRolloutEvidence),
    timelineRolloutMonitoring: normalizeVisitLongitudinalTimelineRolloutMonitoring(row.timelineRolloutMonitoring),
    timelineRolloutIncidentProcedure: normalizeVisitLongitudinalTimelineRolloutIncidentProcedure(
      row.timelineRolloutIncidentProcedure,
    ),
    timelineRolloutClinicalValidation: normalizeVisitLongitudinalTimelineRolloutClinicalValidation(
      row.timelineRolloutClinicalValidation,
    ),
    timelineRolloutPostValidationMonitoring: normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoring(
      row.timelineRolloutPostValidationMonitoring,
    ),
    timelineRolloutObservationGovernance: normalizeVisitLongitudinalTimelineRolloutObservationGovernance(
      row.timelineRolloutObservationGovernance,
    ),
    nextActions: normalizeLongitudinalQaActions(row.nextActions),
    boundaries: {
      patientDeliveryAllowed: false,
      medicalMeasurementAllowed: false,
      protectedFieldsExposed: false,
      pairKeysExposed: false,
      imageIdsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      rawImageBytesExposed: false,
      doctorOnlyTextExposed: false,
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
    async reviewLesionComparisonViewerQaReviewerWorkflow(params) {
      return queryOne(
        dbClient,
        buildReviewLesionComparisonViewerQaReviewerWorkflowSql(params),
        normalizeLesionComparisonViewerQa,
      );
    },
    async reviewLesionComparisonMeasurementPolicy(params) {
      return queryOne(
        dbClient,
        buildReviewLesionComparisonMeasurementPolicySql(params),
        normalizeLesionComparisonViewerQa,
      );
    },
    async reviewLesionComparisonProductionAnalysisPolicy(params) {
      return queryOne(
        dbClient,
        buildReviewLesionComparisonProductionAnalysisPolicySql(params),
        normalizeLesionComparisonViewerQa,
      );
    },
    async assignLesionComparisonReviewer(params) {
      return queryOne(
        dbClient,
        buildAssignLesionComparisonReviewerSql(params),
        normalizeLesionComparisonViewerQa,
      );
    },
    async getVisitLesionComparisonViewerQaReviewQueue(params) {
      return queryOne(
        dbClient,
        buildGetVisitLesionComparisonViewerQaReviewQueueSql(params),
        normalizeVisitLesionComparisonViewerQaReviewQueue,
      );
    },
    async getVisitLongitudinalDatasetValidation(params) {
      return queryOne(
        dbClient,
        buildGetVisitLongitudinalDatasetValidationSql(params),
        normalizeVisitLongitudinalDatasetValidation,
      );
    },
    async reviewVisitLongitudinalTimelineRollout(params) {
      return queryOne(
        dbClient,
        buildReviewVisitLongitudinalTimelineRolloutSql(params),
        normalizeVisitLongitudinalTimelineRollout,
      );
    },
    async reviewVisitLongitudinalTimelineRolloutSop(params) {
      return queryOne(
        dbClient,
        buildReviewVisitLongitudinalTimelineRolloutSopSql(params),
        normalizeVisitLongitudinalTimelineRolloutSop,
      );
    },
    async reviewVisitLongitudinalTimelineRolloutEvidence(params) {
      return queryOne(
        dbClient,
        buildReviewVisitLongitudinalTimelineRolloutEvidenceSql(params),
        normalizeVisitLongitudinalTimelineRolloutEvidence,
      );
    },
    async reviewVisitLongitudinalTimelineRolloutMonitoring(params) {
      return queryOne(
        dbClient,
        buildReviewVisitLongitudinalTimelineRolloutMonitoringSql(params),
        normalizeVisitLongitudinalTimelineRolloutMonitoring,
      );
    },
    async reviewVisitLongitudinalTimelineRolloutIncidentProcedure(params) {
      return queryOne(
        dbClient,
        buildReviewVisitLongitudinalTimelineRolloutIncidentProcedureSql(params),
        normalizeVisitLongitudinalTimelineRolloutIncidentProcedure,
      );
    },
    async reviewVisitLongitudinalTimelineRolloutClinicalValidation(params) {
      return queryOne(
        dbClient,
        buildReviewVisitLongitudinalTimelineRolloutClinicalValidationSql(params),
        normalizeVisitLongitudinalTimelineRolloutClinicalValidation,
      );
    },
    async reviewVisitLongitudinalTimelineRolloutPostValidationMonitoring(params) {
      return queryOne(
        dbClient,
        buildReviewVisitLongitudinalTimelineRolloutPostValidationMonitoringSql(params),
        normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoring,
      );
    },
    async reviewVisitLongitudinalTimelineRolloutObservationGovernance(params) {
      return queryOne(
        dbClient,
        buildReviewVisitLongitudinalTimelineRolloutObservationGovernanceSql(params),
        normalizeVisitLongitudinalTimelineRolloutObservationGovernance,
      );
    },
    async getLesionLongitudinalHistory(params) {
      return queryOne(dbClient, buildGetLesionLongitudinalHistorySql(params), normalizeLesionLongitudinalHistory);
    },
    async getLesionLongitudinalQa(params) {
      return queryOne(dbClient, buildGetLesionLongitudinalQaSql(params), normalizeLesionLongitudinalQa);
    },
    async getProtectedLesionImageAsset(params) {
      return queryOne(dbClient, buildGetProtectedLesionImageAssetSql(params), normalizeProtectedLesionImageAsset);
    },
  };
}

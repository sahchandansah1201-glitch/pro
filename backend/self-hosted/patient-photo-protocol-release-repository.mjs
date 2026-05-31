// Batch R · Patient photo/protocol release ledger repository.
// Persists release/revoke metadata only. Raw file locations and temporary
// access artifacts never leave the backend through this contract.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SELF_HOSTED_DELIVERY_BLOCKER = "self_hosted_photo_delivery_contract_missing";

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlNullableUuid(value) {
  return value == null ? "null" : sqlUuid(value);
}

function sqlNullableText(value) {
  return value == null ? "null" : sqlLiteral(value);
}

function sqlNullableTimestamp(value) {
  return value == null ? "null" : `${sqlLiteral(value)}::timestamptz`;
}

function safeClinicIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(String)
    .filter((value) => UUID_PATTERN.test(value))
    .slice(0, 100);
}

function clinicScopeWhere({ alias = "v", clinicIds = [], allClinics = false } = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${ids.map(sqlUuid).join(", ")})`;
}

function releaseSafeColumns(alias = "r") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.visit_id::text as "visitId",
    ${alias}.report_id::text as "reportId",
    ${alias}.status as "status",
    ${alias}.selected_photo_count as "selectedPhotoCount",
    ${alias}.overview_photo_count as "overviewPhotoCount",
    ${alias}.dermoscopy_photo_count as "dermoscopyPhotoCount",
    ${alias}.report_attachment_count as "reportAttachmentCount",
    ${alias}.release_blockers as "blockers",
    ${alias}.prepared_at as "preparedAt",
    ${alias}.revoked_at as "revokedAt",
    ${alias}.revoke_reason as "revokeReason",
    ${alias}.expires_at as "expiresAt",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"
  `;
}

function contextCtes({ visitId, clinicIds = [], allClinics = false } = {}) {
  return `
with scoped_visit as (
  select
    v.id,
    v.clinic_id,
    v.patient_id,
    p.imaging_consent
  from visits v
  join patients p on p.id = v.patient_id and p.clinic_id = v.clinic_id
  where v.id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  limit 1
),
report as (
  select
    r.id,
    r.status,
    nullif(trim(coalesce(r.patient_safe_text, '')), '') is not null as patient_safe_text_present
  from reports r
  join scoped_visit sv on sv.id = r.visit_id and sv.clinic_id = r.clinic_id
  limit 1
),
asset_counts as (
  select
    count(*) filter (where a.kind in ('overview_photo', 'dermoscopy'))::int as patient_photo_count,
    count(*) filter (where a.kind = 'overview_photo')::int as overview_photo_count,
    count(*) filter (where a.kind = 'dermoscopy')::int as dermoscopy_photo_count,
    count(*) filter (where a.kind = 'report_attachment')::int as report_attachment_count
  from clinical_assets a
  join scoped_visit sv on sv.id = a.visit_id and sv.clinic_id = a.clinic_id
),
gate as (
  select
    sv.clinic_id,
    sv.patient_id,
    sv.id as visit_id,
    r.id as report_id,
    coalesce(ac.patient_photo_count, 0) as patient_photo_count,
    coalesce(ac.overview_photo_count, 0) as overview_photo_count,
    coalesce(ac.dermoscopy_photo_count, 0) as dermoscopy_photo_count,
    coalesce(ac.report_attachment_count, 0) as report_attachment_count,
    array_remove(array[
      case when sv.imaging_consent then null else 'imaging_consent_missing' end,
      case when coalesce(ac.patient_photo_count, 0) > 0 then null else 'patient_photo_assets_missing' end,
      case when r.id is not null then null else 'report_missing' end,
      case when r.id is not null and r.status = 'signed' then null else 'report_not_signed' end,
      case when coalesce(r.patient_safe_text_present, false) then null else 'patient_safe_text_missing' end,
      '${SELF_HOSTED_DELIVERY_BLOCKER}'
    ], null)::text[] as blockers
  from scoped_visit sv
  left join report r on true
  left join asset_counts ac on true
)`;
}

export function buildPreparePatientPhotoProtocolReleaseSql({
  visitId,
  actorUserId,
  expiresAt = null,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
${contextCtes({ visitId, clinicIds, allClinics })},
upserted as (
  insert into patient_photo_protocol_releases (
    clinic_id,
    patient_id,
    visit_id,
    report_id,
    status,
    selected_photo_count,
    overview_photo_count,
    dermoscopy_photo_count,
    report_attachment_count,
    release_blockers,
    prepared_by_user_id,
    prepared_at,
    revoked_by_user_id,
    revoked_at,
    revoke_reason,
    expires_at,
    metadata_json
  )
  select
    g.clinic_id,
    g.patient_id,
    g.visit_id,
    g.report_id,
    case
      when cardinality(g.blockers) = 1 and g.blockers[1] = '${SELF_HOSTED_DELIVERY_BLOCKER}'
        then 'prepared'
      else 'blocked'
    end,
    g.patient_photo_count,
    g.overview_photo_count,
    g.dermoscopy_photo_count,
    g.report_attachment_count,
    g.blockers,
    ${sqlNullableUuid(actorUserId)},
    now(),
    null,
    null,
    null,
    ${sqlNullableTimestamp(expiresAt)},
    jsonb_build_object(
      'brainstormTask', 'SD-MF-046',
      'patientDeliveryAllowed', false,
      'rawFilesExposed', false,
      'signedUrlsIssued', false
    )
  from gate g
  on conflict (visit_id) do update
  set
    report_id = excluded.report_id,
    status = excluded.status,
    selected_photo_count = excluded.selected_photo_count,
    overview_photo_count = excluded.overview_photo_count,
    dermoscopy_photo_count = excluded.dermoscopy_photo_count,
    report_attachment_count = excluded.report_attachment_count,
    release_blockers = excluded.release_blockers,
    prepared_by_user_id = excluded.prepared_by_user_id,
    prepared_at = excluded.prepared_at,
    revoked_by_user_id = null,
    revoked_at = null,
    revoke_reason = null,
    expires_at = excluded.expires_at,
    metadata_json = excluded.metadata_json,
    updated_at = now()
  returning *
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${releaseSafeColumns("r")}
  from upserted r
  limit 1
) result;
`.trim();
}

export function buildRevokePatientPhotoProtocolReleaseSql({
  visitId,
  actorUserId,
  reason,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
with scoped_release as (
  select r.id
  from patient_photo_protocol_releases r
  join visits v on v.id = r.visit_id and v.clinic_id = r.clinic_id
  where r.visit_id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  limit 1
),
updated as (
  update patient_photo_protocol_releases r
  set
    status = 'revoked',
    revoked_by_user_id = ${sqlNullableUuid(actorUserId)},
    revoked_at = now(),
    revoke_reason = ${sqlNullableText(reason)},
    updated_at = now()
  from scoped_release s
  where r.id = s.id
  returning r.*
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${releaseSafeColumns("r")}
  from updated r
  limit 1
) result;
`.trim();
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function number(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function textOrNull(value) {
  return value == null ? null : String(value);
}

function normalizeRelease(row) {
  return {
    id: String(row.id),
    clinicId: textOrNull(row.clinicId),
    patientId: textOrNull(row.patientId),
    visitId: textOrNull(row.visitId),
    reportId: textOrNull(row.reportId),
    status: String(row.status ?? "blocked"),
    selectedPhotoCount: number(row.selectedPhotoCount),
    counts: {
      selectedPhotos: number(row.selectedPhotoCount),
      overviewPhotos: number(row.overviewPhotoCount),
      dermoscopyPhotos: number(row.dermoscopyPhotoCount),
      reportAttachments: number(row.reportAttachmentCount),
    },
    blockers: arrayOfStrings(row.blockers),
    preparedAt: row.preparedAt ?? null,
    revokedAt: row.revokedAt ?? null,
    revokeReason: textOrNull(row.revokeReason),
    expiresAt: row.expiresAt ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    deliveryBoundary: {
      patientDeliveryAllowed: false,
      rawFilesExposed: false,
      signedUrlsIssued: false,
      storagePathsExposed: false,
      tokensExposed: false,
      physicianTextExposed: false,
      requiresSelfHostedFileProxy: true,
      requiresReleaseAudit: true,
      requiresRevoke: true,
      requiresIdentityCheck: true,
      requiresRetentionPolicy: true,
    },
  };
}

export function createPatientPhotoProtocolReleaseRepository(dbClient) {
  return {
    async prepareRelease(params) {
      const rows = await dbClient.queryJson(buildPreparePatientPhotoProtocolReleaseSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeRelease(rows[0]) : null;
    },
    async revokeRelease(params) {
      const rows = await dbClient.queryJson(buildRevokePatientPhotoProtocolReleaseSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeRelease(rows[0]) : null;
    },
  };
}

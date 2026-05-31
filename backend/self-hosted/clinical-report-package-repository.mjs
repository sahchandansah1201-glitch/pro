// Stage 8G-8I · Clinical reporting completion repository.
// Builds a safe report-package snapshot from local PostgreSQL only.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlUuidList(values = []) {
  return values.map((v) => sqlUuid(v)).join(", ");
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
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

export function buildGetClinicalReportPackageSql({
  visitId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
with scoped_visit as (
  select
    v.id,
    v.clinic_id,
    v.patient_id,
    v.status,
    v.started_at,
    v.signed_at
  from visits v
  where v.id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  limit 1
),
assessment as (
  select
    a.id,
    a.status,
    a.risk_level,
    a.abcd_total,
    a.seven_point_total,
    a.summary,
    a.recommendation,
    a.signed_at,
    a.updated_at
  from clinical_assessments a
  join scoped_visit sv on sv.id = a.visit_id and sv.clinic_id = a.clinic_id
  limit 1
),
conclusion as (
  select
    c.id,
    c.status,
    c.summary,
    c.next_step,
    c.follow_up_at,
    c.signed_at,
    c.updated_at
  from clinical_conclusions c
  join scoped_visit sv on sv.id = c.visit_id and sv.clinic_id = c.clinic_id
  limit 1
),
report as (
  select
    r.id,
    r.status,
    nullif(trim(coalesce(r.physician_text, '')), '') is not null as physician_text_present,
    nullif(trim(coalesce(r.patient_safe_text, '')), '') is not null as patient_safe_text_present,
    r.signed_at,
    r.updated_at
  from reports r
  join scoped_visit sv on sv.id = r.visit_id and sv.clinic_id = r.clinic_id
  limit 1
),
patient_flags as (
  select
    p.imaging_consent as "imagingConsent"
  from patients p
  join scoped_visit sv on sv.patient_id = p.id and sv.clinic_id = p.clinic_id
  limit 1
),
lesion_counts as (
  select count(*)::int as count
  from lesions l
  join scoped_visit sv on sv.id = l.visit_id and sv.clinic_id = l.clinic_id
  where l.deleted_at is null
),
asset_counts as (
  select
    count(*)::int as count,
    count(*) filter (where a.kind in ('overview_photo', 'dermoscopy'))::int as patient_photo_count,
    count(*) filter (where a.kind = 'overview_photo')::int as overview_photo_count,
    count(*) filter (where a.kind = 'dermoscopy')::int as dermoscopy_photo_count,
    count(*) filter (where a.kind = 'report_attachment')::int as report_attachment_count
  from clinical_assets a
  join scoped_visit sv on sv.id = a.visit_id and sv.clinic_id = a.clinic_id
),
release_policy as (
  select
    true as release_exists,
    r.expires_at as release_expires_at,
    coalesce((r.metadata_json ->> 'patientFileProxyEnabled')::boolean, false) as patient_file_proxy_enabled,
    coalesce((r.metadata_json ->> 'patientCopyApproved')::boolean, false) as patient_copy_approved,
    coalesce((r.metadata_json ->> 'retentionPolicyApproved')::boolean, false) as retention_policy_approved
  from patient_photo_protocol_releases r
  join scoped_visit sv on sv.id = r.visit_id and sv.clinic_id = r.clinic_id
  where r.status in ('prepared', 'revoked', 'blocked')
  order by r.updated_at desc
  limit 1
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    sv.id::text as "visitId",
    sv.clinic_id::text as "clinicId",
    sv.patient_id::text as "patientId",
    sv.status::text as "visitStatus",
    sv.started_at as "visitStartedAt",
    sv.signed_at as "visitSignedAt",
    a.id::text as "assessmentId",
    a.status::text as "assessmentStatus",
    a.risk_level::text as "assessmentRiskLevel",
    a.abcd_total as "assessmentAbcdTotal",
    a.seven_point_total as "assessmentSevenPointTotal",
    nullif(trim(coalesce(a.summary, '')), '') is not null as "assessmentSummaryPresent",
    nullif(trim(coalesce(a.recommendation, '')), '') is not null as "assessmentRecommendationPresent",
    a.signed_at as "assessmentSignedAt",
    a.updated_at as "assessmentUpdatedAt",
    c.id::text as "conclusionId",
    c.status::text as "conclusionStatus",
    nullif(trim(coalesce(c.summary, '')), '') is not null as "conclusionSummaryPresent",
    nullif(trim(coalesce(c.next_step, '')), '') is not null as "conclusionNextStepPresent",
    c.follow_up_at as "conclusionFollowUpAt",
    c.signed_at as "conclusionSignedAt",
    c.updated_at as "conclusionUpdatedAt",
    r.id::text as "reportId",
    r.status::text as "reportStatus",
    r.physician_text_present as "reportPhysicianTextPresent",
    r.patient_safe_text_present as "reportPatientSafeTextPresent",
    r.signed_at as "reportSignedAt",
    r.updated_at as "reportUpdatedAt",
    coalesce(lc.count, 0) as "lesionCount",
    coalesce(ac.count, 0) as "assetCount",
    coalesce(pf."imagingConsent", false) as "imagingConsent",
    coalesce(ac.patient_photo_count, 0) as "patientPhotoAssetCount",
    coalesce(ac.overview_photo_count, 0) as "overviewPhotoCount",
    coalesce(ac.dermoscopy_photo_count, 0) as "dermoscopyPhotoCount",
    coalesce(ac.report_attachment_count, 0) as "reportAttachmentCount",
    coalesce(rp.release_exists, false) as "photoReleaseExists",
    rp.release_expires_at as "photoReleaseExpiresAt",
    coalesce(rp.patient_file_proxy_enabled, false) as "patientFileProxyEnabled",
    coalesce(rp.patient_copy_approved, false) as "patientCopyApproved",
    coalesce(rp.retention_policy_approved, false) as "retentionPolicyApproved"
  from scoped_visit sv
  left join assessment a on true
  left join conclusion c on true
  left join report r on true
  left join patient_flags pf on true
  left join lesion_counts lc on true
  left join asset_counts ac on true
  left join release_policy rp on true
  limit 1
) result;
`.trim();
}

function textOrNull(value) {
  return value == null ? null : String(value);
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function statusReady(status) {
  return status === "ready" || status === "signed";
}

function count(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

function buildMissing(row) {
  const missing = [];
  if (!row.assessmentId) missing.push("assessment_missing");
  if (row.assessmentId && !statusReady(row.assessmentStatus)) missing.push("assessment_not_ready");
  if (!bool(row.assessmentSummaryPresent)) missing.push("assessment_summary_missing");
  if (!row.conclusionId) missing.push("conclusion_missing");
  if (row.conclusionId && !statusReady(row.conclusionStatus)) missing.push("conclusion_not_ready");
  if (!bool(row.conclusionSummaryPresent)) missing.push("conclusion_summary_missing");
  if (!row.reportId) missing.push("report_missing");
  if (row.reportId && row.reportStatus !== "signed") missing.push("report_not_signed");
  if (!bool(row.reportPatientSafeTextPresent)) missing.push("patient_safe_text_missing");
  if (!bool(row.reportPhysicianTextPresent)) missing.push("physician_text_missing");
  return missing;
}

function buildPatientPhotoProtocolMissing(row) {
  const missing = [];
  if (!bool(row.imagingConsent)) missing.push("imaging_consent_missing");
  if (count(row.patientPhotoAssetCount) === 0) missing.push("patient_photo_assets_missing");
  if (!row.reportId) missing.push("report_missing");
  if (row.reportId && row.reportStatus !== "signed") missing.push("report_not_signed");
  if (!bool(row.reportPatientSafeTextPresent)) missing.push("patient_safe_text_missing");
  missing.push("self_hosted_photo_delivery_contract_missing");
  return Array.from(new Set(missing));
}

function normalizePatientPhotoProtocol(row) {
  const missing = buildPatientPhotoProtocolMissing(row);
  const readyForBackendContract = missing.every((key) => key === "self_hosted_photo_delivery_contract_missing");
  const fileProxyReady = bool(row.patientFileProxyEnabled);
  const retentionPolicyApproved = bool(row.retentionPolicyApproved);
  const patientCopyApproved = bool(row.patientCopyApproved);
  const releaseExpiresAt = textOrNull(row.photoReleaseExpiresAt);
  const requiresRetentionPolicy = !retentionPolicyApproved || !releaseExpiresAt;
  const requiresApprovedPatientCopy = !patientCopyApproved || !bool(row.reportPatientSafeTextPresent);
  return {
    brainstormTask: "SD-MF-046",
    status: readyForBackendContract ? "metadata_ready_backend_blocked" : "blocked",
    readyForBackendContract,
    selectedPhotoCount: count(row.patientPhotoAssetCount),
    counts: {
      selectedPhotos: count(row.patientPhotoAssetCount),
      overviewPhotos: count(row.overviewPhotoCount),
      dermoscopyPhotos: count(row.dermoscopyPhotoCount),
      reportAttachments: count(row.reportAttachmentCount),
    },
    missing,
    policy: {
      releasePrepared: bool(row.photoReleaseExists),
      patientFileProxyEnabled: fileProxyReady,
      patientCopyApproved,
      retentionPolicyApproved,
      expiresAt: releaseExpiresAt,
    },
    deliveryBoundary: {
      patientDeliveryAllowed: false,
      rawFilesExposed: false,
      signedUrlsIssued: false,
      storagePathsExposed: false,
      tokensExposed: false,
      physicianTextExposed: false,
      fileProxyReady,
      requiresSelfHostedFileProxy: !fileProxyReady,
      requiresReleaseAudit: true,
      requiresRevoke: true,
      requiresIdentityCheck: true,
      requiresRetentionPolicy,
      requiresApprovedPatientCopy,
    },
  };
}

function normalizeReportPackage(row) {
  const missing = buildMissing(row);
  const ready = missing.length === 0;
  const totalChecks = 10;
  const passedChecks = Math.max(0, totalChecks - missing.length);
  return {
    visitId: String(row.visitId),
    clinicId: textOrNull(row.clinicId),
    patientId: textOrNull(row.patientId),
    visitStatus: String(row.visitStatus ?? "draft"),
    visitStartedAt: row.visitStartedAt ?? null,
    visitSignedAt: row.visitSignedAt ?? null,
    assessment: {
      id: textOrNull(row.assessmentId),
      status: textOrNull(row.assessmentStatus),
      riskLevel: textOrNull(row.assessmentRiskLevel),
      abcdTotal: numberOrNull(row.assessmentAbcdTotal),
      sevenPointTotal: numberOrNull(row.assessmentSevenPointTotal),
      summaryPresent: bool(row.assessmentSummaryPresent),
      recommendationPresent: bool(row.assessmentRecommendationPresent),
      signedAt: row.assessmentSignedAt ?? null,
      updatedAt: row.assessmentUpdatedAt ?? null,
    },
    conclusion: {
      id: textOrNull(row.conclusionId),
      status: textOrNull(row.conclusionStatus),
      summaryPresent: bool(row.conclusionSummaryPresent),
      nextStepPresent: bool(row.conclusionNextStepPresent),
      followUpAt: row.conclusionFollowUpAt ?? null,
      signedAt: row.conclusionSignedAt ?? null,
      updatedAt: row.conclusionUpdatedAt ?? null,
    },
    report: {
      id: textOrNull(row.reportId),
      status: textOrNull(row.reportStatus),
      physicianTextPresent: bool(row.reportPhysicianTextPresent),
      patientSafeTextPresent: bool(row.reportPatientSafeTextPresent),
      signedAt: row.reportSignedAt ?? null,
      updatedAt: row.reportUpdatedAt ?? null,
    },
    counts: {
      lesions: Number(row.lesionCount ?? 0),
      assets: Number(row.assetCount ?? 0),
    },
    readiness: {
      ready,
      status: ready ? "ready" : "blocked",
      completionPercent: Math.round((passedChecks / totalChecks) * 100),
      missing,
      exportAllowed: ready,
      patientDeliveryAllowed: ready,
    },
    patientPhotoProtocol: normalizePatientPhotoProtocol(row),
    productBoundary: {
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
      externalRuntimeCalls: false,
      rawPatientDataInReport: false,
    },
  };
}

export function createClinicalReportPackageRepository(dbClient) {
  return {
    async getReportPackage(params) {
      const rows = await dbClient.queryJson(buildGetClinicalReportPackageSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeReportPackage(rows[0]) : null;
    },
  };
}

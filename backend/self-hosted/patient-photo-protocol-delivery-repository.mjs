// Batch T · Patient photo/protocol secure delivery repository.
// This repository may read object bucket/key internally for backend proxying.
// It must never expose those storage identifiers through JSON contracts.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function safeUuid(value) {
  const text = String(value || "");
  return UUID_PATTERN.test(text) ? text : "00000000-0000-4000-8000-000000000000";
}

function safeSequence(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) return 0;
  return parsed;
}

function textOrNull(value) {
  return value == null ? null : String(value);
}

function numberOrZero(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value) {
  return value === true || value === "true";
}

export function buildGetPatientPhotoProtocolDeliveryAssetSql({
  userId,
  visitId,
  sequence,
} = {}) {
  const safeUserId = safeUuid(userId);
  const safeVisitId = safeUuid(visitId);
  const safeAssetSequence = safeSequence(sequence);
  return `
with linked_release as (
  select
    r.id,
    r.clinic_id,
    r.patient_id,
    r.visit_id,
    r.status,
    r.expires_at,
    p.imaging_consent,
    (r.metadata_json ->> 'patientFileProxyEnabled') = 'true' as file_proxy_enabled
  from patient_photo_protocol_releases r
  join patient_user_links pul on pul.patient_id = r.patient_id
  join patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id and p.deleted_at is null
  where pul.user_id = ${sqlUuid(safeUserId)}
    and r.visit_id = ${sqlUuid(safeVisitId)}
  limit 1
),
numbered_assets as (
  select
    row_number() over (order by a.captured_at asc nulls last, a.created_at asc) as sequence,
    a.id,
    a.kind::text,
    a.content_type,
    a.byte_size,
    a.captured_at,
    a.object_bucket,
    a.object_key
  from clinical_assets a
  join linked_release lr on lr.visit_id = a.visit_id
    and lr.patient_id = a.patient_id
    and lr.clinic_id = a.clinic_id
  where a.kind in ('overview_photo', 'dermoscopy')
  order by a.captured_at asc nulls last, a.created_at asc
  limit 200
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    lr.id::text as "releaseId",
    lr.clinic_id::text as "clinicId",
    lr.patient_id::text as "patientId",
    lr.visit_id::text as "visitId",
    lr.status as "releaseStatus",
    lr.expires_at as "expiresAt",
    lr.imaging_consent as "imagingConsent",
    lr.file_proxy_enabled as "fileProxyEnabled",
    na.sequence as "sequence",
    na.id::text as "assetId",
    na.kind as "kind",
    na.content_type as "contentType",
    na.byte_size as "byteSize",
    na.captured_at as "capturedAt",
    na.object_bucket as "objectBucket",
    na.object_key as "objectKey"
  from linked_release lr
  left join numbered_assets na on na.sequence = ${safeAssetSequence}
  limit 1
) result;
`.trim();
}

export function normalizePatientPhotoProtocolDeliveryAsset(row) {
  if (!row || typeof row !== "object" || !row.releaseId) return null;
  return {
    release: {
      id: String(row.releaseId),
      clinicId: textOrNull(row.clinicId),
      patientId: textOrNull(row.patientId),
      visitId: textOrNull(row.visitId),
      status: String(row.releaseStatus ?? "blocked"),
      expiresAt: textOrNull(row.expiresAt),
      imagingConsent: booleanValue(row.imagingConsent),
      fileProxyEnabled: booleanValue(row.fileProxyEnabled),
    },
    asset: {
      id: textOrNull(row.assetId),
      sequence: numberOrZero(row.sequence),
      kind: textOrNull(row.kind),
      contentType: textOrNull(row.contentType),
      byteSize: row.byteSize == null ? null : numberOrZero(row.byteSize),
      capturedAt: textOrNull(row.capturedAt),
      objectBucket: textOrNull(row.objectBucket) || "",
      objectKey: textOrNull(row.objectKey) || "",
    },
  };
}

export function createPatientPhotoProtocolDeliveryRepository(dbClient) {
  return {
    async getDeliveryAsset(params) {
      const rows = await dbClient.queryJson(buildGetPatientPhotoProtocolDeliveryAssetSql(params));
      const first = Array.isArray(rows) ? rows[0] : rows;
      return normalizePatientPhotoProtocolDeliveryAsset(first);
    },
  };
}

// Stage 4I · Self-hosted clinical asset write repository.
// SQL builders for registering clinical asset metadata and issuing safe
// download-url contracts. Object bucket/key never leave the backend.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function sqlNullableBigint(value) {
  if (value == null) return "null";
  return `${Number(value)}::bigint`;
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

function clinicScopeWhere({ alias, clinicIds = [], allClinics = false } = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${ids.map(sqlUuid).join(", ")})`;
}

function assetSafeColumns(alias = "a") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.visit_id::text as "visitId",
    ${alias}.lesion_id::text as "lesionId",
    ${alias}.kind::text as "kind",
    ${alias}.content_type as "contentType",
    ${alias}.byte_size as "byteSize",
    ${alias}.captured_at as "capturedAt",
    ${alias}.uploaded_by::text as "uploadedBy",
    ${alias}.created_at as "createdAt"
  `;
}

function assetInternalColumns(alias = "a") {
  return `
    ${assetSafeColumns(alias)},
    ${alias}.object_bucket as "objectBucket",
    ${alias}.object_key as "objectKey",
    ${alias}.checksum_sha256 as "checksumSha256"
  `;
}

export function buildCreateVisitAssetSql({
  clinicId,
  patientId,
  visitId,
  lesionId = null,
  kind,
  objectBucket,
  objectKey,
  contentType,
  byteSize = null,
  checksumSha256 = null,
  capturedAt = null,
  uploadedBy = null,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with inserted as (
    insert into clinical_assets (
      clinic_id,
      patient_id,
      visit_id,
      lesion_id,
      kind,
      object_bucket,
      object_key,
      content_type,
      byte_size,
      checksum_sha256,
      captured_at,
      uploaded_by
    )
    values (
      ${sqlUuid(clinicId)},
      ${sqlUuid(patientId)},
      ${sqlUuid(visitId)},
      ${sqlNullableUuid(lesionId)},
      ${sqlLiteral(kind)}::asset_kind,
      ${sqlLiteral(objectBucket)},
      ${sqlLiteral(objectKey)},
      ${sqlLiteral(contentType)},
      ${sqlNullableBigint(byteSize)},
      ${sqlNullableText(checksumSha256)},
      ${sqlNullableTimestamp(capturedAt)},
      ${sqlNullableUuid(uploadedBy)}
    )
    returning *
  )
  select ${assetSafeColumns("a")}
  from inserted a
) result;
`.trim();
}

export function buildGetAssetInternalSql({
  assetId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${assetInternalColumns("a")}
  from clinical_assets a
  where a.id = ${sqlUuid(assetId)}
    ${clinicScopeWhere({ alias: "a", clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

function normalizeAsset(row) {
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
    uploadedBy: row.uploadedBy ? String(row.uploadedBy) : null,
    createdAt: row.createdAt ?? null,
  };
}

function normalizeInternalAsset(row) {
  return {
    ...normalizeAsset(row),
    objectBucket: row.objectBucket ? String(row.objectBucket) : "",
    objectKey: row.objectKey ? String(row.objectKey) : "",
    checksumSha256: row.checksumSha256 ? String(row.checksumSha256) : null,
  };
}

export function createAssetWriteRepository(dbClient) {
  return {
    async createVisitAsset(params) {
      const rows = await dbClient.queryJson(buildCreateVisitAssetSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeAsset(rows[0]) : null;
    },
    async getAssetInternal(params) {
      const rows = await dbClient.queryJson(buildGetAssetInternalSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeInternalAsset(rows[0]) : null;
    },
  };
}

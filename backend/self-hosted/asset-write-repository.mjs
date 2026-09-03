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

export function buildBeginVisitAssetUploadSql({
  clinicId,
  patientId,
  visitId,
  idempotencyKey,
  requestHash,
  reservationToken,
  objectBucket,
  objectKey,
} = {}) {
  return `
with attempted as (
  insert into clinical_asset_upload_requests (
    clinic_id,
    patient_id,
    visit_id,
    idempotency_key,
    request_hash,
    reservation_token,
    object_bucket,
    object_key
  )
  values (
    ${sqlUuid(clinicId)},
    ${sqlUuid(patientId)},
    ${sqlUuid(visitId)},
    ${sqlLiteral(idempotencyKey)},
    ${sqlLiteral(requestHash)},
    ${sqlUuid(reservationToken)},
    ${sqlLiteral(objectBucket)},
    ${sqlLiteral(objectKey)}
  )
  on conflict (clinic_id, idempotency_key) do nothing
  returning *, true as claimed, false as recovered
), reclaimed as (
  update clinical_asset_upload_requests existing
  set reservation_token = ${sqlUuid(reservationToken)},
      lease_expires_at = now() + interval '15 minutes',
      last_claimed_at = now(),
      recovery_count = existing.recovery_count + 1
  where existing.clinic_id = ${sqlUuid(clinicId)}
    and existing.patient_id = ${sqlUuid(patientId)}
    and existing.visit_id = ${sqlUuid(visitId)}
    and existing.idempotency_key = ${sqlLiteral(idempotencyKey)}
    and existing.request_hash = ${sqlLiteral(requestHash)}
    and existing.state = 'pending'
    and existing.lease_expires_at <= now()
    and not exists (select 1 from attempted)
  returning existing.*, true as claimed, true as recovered
), selected as (
  select * from attempted
  union all
  select * from reclaimed
  union all
  select existing.*, false as claimed, false as recovered
  from clinical_asset_upload_requests existing
  where existing.clinic_id = ${sqlUuid(clinicId)}
    and existing.idempotency_key = ${sqlLiteral(idempotencyKey)}
    and not exists (select 1 from attempted)
    and not exists (select 1 from reclaimed)
  limit 1
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    selected.claimed,
    selected.recovered,
    selected.state,
    selected.request_hash as "requestHash",
    selected.reservation_token::text as "reservationToken",
    selected.object_bucket as "objectBucket",
    selected.object_key as "objectKey",
    ${assetSafeColumns("a")}
  from selected
  left join clinical_assets a on a.id = selected.asset_id
) result;
`.trim();
}

export function buildCompleteVisitAssetUploadSql({
  clinicId,
  patientId,
  visitId,
  idempotencyKey,
  requestHash,
  reservationToken,
  lesionId = null,
  kind,
  contentType,
  byteSize = null,
  checksumSha256 = null,
  capturedAt = null,
  uploadedBy = null,
} = {}) {
  return `
with reserved as (
  select r.*
  from clinical_asset_upload_requests r
  where r.clinic_id = ${sqlUuid(clinicId)}
    and r.patient_id = ${sqlUuid(patientId)}
    and r.visit_id = ${sqlUuid(visitId)}
    and r.idempotency_key = ${sqlLiteral(idempotencyKey)}
    and r.request_hash = ${sqlLiteral(requestHash)}
    and r.reservation_token = ${sqlUuid(reservationToken)}
    and r.state = 'pending'
  for update
), inserted as (
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
  select
    reserved.clinic_id,
    reserved.patient_id,
    reserved.visit_id,
    ${sqlNullableUuid(lesionId)},
    ${sqlLiteral(kind)}::asset_kind,
    reserved.object_bucket,
    reserved.object_key,
    ${sqlLiteral(contentType)},
    ${sqlNullableBigint(byteSize)},
    ${sqlNullableText(checksumSha256)},
    ${sqlNullableTimestamp(capturedAt)},
    ${sqlNullableUuid(uploadedBy)}
  from reserved
  returning *
), completed as (
  update clinical_asset_upload_requests r
  set state = 'completed',
      asset_id = inserted.id,
      completed_at = now()
  from inserted
  where r.id = (select id from reserved)
  returning r.asset_id
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${assetSafeColumns("a")}
  from inserted a
  join completed on completed.asset_id = a.id
) result;
`.trim();
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
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
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

export class AssetIdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency-Key was already used with a different asset payload.");
    this.name = "AssetIdempotencyConflictError";
    this.publicCode = "idempotency_conflict";
    this.publicStatus = 409;
  }
}

export function createAssetWriteRepository(dbClient) {
  return {
    async beginVisitAssetUpload(params) {
      const rows = await dbClient.queryJson(buildBeginVisitAssetUploadSql(params));
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return null;
      if (row.requestHash !== params.requestHash) throw new AssetIdempotencyConflictError();
      if (row.claimed === true) {
        return {
          status: "claimed",
          recovered: row.recovered === true,
          objectBucket: String(row.objectBucket || ""),
          objectKey: String(row.objectKey || ""),
        };
      }
      if (row.state === "completed" && row.id) {
        return { status: "replayed", asset: normalizeAsset(row) };
      }
      return { status: "in_progress" };
    },
    async completeVisitAssetUpload(params) {
      const rows = await dbClient.queryJson(buildCompleteVisitAssetUploadSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeAsset(rows[0]) : null;
    },
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

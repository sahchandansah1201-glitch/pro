// Stage 4H · Self-hosted visit workspace write repository.
// SQL builders + repository for visits/lesions/reports mutations. RBAC-scoped
// at the service layer; this module produces parameterised SQL strings only.

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
  return value == null ? "null" : String(Number(value));
}

function sqlJson(value) {
  return `${sqlLiteral(JSON.stringify(value ?? {}))}::jsonb`;
}

function lesionAuditCte({ action, actorUserId, correlationId, metadata }, source = "inserted") {
  return `,
  audited as (
    insert into audit_log (
      clinic_id, actor_user_id, action, entity_type, entity_id, correlation_id, metadata_json
    )
    select
      l.clinic_id,
      ${sqlNullableUuid(actorUserId)},
      ${sqlLiteral(action)},
      'lesion',
      l.id,
      ${sqlLiteral(correlationId)},
      ${sqlJson(metadata)}
    from ${source} l
    returning id
  )`;
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

function visitColumns(alias = "v") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.doctor_user_id::text as "doctorUserId",
    ${alias}.status::text as "status",
    ${alias}.started_at as "startedAt",
    ${alias}.signed_at as "signedAt",
    ${alias}.chief_complaint as "chiefComplaint",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"
  `;
}

function lesionColumns(alias = "l") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.visit_id::text as "visitId",
    ${alias}.label as "label",
    ${alias}.body_zone as "bodyZone",
    ${alias}.body_surface as "bodySurface",
    ${alias}.status as "status",
    ${alias}.risk_level as "riskLevel",
    ${alias}.body_map_view as "bodyMapView",
    ${alias}.body_map_x::float8 as "bodyMapX",
    ${alias}.body_map_y::float8 as "bodyMapY",
    ${alias}.body_region_id as "bodyRegionId",
    ${alias}.body_region_detail_id as "bodyRegionDetailId",
    ${alias}.body_atlas_source as "bodyAtlasSource",
    ${alias}.body_atlas_profile_id as "bodyAtlasProfileId",
    ${alias}.body_atlas_manifest_sha256 as "bodyAtlasManifestSha256",
    ${alias}.body_region_map_sha256 as "bodyRegionMapSha256",
    ${alias}.placement_revision as "placementRevision",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt",
    ${alias}.deleted_at as "deletedAt"
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

function visitUpdateSet(changes = {}) {
  const clauses = [];
  if (Object.hasOwn(changes, "status")) clauses.push(`status = ${sqlLiteral(changes.status)}::visit_status`);
  if (Object.hasOwn(changes, "chiefComplaint")) clauses.push(`chief_complaint = ${sqlNullableText(changes.chiefComplaint)}`);
  if (Object.hasOwn(changes, "startedAt")) clauses.push(`started_at = ${sqlNullableTimestamp(changes.startedAt)}`);
  if (Object.hasOwn(changes, "signedAt")) clauses.push(`signed_at = ${sqlNullableTimestamp(changes.signedAt)}`);
  if (Object.hasOwn(changes, "doctorUserId")) clauses.push(`doctor_user_id = ${sqlNullableUuid(changes.doctorUserId)}`);
  return [...clauses, "updated_at = now()"].join(",\n      ");
}

export function buildUpdateVisitSql({ visitId, changes = {}, clinicIds = [], allClinics = false } = {}) {
  return `
with updated as (
  update visits v
  set ${visitUpdateSet(changes)}
  where v.id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  returning v.*
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${visitColumns("v")}
  from updated v
) result;
`.trim();
}

export function buildCreateLesionSql({
  visitId,
  patientId,
  clinicId,
  label,
  bodyZone = null,
  bodySurface = null,
  status = "active",
  riskLevel = null,
  bodyMap = null,
  idempotencyKey = null,
  requestHash = null,
  auditEvent = null,
} = {}) {
  return `
with inserted as (
  insert into lesions (
      clinic_id, patient_id, visit_id, label, body_zone, body_surface, status, risk_level,
      body_map_view, body_map_x, body_map_y, body_region_id, body_region_detail_id,
      body_atlas_source, body_atlas_profile_id, body_atlas_manifest_sha256, body_region_map_sha256,
      placement_revision, creation_idempotency_key, creation_request_hash
  )
  values (
      ${sqlUuid(clinicId)},
      ${sqlUuid(patientId)},
      ${sqlUuid(visitId)},
      ${sqlLiteral(label)},
      ${sqlNullableText(bodyZone)},
      ${sqlNullableText(bodySurface)},
      ${sqlLiteral(status)},
      ${sqlNullableText(riskLevel)},
      ${sqlNullableText(bodyMap?.view)},
      ${sqlNullableNumber(bodyMap?.x)},
      ${sqlNullableNumber(bodyMap?.y)},
      ${sqlNullableText(bodyMap?.regionId)},
      ${sqlNullableText(bodyMap?.detailId)},
      ${sqlNullableText(bodyMap?.atlasSource)},
      ${sqlNullableText(bodyMap?.atlasProfileId)},
      ${sqlNullableText(bodyMap?.atlasManifestSha256)},
      ${sqlNullableText(bodyMap?.bodyRegionMapSha256)},
      ${bodyMap ? 1 : 0},
      ${sqlNullableText(idempotencyKey)},
      ${sqlNullableText(requestHash)}
  )
  ${idempotencyKey
    ? "on conflict (clinic_id, visit_id, creation_idempotency_key) where creation_idempotency_key is not null do nothing"
    : ""}
  returning *
)${bodyMap && auditEvent ? lesionAuditCte({ action: "lesion.create", ...auditEvent }) : ""}
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${lesionColumns("l")}
  from inserted l
) result;
`.trim();
}

function lesionUpdateSet(changes = {}) {
  const clauses = [];
  if (Object.hasOwn(changes, "label")) clauses.push(`label = ${sqlLiteral(changes.label)}`);
  if (Object.hasOwn(changes, "bodyZone")) clauses.push(`body_zone = ${sqlNullableText(changes.bodyZone)}`);
  if (Object.hasOwn(changes, "bodySurface")) clauses.push(`body_surface = ${sqlNullableText(changes.bodySurface)}`);
  if (Object.hasOwn(changes, "status")) clauses.push(`status = ${sqlLiteral(changes.status)}`);
  if (Object.hasOwn(changes, "riskLevel")) clauses.push(`risk_level = ${sqlNullableText(changes.riskLevel)}`);
  if (Object.hasOwn(changes, "bodyMap")) {
    clauses.push(`body_map_view = ${sqlNullableText(changes.bodyMap.view)}`);
    clauses.push(`body_map_x = ${sqlNullableNumber(changes.bodyMap.x)}`);
    clauses.push(`body_map_y = ${sqlNullableNumber(changes.bodyMap.y)}`);
    clauses.push(`body_region_id = ${sqlNullableText(changes.bodyMap.regionId)}`);
    clauses.push(`body_region_detail_id = ${sqlNullableText(changes.bodyMap.detailId)}`);
    clauses.push(`body_atlas_source = ${sqlNullableText(changes.bodyMap.atlasSource)}`);
    clauses.push(`body_atlas_profile_id = ${sqlNullableText(changes.bodyMap.atlasProfileId)}`);
    clauses.push(`body_atlas_manifest_sha256 = ${sqlNullableText(changes.bodyMap.atlasManifestSha256)}`);
    clauses.push(`body_region_map_sha256 = ${sqlNullableText(changes.bodyMap.bodyRegionMapSha256)}`);
    clauses.push("placement_revision = l.placement_revision + 1");
  }
  return [...clauses, "updated_at = now()"].join(",\n      ");
}

export function buildUpdateLesionSql({ lesionId, changes = {}, clinicIds = [], allClinics = false, auditEvent = null } = {}) {
  if (Object.hasOwn(changes, "bodyMap")) {
    return `
with target as (
  select l.*
  from lesions l
  where l.id = ${sqlUuid(lesionId)}
    and l.deleted_at is null
    ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
),
updated as (
  update lesions l
  set ${lesionUpdateSet(changes)}
  from target t
  where l.id = t.id
    and l.placement_revision = ${Number(changes.expectedPlacementRevision)}
  returning l.*
)${auditEvent ? lesionAuditCte({ action: "lesion.update", ...auditEvent }, "updated") : ""}
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${lesionColumns("l")}, false as "placementConflict"
  from updated l
  union all
  select ${lesionColumns("l")}, true as "placementConflict"
  from target l
  where not exists (select 1 from updated)
) result;
`.trim();
  }
  return `
with updated as (
  update lesions l
  set ${lesionUpdateSet(changes)}
  where l.id = ${sqlUuid(lesionId)}
    and l.deleted_at is null
    ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
  returning l.*
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${lesionColumns("l")}
  from updated l
) result;
`.trim();
}

export function buildArchiveLesionSql({ lesionId, clinicIds = [], allClinics = false, auditEvent = null } = {}) {
  return `
with archived as (
  update lesions l
  set deleted_at = now(), updated_at = now()
  where l.id = ${sqlUuid(lesionId)}
    and l.deleted_at is null
    ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
  returning l.*
)${auditEvent ? lesionAuditCte({ action: "lesion.archive", ...auditEvent }, "archived") : ""}
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${lesionColumns("l")}
  from archived l
) result;
`.trim();
}

function reportUpdateSet(changes = {}) {
  const clauses = [];
  if (Object.hasOwn(changes, "status")) clauses.push(`status = ${sqlLiteral(changes.status)}`);
  if (Object.hasOwn(changes, "physicianText")) clauses.push(`physician_text = ${sqlNullableText(changes.physicianText)}`);
  if (Object.hasOwn(changes, "patientSafeText")) clauses.push(`patient_safe_text = ${sqlNullableText(changes.patientSafeText)}`);
  if (Object.hasOwn(changes, "signedAt")) clauses.push(`signed_at = ${sqlNullableTimestamp(changes.signedAt)}`);
  return [...clauses, "updated_at = now()"].join(",\n      ");
}

export function buildUpsertReportSql({
  visitId,
  patientId,
  clinicId,
  doctorUserId = null,
  changes = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  const updateClauses = reportUpdateSet(changes);
  const scope = clinicScopeWhere({ alias: "r", clinicIds, allClinics });
  return `
with upserted as (
  insert into reports (
    clinic_id, patient_id, visit_id, doctor_user_id, status, physician_text, patient_safe_text
  )
  values (
    ${sqlUuid(clinicId)},
    ${sqlUuid(patientId)},
    ${sqlUuid(visitId)},
    ${sqlNullableUuid(doctorUserId)},
    ${sqlLiteral(changes.status ?? "draft")},
    ${sqlNullableText(changes.physicianText ?? null)},
    ${sqlNullableText(changes.patientSafeText ?? null)}
  )
  on conflict (visit_id) do nothing
  returning *
),
updated as (
  update reports r
  set ${updateClauses}
  where r.visit_id = ${sqlUuid(visitId)}
    and not exists (select 1 from upserted)
    ${scope}
  returning r.*
),
combined as (
  select * from upserted
  union all
  select * from updated
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${reportColumns("r")}
  from combined r
  limit 1
) result;
`.trim();
}

function normalizeVisit(row) {
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    doctorUserId: row.doctorUserId ? String(row.doctorUserId) : null,
    status: String(row.status ?? "draft"),
    startedAt: row.startedAt ?? null,
    signedAt: row.signedAt ?? null,
    chiefComplaint: row.chiefComplaint ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeLesion(row) {
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    visitId: row.visitId ? String(row.visitId) : null,
    label: String(row.label ?? ""),
    bodyZone: row.bodyZone ?? null,
    bodySurface: row.bodySurface ?? null,
    status: String(row.status ?? "active"),
    riskLevel: row.riskLevel ?? null,
    bodyRegionId: row.bodyRegionId ?? null,
    bodyRegionDetailId: row.bodyRegionDetailId ?? null,
    bodyAtlasSource: row.bodyAtlasSource ?? null,
    bodyAtlasProfileId: row.bodyAtlasProfileId ?? null,
    bodyAtlasManifestSha256: row.bodyAtlasManifestSha256 ?? null,
    bodyRegionMapSha256: row.bodyRegionMapSha256 ?? null,
    mapPoint: row.bodyMapView == null || row.bodyMapX == null || row.bodyMapY == null
      ? null
      : {
          view: String(row.bodyMapView),
          x: Number(row.bodyMapX),
          y: Number(row.bodyMapY),
        },
    placementRevision: Number(row.placementRevision ?? 0),
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    deletedAt: row.deletedAt ?? null,
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

async function queryOne(dbClient, sql, normalize) {
  const rows = await dbClient.queryJson(sql);
  return Array.isArray(rows) && rows[0] ? normalize(rows[0]) : null;
}

export function createVisitWorkspaceWriteRepository(dbClient) {
  return {
    async updateVisit(params) {
      return queryOne(dbClient, buildUpdateVisitSql(params), normalizeVisit);
    },
    async createLesion(params) {
      if (params.idempotencyKey) {
        const existing = await findLesionCreation(dbClient, params);
        if (existing) return replayOrConflict(existing, params.requestHash);
      }
      const lesion = await queryOne(dbClient, buildCreateLesionSql(params), normalizeLesion);
      if (lesion) {
        return params.idempotencyKey
          ? { lesion, replayed: false, auditPersisted: Boolean(params.bodyMap && params.auditEvent) }
          : lesion;
      }
      const existing = await findLesionCreation(dbClient, params);
      return existing ? replayOrConflict(existing, params.requestHash) : null;
    },
    async updateLesion(params) {
      const rows = await dbClient.queryJson(buildUpdateLesionSql(params));
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row?.placementConflict) {
        throw new LesionPlacementConflictError(Number(row.placementRevision ?? 0));
      }
      return row
        ? {
            lesion: normalizeLesion(row),
            auditPersisted: Boolean(params.changes?.bodyMap && params.auditEvent),
          }
        : null;
    },
    async archiveLesion(params) {
      const lesion = await queryOne(dbClient, buildArchiveLesionSql(params), normalizeLesion);
      return lesion && params.auditEvent ? { lesion, auditPersisted: true } : lesion;
    },
    async upsertReport(params) {
      return queryOne(dbClient, buildUpsertReportSql(params), normalizeReport);
    },
  };
}

export class LesionIdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency-Key was already used with a different lesion payload.");
    this.name = "LesionIdempotencyConflictError";
    this.publicCode = "idempotency_conflict";
    this.publicStatus = 409;
  }
}

export class LesionPlacementConflictError extends Error {
  constructor(currentPlacementRevision) {
    super("Body-map placement changed after it was loaded.");
    this.name = "LesionPlacementConflictError";
    this.publicCode = "placement_conflict";
    this.publicStatus = 409;
    this.publicDetails = [{
      field: "expectedPlacementRevision",
      message: "Reload the lesion placement before correcting it.",
      currentPlacementRevision,
    }];
  }
}

export function buildFindLesionCreationSql({ clinicId, visitId, idempotencyKey } = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    ${lesionColumns("l")},
    l.creation_request_hash as "creationRequestHash"
  from lesions l
  where l.clinic_id = ${sqlUuid(clinicId)}
    and l.visit_id = ${sqlUuid(visitId)}
    and l.creation_idempotency_key = ${sqlLiteral(idempotencyKey)}
  limit 1
) result;
`.trim();
}

async function findLesionCreation(dbClient, params) {
  if (!params.idempotencyKey) return null;
  const rows = await dbClient.queryJson(buildFindLesionCreationSql(params));
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? { lesion: normalizeLesion(row), requestHash: row.creationRequestHash ?? null } : null;
}

function replayOrConflict(existing, requestHash) {
  if (existing.requestHash !== requestHash) throw new LesionIdempotencyConflictError();
  return { lesion: existing.lesion, replayed: true, auditPersisted: true };
}

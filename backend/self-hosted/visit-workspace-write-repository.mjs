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
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with updated as (
    update visits v
    set ${visitUpdateSet(changes)}
    where v.id = ${sqlUuid(visitId)}
      ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
    returning v.*
  )
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
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with inserted as (
    insert into lesions (
      clinic_id, patient_id, visit_id, label, body_zone, body_surface, status, risk_level
    )
    values (
      ${sqlUuid(clinicId)},
      ${sqlUuid(patientId)},
      ${sqlUuid(visitId)},
      ${sqlLiteral(label)},
      ${sqlNullableText(bodyZone)},
      ${sqlNullableText(bodySurface)},
      ${sqlLiteral(status)},
      ${sqlNullableText(riskLevel)}
    )
    returning *
  )
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
  return [...clauses, "updated_at = now()"].join(",\n      ");
}

export function buildUpdateLesionSql({ lesionId, changes = {}, clinicIds = [], allClinics = false } = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with updated as (
    update lesions l
    set ${lesionUpdateSet(changes)}
    where l.id = ${sqlUuid(lesionId)}
      and l.deleted_at is null
      ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
    returning l.*
  )
  select ${lesionColumns("l")}
  from updated l
) result;
`.trim();
}

export function buildArchiveLesionSql({ lesionId, clinicIds = [], allClinics = false } = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with archived as (
    update lesions l
    set deleted_at = now(), updated_at = now()
    where l.id = ${sqlUuid(lesionId)}
      and l.deleted_at is null
      ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
    returning l.*
  )
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
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
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
      return queryOne(dbClient, buildCreateLesionSql(params), normalizeLesion);
    },
    async updateLesion(params) {
      return queryOne(dbClient, buildUpdateLesionSql(params), normalizeLesion);
    },
    async archiveLesion(params) {
      return queryOne(dbClient, buildArchiveLesionSql(params), normalizeLesion);
    },
    async upsertReport(params) {
      return queryOne(dbClient, buildUpsertReportSql(params), normalizeReport);
    },
  };
}

// Stage 4G · Self-hosted visit workspace read repository.
// Read-only PostgreSQL queries for visits, lesions and clinical asset metadata.

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

export function buildListVisitsByPatientSql({
  patientId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result) order by result."startedAt" desc nulls last), '[]'::jsonb)::text
from (
  select
    ${visitColumns("v")}
  from visits v
  where v.patient_id = ${sqlUuid(patientId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  order by v.started_at desc nulls last
  limit 200
) result;
`.trim();
}

export function buildGetVisitSql({
  visitId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    ${visitColumns("v")},
    p.full_name as "patientFullName",
    p.code as "patientCode",
    c.slug as "clinicSlug",
    c.name as "clinicName"
  from visits v
  join patients p on p.id = v.patient_id
  join clinics c on c.id = v.clinic_id
  where v.id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

export function buildListVisitLesionsSql({
  visitId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result) order by result."createdAt" asc), '[]'::jsonb)::text
from (
  select
    l.id::text as "id",
    l.clinic_id::text as "clinicId",
    l.patient_id::text as "patientId",
    l.visit_id::text as "visitId",
    l.label as "label",
    l.body_zone as "bodyZone",
    l.body_surface as "bodySurface",
    l.status as "status",
    l.risk_level as "riskLevel",
    l.created_at as "createdAt",
    l.updated_at as "updatedAt"
  from lesions l
  where l.visit_id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
  order by l.created_at asc
  limit 500
) result;
`.trim();
}

export function buildListVisitAssetsSql({
  visitId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result) order by result."capturedAt" asc nulls last), '[]'::jsonb)::text
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
    a.uploaded_by::text as "uploadedBy",
    a.created_at as "createdAt"
  from clinical_assets a
  where a.visit_id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "a", clinicIds, allClinics })}
  order by a.captured_at asc nulls last
  limit 500
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

function normalizeVisitDetail(row) {
  return {
    ...normalizeVisit(row),
    patient: {
      id: row.patientId ? String(row.patientId) : null,
      fullName: row.patientFullName ?? null,
      code: row.patientCode ?? null,
    },
    clinic: {
      id: row.clinicId ? String(row.clinicId) : null,
      slug: row.clinicSlug ?? null,
      name: row.clinicName ?? null,
    },
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
  };
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

export function createVisitWorkspaceRepository(dbClient) {
  return {
    async listVisitsByPatient(params) {
      const rows = await dbClient.queryJson(buildListVisitsByPatientSql(params));
      return Array.isArray(rows) ? rows.map(normalizeVisit) : [];
    },
    async getVisit(params) {
      const rows = await dbClient.queryJson(buildGetVisitSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeVisitDetail(rows[0]) : null;
    },
    async listVisitLesions(params) {
      const rows = await dbClient.queryJson(buildListVisitLesionsSql(params));
      return Array.isArray(rows) ? rows.map(normalizeLesion) : [];
    },
    async listVisitAssets(params) {
      const rows = await dbClient.queryJson(buildListVisitAssetsSql(params));
      return Array.isArray(rows) ? rows.map(normalizeAsset) : [];
    },
  };
}

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

function sqlTextArray(values = []) {
  const items = (Array.isArray(values) ? values : []).map((value) => sqlLiteral(value));
  return `array[${items.join(", ")}]::text[]`;
}

function sqlJsonb(value) {
  return `${sqlLiteral(JSON.stringify(value ?? null))}::jsonb`;
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
  };
}

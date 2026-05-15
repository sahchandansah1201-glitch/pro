// Stage 5J · Self-hosted visit schedule repository.
// Production schedule data comes from PostgreSQL visits/patients/clinics only.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS_VALUES = new Set(["draft", "in_progress", "signed", "cancelled"]);

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlUuidList(values = []) {
  return values.map((value) => sqlUuid(value)).join(", ");
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

function doctorScopeWhere({ alias = "v", doctorUserId = null } = {}) {
  return doctorUserId && UUID_PATTERN.test(String(doctorUserId))
    ? `and ${alias}.doctor_user_id = ${sqlUuid(doctorUserId)}`
    : "";
}

function safeLimit(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, parsed));
}

function safeOffset(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function safeDate(value) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function safeStatus(value) {
  const text = String(value ?? "").trim();
  return STATUS_VALUES.has(text) ? text : "";
}

function safeSearch(value) {
  return String(value ?? "").trim().slice(0, 120);
}

export function normalizeVisitScheduleParams(searchParams = new URLSearchParams()) {
  return {
    status: safeStatus(searchParams.get?.("status")),
    dateFrom: safeDate(searchParams.get?.("dateFrom")),
    dateTo: safeDate(searchParams.get?.("dateTo")),
    search: safeSearch(searchParams.get?.("search")),
    limit: safeLimit(searchParams.get?.("limit")),
    offset: safeOffset(searchParams.get?.("offset")),
  };
}

function filterWhere(params = {}) {
  const where = [];
  if (params.status) {
    where.push(`and v.status = ${sqlLiteral(params.status)}::visit_status`);
  }
  if (params.dateFrom) {
    where.push(`and v.started_at::date >= ${sqlLiteral(params.dateFrom)}::date`);
  }
  if (params.dateTo) {
    where.push(`and v.started_at::date <= ${sqlLiteral(params.dateTo)}::date`);
  }
  if (params.search) {
    const term = `%${params.search}%`;
    where.push(`and (
      p.full_name ilike ${sqlLiteral(term)}
      or p.code ilike ${sqlLiteral(term)}
      or coalesce(v.chief_complaint, '') ilike ${sqlLiteral(term)}
    )`);
  }
  return where.join("\n    ");
}

export function buildVisitScheduleSql({
  clinicIds = [],
  allClinics = false,
  doctorUserId = null,
  status = "",
  dateFrom = "",
  dateTo = "",
  search = "",
  limit = 50,
  offset = 0,
} = {}) {
  const params = {
    status: safeStatus(status),
    dateFrom: safeDate(dateFrom),
    dateTo: safeDate(dateTo),
    search: safeSearch(search),
    limit: safeLimit(limit),
    offset: safeOffset(offset),
  };
  return `
with scoped_visits as (
  select
    v.id,
    v.clinic_id,
    v.patient_id,
    v.doctor_user_id,
    v.status,
    v.started_at,
    v.signed_at,
    v.chief_complaint,
    v.created_at,
    v.updated_at,
    p.full_name as patient_full_name,
    p.code as patient_code,
    c.slug as clinic_slug,
    c.name as clinic_name
  from visits v
  join patients p on p.id = v.patient_id and p.deleted_at is null
  join clinics c on c.id = v.clinic_id
  where true
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
    ${doctorScopeWhere({ alias: "v", doctorUserId })}
    ${filterWhere(params)}
),
limited_visits as (
  select *
  from scoped_visits
  order by started_at asc nulls last, created_at desc
  limit ${params.limit}
  offset ${params.offset}
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(row_to_json(row) order by row."startedAt" asc nulls last)
    from (
      select
        v.id::text as "id",
        v.clinic_id::text as "clinicId",
        v.patient_id::text as "patientId",
        v.doctor_user_id::text as "doctorUserId",
        v.status::text as "status",
        v.started_at as "startedAt",
        v.signed_at as "signedAt",
        v.chief_complaint as "chiefComplaint",
        v.created_at as "createdAt",
        v.updated_at as "updatedAt",
        v.patient_full_name as "patientFullName",
        v.patient_code as "patientCode",
        v.clinic_slug as "clinicSlug",
        v.clinic_name as "clinicName"
      from limited_visits v
    ) row
  ), '[]'::jsonb),
  'count', (select count(*)::int from scoped_visits),
  'limit', ${params.limit},
  'offset', ${params.offset},
  'filters', jsonb_build_object(
    'status', ${sqlLiteral(params.status || "all")},
    'dateFrom', ${params.dateFrom ? sqlLiteral(params.dateFrom) : "null"},
    'dateTo', ${params.dateTo ? sqlLiteral(params.dateTo) : "null"},
    'search', ${params.search ? sqlLiteral(params.search) : "null"}
  )
)::text;
`.trim();
}

function normalizeVisit(row) {
  return {
    id: String(row.id ?? ""),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    doctorUserId: row.doctorUserId ? String(row.doctorUserId) : null,
    status: String(row.status ?? "draft"),
    startedAt: row.startedAt ?? null,
    signedAt: row.signedAt ?? null,
    chiefComplaint: row.chiefComplaint ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
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

export function normalizeVisitSchedule(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const filters = source.filters && typeof source.filters === "object" ? source.filters : {};
  return {
    items: rawItems.map(normalizeVisit).filter((visit) => visit.id),
    count: Number(source.count ?? rawItems.length) || 0,
    limit: Number(source.limit ?? 50) || 50,
    offset: Number(source.offset ?? 0) || 0,
    filters: {
      status: String(filters.status ?? "all"),
      dateFrom: filters.dateFrom == null ? null : String(filters.dateFrom),
      dateTo: filters.dateTo == null ? null : String(filters.dateTo),
      search: filters.search == null ? null : String(filters.search),
    },
  };
}

export function createVisitScheduleRepository(dbClient) {
  return {
    async listVisits(params) {
      const rows = await dbClient.queryJson(buildVisitScheduleSql(params));
      return normalizeVisitSchedule(Array.isArray(rows) ? rows[0] : rows);
    },
  };
}

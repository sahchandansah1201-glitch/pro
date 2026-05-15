// Stage 5P · Self-hosted clinic booking requests intake repository.
// Operator/clinic-side reads and updates of patient_portal_booking_requests
// created by Stage 5O. All writes stay inside local PostgreSQL — no managed
// runtime, no external CRM, no notification provider.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS_VALUES = new Set(["requested", "reviewing", "booked", "cancelled"]);

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlNullableText(value) {
  return value == null || value === "" ? "null" : sqlLiteral(value);
}

function sqlNullableUuid(value) {
  return value && UUID_PATTERN.test(String(value)) ? sqlUuid(value) : "null";
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

function clinicScopeWhere({ alias = "br", clinicIds = [], allClinics = false } = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function statusFilter(alias, status) {
  if (!status || status === "all") return "";
  if (!STATUS_VALUES.has(status)) return "and false";
  return `and ${alias}.status = ${sqlLiteral(status)}`;
}

function bookingRequestSelect(alias = "br") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.requested_by_user_id::text as "requestedByUserId",
    ${alias}.status as "status",
    ${alias}.preferred_from as "preferredFrom",
    ${alias}.preferred_to as "preferredTo",
    ${alias}.reason as "reason",
    ${alias}.clinic_note as "clinicNote",
    ${alias}.assigned_visit_id::text as "assignedVisitId",
    ${alias}.reviewed_by_user_id::text as "reviewedByUserId",
    ${alias}.reviewed_at as "reviewedAt",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt",
    p.full_name as "patientFullName",
    p.code as "patientCode",
    c.slug as "clinicSlug",
    c.name as "clinicName",
    reviewer.display_name as "reviewedByDisplayName"
  `;
}

export function buildListClinicBookingRequestsSql({
  clinicIds = [],
  allClinics = false,
  status = "all",
  limit = 50,
  offset = 0,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  return `
select coalesce(jsonb_agg(row_to_json(result) order by result."createdAt" desc), '[]'::jsonb)::text
from (
  select
    ${bookingRequestSelect("br")}
  from patient_portal_booking_requests br
  join patients p on p.id = br.patient_id
  join clinics c on c.id = br.clinic_id
  left join app_users reviewer on reviewer.id = br.reviewed_by_user_id
  where true
    ${clinicScopeWhere({ alias: "br", clinicIds, allClinics })}
    ${statusFilter("br", status)}
  order by br.created_at desc
  limit ${safeLimit}
  offset ${safeOffset}
) result;
`.trim();
}

export function buildCountClinicBookingRequestsSql({
  clinicIds = [],
  allClinics = false,
  status = "all",
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    count(*)::int as "total",
    count(*) filter (where br.status = 'requested')::int as "requested",
    count(*) filter (where br.status = 'reviewing')::int as "reviewing",
    count(*) filter (where br.status = 'booked')::int as "booked",
    count(*) filter (where br.status = 'cancelled')::int as "cancelled"
  from patient_portal_booking_requests br
  where true
    ${clinicScopeWhere({ alias: "br", clinicIds, allClinics })}
    ${statusFilter("br", status)}
) result;
`.trim();
}

export function buildGetClinicBookingRequestSql({
  bookingRequestId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    ${bookingRequestSelect("br")}
  from patient_portal_booking_requests br
  join patients p on p.id = br.patient_id
  join clinics c on c.id = br.clinic_id
  left join app_users reviewer on reviewer.id = br.reviewed_by_user_id
  where br.id = ${sqlUuid(bookingRequestId)}
    ${clinicScopeWhere({ alias: "br", clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

export function buildUpdateClinicBookingRequestSql({
  bookingRequestId,
  status,
  clinicIds = [],
  allClinics = false,
  reviewerUserId,
  assignedVisitId = null,
  clinicNote = null,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with updated as (
    update patient_portal_booking_requests br
    set status = ${sqlLiteral(status)},
        reviewed_by_user_id = ${sqlUuid(reviewerUserId)},
        reviewed_at = now(),
        assigned_visit_id = case
          when ${sqlLiteral(status)} = 'booked'
            then coalesce(${sqlNullableUuid(assignedVisitId)}, br.assigned_visit_id)
          else br.assigned_visit_id
        end,
        clinic_note = coalesce(${sqlNullableText(clinicNote)}, br.clinic_note),
        updated_at = now()
    where br.id = ${sqlUuid(bookingRequestId)}
      ${clinicScopeWhere({ alias: "br", clinicIds, allClinics })}
    returning br.*
  )
  select
    ${bookingRequestSelect("br")}
  from updated br
  join patients p on p.id = br.patient_id
  join clinics c on c.id = br.clinic_id
  left join app_users reviewer on reviewer.id = br.reviewed_by_user_id
) result;
`.trim();
}

function normalizeBookingRequest(row = {}) {
  if (!row || typeof row !== "object" || !row.id) return null;
  return {
    id: String(row.id),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    requestedByUserId: row.requestedByUserId ? String(row.requestedByUserId) : null,
    status: String(row.status ?? "requested"),
    preferredFrom: row.preferredFrom ?? null,
    preferredTo: row.preferredTo ?? null,
    reason: row.reason ?? null,
    clinicNote: row.clinicNote ?? null,
    assignedVisitId: row.assignedVisitId ? String(row.assignedVisitId) : null,
    reviewedByUserId: row.reviewedByUserId ? String(row.reviewedByUserId) : null,
    reviewedAt: row.reviewedAt ?? null,
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
    reviewer: {
      id: row.reviewedByUserId ? String(row.reviewedByUserId) : null,
      displayName: row.reviewedByDisplayName ?? null,
    },
  };
}

export function normalizeBookingRequestList(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeBookingRequest).filter(Boolean);
}

export function normalizeBookingRequestSingle(rows) {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  return normalizeBookingRequest(list[0] || {});
}

export function normalizeBookingRequestCounts(rows) {
  const row = Array.isArray(rows) ? rows[0] : rows;
  const source = row && typeof row === "object" ? row : {};
  const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    total: num(source.total),
    requested: num(source.requested),
    reviewing: num(source.reviewing),
    booked: num(source.booked),
    cancelled: num(source.cancelled),
  };
}

export function createClinicBookingRequestsRepository(dbClient) {
  return {
    async listBookingRequests(params) {
      const rows = await dbClient.queryJson(buildListClinicBookingRequestsSql(params));
      return normalizeBookingRequestList(rows);
    },

    async countBookingRequests(params) {
      const rows = await dbClient.queryJson(buildCountClinicBookingRequestsSql(params));
      return normalizeBookingRequestCounts(rows);
    },

    async getBookingRequest(params) {
      const rows = await dbClient.queryJson(buildGetClinicBookingRequestSql(params));
      return normalizeBookingRequestSingle(rows);
    },

    async updateBookingRequest(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicBookingRequestSql(params));
      return normalizeBookingRequestSingle(rows);
    },
  };
}

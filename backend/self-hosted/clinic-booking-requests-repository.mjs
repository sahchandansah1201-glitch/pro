// Stage 5P · Clinic booking requests repository.
// Local PostgreSQL queue for patient portal booking requests reviewed by clinic staff.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS_VALUES = new Set(["requested", "reviewing", "booked", "cancelled"]);

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlUuidList(values = []) {
  return values.map((value) => sqlUuid(value)).join(", ");
}

function sqlNullableText(value) {
  return value == null || value === "" ? "null" : sqlLiteral(value);
}

function sqlNullableUuid(value) {
  return value == null || value === "" ? "null" : sqlUuid(value);
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

function safeLimit(value, fallback = 25, max = 100) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, parsed));
}

function safeOffset(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function safeStatus(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "all") return "all";
  return STATUS_VALUES.has(text) ? text : "all";
}

function safeSearch(value) {
  return String(value ?? "").trim().slice(0, 160);
}

function filterWhere(params = {}) {
  const where = [];
  if (params.status && params.status !== "all") {
    where.push(`and br.status = ${sqlLiteral(params.status)}`);
  }
  if (params.search) {
    const term = `%${params.search}%`;
    where.push(`and (
      coalesce(br.reason, '') ilike ${sqlLiteral(term)}
      or coalesce(br.clinic_note, '') ilike ${sqlLiteral(term)}
      or p.full_name ilike ${sqlLiteral(term)}
      or p.code ilike ${sqlLiteral(term)}
    )`);
  }
  return where.join("\n    ");
}

export function normalizeClinicBookingRequestParams(searchParams = new URLSearchParams()) {
  return {
    status: safeStatus(searchParams.get?.("status")),
    search: safeSearch(searchParams.get?.("search")),
    limit: safeLimit(searchParams.get?.("limit")),
    offset: safeOffset(searchParams.get?.("offset")),
  };
}

function selectScopedRows({ clinicIds = [], allClinics = false, params = {} } = {}) {
  return `
  select
    br.id,
    br.clinic_id,
    br.patient_id,
    br.requested_by_user_id,
    br.preferred_from,
    br.preferred_to,
    br.reason,
    br.status,
    br.assigned_visit_id,
    br.reviewed_by_user_id,
    br.reviewed_at,
    br.clinic_note,
    br.created_at,
    br.updated_at,
    p.full_name as patient_full_name,
    p.code as patient_code,
    c.slug as clinic_slug,
    c.name as clinic_name,
    requester.display_name as requested_by_display_name,
    reviewer.display_name as reviewed_by_display_name,
    v.started_at as assigned_visit_started_at,
    v.status as assigned_visit_status
  from patient_portal_booking_requests br
  join patients p on p.id = br.patient_id and p.deleted_at is null
  join clinics c on c.id = br.clinic_id
  left join app_users requester on requester.id = br.requested_by_user_id
  left join app_users reviewer on reviewer.id = br.reviewed_by_user_id
  left join visits v on v.id = br.assigned_visit_id
  where true
    ${clinicScopeWhere({ alias: "br", clinicIds, allClinics })}
    ${filterWhere(params)}
`;
}

function selectJsonRow() {
  return `
      select
        row.id::text as "id",
        row.clinic_id::text as "clinicId",
        row.patient_id::text as "patientId",
        row.requested_by_user_id::text as "requestedByUserId",
        row.preferred_from as "preferredFrom",
        row.preferred_to as "preferredTo",
        row.reason as "reason",
        row.status as "status",
        row.assigned_visit_id::text as "assignedVisitId",
        row.reviewed_by_user_id::text as "reviewedByUserId",
        row.reviewed_at as "reviewedAt",
        row.clinic_note as "clinicNote",
        row.created_at as "createdAt",
        row.updated_at as "updatedAt",
        row.patient_full_name as "patientFullName",
        row.patient_code as "patientCode",
        row.clinic_slug as "clinicSlug",
        row.clinic_name as "clinicName",
        row.requested_by_display_name as "requestedByDisplayName",
        row.reviewed_by_display_name as "reviewedByDisplayName",
        row.assigned_visit_started_at as "assignedVisitStartedAt",
        row.assigned_visit_status as "assignedVisitStatus"
`;
}

export function buildClinicBookingRequestsSql({
  clinicIds = [],
  allClinics = false,
  status = "all",
  search = "",
  limit = 25,
  offset = 0,
} = {}) {
  const params = {
    status: safeStatus(status),
    search: safeSearch(search),
    limit: safeLimit(limit),
    offset: safeOffset(offset),
  };
  return `
with scoped_requests as (
${selectScopedRows({ clinicIds, allClinics, params })}
),
ordered_requests as (
  select *
  from scoped_requests
  order by created_at desc, id desc
  limit ${params.limit}
  offset ${params.offset}
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(row_to_json(item) order by item."createdAt" desc)
    from (
${selectJsonRow()}
      from ordered_requests row
    ) item
  ), '[]'::jsonb),
  'count', (select count(*)::int from scoped_requests),
  'limit', ${params.limit},
  'offset', ${params.offset},
  'filters', jsonb_build_object(
    'status', ${sqlLiteral(params.status)},
    'search', ${params.search ? sqlLiteral(params.search) : "null"}
  )
)::text;
`.trim();
}

export function buildClinicBookingRequestDetailSql({
  requestId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
with scoped_requests as (
${selectScopedRows({ clinicIds, allClinics, params: {} })}
    and br.id = ${sqlUuid(requestId)}
)
select coalesce((
  select row_to_json(item)
  from (
${selectJsonRow()}
    from scoped_requests row
    limit 1
  ) item
), 'null'::json)::text;
`.trim();
}

export function buildUpdateClinicBookingRequestSql({
  requestId,
  status = null,
  clinicNote = null,
  assignedVisitId = null,
  reviewedByUserId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  const assignments = [
    "reviewed_by_user_id = " + sqlUuid(reviewedByUserId),
    "reviewed_at = now()",
    "updated_at = now()",
  ];
  if (status) assignments.push(`status = ${sqlLiteral(status)}`);
  if (clinicNote !== undefined) assignments.push(`clinic_note = ${sqlNullableText(clinicNote)}`);
  if (assignedVisitId !== undefined) assignments.push(`assigned_visit_id = ${sqlNullableUuid(assignedVisitId)}`);

  return `
with updated as (
  update patient_portal_booking_requests br
  set ${assignments.join(",\n      ")}
  where br.id = ${sqlUuid(requestId)}
    ${clinicScopeWhere({ alias: "br", clinicIds, allClinics })}
  returning br.*
),
scoped_requests as (
  select
    br.id,
    br.clinic_id,
    br.patient_id,
    br.requested_by_user_id,
    br.preferred_from,
    br.preferred_to,
    br.reason,
    br.status,
    br.assigned_visit_id,
    br.reviewed_by_user_id,
    br.reviewed_at,
    br.clinic_note,
    br.created_at,
    br.updated_at,
    p.full_name as patient_full_name,
    p.code as patient_code,
    c.slug as clinic_slug,
    c.name as clinic_name,
    requester.display_name as requested_by_display_name,
    reviewer.display_name as reviewed_by_display_name,
    v.started_at as assigned_visit_started_at,
    v.status as assigned_visit_status
  from updated br
  join patients p on p.id = br.patient_id and p.deleted_at is null
  join clinics c on c.id = br.clinic_id
  left join app_users requester on requester.id = br.requested_by_user_id
  left join app_users reviewer on reviewer.id = br.reviewed_by_user_id
  left join visits v on v.id = br.assigned_visit_id
)
select coalesce((
  select row_to_json(item)
  from (
${selectJsonRow()}
    from scoped_requests row
    limit 1
  ) item
), 'null'::json)::text;
`.trim();
}

export function buildBookClinicBookingRequestFromSlotSql({
  requestId,
  slotId,
  clinicNote = null,
  reviewedByUserId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
with selected_request as (
  select br.*
  from patient_portal_booking_requests br
  join patients p on p.id = br.patient_id and p.deleted_at is null
  where br.id = ${sqlUuid(requestId)}
    and br.status in ('requested', 'reviewing')
    and br.assigned_visit_id is null
    ${clinicScopeWhere({ alias: "br", clinicIds, allClinics })}
  limit 1
),
selected_slot as (
  select s.*
  from clinic_available_slots s
  join selected_request br on br.clinic_id = s.clinic_id
  where s.id = ${sqlUuid(slotId)}
    and s.status = 'available'
  limit 1
),
booked_slot as (
  update clinic_available_slots s
  set status = 'booked',
      updated_at = now()
  from selected_slot ss
  where s.id = ss.id
  returning s.*
),
inserted_visit as (
  insert into visits (
    clinic_id,
    patient_id,
    doctor_user_id,
    status,
    started_at,
    chief_complaint
  )
  select
    br.clinic_id,
    br.patient_id,
    bs.doctor_user_id,
    'draft'::visit_status,
    bs.started_at,
    coalesce(nullif(br.reason, ''), ${sqlNullableText(clinicNote)})
  from selected_request br
  join booked_slot bs on true
  returning *
),
updated as (
  update patient_portal_booking_requests br
  set status = 'booked',
      assigned_visit_id = iv.id,
      reviewed_by_user_id = ${sqlUuid(reviewedByUserId)},
      reviewed_at = now(),
      clinic_note = coalesce(${sqlNullableText(clinicNote)}, br.clinic_note),
      updated_at = now()
  from inserted_visit iv
  where br.id = (select id from selected_request)
  returning br.*
),
scoped_requests as (
  select
    br.id,
    br.clinic_id,
    br.patient_id,
    br.requested_by_user_id,
    br.preferred_from,
    br.preferred_to,
    br.reason,
    br.status,
    br.assigned_visit_id,
    br.reviewed_by_user_id,
    br.reviewed_at,
    br.clinic_note,
    br.created_at,
    br.updated_at,
    p.full_name as patient_full_name,
    p.code as patient_code,
    c.slug as clinic_slug,
    c.name as clinic_name,
    requester.display_name as requested_by_display_name,
    reviewer.display_name as reviewed_by_display_name,
    v.started_at as assigned_visit_started_at,
    v.status as assigned_visit_status
  from updated br
  join patients p on p.id = br.patient_id and p.deleted_at is null
  join clinics c on c.id = br.clinic_id
  left join app_users requester on requester.id = br.requested_by_user_id
  left join app_users reviewer on reviewer.id = br.reviewed_by_user_id
  left join visits v on v.id = br.assigned_visit_id
)
select coalesce((
  select row_to_json(item)
  from (
${selectJsonRow()}
    from scoped_requests row
    limit 1
  ) item
), 'null'::json)::text;
`.trim();
}

function textOrNull(value) {
  return value == null ? null : String(value);
}

function nestedRow(input = {}, keys = []) {
  return keys.reduce((out, [from, to]) => {
    out[to] = textOrNull(input[from]);
    return out;
  }, {});
}

export function normalizeClinicBookingRequest(input) {
  if (!input || typeof input !== "object" || !input.id) return null;
  return {
    id: String(input.id),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    requestedByUserId: textOrNull(input.requestedByUserId),
    preferredFrom: textOrNull(input.preferredFrom),
    preferredTo: textOrNull(input.preferredTo),
    reason: textOrNull(input.reason),
    status: String(input.status ?? "requested"),
    assignedVisitId: textOrNull(input.assignedVisitId),
    reviewedByUserId: textOrNull(input.reviewedByUserId),
    reviewedAt: textOrNull(input.reviewedAt),
    clinicNote: textOrNull(input.clinicNote),
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
    patient: {
      id: textOrNull(input.patientId),
      fullName: textOrNull(input.patientFullName),
      code: textOrNull(input.patientCode),
    },
    clinic: {
      id: textOrNull(input.clinicId),
      ...nestedRow(input, [["clinicSlug", "slug"], ["clinicName", "name"]]),
    },
    requestedBy: {
      id: textOrNull(input.requestedByUserId),
      displayName: textOrNull(input.requestedByDisplayName),
    },
    reviewedBy: {
      id: textOrNull(input.reviewedByUserId),
      displayName: textOrNull(input.reviewedByDisplayName),
    },
    assignedVisit: input.assignedVisitId
      ? {
          id: String(input.assignedVisitId),
          startedAt: textOrNull(input.assignedVisitStartedAt),
          status: textOrNull(input.assignedVisitStatus),
        }
      : null,
  };
}

export function normalizeClinicBookingRequests(input) {
  const source = input && typeof input === "object" ? input : {};
  const filters = source.filters && typeof source.filters === "object" ? source.filters : {};
  return {
    items: Array.isArray(source.items)
      ? source.items.map(normalizeClinicBookingRequest).filter(Boolean)
      : [],
    count: Number.isFinite(Number(source.count)) ? Number(source.count) : 0,
    limit: Number.isFinite(Number(source.limit)) ? Number(source.limit) : 25,
    offset: Number.isFinite(Number(source.offset)) ? Number(source.offset) : 0,
    filters: {
      status: String(filters.status ?? "all"),
      search: filters.search == null ? null : String(filters.search),
    },
  };
}

function firstJson(rows) {
  return Array.isArray(rows) ? rows[0] : rows;
}

export function createClinicBookingRequestsRepository(dbClient) {
  return {
    async listBookingRequests(params) {
      const rows = await dbClient.queryJson(buildClinicBookingRequestsSql(params));
      return normalizeClinicBookingRequests(firstJson(rows));
    },
    async getBookingRequest(params) {
      const rows = await dbClient.queryJson(buildClinicBookingRequestDetailSql(params));
      return normalizeClinicBookingRequest(firstJson(rows));
    },
    async updateBookingRequest(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicBookingRequestSql(params));
      return normalizeClinicBookingRequest(firstJson(rows));
    },
    async bookBookingRequestFromSlot(params) {
      const rows = await dbClient.queryJson(buildBookClinicBookingRequestFromSlotSql(params));
      return normalizeClinicBookingRequest(firstJson(rows));
    },
  };
}

// Stage 5R · Clinic available slots repository.
// Reads locally cached CRM/ad availability from PostgreSQL only. The product
// never calls external scheduling systems while operators handle requests.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_SYSTEM_VALUES = new Set(["clinic_crm", "ads", "site", "manual", "other"]);
const SLOT_STATUS_VALUES = new Set(["available", "held", "booked", "cancelled"]);

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

function clinicScopeWhere({ alias = "s", clinicIds = [], allClinics = false } = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function safeLimit(value, fallback = 20, max = 100) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, parsed));
}

function safeOffset(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function safeSourceSystem(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "all") return "all";
  return SOURCE_SYSTEM_VALUES.has(text) ? text : "all";
}

function safeStatus(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "all") return "available";
  return SLOT_STATUS_VALUES.has(text) ? text : "available";
}

function safeDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeClinicAvailableSlotParams(searchParams = new URLSearchParams()) {
  return {
    sourceSystem: safeSourceSystem(searchParams.get?.("sourceSystem")),
    status: safeStatus(searchParams.get?.("status")),
    dateFrom: safeDate(searchParams.get?.("dateFrom")),
    dateTo: safeDate(searchParams.get?.("dateTo")),
    limit: safeLimit(searchParams.get?.("limit")),
    offset: safeOffset(searchParams.get?.("offset")),
  };
}

function slotFilters(params = {}) {
  const filters = [];
  if (params.status && params.status !== "all") {
    filters.push(`and s.status = ${sqlLiteral(params.status)}`);
  }
  if (params.sourceSystem && params.sourceSystem !== "all") {
    filters.push(`and s.source_system = ${sqlLiteral(params.sourceSystem)}`);
  }
  if (params.dateFrom) {
    filters.push(`and s.started_at >= ${sqlLiteral(params.dateFrom)}::timestamptz`);
  }
  if (params.dateTo) {
    filters.push(`and s.started_at <= ${sqlLiteral(params.dateTo)}::timestamptz`);
  }
  return filters.join("\n    ");
}

function slotSelect(alias = "s") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.doctor_user_id::text as "doctorUserId",
    ${alias}.source_system as "sourceSystem",
    ${alias}.external_slot_id as "externalSlotId",
    ${alias}.started_at as "startedAt",
    ${alias}.duration_minutes as "durationMinutes",
    ${alias}.status as "status",
    ${alias}.imported_at as "importedAt",
    ${alias}.updated_at as "updatedAt",
    c.slug as "clinicSlug",
    c.name as "clinicName",
    doctor.display_name as "doctorDisplayName"
  `;
}

export function buildClinicAvailableSlotsSql({
  clinicIds = [],
  allClinics = false,
  sourceSystem = "all",
  status = "available",
  dateFrom = null,
  dateTo = null,
  limit = 20,
  offset = 0,
} = {}) {
  const params = {
    sourceSystem: safeSourceSystem(sourceSystem),
    status: safeStatus(status),
    dateFrom: safeDate(dateFrom),
    dateTo: safeDate(dateTo),
    limit: safeLimit(limit),
    offset: safeOffset(offset),
  };
  return `
with scoped_slots as (
  select s.*
  from clinic_available_slots s
  where true
    ${clinicScopeWhere({ alias: "s", clinicIds, allClinics })}
    ${slotFilters(params)}
),
ordered_slots as (
  select *
  from scoped_slots
  order by started_at asc, id asc
  limit ${params.limit}
  offset ${params.offset}
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(row_to_json(item) order by item."startedAt" asc)
    from (
      select
        ${slotSelect("s")}
      from ordered_slots s
      join clinics c on c.id = s.clinic_id
      left join app_users doctor on doctor.id = s.doctor_user_id
    ) item
  ), '[]'::jsonb),
  'count', (select count(*)::int from scoped_slots),
  'limit', ${params.limit},
  'offset', ${params.offset},
  'filters', jsonb_build_object(
    'sourceSystem', ${sqlLiteral(params.sourceSystem)},
    'status', ${sqlLiteral(params.status)},
    'dateFrom', ${params.dateFrom ? sqlLiteral(params.dateFrom) : "null"},
    'dateTo', ${params.dateTo ? sqlLiteral(params.dateTo) : "null"}
  )
)::text;
`.trim();
}

function textOrNull(value) {
  return value == null ? null : String(value);
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeClinicAvailableSlot(input) {
  if (!input || typeof input !== "object" || !input.id) return null;
  return {
    id: String(input.id),
    clinicId: textOrNull(input.clinicId),
    doctorUserId: textOrNull(input.doctorUserId),
    sourceSystem: String(input.sourceSystem ?? "other"),
    externalSlotId: String(input.externalSlotId ?? ""),
    startedAt: textOrNull(input.startedAt),
    durationMinutes: asNumber(input.durationMinutes),
    status: String(input.status ?? "available"),
    importedAt: textOrNull(input.importedAt),
    updatedAt: textOrNull(input.updatedAt),
    clinic: {
      id: textOrNull(input.clinicId),
      slug: textOrNull(input.clinicSlug),
      name: textOrNull(input.clinicName),
    },
    doctor: {
      id: textOrNull(input.doctorUserId),
      displayName: textOrNull(input.doctorDisplayName),
    },
  };
}

export function normalizeClinicAvailableSlots(input) {
  const source = input && typeof input === "object" ? input : {};
  const filters = source.filters && typeof source.filters === "object" ? source.filters : {};
  return {
    items: Array.isArray(source.items)
      ? source.items.map(normalizeClinicAvailableSlot).filter(Boolean)
      : [],
    count: asNumber(source.count),
    limit: asNumber(source.limit) || 20,
    offset: asNumber(source.offset),
    filters: {
      sourceSystem: String(filters.sourceSystem ?? "all"),
      status: String(filters.status ?? "available"),
      dateFrom: textOrNull(filters.dateFrom),
      dateTo: textOrNull(filters.dateTo),
    },
  };
}

function firstJson(rows) {
  return Array.isArray(rows) ? rows[0] : rows;
}

export function createClinicAvailableSlotsRepository(dbClient) {
  return {
    async listAvailableSlots(params) {
      const rows = await dbClient.queryJson(buildClinicAvailableSlotsSql(params));
      return normalizeClinicAvailableSlots(firstJson(rows));
    },
  };
}

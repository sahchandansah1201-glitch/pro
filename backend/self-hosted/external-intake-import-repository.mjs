// Stage 5Q · External intake import repository.
// Stores only sanitized import metadata and local booking/slot rows in
// PostgreSQL. There are no outbound CRM/ad-network calls in this repository.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_SYSTEM_VALUES = new Set(["clinic_crm", "ads", "site", "manual", "other"]);

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJsonb(value) {
  return `${sqlLiteral(JSON.stringify(value ?? []))}::jsonb`;
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

function clinicScopeWhere({ alias = "b", clinicIds = [], allClinics = false } = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function safeLimit(value, fallback = 10, max = 100) {
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

export function normalizeExternalIntakeImportParams(searchParams = new URLSearchParams()) {
  return {
    sourceSystem: safeSourceSystem(searchParams.get?.("sourceSystem")),
    limit: safeLimit(searchParams.get?.("limit")),
    offset: safeOffset(searchParams.get?.("offset")),
  };
}

export function normalizeExternalIntakeStatusParams(searchParams = new URLSearchParams()) {
  return {
    sourceSystem: safeSourceSystem(searchParams.get?.("sourceSystem")),
  };
}

function batchSelect(alias = "b") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.imported_by_user_id::text as "importedByUserId",
    ${alias}.source_system as "sourceSystem",
    ${alias}.source_reference as "sourceReference",
    ${alias}.status as "status",
    ${alias}.item_count as "itemCount",
    ${alias}.accepted_booking_count as "acceptedBookingCount",
    ${alias}.accepted_slot_count as "acceptedSlotCount",
    ${alias}.rejected_count as "rejectedCount",
    ${alias}.duplicate_count as "duplicateCount",
    ${alias}.idempotency_key as "idempotencyKey",
    ${alias}.hardening_version as "hardeningVersion",
    ${alias}.summary_json as "summary",
    ${alias}.created_at as "createdAt",
    c.slug as "clinicSlug",
    c.name as "clinicName",
    u.display_name as "importedByDisplayName"
  `;
}

export function buildImportExternalIntakeSql({
  clinicId,
  actorUserId,
  sourceSystem,
  sourceReference = null,
  idempotencyKey = null,
  items = [],
} = {}) {
  return `
with raw_items as (
  select
    row_number() over () as ordinal,
    item."kind" as kind,
    item."externalId" as external_id,
    item."patientCode" as patient_code,
    item."preferredFrom" as preferred_from,
    item."preferredTo" as preferred_to,
    item."reason" as reason,
    item."doctorUserId" as doctor_user_id,
    item."startedAt" as started_at,
    item."durationMinutes" as duration_minutes
  from jsonb_to_recordset(${sqlJsonb(items)}) as item(
    "kind" text,
    "externalId" text,
    "patientCode" text,
    "preferredFrom" text,
    "preferredTo" text,
    "reason" text,
    "doctorUserId" text,
    "startedAt" text,
    "durationMinutes" integer
  )
),
booking_items as (
  select
    raw.*,
    p.id as patient_id
  from raw_items raw
  left join patients p
    on p.clinic_id = ${sqlUuid(clinicId)}
   and p.code = raw.patient_code
   and p.deleted_at is null
  where raw.kind = 'booking_request'
),
existing_bookings as (
  select item.external_id
  from booking_items item
  join patient_portal_booking_requests existing
    on existing.clinic_id = ${sqlUuid(clinicId)}
   and existing.source_system = ${sqlLiteral(sourceSystem)}
   and existing.external_request_id = item.external_id
  where item.patient_id is not null
    and item.external_id is not null
    and item.external_id <> ''
),
inserted_bookings as (
  insert into patient_portal_booking_requests (
    clinic_id,
    patient_id,
    requested_by_user_id,
    preferred_from,
    preferred_to,
    reason,
    status,
    source_system,
    external_request_id
  )
  select
    ${sqlUuid(clinicId)},
    item.patient_id,
    ${sqlUuid(actorUserId)},
    item.preferred_from::timestamptz,
    nullif(item.preferred_to, '')::timestamptz,
    nullif(item.reason, ''),
    'requested',
    ${sqlLiteral(sourceSystem)},
    item.external_id
  from booking_items item
  where item.patient_id is not null
    and item.external_id is not null
    and item.external_id <> ''
  on conflict (clinic_id, source_system, external_request_id)
  where external_request_id is not null
  do nothing
  returning id
),
slot_items as (
  select *
  from raw_items
  where kind = 'available_slot'
),
upserted_slots as (
  insert into clinic_available_slots (
    clinic_id,
    doctor_user_id,
    source_system,
    external_slot_id,
    started_at,
    duration_minutes,
    status,
    imported_at
  )
  select
    ${sqlUuid(clinicId)},
    ${"nullif(slot.doctor_user_id, '')::uuid"},
    ${sqlLiteral(sourceSystem)},
    slot.external_id,
    slot.started_at::timestamptz,
    coalesce(slot.duration_minutes, 30),
    'available',
    now()
  from slot_items slot
  where slot.external_id is not null and slot.external_id <> ''
  on conflict (clinic_id, source_system, external_slot_id)
  do update set
    doctor_user_id = excluded.doctor_user_id,
    started_at = excluded.started_at,
    duration_minutes = excluded.duration_minutes,
    status = 'available',
    imported_at = now(),
    updated_at = now()
  returning id
),
counts as (
  select
    (select count(*)::int from raw_items) as item_count,
    (select count(*)::int from inserted_bookings) as accepted_booking_count,
    (select count(*)::int from upserted_slots) as accepted_slot_count,
    (select count(*)::int from existing_bookings) as duplicate_count,
    (
      (select count(*)::int from raw_items)
      - (select count(*)::int from inserted_bookings)
      - (select count(*)::int from upserted_slots)
      - (select count(*)::int from existing_bookings)
    ) as rejected_count
),
inserted_batch as (
  insert into external_booking_import_batches (
    clinic_id,
    imported_by_user_id,
    source_system,
    source_reference,
    idempotency_key,
    status,
    item_count,
    accepted_booking_count,
    accepted_slot_count,
    rejected_count,
    duplicate_count,
    hardening_version,
    summary_json
  )
  select
    ${sqlUuid(clinicId)},
    ${sqlUuid(actorUserId)},
    ${sqlLiteral(sourceSystem)},
    ${sqlNullableText(sourceReference)},
    ${sqlNullableText(idempotencyKey)},
    case
      when counts.item_count = 0 then 'rejected'
      when counts.rejected_count > 0 or counts.duplicate_count > 0 then 'completed_with_rejections'
      else 'completed'
    end,
    counts.item_count,
    counts.accepted_booking_count,
    counts.accepted_slot_count,
    counts.rejected_count,
    counts.duplicate_count,
    'stage5t',
    jsonb_build_object(
      'acceptedBookingCount', counts.accepted_booking_count,
      'acceptedSlotCount', counts.accepted_slot_count,
      'rejectedCount', counts.rejected_count,
      'duplicateCount', counts.duplicate_count,
      'idempotencyKeyProvided', ${idempotencyKey ? "true" : "false"},
      'storedRawPayload', false
    )
  from counts
  on conflict (clinic_id, source_system, idempotency_key)
  where idempotency_key is not null
  do update set
    summary_json = external_booking_import_batches.summary_json
      || jsonb_build_object('duplicateBatch', true, 'storedRawPayload', false),
    hardening_version = 'stage5t'
  returning *
)
select row_to_json(result)::text
from (
  select
    ${batchSelect("b")}
  from inserted_batch b
  join clinics c on c.id = b.clinic_id
  left join app_users u on u.id = b.imported_by_user_id
  limit 1
) result;
`.trim();
}

export function buildExternalIntakeStatusSql({
  clinicIds = [],
  allClinics = false,
  sourceSystem = "all",
} = {}) {
  const params = { sourceSystem: safeSourceSystem(sourceSystem) };
  const sourceFilter = params.sourceSystem === "all" ? "" : `and b.source_system = ${sqlLiteral(params.sourceSystem)}`;
  const slotSourceFilter = params.sourceSystem === "all" ? "" : `and s.source_system = ${sqlLiteral(params.sourceSystem)}`;
  return `
with scoped_batches as (
  select b.*
  from external_booking_import_batches b
  where true
    ${clinicScopeWhere({ alias: "b", clinicIds, allClinics })}
    ${sourceFilter}
),
latest_by_source as (
  select distinct on (b.source_system)
    b.source_system,
    b.status,
    b.created_at,
    b.item_count,
    b.accepted_booking_count,
    b.accepted_slot_count,
    b.rejected_count,
    b.duplicate_count,
    b.hardening_version
  from scoped_batches b
  order by b.source_system, b.created_at desc, b.id desc
),
open_requests as (
  select count(*)::int as count
  from patient_portal_booking_requests br
  where br.status in ('requested', 'reviewing')
    ${clinicScopeWhere({ alias: "br", clinicIds, allClinics })}
),
available_slots as (
  select count(*)::int as count
  from clinic_available_slots s
  where s.status = 'available'
    ${clinicScopeWhere({ alias: "s", clinicIds, allClinics })}
    ${slotSourceFilter}
)
select jsonb_build_object(
  'sourceSystem', ${sqlLiteral(params.sourceSystem)},
  'recentBatchCount', (select count(*)::int from scoped_batches),
  'rejectedLast24h', coalesce((
    select sum(rejected_count)::int from scoped_batches where created_at >= now() - interval '24 hours'
  ), 0),
  'duplicateLast24h', coalesce((
    select sum(duplicate_count)::int from scoped_batches where created_at >= now() - interval '24 hours'
  ), 0),
  'latestImportAt', (select max(created_at) from scoped_batches),
  'openBookingRequestCount', (select count from open_requests),
  'availableSlotCount', (select count from available_slots),
  'storedRawPayload', false,
  'runtimeCallsExternalSystems', false,
  'hardeningVersion', 'stage5t',
  'latestBySource', coalesce((
    select jsonb_agg(jsonb_build_object(
      'sourceSystem', source_system,
      'status', status,
      'createdAt', created_at,
      'itemCount', item_count,
      'acceptedBookingCount', accepted_booking_count,
      'acceptedSlotCount', accepted_slot_count,
      'rejectedCount', rejected_count,
      'duplicateCount', duplicate_count,
      'hardeningVersion', hardening_version
    ) order by created_at desc)
    from latest_by_source
  ), '[]'::jsonb)
)::text;
`.trim();
}

export function buildExternalIntakeImportBatchesSql({
  clinicIds = [],
  allClinics = false,
  sourceSystem = "all",
  limit = 10,
  offset = 0,
} = {}) {
  const params = {
    sourceSystem: safeSourceSystem(sourceSystem),
    limit: safeLimit(limit),
    offset: safeOffset(offset),
  };
  const sourceFilter = params.sourceSystem === "all" ? "" : `and b.source_system = ${sqlLiteral(params.sourceSystem)}`;
  return `
with scoped_batches as (
  select b.*
  from external_booking_import_batches b
  where true
    ${clinicScopeWhere({ alias: "b", clinicIds, allClinics })}
    ${sourceFilter}
),
ordered_batches as (
  select *
  from scoped_batches
  order by created_at desc, id desc
  limit ${params.limit}
  offset ${params.offset}
)
select jsonb_build_object(
  'items', coalesce((
    select jsonb_agg(row_to_json(item) order by item."createdAt" desc)
    from (
      select
        ${batchSelect("b")}
      from ordered_batches b
      join clinics c on c.id = b.clinic_id
      left join app_users u on u.id = b.imported_by_user_id
    ) item
  ), '[]'::jsonb),
  'count', (select count(*)::int from scoped_batches),
  'limit', ${params.limit},
  'offset', ${params.offset},
  'filters', jsonb_build_object('sourceSystem', ${sqlLiteral(params.sourceSystem)})
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

export function normalizeExternalIntakeImportBatch(input) {
  if (!input || typeof input !== "object" || !input.id) return null;
  return {
    id: String(input.id),
    clinicId: textOrNull(input.clinicId),
    importedByUserId: textOrNull(input.importedByUserId),
    sourceSystem: String(input.sourceSystem ?? "other"),
    sourceReference: textOrNull(input.sourceReference),
    status: String(input.status ?? "completed"),
    itemCount: asNumber(input.itemCount),
    acceptedBookingCount: asNumber(input.acceptedBookingCount),
    acceptedSlotCount: asNumber(input.acceptedSlotCount),
    rejectedCount: asNumber(input.rejectedCount),
    duplicateCount: asNumber(input.duplicateCount),
    idempotencyKey: textOrNull(input.idempotencyKey),
    hardeningVersion: textOrNull(input.hardeningVersion) || "stage5q",
    summary: input.summary && typeof input.summary === "object" ? input.summary : {},
    createdAt: textOrNull(input.createdAt),
    clinic: {
      id: textOrNull(input.clinicId),
      slug: textOrNull(input.clinicSlug),
      name: textOrNull(input.clinicName),
    },
    importedBy: {
      id: textOrNull(input.importedByUserId),
      displayName: textOrNull(input.importedByDisplayName),
    },
  };
}

export function normalizeExternalIntakeStatus(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    sourceSystem: String(source.sourceSystem ?? "all"),
    recentBatchCount: asNumber(source.recentBatchCount),
    rejectedLast24h: asNumber(source.rejectedLast24h),
    duplicateLast24h: asNumber(source.duplicateLast24h),
    latestImportAt: textOrNull(source.latestImportAt),
    openBookingRequestCount: asNumber(source.openBookingRequestCount),
    availableSlotCount: asNumber(source.availableSlotCount),
    storedRawPayload: source.storedRawPayload === true ? true : false,
    runtimeCallsExternalSystems: source.runtimeCallsExternalSystems === true ? true : false,
    hardeningVersion: String(source.hardeningVersion ?? "stage5t"),
    latestBySource: Array.isArray(source.latestBySource)
      ? source.latestBySource.map((item) => ({
          sourceSystem: String(item?.sourceSystem ?? "other"),
          status: String(item?.status ?? "unknown"),
          createdAt: textOrNull(item?.createdAt),
          itemCount: asNumber(item?.itemCount),
          acceptedBookingCount: asNumber(item?.acceptedBookingCount),
          acceptedSlotCount: asNumber(item?.acceptedSlotCount),
          rejectedCount: asNumber(item?.rejectedCount),
          duplicateCount: asNumber(item?.duplicateCount),
          hardeningVersion: String(item?.hardeningVersion ?? "stage5t"),
        }))
      : [],
  };
}

export function normalizeExternalIntakeImportBatches(input) {
  const source = input && typeof input === "object" ? input : {};
  const filters = source.filters && typeof source.filters === "object" ? source.filters : {};
  return {
    items: Array.isArray(source.items)
      ? source.items.map(normalizeExternalIntakeImportBatch).filter(Boolean)
      : [],
    count: asNumber(source.count),
    limit: asNumber(source.limit) || 10,
    offset: asNumber(source.offset),
    filters: {
      sourceSystem: String(filters.sourceSystem ?? "all"),
    },
  };
}

function firstJson(rows) {
  return Array.isArray(rows) ? rows[0] : rows;
}

export function createExternalIntakeImportRepository(dbClient) {
  return {
    async importExternalIntake(params) {
      const rows = await dbClient.queryJson(buildImportExternalIntakeSql(params));
      return normalizeExternalIntakeImportBatch(firstJson(rows));
    },
    async listImportBatches(params) {
      const rows = await dbClient.queryJson(buildExternalIntakeImportBatchesSql(params));
      return normalizeExternalIntakeImportBatches(firstJson(rows));
    },
    async getImportStatus(params) {
      const rows = await dbClient.queryJson(buildExternalIntakeStatusSql(params));
      return normalizeExternalIntakeStatus(firstJson(rows));
    },
  };
}

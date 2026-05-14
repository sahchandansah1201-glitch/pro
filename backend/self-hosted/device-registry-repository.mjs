const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clampInteger(value, { fallback, min, max }) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlUuidList(values = []) {
  return values.map((value) => sqlUuid(value)).join(", ");
}

function normalizeSearch(value) {
  return String(value || "").trim().slice(0, 120);
}

function safeClinicIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(String)
    .filter((value) => UUID_PATTERN.test(value))
    .slice(0, 100);
}

function clinicScopeWhere({
  alias,
  clinicIds = [],
  allClinics = false,
} = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function normalizeDeviceStatus(value) {
  return value === "connected" || value === "standby" || value === "offline"
    ? value
    : "all";
}

function normalizeBridgeStatus(value) {
  return value === "online" || value === "degraded" || value === "offline"
    ? value
    : "all";
}

export function parseDeviceRegistryParams(searchParams) {
  return {
    limit: clampInteger(searchParams.get("limit"), {
      fallback: DEFAULT_LIMIT,
      min: 1,
      max: MAX_LIMIT,
    }),
    offset: clampInteger(searchParams.get("offset"), {
      fallback: 0,
      min: 0,
      max: 10_000,
    }),
    search: normalizeSearch(searchParams.get("search")),
    status: normalizeDeviceStatus(searchParams.get("status")),
    bridgeStatus: normalizeBridgeStatus(searchParams.get("bridgeStatus")),
    needsCalibration: searchParams.get("needsCalibration") === "true",
  };
}

export function buildListDeviceBridgesSql({
  clinicIds = [],
  allClinics = false,
  bridgeStatus = "all",
} = {}) {
  const statusWhere = normalizeBridgeStatus(bridgeStatus) !== "all"
    ? `and b.lan_status = ${sqlLiteral(bridgeStatus)}`
    : "";
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    b.id::text as "id",
    b.clinic_id::text as "clinicId",
    c.slug as "clinicSlug",
    c.name as "clinicName",
    b.bridge_code as "bridgeCode",
    b.host_name as "hostName",
    b.lan_status as "lanStatus",
    b.version as "version",
    b.last_heartbeat_at as "lastHeartbeatAt",
    count(d.id)::int as "pairedCount",
    b.created_at as "createdAt",
    b.updated_at as "updatedAt"
  from device_bridges b
  join clinics c on c.id = b.clinic_id
  left join medical_devices d on d.bridge_id = b.id and d.deleted_at is null
  where true
    ${clinicScopeWhere({ alias: "b", clinicIds, allClinics })}
    ${statusWhere}
  group by b.id, c.slug, c.name
  order by b.last_heartbeat_at desc nulls last, b.bridge_code asc
) result;
`.trim();
}

export function buildListMedicalDevicesSql({
  limit = DEFAULT_LIMIT,
  offset = 0,
  search = "",
  status = "all",
  needsCalibration = false,
  clinicIds = [],
  allClinics = false,
} = {}) {
  const safeLimit = clampInteger(limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT });
  const safeOffset = clampInteger(offset, { fallback: 0, min: 0, max: 10_000 });
  const safeSearch = normalizeSearch(search);
  const safeStatus = normalizeDeviceStatus(status);
  const searchWhere = safeSearch
    ? `and (
        d.model ilike '%' || ${sqlLiteral(safeSearch)} || '%'
        or d.serial ilike '%' || ${sqlLiteral(safeSearch)} || '%'
        or coalesce(b.bridge_code, '') ilike '%' || ${sqlLiteral(safeSearch)} || '%'
      )`
    : "";
  const statusWhere = safeStatus !== "all"
    ? `and d.status = ${sqlLiteral(safeStatus)}`
    : "";
  const calibrationWhere = needsCalibration
    ? "and d.calibration_due_at is not null and d.calibration_due_at <= current_date"
    : "";

  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    d.id::text as "id",
    d.clinic_id::text as "clinicId",
    c.slug as "clinicSlug",
    c.name as "clinicName",
    d.model as "model",
    d.serial as "serial",
    d.firmware as "firmware",
    d.magnification as "magnification",
    d.polarization as "polarization",
    d.calibration_profile as "calibrationProfile",
    d.calibration_due_at as "calibrationDueAt",
    d.status as "status",
    d.last_seen_at as "lastSeenAt",
    d.bridge_id::text as "bridgeId",
    b.bridge_code as "bridgeCode",
    b.host_name as "bridgeHostName",
    b.lan_status as "bridgeLanStatus",
    d.created_at as "createdAt",
    d.updated_at as "updatedAt"
  from medical_devices d
  join clinics c on c.id = d.clinic_id
  left join device_bridges b on b.id = d.bridge_id
  where d.deleted_at is null
    ${clinicScopeWhere({ alias: "d", clinicIds, allClinics })}
    ${searchWhere}
    ${statusWhere}
    ${calibrationWhere}
  order by d.last_seen_at desc nulls last, d.model asc, d.serial asc
  limit ${safeLimit}
  offset ${safeOffset}
) result;
`.trim();
}

function normalizeBridge(row = {}) {
  return {
    id: String(row.id || ""),
    bridgeCode: String(row.bridgeCode || ""),
    hostName: String(row.hostName || ""),
    lanStatus: normalizeBridgeStatus(row.lanStatus) === "all" ? "offline" : normalizeBridgeStatus(row.lanStatus),
    version: String(row.version || ""),
    pairedCount: Number(row.pairedCount || 0),
    lastHeartbeatAt: row.lastHeartbeatAt ? String(row.lastHeartbeatAt) : null,
    clinic: {
      id: String(row.clinicId || ""),
      slug: String(row.clinicSlug || ""),
      name: String(row.clinicName || ""),
    },
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

function normalizeDevice(row = {}) {
  return {
    id: String(row.id || ""),
    model: String(row.model || ""),
    serial: String(row.serial || ""),
    firmware: String(row.firmware || ""),
    magnification: String(row.magnification || ""),
    polarization:
      row.polarization === "polarized" || row.polarization === "non_polarized" || row.polarization === "both"
        ? row.polarization
        : "polarized",
    calibrationProfile: String(row.calibrationProfile || ""),
    calibrationDueAt: row.calibrationDueAt ? String(row.calibrationDueAt).slice(0, 10) : null,
    status: normalizeDeviceStatus(row.status) === "all" ? "offline" : normalizeDeviceStatus(row.status),
    lastSeenAt: row.lastSeenAt ? String(row.lastSeenAt) : null,
    bridgeId: row.bridgeId ? String(row.bridgeId) : null,
    bridge: row.bridgeCode
      ? {
          id: row.bridgeId ? String(row.bridgeId) : "",
          code: String(row.bridgeCode || ""),
          hostName: String(row.bridgeHostName || ""),
          lanStatus:
            normalizeBridgeStatus(row.bridgeLanStatus) === "all"
              ? "offline"
              : normalizeBridgeStatus(row.bridgeLanStatus),
        }
      : null,
    clinic: {
      id: String(row.clinicId || ""),
      slug: String(row.clinicSlug || ""),
      name: String(row.clinicName || ""),
    },
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

export function createDeviceRegistryRepository(dbClient) {
  return {
    async listDeviceBridges(params = {}) {
      const result = rows(await dbClient.queryJson(buildListDeviceBridgesSql(params))).map(normalizeBridge);
      return {
        source: "postgres",
        items: result,
        count: result.length,
        clinicIds: safeClinicIds(params.clinicIds),
        allClinics: Boolean(params.allClinics),
      };
    },

    async listMedicalDevices(params = {}) {
      const result = rows(await dbClient.queryJson(buildListMedicalDevicesSql(params))).map(normalizeDevice);
      return {
        source: "postgres",
        items: result,
        count: result.length,
        limit: clampInteger(params.limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT }),
        offset: clampInteger(params.offset, { fallback: 0, min: 0, max: 10_000 }),
        search: normalizeSearch(params.search),
        status: normalizeDeviceStatus(params.status),
        needsCalibration: Boolean(params.needsCalibration),
        clinicIds: safeClinicIds(params.clinicIds),
        allClinics: Boolean(params.allClinics),
      };
    },
  };
}

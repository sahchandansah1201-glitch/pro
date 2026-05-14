// Stage 4R · self-hosted Device Bridge command repository.
// Commands are persisted in PostgreSQL for a local Device Bridge worker.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function clinicScopeWhere(alias, { clinicIds = [], allClinics = false } = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function jsonLiteral(value) {
  return `${sqlLiteral(JSON.stringify(value ?? {}))}::jsonb`;
}

function nullableText(value) {
  return value ? sqlLiteral(value) : "null";
}

function nullableUuid(value) {
  return value && UUID_PATTERN.test(String(value)) ? sqlUuid(value) : "null";
}

export function buildGetBridgeForCommandSql({
  bridgeId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    b.id::text as "id",
    b.clinic_id::text as "clinicId",
    b.bridge_code as "bridgeCode",
    b.host_name as "hostName",
    b.lan_status as "lanStatus",
    b.version as "version"
  from device_bridges b
  where b.id = ${sqlUuid(bridgeId)}
    ${clinicScopeWhere("b", { clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

export function buildGetDeviceForCommandSql({
  deviceId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    d.id::text as "id",
    d.clinic_id::text as "clinicId",
    d.model as "model",
    d.serial as "serial",
    d.status as "status",
    d.bridge_id::text as "bridgeId",
    b.bridge_code as "bridgeCode",
    b.host_name as "bridgeHostName",
    b.lan_status as "bridgeLanStatus"
  from medical_devices d
  left join device_bridges b on b.id = d.bridge_id
  where d.id = ${sqlUuid(deviceId)}
    and d.deleted_at is null
    ${clinicScopeWhere("d", { clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

export function buildCreateDeviceBridgeCommandSql({
  clinicId,
  bridgeId = null,
  deviceId = null,
  commandType,
  requestedBy = null,
  reason = null,
  payload = {},
} = {}) {
  return `
with inserted as (
  insert into device_bridge_commands (
    clinic_id,
    bridge_id,
    device_id,
    command_type,
    status,
    requested_by,
    reason,
    payload_json
  )
  values (
    ${sqlUuid(clinicId)},
    ${nullableUuid(bridgeId)},
    ${nullableUuid(deviceId)},
    ${sqlLiteral(commandType)},
    'queued',
    ${nullableUuid(requestedBy)},
    ${nullableText(reason)},
    ${jsonLiteral(payload)}
  )
  returning *
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    c.id::text as "id",
    c.clinic_id::text as "clinicId",
    c.bridge_id::text as "bridgeId",
    c.device_id::text as "deviceId",
    c.command_type as "commandType",
    c.status as "status",
    c.reason as "reason",
    c.created_at as "createdAt",
    c.updated_at as "updatedAt"
  from inserted c
) result;
`.trim();
}

function normalizeBridge(row = {}) {
  return {
    id: String(row.id || ""),
    clinicId: String(row.clinicId || ""),
    bridgeCode: String(row.bridgeCode || ""),
    hostName: String(row.hostName || ""),
    lanStatus:
      row.lanStatus === "online" || row.lanStatus === "degraded" || row.lanStatus === "offline"
        ? row.lanStatus
        : "offline",
    version: String(row.version || ""),
  };
}

function normalizeDevice(row = {}) {
  return {
    id: String(row.id || ""),
    clinicId: String(row.clinicId || ""),
    model: String(row.model || ""),
    serial: String(row.serial || ""),
    status:
      row.status === "connected" || row.status === "standby" || row.status === "offline"
        ? row.status
        : "offline",
    bridgeId: row.bridgeId ? String(row.bridgeId) : null,
    bridge: row.bridgeCode
      ? {
          code: String(row.bridgeCode || ""),
          hostName: String(row.bridgeHostName || ""),
          lanStatus:
            row.bridgeLanStatus === "online" ||
            row.bridgeLanStatus === "degraded" ||
            row.bridgeLanStatus === "offline"
              ? row.bridgeLanStatus
              : "offline",
        }
      : null,
  };
}

function normalizeCommand(row = {}) {
  return {
    id: String(row.id || ""),
    clinicId: String(row.clinicId || ""),
    bridgeId: row.bridgeId ? String(row.bridgeId) : null,
    deviceId: row.deviceId ? String(row.deviceId) : null,
    commandType: String(row.commandType || ""),
    status: row.status === "queued" ? "queued" : String(row.status || "queued"),
    reason: row.reason ? String(row.reason) : null,
    createdAt: row.createdAt ? String(row.createdAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
  };
}

function first(value) {
  return Array.isArray(value) && value.length > 0 ? value[0] : null;
}

export function createDeviceBridgeCommandRepository(dbClient) {
  return {
    async getBridgeForCommand(params = {}) {
      const row = first(await dbClient.queryJson(buildGetBridgeForCommandSql(params)));
      return row ? normalizeBridge(row) : null;
    },

    async getDeviceForCommand(params = {}) {
      const row = first(await dbClient.queryJson(buildGetDeviceForCommandSql(params)));
      return row ? normalizeDevice(row) : null;
    },

    async createCommand(params = {}) {
      const row = first(await dbClient.queryJson(buildCreateDeviceBridgeCommandSql(params)));
      return row ? normalizeCommand(row) : null;
    },
  };
}

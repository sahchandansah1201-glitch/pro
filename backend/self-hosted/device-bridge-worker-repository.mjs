// Stage 4S · Device Bridge worker repository.
// Worker endpoints use PostgreSQL only; hardware access stays outside the browser.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlJson(value) {
  return `${sqlLiteral(JSON.stringify(value ?? {}))}::jsonb`;
}

function safeLimit(value, fallback = 10, max = 50) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function assertUuid(value, field) {
  if (!UUID_PATTERN.test(String(value || ""))) {
    throw new Error(`${field} must be a UUID`);
  }
  return String(value);
}

function nullableUuid(value) {
  return value && UUID_PATTERN.test(String(value)) ? sqlUuid(value) : "null";
}

function normalizeStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function buildWorkerHeartbeatSql({
  clinicId,
  bridgeCode,
  hostName,
  version,
  lanStatus = "online",
  workerStatus = "online",
  metadata = {},
} = {}) {
  const safeClinicId = assertUuid(clinicId, "clinicId");
  return `
with upserted as (
  insert into device_bridges (
    clinic_id,
    bridge_code,
    host_name,
    lan_status,
    version,
    last_heartbeat_at,
    worker_status,
    worker_last_seen_at,
    worker_version,
    worker_metadata_json,
    metadata_json
  )
  values (
    ${sqlUuid(safeClinicId)},
    ${sqlLiteral(bridgeCode)},
    ${sqlLiteral(hostName)},
    ${sqlLiteral(lanStatus)},
    ${sqlLiteral(version)},
    now(),
    ${sqlLiteral(workerStatus)},
    now(),
    ${sqlLiteral(version)},
    ${sqlJson(metadata)},
    jsonb_build_object('stage', '4S', 'source', 'device_bridge_worker')
  )
  on conflict (clinic_id, bridge_code)
  do update set
    host_name = excluded.host_name,
    lan_status = excluded.lan_status,
    version = excluded.version,
    last_heartbeat_at = now(),
    worker_status = excluded.worker_status,
    worker_last_seen_at = now(),
    worker_version = excluded.worker_version,
    worker_metadata_json = excluded.worker_metadata_json,
    updated_at = now()
  returning *
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    b.id::text as "id",
    b.clinic_id::text as "clinicId",
    b.bridge_code as "bridgeCode",
    b.host_name as "hostName",
    b.lan_status as "lanStatus",
    b.worker_status as "workerStatus",
    b.version as "version",
    b.worker_version as "workerVersion",
    b.last_heartbeat_at as "lastHeartbeatAt",
    b.worker_last_seen_at as "workerLastSeenAt"
  from upserted b
) result;
`.trim();
}

export function buildListWorkerCommandsSql({
  clinicId,
  bridgeCode,
  limit = 10,
} = {}) {
  const safeClinicId = assertUuid(clinicId, "clinicId");
  return `
with bridge as (
  select id, clinic_id, bridge_code
  from device_bridges
  where clinic_id = ${sqlUuid(safeClinicId)}
    and bridge_code = ${sqlLiteral(bridgeCode)}
  limit 1
),
target as (
  select c.id
  from device_bridge_commands c
  join bridge b on b.id = c.bridge_id
  where c.status in ('queued', 'acknowledged')
  order by c.created_at asc
  limit ${safeLimit(limit)}
  for update skip locked
),
touched as (
  update device_bridge_commands c
  set dispatched_at = coalesce(c.dispatched_at, now()),
      updated_at = now()
  from target
  where c.id = target.id
  returning c.*
)
select coalesce(jsonb_agg(row_to_json(result) order by result."createdAt"), '[]'::jsonb)::text
from (
  select
    c.id::text as "id",
    c.clinic_id::text as "clinicId",
    c.bridge_id::text as "bridgeId",
    c.device_id::text as "deviceId",
    c.command_type as "commandType",
    c.status as "status",
    c.reason as "reason",
    c.payload_json as "payload",
    c.created_at as "createdAt",
    c.dispatched_at as "dispatchedAt",
    c.acknowledged_at as "acknowledgedAt"
  from touched c
) result;
`.trim();
}

export function buildUpdateWorkerCommandStatusSql({
  clinicId,
  bridgeCode,
  commandId,
  status,
  result = {},
} = {}) {
  const safeClinicId = assertUuid(clinicId, "clinicId");
  const safeCommandId = assertUuid(commandId, "commandId");
  const safeStatus = normalizeStatus(status, ["acknowledged", "completed", "failed"], "acknowledged");
  const statusTransition =
    safeStatus === "acknowledged"
      ? "and c.status = 'queued'"
      : "and c.status in ('queued', 'acknowledged')";
  return `
with bridge as (
  select id
  from device_bridges
  where clinic_id = ${sqlUuid(safeClinicId)}
    and bridge_code = ${sqlLiteral(bridgeCode)}
  limit 1
),
updated as (
  update device_bridge_commands c
  set
    status = ${sqlLiteral(safeStatus)},
    acknowledged_at = case
      when ${sqlLiteral(safeStatus)} in ('acknowledged', 'completed', 'failed') then coalesce(c.acknowledged_at, now())
      else c.acknowledged_at
    end,
    completed_at = case
      when ${sqlLiteral(safeStatus)} in ('completed', 'failed') then now()
      else c.completed_at
    end,
    result_json = case
      when ${sqlLiteral(safeStatus)} in ('completed', 'failed') then ${sqlJson(result)}
      else c.result_json
    end,
    updated_at = now()
  from bridge b
  where c.id = ${sqlUuid(safeCommandId)}
    and c.bridge_id = b.id
    ${statusTransition}
  returning c.*
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
    c.created_at as "createdAt",
    c.dispatched_at as "dispatchedAt",
    c.acknowledged_at as "acknowledgedAt",
    c.completed_at as "completedAt"
  from updated c
) result;
`.trim();
}

function normalizeBridge(row = {}) {
  return {
    id: String(row.id || ""),
    clinicId: String(row.clinicId || ""),
    bridgeCode: String(row.bridgeCode || ""),
    hostName: String(row.hostName || ""),
    lanStatus: normalizeStatus(row.lanStatus, ["online", "degraded", "offline"], "offline"),
    workerStatus: normalizeStatus(row.workerStatus, ["unknown", "online", "degraded", "offline"], "unknown"),
    version: String(row.version || ""),
    workerVersion: String(row.workerVersion || row.version || ""),
    lastHeartbeatAt: row.lastHeartbeatAt ? String(row.lastHeartbeatAt) : null,
    workerLastSeenAt: row.workerLastSeenAt ? String(row.workerLastSeenAt) : null,
  };
}

function normalizeCommand(row = {}) {
  return {
    id: String(row.id || ""),
    clinicId: String(row.clinicId || ""),
    bridgeId: row.bridgeId ? String(row.bridgeId) : null,
    deviceId: row.deviceId ? String(row.deviceId) : null,
    commandType: String(row.commandType || ""),
    status: normalizeStatus(row.status, ["queued", "acknowledged", "completed", "failed", "cancelled"], "queued"),
    reason: row.reason ? String(row.reason) : null,
    payload: row.payload && typeof row.payload === "object" ? row.payload : {},
    createdAt: row.createdAt ? String(row.createdAt) : null,
    dispatchedAt: row.dispatchedAt ? String(row.dispatchedAt) : null,
    acknowledgedAt: row.acknowledgedAt ? String(row.acknowledgedAt) : null,
    completedAt: row.completedAt ? String(row.completedAt) : null,
  };
}

function first(value) {
  return Array.isArray(value) && value.length > 0 ? value[0] : null;
}

export function createDeviceBridgeWorkerRepository(dbClient) {
  return {
    async recordHeartbeat(params = {}) {
      const row = first(await dbClient.queryJson(buildWorkerHeartbeatSql(params)));
      return row ? normalizeBridge(row) : null;
    },

    async listCommands(params = {}) {
      const rows = await dbClient.queryJson(buildListWorkerCommandsSql(params));
      return Array.isArray(rows) ? rows.map(normalizeCommand) : [];
    },

    async updateCommandStatus(params = {}) {
      const row = first(await dbClient.queryJson(buildUpdateWorkerCommandStatusSql(params)));
      return row ? normalizeCommand(row) : null;
    },
  };
}

export const __stage4sRepositoryInternals = {
  nullableUuid,
};

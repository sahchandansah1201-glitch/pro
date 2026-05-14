// Stage 4S · Device Bridge worker repository.
// Worker endpoints use PostgreSQL only; hardware access stays outside the browser.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlUuidList(values = []) {
  return values.map((value) => sqlUuid(value)).join(", ");
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

function normalizeStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeWorkerStatus(value) {
  return normalizeStatus(value, ["unknown", "online", "degraded", "offline"], "all");
}

function normalizeCommandStatusFilter(value) {
  return normalizeStatus(value, ["queued", "acknowledged", "completed", "failed", "cancelled"], "all");
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

export function buildListWorkerTelemetrySql({
  clinicIds = [],
  allClinics = false,
  workerStatus = "all",
  commandStatus = "all",
  limit = 25,
} = {}) {
  const safeLimitValue = safeLimit(limit, 25, 100);
  const safeWorkerStatus = normalizeWorkerStatus(workerStatus);
  const safeCommandStatus = normalizeCommandStatusFilter(commandStatus);
  const workerStatusWhere = safeWorkerStatus !== "all"
    ? `and b.worker_status = ${sqlLiteral(safeWorkerStatus)}`
    : "";
  const commandStatusWhere = safeCommandStatus !== "all"
    ? `and c.status = ${sqlLiteral(safeCommandStatus)}`
    : "";
  return `
with scoped_bridges as (
  select b.*
  from device_bridges b
  where true
    ${clinicScopeWhere("b", { clinicIds, allClinics })}
    ${workerStatusWhere}
  order by b.worker_last_seen_at desc nulls last, b.updated_at desc, b.bridge_code asc
  limit ${safeLimitValue}
),
bridge_command_counts as (
  select
    c.bridge_id,
    count(*) filter (where c.status = 'queued')::int as queued_count,
    count(*) filter (where c.status = 'acknowledged')::int as acknowledged_count,
    count(*) filter (where c.status = 'completed')::int as completed_count,
    count(*) filter (where c.status = 'failed')::int as failed_count,
    max(c.updated_at) as latest_command_at
  from device_bridge_commands c
  join scoped_bridges b on b.id = c.bridge_id
  group by c.bridge_id
),
recent_commands as (
  select c.*
  from device_bridge_commands c
  join scoped_bridges b on b.id = c.bridge_id
  where true
    ${commandStatusWhere}
  order by c.created_at desc
  limit ${safeLimitValue * 5}
)
select jsonb_build_object(
  'bridges',
  coalesce((
    select jsonb_agg(row_to_json(result) order by result."workerLastSeenAt" desc nulls last, result."bridgeCode")
    from (
      select
        b.id::text as "id",
        b.clinic_id::text as "clinicId",
        c.slug as "clinicSlug",
        c.name as "clinicName",
        b.bridge_code as "bridgeCode",
        b.host_name as "hostName",
        b.lan_status as "lanStatus",
        b.worker_status as "workerStatus",
        b.version as "version",
        b.worker_version as "workerVersion",
        b.last_heartbeat_at as "lastHeartbeatAt",
        b.worker_last_seen_at as "workerLastSeenAt",
        coalesce(d.paired_count, 0)::int as "pairedCount",
        coalesce(counts.queued_count, 0)::int as "queuedCount",
        coalesce(counts.acknowledged_count, 0)::int as "acknowledgedCount",
        coalesce(counts.completed_count, 0)::int as "completedCount",
        coalesce(counts.failed_count, 0)::int as "failedCount",
        counts.latest_command_at as "latestCommandAt"
      from scoped_bridges b
      join clinics c on c.id = b.clinic_id
      left join bridge_command_counts counts on counts.bridge_id = b.id
      left join lateral (
        select count(*)::int as paired_count
        from medical_devices md
        where md.bridge_id = b.id and md.deleted_at is null
      ) d on true
    ) result
  ), '[]'::jsonb),
  'commands',
  coalesce((
    select jsonb_agg(row_to_json(result) order by result."createdAt" desc)
    from (
      select
        c.id::text as "id",
        c.clinic_id::text as "clinicId",
        c.bridge_id::text as "bridgeId",
        c.device_id::text as "deviceId",
        b.bridge_code as "bridgeCode",
        d.serial as "deviceSerial",
        c.command_type as "commandType",
        c.status as "status",
        c.reason as "reason",
        c.created_at as "createdAt",
        c.dispatched_at as "dispatchedAt",
        c.acknowledged_at as "acknowledgedAt",
        c.completed_at as "completedAt",
        c.updated_at as "updatedAt"
      from recent_commands c
      left join device_bridges b on b.id = c.bridge_id
      left join medical_devices d on d.id = c.device_id
    ) result
  ), '[]'::jsonb)
)::text;
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

function normalizeTelemetryBridge(row = {}) {
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
    pairedCount: Number(row.pairedCount || 0),
    queuedCount: Number(row.queuedCount || 0),
    acknowledgedCount: Number(row.acknowledgedCount || 0),
    completedCount: Number(row.completedCount || 0),
    failedCount: Number(row.failedCount || 0),
    latestCommandAt: row.latestCommandAt ? String(row.latestCommandAt) : null,
    clinic: {
      id: String(row.clinicId || ""),
      slug: String(row.clinicSlug || ""),
      name: String(row.clinicName || ""),
    },
  };
}

function normalizeTelemetryCommand(row = {}) {
  return {
    id: String(row.id || ""),
    clinicId: String(row.clinicId || ""),
    bridgeId: row.bridgeId ? String(row.bridgeId) : null,
    deviceId: row.deviceId ? String(row.deviceId) : null,
    bridgeCode: row.bridgeCode ? String(row.bridgeCode) : null,
    deviceSerial: row.deviceSerial ? String(row.deviceSerial) : null,
    commandType: String(row.commandType || ""),
    status: normalizeStatus(row.status, ["queued", "acknowledged", "completed", "failed", "cancelled"], "queued"),
    reason: row.reason ? String(row.reason) : null,
    createdAt: row.createdAt ? String(row.createdAt) : null,
    dispatchedAt: row.dispatchedAt ? String(row.dispatchedAt) : null,
    acknowledgedAt: row.acknowledgedAt ? String(row.acknowledgedAt) : null,
    completedAt: row.completedAt ? String(row.completedAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
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

    async listWorkerTelemetry(params = {}) {
      const rows = await dbClient.queryJson(buildListWorkerTelemetrySql(params));
      const payload = Array.isArray(rows) ? first(rows) || {} : rows || {};
      const bridges = Array.isArray(payload.bridges)
        ? payload.bridges.map(normalizeTelemetryBridge)
        : [];
      const commands = Array.isArray(payload.commands)
        ? payload.commands.map(normalizeTelemetryCommand)
        : [];
      return {
        source: "postgres",
        bridges,
        commands,
        summary: {
          bridgeCount: bridges.length,
          onlineWorkers: bridges.filter((item) => item.workerStatus === "online").length,
          degradedWorkers: bridges.filter((item) => item.workerStatus === "degraded").length,
          offlineWorkers: bridges.filter((item) => item.workerStatus === "offline").length,
          queuedCommands: bridges.reduce((sum, item) => sum + item.queuedCount, 0),
          failedCommands: bridges.reduce((sum, item) => sum + item.failedCount, 0),
        },
        filters: {
          workerStatus: normalizeWorkerStatus(params.workerStatus),
          commandStatus: normalizeCommandStatusFilter(params.commandStatus),
          limit: safeLimit(params.limit, 25, 100),
        },
        clinicIds: safeClinicIds(params.clinicIds),
        allClinics: Boolean(params.allClinics),
      };
    },
  };
}

export const __stage4sRepositoryInternals = {
  nullableUuid,
};

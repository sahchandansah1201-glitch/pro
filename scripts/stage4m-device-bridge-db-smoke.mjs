#!/usr/bin/env node
// Stage 4M · Device bridge registry database smoke.
// Exercises the system admin device registry and worker telemetry SQL against
// PostgreSQL inside one transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildCreateDeviceBridgeCommandSql,
  buildGetBridgeForCommandSql,
  buildGetDeviceForCommandSql,
} from "../backend/self-hosted/device-bridge-command-repository.mjs";
import {
  buildListDeviceBridgesSql,
  buildListMedicalDevicesSql,
} from "../backend/self-hosted/device-registry-repository.mjs";
import {
  buildListWorkerCommandAuditSql,
  buildListWorkerHardeningSql,
  buildListWorkerRecoverySql,
  buildListWorkerTelemetrySql,
} from "../backend/self-hosted/device-bridge-worker-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];

const CLINIC_ID = "10000000-0000-4000-8000-000000000741";
const SYSTEM_ADMIN_ID = "10000000-0000-4000-8000-000000000742";
const BRIDGE_ID = "10000000-0000-4000-8000-000000000743";
const DEVICE_ID = "10000000-0000-4000-8000-000000000744";

function redact(value) {
  return String(value || "")
    .replace(/postgres:\/\/([^:]+):([^@]+)@/g, "postgres://$1:[redacted]@")
    .replace(/(POSTGRES_PASSWORD|JWT_SECRET|MINIO_ROOT_PASSWORD)=([^\s]+)/g, "$1=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]");
}

function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function withoutTrailingSemicolon(sql) {
  return String(sql || "").trim().replace(/;+$/, "");
}

function safeSmokeSuffix(value = new Date().toISOString()) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "manual";
}

function dockerComposeArgs(config, args) {
  const result = ["compose", "--env-file", config.composeEnvFile];
  for (const file of config.composeFiles) result.push("-f", file);
  return [...result, "-p", config.projectName, ...args];
}

export function parseStage4MDeviceBridgeDbSmokeArgs(argv = []) {
  const parsed = {
    command: argv[0] || "help",
    dryRun: false,
    projectName: DEFAULT_PROJECT_NAME,
    composeEnvFile: DEFAULT_COMPOSE_ENV_FILE,
    composeFiles: [...DEFAULT_COMPOSE_FILES],
    suffix: safeSmokeSuffix(),
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--project-name") {
      parsed.projectName = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--project-name=")) {
      parsed.projectName = arg.slice("--project-name=".length).trim();
      continue;
    }
    if (arg === "--compose-env-file") {
      parsed.composeEnvFile = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--compose-env-file=")) {
      parsed.composeEnvFile = arg.slice("--compose-env-file=".length).trim();
      continue;
    }
    if (arg === "--compose-file") {
      const value = String(argv[++index] || "").trim();
      parsed.composeFiles = parsed.composeFiles.length === DEFAULT_COMPOSE_FILES.length &&
        parsed.composeFiles.every((file, fileIndex) => file === DEFAULT_COMPOSE_FILES[fileIndex])
        ? [value]
        : [...parsed.composeFiles, value];
      continue;
    }
    if (arg.startsWith("--compose-file=")) {
      const value = arg.slice("--compose-file=".length).trim();
      parsed.composeFiles = parsed.composeFiles.length === DEFAULT_COMPOSE_FILES.length &&
        parsed.composeFiles.every((file, fileIndex) => file === DEFAULT_COMPOSE_FILES[fileIndex])
        ? [value]
        : [...parsed.composeFiles, value];
      continue;
    }
    if (arg === "--suffix") {
      parsed.suffix = safeSmokeSuffix(argv[++index]);
      continue;
    }
    if (arg.startsWith("--suffix=")) {
      parsed.suffix = safeSmokeSuffix(arg.slice("--suffix=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["help", "verify"].includes(parsed.command)) {
    throw new Error(`Unknown device bridge database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function buildStage4MDeviceBridgeDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicSlug = `stage4m-device-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const bridgeCode = `stage4m-bridge-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const deviceSerial = `STAGE4M-DEVICE-${safeSuffix}`.toUpperCase().slice(0, 80).replace(/-+$/g, "");
  const commandReason = `Stage 4M device bridge smoke ${safeSuffix}`;
  const clinicIds = [CLINIC_ID];
  const listBridgesSql = withoutTrailingSemicolon(buildListDeviceBridgesSql({
    clinicIds,
    bridgeStatus: "online",
  }));
  const listDevicesSql = withoutTrailingSemicolon(buildListMedicalDevicesSql({
    clinicIds,
    limit: 10,
    search: deviceSerial,
    status: "connected",
  }));
  const getBridgeSql = withoutTrailingSemicolon(buildGetBridgeForCommandSql({
    bridgeId: BRIDGE_ID,
    clinicIds,
  }));
  const getDeviceSql = withoutTrailingSemicolon(buildGetDeviceForCommandSql({
    deviceId: DEVICE_ID,
    clinicIds,
  }));
  const createCommandSql = withoutTrailingSemicolon(buildCreateDeviceBridgeCommandSql({
    clinicId: CLINIC_ID,
    bridgeId: BRIDGE_ID,
    deviceId: DEVICE_ID,
    commandType: "device_calibration_request",
    requestedBy: SYSTEM_ADMIN_ID,
    reason: commandReason,
    payload: {
      profile: "stage4m-smoke",
      visibility: "worker-only",
    },
  }));
  const telemetrySql = withoutTrailingSemicolon(buildListWorkerTelemetrySql({
    clinicIds,
    workerStatus: "online",
    commandStatus: "queued",
    limit: 10,
  }));
  const hardeningSql = withoutTrailingSemicolon(buildListWorkerHardeningSql({
    clinicIds,
    staleAfterMinutes: 10,
    retentionDays: 30,
    limit: 10,
  }));
  const recoverySql = withoutTrailingSemicolon(buildListWorkerRecoverySql({
    clinicIds,
    staleAfterMinutes: 10,
    leaseTtlSeconds: 90,
    limit: 10,
  }));
  const auditSql = withoutTrailingSemicolon(buildListWorkerCommandAuditSql({
    clinicIds,
    action: "reschedule",
    status: "queued",
    limit: 10,
  }));

  return `
begin;

do $stage4m_device_bridge_db_smoke$
declare
  payload text;
  command_payload text;
  command_id uuid;
begin
  insert into clinics (id, slug, name, timezone, address)
  values (${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(clinicSlug)}, 'Stage 4M device smoke clinic', 'Europe/Moscow', 'Stage 4M device smoke address');

  insert into app_users (id, email, display_name)
  values (${sqlLiteral(SYSTEM_ADMIN_ID)}::uuid, ${sqlLiteral(`stage4m-device-${safeSuffix}@example.invalid`)}, 'Stage 4M device smoke admin');

  insert into user_roles (user_id, clinic_id, role)
  values (${sqlLiteral(SYSTEM_ADMIN_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, 'system_admin'::app_role);

  insert into device_bridges (
    id,
    clinic_id,
    bridge_code,
    host_name,
    lan_status,
    version,
    last_heartbeat_at,
    worker_status,
    worker_last_seen_at,
    worker_version,
    worker_metadata_json
  )
  values (
    ${sqlLiteral(BRIDGE_ID)}::uuid,
    ${sqlLiteral(CLINIC_ID)}::uuid,
    ${sqlLiteral(bridgeCode)},
    'stage4m-hidden-host',
    'online',
    'stage4m',
    now(),
    'online',
    now(),
    'stage4m-worker',
    '{"safeSummary":"stage4m"}'::jsonb
  );

  insert into medical_devices (
    id,
    clinic_id,
    bridge_id,
    model,
    serial,
    firmware,
    magnification,
    polarization,
    calibration_profile,
    calibration_due_at,
    status,
    last_seen_at
  )
  values (
    ${sqlLiteral(DEVICE_ID)}::uuid,
    ${sqlLiteral(CLINIC_ID)}::uuid,
    ${sqlLiteral(BRIDGE_ID)}::uuid,
    'Stage 4M dermatoscope',
    ${sqlLiteral(deviceSerial)},
    '1.0.0',
    '10x',
    'both',
    'stage4m-profile',
    current_date + interval '30 days',
    'connected',
    now()
  );

  execute $sql$${listBridgesSql}$sql$ into payload;
  if payload is null
    or position(${sqlLiteral(bridgeCode)} in payload) = 0
    or (payload::jsonb->0->>'pairedCount') is distinct from '1' then
    raise exception 'device bridge registry did not return the fixture bridge';
  end if;

  execute $sql$${listDevicesSql}$sql$ into payload;
  if payload is null
    or position(${sqlLiteral(deviceSerial)} in payload) = 0
    or (payload::jsonb->0->>'status') is distinct from 'connected' then
    raise exception 'device registry did not return the fixture device';
  end if;

  execute $sql$${getBridgeSql}$sql$ into payload;
  if payload is null or position(${sqlLiteral(bridgeCode)} in payload) = 0 then
    raise exception 'device bridge command lookup did not return fixture bridge';
  end if;

  execute $sql$${getDeviceSql}$sql$ into payload;
  if payload is null or position(${sqlLiteral(deviceSerial)} in payload) = 0 then
    raise exception 'device bridge command lookup did not return fixture device';
  end if;

  execute $sql$${createCommandSql}$sql$ into command_payload;
  if command_payload is null
    or (command_payload::jsonb->0->>'status') is distinct from 'queued'
    or position(${sqlLiteral(commandReason)} in command_payload) = 0
    or position('payload_json' in command_payload) > 0
    or position('worker-only' in command_payload) > 0 then
    raise exception 'device bridge command create did not return queued command';
  end if;

  select id into command_id
  from device_bridge_commands
  where clinic_id = ${sqlLiteral(CLINIC_ID)}::uuid
    and bridge_id = ${sqlLiteral(BRIDGE_ID)}::uuid
    and device_id = ${sqlLiteral(DEVICE_ID)}::uuid
    and reason = ${sqlLiteral(commandReason)}
  order by created_at desc
  limit 1;

  insert into audit_log (
    clinic_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    correlation_id,
    metadata_json
  )
  values (
    ${sqlLiteral(CLINIC_ID)}::uuid,
    ${sqlLiteral(SYSTEM_ADMIN_ID)}::uuid,
    'device_bridge.command.reschedule',
    'device_bridge_command',
    command_id,
    'stage4m-device-smoke',
    '{"safe":"summary"}'::jsonb
  );

  execute $sql$${telemetrySql}$sql$ into payload;
  if payload is null
    or jsonb_array_length(payload::jsonb->'bridges') <> 1
    or jsonb_array_length(payload::jsonb->'commands') <> 1
    or payload::jsonb->'bridges'->0->>'bridgeCode' is distinct from ${sqlLiteral(bridgeCode)}
    or payload::jsonb->'commands'->0->>'status' is distinct from 'queued'
    or position('worker-only' in payload) > 0 then
    raise exception 'device bridge worker telemetry did not return safe summary';
  end if;

  execute $sql$${hardeningSql}$sql$ into payload;
  if payload is null
    or payload::jsonb->'summary'->>'staleWorkers' is distinct from '0'
    or payload::jsonb->'policy'->>'pollBackoff' is distinct from 'linear-capped' then
    raise exception 'device bridge worker hardening did not return policy summary';
  end if;

  execute $sql$${recoverySql}$sql$ into payload;
  if payload is null
    or payload::jsonb->'summary'->>'cancellableCommands' is distinct from '1'
    or payload::jsonb->'policy'->>'maxRecoveryBatch' is distinct from '100' then
    raise exception 'device bridge worker recovery did not return actionable queue summary';
  end if;

  execute $sql$${auditSql}$sql$ into payload;
  if payload is null
    or payload::jsonb->'summary'->>'recoveryEvents' is distinct from '1'
    or payload::jsonb->'policy'->>'payloadVisibility' is distinct from 'backend-only' then
    raise exception 'device bridge worker audit did not return metadata-only summary';
  end if;
end
$stage4m_device_bridge_db_smoke$;

select 'stage4m_device_bridge_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MDeviceBridgeDbSmokePlan(options = {}) {
  const config = { ...parseStage4MDeviceBridgeDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-device-bridge-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: device registry, command queue, worker telemetry, recovery, and audit SQL against PostgreSQL",
    "- Safety: wrapped in one transaction and rolled back; no credentials, raw command payloads, storage paths, signed URLs, tokens, or patient data are printed",
  ].join("\n");
}

function runPsql(config, { input, label, spawn = spawnSync } = {}) {
  const result = spawn("docker", dockerComposeArgs(config, [
    "exec",
    "-T",
    "postgres",
    "psql",
    "--no-psqlrc",
    "--quiet",
    "--set",
    "ON_ERROR_STOP=1",
    "-U",
    "dermatolog",
    "-d",
    "dermatolog_pro",
  ]), {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const detail = redact(result.stderr || result.stdout || result.error?.message || `exit ${result.status}`);
    throw new Error(`${label} failed: ${detail.trim() || "psql command failed"}`);
  }
  return result;
}

export function runStage4MDeviceBridgeDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MDeviceBridgeDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) {
    return { ok: true, dryRun: true, output: renderStage4MDeviceBridgeDbSmokePlan(config) };
  }
  if (config.command === "help") {
    return { ok: true, dryRun: true, output: usage() };
  }
  const sql = buildStage4MDeviceBridgeDbSmokeSql({ suffix: config.suffix });
  const result = runPsql(config, {
    label: "Device bridge registry database smoke",
    input: sql,
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_device_bridge_db_smoke_ok")) {
    throw new Error("Device bridge registry database smoke did not return its OK marker.");
  }
  console.log("[stage4m-device-bridge-db-smoke] verified device registry and worker telemetry journey against PostgreSQL");
  return { ok: true, dryRun: false };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-device-bridge-db-smoke.mjs verify",
    "  node scripts/stage4m-device-bridge-db-smoke.mjs verify --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MDeviceBridgeDbSmokeArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MDeviceBridgeDbSmoke(options);
    if (result.output) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(redact(error?.message || String(error)));
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

#!/usr/bin/env node
// Stage 4M · Self-hosted schema migrations for an existing production database.
// Docker's /docker-entrypoint-initdb.d only runs on a new PostgreSQL volume; this
// runner applies the idempotent admin-management migrations during updates.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];

export const STAGE4M_SELF_HOSTED_SCHEMA_MIGRATIONS = [
  "backend/self-hosted/db/migrations/0008_stage4q_device_registry.sql",
  "backend/self-hosted/db/migrations/0009_stage4r_device_bridge_commands.sql",
  "backend/self-hosted/db/migrations/0010_stage4s_device_bridge_worker_contract.sql",
  "backend/self-hosted/db/migrations/0011_stage4v_device_bridge_production_hardening.sql",
  "backend/self-hosted/db/migrations/0012_stage4w_device_bridge_command_safety.sql",
  "backend/self-hosted/db/migrations/0013_stage4x_device_bridge_audit_replay.sql",
  "backend/self-hosted/db/migrations/0015_stage5k_leads_appointments_contract.sql",
  "backend/self-hosted/db/migrations/0016_stage5l_leads_appointments_write_contract.sql",
  "backend/self-hosted/db/migrations/0089_stage6_device_bridge_existing_volume_repair.sql",
  "backend/self-hosted/db/migrations/0086_stage6_admin_management.sql",
  "backend/self-hosted/db/migrations/0087_stage6_clinic_address.sql",
  "backend/self-hosted/db/migrations/0088_stage6_admin_lifecycle.sql",
  "backend/self-hosted/db/migrations/0090_stage6_service_keys.sql",
];

const VERIFY_STAGE6_ADMIN_SCHEMA_SQL = `
select json_build_object(
  'privateDoctorRole', exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'app_role'
      and e.enumlabel = 'private_doctor'
  ),
  'clinicAddressColumn', exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinics'
      and column_name = 'address'
  ),
  'clinicStatusColumn', exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinics'
      and column_name = 'status'
  ),
  'clinicDeletedAtColumn', exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinics'
      and column_name = 'deleted_at'
  ),
  'userRoleDisabledAtColumn', exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_roles'
      and column_name = 'disabled_at'
  ),
  'serviceApiKeysTable', exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'service_api_keys'
  ),
  'deviceBridgesTable', exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'device_bridges'
  ),
  'medicalDevicesTable', exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'medical_devices'
  ),
  'deviceBridgeCommandsTable', exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'device_bridge_commands'
  ),
  'deviceBridgeWorkerColumns', (
    select count(*) = 4
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'device_bridges'
      and column_name in ('worker_status', 'worker_last_seen_at', 'worker_version', 'worker_metadata_json')
  ),
  'deviceBridgeCommandLifecycleColumns', (
    select count(*) = 21
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'device_bridge_commands'
      and column_name in (
        'dispatched_at',
        'acknowledged_at',
        'completed_at',
        'idempotency_key',
        'attempt_count',
        'lifecycle_revision',
        'last_polled_at',
        'next_attempt_at',
        'expires_at',
        'cleanup_after',
        'last_worker_error',
        'lease_owner',
        'lease_expires_at',
        'recovery_action',
        'recovery_reason',
        'recovery_requested_at',
        'recovered_by',
        'replay_of_command_id',
        'replay_requested_at',
        'replay_requested_by',
        'replay_policy'
      )
  ),
  'leadsTable', exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'leads'
  ),
  'leadsRequiredColumns', (
    select count(*) = 10
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name in (
        'id',
        'clinic_id',
        'patient_id',
        'source',
        'status',
        'safe_summary',
        'created_by',
        'created_at',
        'updated_at',
        'deleted_at'
      )
  )
)::text;
`.trim();

function redact(value) {
  return String(value || "")
    .replace(/postgres:\/\/([^:]+):([^@]+)@/g, "postgres://$1:[redacted]@")
    .replace(/(POSTGRES_PASSWORD|JWT_SECRET|MINIO_ROOT_PASSWORD)=([^\s]+)/g, "$1=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]");
}

function dockerComposeArgs(config, args) {
  const result = ["compose", "--env-file", config.composeEnvFile];
  for (const file of config.composeFiles) result.push("-f", file);
  return [...result, "-p", config.projectName, ...args];
}

function parseJsonLine(value, label) {
  try {
    return JSON.parse(String(value || "").trim() || "{}");
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

export function parseStage4MSchemaMigrationArgs(argv = []) {
  const parsed = {
    command: argv[0] || "help",
    dryRun: false,
    projectName: DEFAULT_PROJECT_NAME,
    composeEnvFile: DEFAULT_COMPOSE_ENV_FILE,
    composeFiles: [...DEFAULT_COMPOSE_FILES],
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
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["help", "apply", "verify"].includes(parsed.command)) {
    throw new Error(`Unknown schema migration command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function renderStage4MSchemaMigrationPlan(options = {}) {
  const config = { ...parseStage4MSchemaMigrationArgs(["apply"]), ...options };
  return [
    "[stage4m-schema] apply plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Migrations:",
    ...STAGE4M_SELF_HOSTED_SCHEMA_MIGRATIONS.map((file) => `  - ${file}`),
    "- Verification: Device Bridge tables/worker/command columns, leads table/write columns, private_doctor role, clinics.address/status/deleted_at columns, user_roles.disabled_at column, and service_api_keys table",
    "",
    "No raw tokens, passwords, patient names, object keys, or storage paths are printed.",
  ].join("\n");
}

function runPsql(config, { input = "", commandSql = "", label, spawn = spawnSync } = {}) {
  const psqlArgs = [
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
  ];
  if (commandSql) {
    psqlArgs.push("--tuples-only", "--no-align", "--command", commandSql);
  }
  const result = spawn("docker", dockerComposeArgs(config, psqlArgs), {
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

export function verifyStage6AdminSchema(config, io = {}) {
  const result = runPsql(config, {
    label: "Verify Stage 6 admin schema",
    commandSql: VERIFY_STAGE6_ADMIN_SCHEMA_SQL,
    spawn: io.spawn || spawnSync,
  });
  const verification = parseJsonLine(result.stdout, "Stage 6 admin schema verification");
  const missing = [];
  if (verification.privateDoctorRole !== true) missing.push("private_doctor role");
  if (verification.clinicAddressColumn !== true) missing.push("clinics.address column");
  if (verification.clinicStatusColumn !== true) missing.push("clinics.status column");
  if (verification.clinicDeletedAtColumn !== true) missing.push("clinics.deleted_at column");
  if (verification.userRoleDisabledAtColumn !== true) missing.push("user_roles.disabled_at column");
  if (verification.serviceApiKeysTable !== true) missing.push("service_api_keys table");
  if (verification.deviceBridgesTable !== true) missing.push("device_bridges table");
  if (verification.medicalDevicesTable !== true) missing.push("medical_devices table");
  if (verification.deviceBridgeCommandsTable !== true) missing.push("device_bridge_commands table");
  if (verification.deviceBridgeWorkerColumns !== true) missing.push("device_bridges worker columns");
  if (verification.deviceBridgeCommandLifecycleColumns !== true) {
    missing.push("device_bridge_commands lifecycle columns");
  }
  if (verification.leadsTable !== true) missing.push("leads table");
  if (verification.leadsRequiredColumns !== true) missing.push("leads write columns");
  if (missing.length) {
    throw new Error(`Self-hosted production schema is incomplete: ${missing.join(", ")}.`);
  }
  return verification;
}

export function runStage4MSelfHostedSchemaMigrations(options = {}, io = {}) {
  const config = { ...parseStage4MSchemaMigrationArgs(["apply"]), ...options };
  if (config.dryRun) {
    return { ok: true, dryRun: true, output: renderStage4MSchemaMigrationPlan(config), applied: [] };
  }

  if (config.command === "help") {
    return { ok: true, dryRun: true, output: usage(), applied: [] };
  }

  const applied = [];
  if (config.command === "apply") {
    for (const file of STAGE4M_SELF_HOSTED_SCHEMA_MIGRATIONS) {
      if (!existsSync(file)) throw new Error(`Migration file not found: ${file}`);
      runPsql(config, {
        label: `Apply ${basename(file)}`,
        input: readFileSync(file, "utf8"),
        spawn: io.spawn || spawnSync,
      });
      applied.push(file);
      console.log(`[stage4m-schema] applied ${basename(file)}`);
    }
  }

  const verification = verifyStage6AdminSchema(config, io);
  console.log("[stage4m-schema] verified Stage 6 admin schema");
  return { ok: true, dryRun: false, applied, verification };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-self-hosted-schema-migrations.mjs apply",
    "  node scripts/stage4m-self-hosted-schema-migrations.mjs verify",
    "  node scripts/stage4m-self-hosted-schema-migrations.mjs apply --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MSchemaMigrationArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MSelfHostedSchemaMigrations(options);
    if (result.dryRun) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(`[stage4m-schema] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

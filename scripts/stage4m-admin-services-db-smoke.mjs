#!/usr/bin/env node
// Stage 4M · Admin services database smoke.
// Exercises clinic service list/create/update SQL against PostgreSQL inside a
// transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildCreateClinicServiceSql,
  buildCreateClinicSql,
  buildListClinicServicesSql,
  buildUpdateClinicServiceSql,
} from "../backend/self-hosted/admin-management-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];
const CLINIC_ID_PLACEHOLDER = "11111111-1111-4111-8111-111111111111";
const SERVICE_ID_PLACEHOLDER = "22222222-2222-4222-8222-222222222222";

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

export function parseStage4MAdminServicesDbSmokeArgs(argv = []) {
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
    throw new Error(`Unknown admin services database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function buildStage4MAdminServicesDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicName = `Stage 4M services clinic ${safeSuffix}`;
  const clinicAddress = `Stage 4M services address ${safeSuffix}`;
  const clinicSlug = `stage4m-services-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const serviceName = `Stage 4M service ${safeSuffix}`;
  const updatedServiceName = `Stage 4M service updated ${safeSuffix}`;
  const createClinicSql = withoutTrailingSemicolon(buildCreateClinicSql({
    name: clinicName,
    address: clinicAddress,
    slug: clinicSlug,
    timezone: "Europe/Moscow",
  }));
  const createServiceSql = withoutTrailingSemicolon(buildCreateClinicServiceSql({
    clinicId: CLINIC_ID_PLACEHOLDER,
    name: serviceName,
    category: "consult",
    durationMin: 30,
    priceMin: 2500,
    priceMax: 3500,
    consentNote: "Согласие на приём",
    onlineBooking: false,
    active: true,
  }));
  const listServiceSql = withoutTrailingSemicolon(buildListClinicServicesSql({
    allClinics: true,
    search: serviceName,
    limit: 5,
  }));
  const updateServiceSql = withoutTrailingSemicolon(buildUpdateClinicServiceSql({
    serviceId: SERVICE_ID_PLACEHOLDER,
    clinicId: CLINIC_ID_PLACEHOLDER,
    name: updatedServiceName,
    category: "consult",
    durationMin: 45,
    priceMin: 3000,
    priceMax: 4000,
    consentNote: "Согласие на приём",
    onlineBooking: true,
    active: true,
  }));

  return `
begin;

do $stage4m_admin_services_db_smoke$
declare
  payload text;
  created_clinic_id text;
  created_service_id text;
begin
  execute $sql$${createClinicSql}$sql$ into payload;
  select id::text into created_clinic_id from clinics where slug = ${sqlLiteral(clinicSlug)};
  if created_clinic_id is null then
    raise exception 'admin services smoke clinic was not created';
  end if;

  execute replace($sql$${createServiceSql}$sql$, ${sqlLiteral(CLINIC_ID_PLACEHOLDER)}, created_clinic_id) into payload;
  if payload is null or position(${sqlLiteral(serviceName)} in payload) = 0 then
    raise exception 'admin service create did not return the created service';
  end if;

  select id::text into created_service_id
  from clinic_services
  where clinic_id = created_clinic_id::uuid
    and name = ${sqlLiteral(serviceName)}
    and deleted_at is null;
  if created_service_id is null then
    raise exception 'admin service create did not persist the service row';
  end if;

  execute $sql$${listServiceSql}$sql$ into payload;
  if payload is null or position(${sqlLiteral(serviceName)} in payload) = 0 then
    raise exception 'admin service list did not include the created service';
  end if;

  execute replace(
    replace($sql$${updateServiceSql}$sql$, ${sqlLiteral(SERVICE_ID_PLACEHOLDER)}, created_service_id),
    ${sqlLiteral(CLINIC_ID_PLACEHOLDER)},
    created_clinic_id
  ) into payload;
  if payload is null or position(${sqlLiteral(updatedServiceName)} in payload) = 0 or position('"onlineBooking":true' in payload) = 0 then
    raise exception 'admin service update did not return updated service fields';
  end if;

  if not exists (
    select 1
    from clinic_services
    where id = created_service_id::uuid
      and name = ${sqlLiteral(updatedServiceName)}
      and duration_min = 45
      and online_booking is true
  ) then
    raise exception 'admin service update did not persist editable fields';
  end if;
end
$stage4m_admin_services_db_smoke$;

select 'stage4m_admin_services_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MAdminServicesDbSmokePlan(options = {}) {
  const config = { ...parseStage4MAdminServicesDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-admin-services-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: clinic service create, list visibility, edit persistence",
    "- Safety: wrapped in one transaction and rolled back; no patient rows, credentials, tokens, storage paths, or signed URLs are printed",
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

export function runStage4MAdminServicesDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MAdminServicesDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) return { ok: true, dryRun: true, output: renderStage4MAdminServicesDbSmokePlan(config) };
  if (config.command === "help") return { ok: true, dryRun: true, output: usage() };

  const result = runPsql(config, {
    input: buildStage4MAdminServicesDbSmokeSql({ suffix: config.suffix }),
    label: "Stage 4M admin services DB smoke",
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_admin_services_db_smoke_ok")) {
    throw new Error("Stage 4M admin services DB smoke did not return its OK marker.");
  }
  console.log("[stage4m-admin-services-db-smoke] verified admin service create/list/edit journey against PostgreSQL");
  return { ok: true, dryRun: false, output: redact(result.stdout || "") };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-admin-services-db-smoke.mjs verify",
    "  node scripts/stage4m-admin-services-db-smoke.mjs verify --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MAdminServicesDbSmokeArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MAdminServicesDbSmoke(options);
    if (result.dryRun) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(`[stage4m-admin-services-db-smoke] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

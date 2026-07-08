#!/usr/bin/env node
// Stage 4M · Admin integrations and bot settings database smoke.
// Exercises integration create/list/update/check and bot settings save/dry-run
// SQL against PostgreSQL inside a transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildCreateClinicIntegrationSql,
  buildCreateClinicSql,
  buildListClinicBotSettingsSql,
  buildListClinicIntegrationsSql,
  buildUpdateClinicIntegrationSql,
  buildUpsertClinicBotSettingsSql,
} from "../backend/self-hosted/admin-management-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];
const CLINIC_ID_PLACEHOLDER = "11111111-1111-4111-8111-111111111111";
const INTEGRATION_ID_PLACEHOLDER = "22222222-2222-4222-8222-222222222222";

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

export function parseStage4MAdminIntegrationsBotDbSmokeArgs(argv = []) {
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
    throw new Error(`Unknown admin integrations and bot database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function buildStage4MAdminIntegrationsBotDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicName = `Stage 4M integrations clinic ${safeSuffix}`;
  const clinicSlug = `stage4m-integrations-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const provider = `Stage 4M CRM ${safeSuffix}`;
  const updatedProvider = `Stage 4M CRM checked ${safeSuffix}`;
  const createClinicSql = withoutTrailingSemicolon(buildCreateClinicSql({
    name: clinicName,
    address: `Stage 4M integrations address ${safeSuffix}`,
    slug: clinicSlug,
    timezone: "Europe/Moscow",
  }));
  const createIntegrationSql = withoutTrailingSemicolon(buildCreateClinicIntegrationSql({
    clinicId: CLINIC_ID_PLACEHOLDER,
    provider,
    kind: "crm",
    status: "draft",
    safeSummaryEnabled: true,
    protectedLinkEnabled: true,
    fieldMap: { source: "Источник обращения", service: "Услуга" },
  }));
  const listIntegrationSql = withoutTrailingSemicolon(buildListClinicIntegrationsSql({
    allClinics: true,
    search: provider,
    limit: 5,
  }));
  const updateIntegrationSql = withoutTrailingSemicolon(buildUpdateClinicIntegrationSql({
    integrationId: INTEGRATION_ID_PLACEHOLDER,
    clinicId: CLINIC_ID_PLACEHOLDER,
    provider: updatedProvider,
    status: "connected",
    markChecked: true,
  }));
  const listBotSql = withoutTrailingSemicolon(buildListClinicBotSettingsSql({ allClinics: true }));
  const saveBotSql = withoutTrailingSemicolon(buildUpsertClinicBotSettingsSql({
    clinicId: CLINIC_ID_PLACEHOLDER,
    enabled: true,
    intakeSteps: { consent: true, location: true, timeline: true, photo: true, booking: true },
    templates: { greeting: "Здравствуйте", bookingText: "Выберите время" },
  }));
  const dryRunBotSql = withoutTrailingSemicolon(buildUpsertClinicBotSettingsSql({
    clinicId: CLINIC_ID_PLACEHOLDER,
    enabled: true,
    intakeSteps: { consent: true, location: true, timeline: true, photo: true, booking: true },
    templates: { greeting: "Здравствуйте", bookingText: "Выберите время" },
    markDryRun: true,
  }));

  return `
begin;

do $stage4m_admin_integrations_bot_db_smoke$
declare
  payload text;
  created_clinic_id text;
  created_integration_id text;
begin
  execute $sql$${createClinicSql}$sql$ into payload;
  select id::text into created_clinic_id from clinics where slug = ${sqlLiteral(clinicSlug)};
  if created_clinic_id is null then
    raise exception 'admin integrations smoke clinic was not created';
  end if;

  execute replace($sql$${createIntegrationSql}$sql$, ${sqlLiteral(CLINIC_ID_PLACEHOLDER)}, created_clinic_id) into payload;
  if payload is null or position(${sqlLiteral(provider)} in payload) = 0 then
    raise exception 'admin integration create did not return the created integration';
  end if;

  select id::text into created_integration_id
  from clinic_integrations
  where clinic_id = created_clinic_id::uuid
    and provider = ${sqlLiteral(provider)}
    and deleted_at is null;
  if created_integration_id is null then
    raise exception 'admin integration create did not persist the integration row';
  end if;

  execute $sql$${listIntegrationSql}$sql$ into payload;
  if payload is null or position(${sqlLiteral(provider)} in payload) = 0 then
    raise exception 'admin integration list did not include the created integration';
  end if;

  execute replace(
    replace($sql$${updateIntegrationSql}$sql$, ${sqlLiteral(INTEGRATION_ID_PLACEHOLDER)}, created_integration_id),
    ${sqlLiteral(CLINIC_ID_PLACEHOLDER)},
    created_clinic_id
  ) into payload;
  if payload is null or position(${sqlLiteral(updatedProvider)} in payload) = 0 or position('"status":"connected"' in payload) = 0 then
    raise exception 'admin integration update/check did not return updated fields';
  end if;

  execute $sql$${listBotSql}$sql$ into payload;
  if payload is null or position(${sqlLiteral(clinicName)} in payload) = 0 then
    raise exception 'admin bot settings list did not include scoped clinic';
  end if;

  execute replace($sql$${saveBotSql}$sql$, ${sqlLiteral(CLINIC_ID_PLACEHOLDER)}, created_clinic_id) into payload;
  if payload is null or position('"enabled":true' in payload) = 0 then
    raise exception 'admin bot settings save did not return enabled settings';
  end if;

  execute replace($sql$${dryRunBotSql}$sql$, ${sqlLiteral(CLINIC_ID_PLACEHOLDER)}, created_clinic_id) into payload;
  if payload is null or position('"lastDryRunAt":' in payload) = 0 then
    raise exception 'admin bot dry-run did not update last check time';
  end if;
end
$stage4m_admin_integrations_bot_db_smoke$;

select 'stage4m_admin_integrations_bot_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MAdminIntegrationsBotDbSmokePlan(options = {}) {
  const config = { ...parseStage4MAdminIntegrationsBotDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-admin-integrations-bot-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: integration create/list/update/check and bot settings save/dry-run",
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

export function runStage4MAdminIntegrationsBotDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MAdminIntegrationsBotDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) return { ok: true, dryRun: true, output: renderStage4MAdminIntegrationsBotDbSmokePlan(config) };
  if (config.command === "help") return { ok: true, dryRun: true, output: usage() };

  const result = runPsql(config, {
    input: buildStage4MAdminIntegrationsBotDbSmokeSql({ suffix: config.suffix }),
    label: "Stage 4M admin integrations and bot DB smoke",
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_admin_integrations_bot_db_smoke_ok")) {
    throw new Error("Stage 4M admin integrations and bot DB smoke did not return its OK marker.");
  }
  console.log("[stage4m-admin-integrations-bot-db-smoke] verified admin integration and bot settings journey against PostgreSQL");
  return { ok: true, dryRun: false, output: redact(result.stdout || "") };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-admin-integrations-bot-db-smoke.mjs verify",
    "  node scripts/stage4m-admin-integrations-bot-db-smoke.mjs verify --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MAdminIntegrationsBotDbSmokeArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MAdminIntegrationsBotDbSmoke(options);
    if (result.dryRun) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(`[stage4m-admin-integrations-bot-db-smoke] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

#!/usr/bin/env node
// Stage 4M · Admin management database smoke.
// Exercises the clinic list/create/update/analytics SQL against the real
// self-hosted PostgreSQL schema inside a transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildAdminAnalyticsSql,
  buildCreateAdminUserSql,
  buildCreateClinicSql,
  buildDeleteEmptyClinicSql,
  buildListAuditEventsSql,
  buildListClinicsSql,
  buildSetClinicStatusSql,
} from "../backend/self-hosted/admin-management-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];

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

export function parseStage4MAdminDbSmokeArgs(argv = []) {
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
    throw new Error(`Unknown admin database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function buildStage4MAdminDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicName = `Stage 4M smoke clinic ${safeSuffix}`;
  const clinicAddress = `Stage 4M smoke address ${safeSuffix}`;
  const updatedAddress = `Stage 4M smoke updated address ${safeSuffix}`;
  const clinicSlug = `stage4m-smoke-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const listSql = withoutTrailingSemicolon(buildListClinicsSql({ allClinics: true, limit: 5 }));
  const createSql = withoutTrailingSemicolon(buildCreateClinicSql({
    name: clinicName,
    address: clinicAddress,
    slug: clinicSlug,
    timezone: "Europe/Moscow",
  }));
  const searchSql = withoutTrailingSemicolon(buildListClinicsSql({
    allClinics: true,
    search: clinicName,
    limit: 5,
  }));
  const analyticsSql = withoutTrailingSemicolon(buildAdminAnalyticsSql({ allClinics: true }));
  const placeholderClinicId = "00000000-0000-4000-8000-000000000000";
  const existingUserEmail = `stage4m-existing-${safeSuffix}@example.invalid`;
  const existingUserName = `Stage 4M existing user ${safeSuffix}`;
  const existingPasswordHash = `stage4m-existing-password-${safeSuffix}`;
  const conflictingUserSql = withoutTrailingSemicolon(buildCreateAdminUserSql({
    email: existingUserEmail,
    displayName: `Stage 4M overwritten user ${safeSuffix}`,
    passwordHash: `stage4m-overwritten-password-${safeSuffix}`,
    role: "doctor",
    clinicId: placeholderClinicId,
  }));
  const scopedAnalyticsSql = withoutTrailingSemicolon(buildAdminAnalyticsSql({
    clinicIds: [placeholderClinicId],
    allClinics: false,
  }));
  const scopedAuditSql = withoutTrailingSemicolon(buildListAuditEventsSql({
    clinicIds: [placeholderClinicId],
    allClinics: false,
    limit: 100,
  }));
  const clinicAuditAction = `stage4m.clinic.audit.${safeSuffix}`;
  const globalAuditAction = `stage4m.global.audit.${safeSuffix}`;
  const statusSql = withoutTrailingSemicolon(buildSetClinicStatusSql({
    clinicId: placeholderClinicId,
    status: "archived",
    reason: "stage4m_smoke_archive",
  }));
  const deleteSql = withoutTrailingSemicolon(buildDeleteEmptyClinicSql({
    clinicId: placeholderClinicId,
  }));

  return `
begin;

do $stage4m_admin_db_smoke$
declare
  payload text;
  updated_count integer;
  existing_user_id uuid;
begin
  execute $sql$${listSql}$sql$ into payload;
  if payload is null then
    raise exception 'admin clinic list returned empty payload';
  end if;

  execute $sql$${createSql}$sql$ into payload;
  if payload is null or position(${sqlLiteral(clinicSlug)} in payload) = 0 then
    raise exception 'admin clinic create did not return the created clinic';
  end if;

  if not exists (select 1 from clinics where slug = ${sqlLiteral(clinicSlug)} and address = ${sqlLiteral(clinicAddress)}) then
    raise exception 'admin clinic create did not persist the clinic row';
  end if;

  insert into app_users (email, display_name, password_hash)
  values (${sqlLiteral(existingUserEmail)}, ${sqlLiteral(existingUserName)}, ${sqlLiteral(existingPasswordHash)})
  returning id into existing_user_id;

  payload := null;
  execute replace(
    $sql$${conflictingUserSql}$sql$,
    ${sqlLiteral(placeholderClinicId)},
    (select id::text from clinics where slug = ${sqlLiteral(clinicSlug)})
  ) into payload;
  if payload is not null then
    raise exception 'admin user duplicate email did not return conflict sentinel';
  end if;
  if not exists (
    select 1
    from app_users
    where id = existing_user_id
      and display_name = ${sqlLiteral(existingUserName)}
      and password_hash = ${sqlLiteral(existingPasswordHash)}
  ) then
    raise exception 'admin user duplicate email changed existing credentials';
  end if;
  if exists (
    select 1
    from user_roles
    where user_id = existing_user_id
      and role = 'doctor'::app_role
  ) then
    raise exception 'admin user duplicate email added a role to existing account';
  end if;

  execute $sql$${searchSql}$sql$ into payload;
  if payload is null or position(${sqlLiteral(clinicSlug)} in payload) = 0 then
    raise exception 'admin clinic list did not include the created clinic';
  end if;

  update clinics
  set address = ${sqlLiteral(updatedAddress)}, timezone = 'Europe/Samara', updated_at = now()
  where slug = ${sqlLiteral(clinicSlug)};
  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'admin clinic update affected % rows', updated_count;
  end if;

  if not exists (
    select 1
    from clinics
    where slug = ${sqlLiteral(clinicSlug)}
      and address = ${sqlLiteral(updatedAddress)}
      and timezone = 'Europe/Samara'
  ) then
    raise exception 'admin clinic update did not persist editable fields';
  end if;

  execute $sql$${analyticsSql}$sql$ into payload;
  if payload is null or position('"clinics"' in payload) = 0 then
    raise exception 'admin analytics query did not return aggregate payload';
  end if;

  insert into audit_log (clinic_id, action, entity_type, correlation_id)
  values
    (null, ${sqlLiteral(globalAuditAction)}, 'stage4m_smoke', ${sqlLiteral(`global-${safeSuffix}`)}),
    ((select id from clinics where slug = ${sqlLiteral(clinicSlug)}), ${sqlLiteral(clinicAuditAction)}, 'stage4m_smoke', ${sqlLiteral(`clinic-${safeSuffix}`)});

  execute replace(
    $sql$${scopedAnalyticsSql}$sql$,
    ${sqlLiteral(placeholderClinicId)},
    (select id::text from clinics where slug = ${sqlLiteral(clinicSlug)})
  ) into payload;
  if (payload::jsonb ->> 'auditEvents7d')::int <> (
    select count(*)::int
    from audit_log
    where clinic_id = (select id from clinics where slug = ${sqlLiteral(clinicSlug)})
      and created_at >= now() - interval '7 days'
  ) then
    raise exception 'global audit event leaked into clinic analytics';
  end if;

  execute replace(
    $sql$${scopedAuditSql}$sql$,
    ${sqlLiteral(placeholderClinicId)},
    (select id::text from clinics where slug = ${sqlLiteral(clinicSlug)})
  ) into payload;
  if position(${sqlLiteral(clinicAuditAction)} in payload) = 0 then
    raise exception 'clinic audit event missing from clinic list';
  end if;
  if position(${sqlLiteral(globalAuditAction)} in payload) > 0 then
    raise exception 'global audit event leaked into clinic list';
  end if;

  execute replace($sql$${statusSql}$sql$, '00000000-0000-4000-8000-000000000000', (select id::text from clinics where slug = ${sqlLiteral(clinicSlug)})) into payload;
  if payload is null or position('"archived"' in payload) = 0 then
    raise exception 'admin clinic archive did not return archived status';
  end if;

  execute replace($sql$${deleteSql}$sql$, '00000000-0000-4000-8000-000000000000', (select id::text from clinics where slug = ${sqlLiteral(clinicSlug)})) into payload;
  if payload is null or position('"deleted":true' in payload) = 0 then
    raise exception 'admin clinic empty delete did not return deleted true';
  end if;

  if exists (select 1 from clinics where slug = ${sqlLiteral(clinicSlug)} and deleted_at is null) then
    raise exception 'admin clinic empty delete did not hide the clinic row';
  end if;
end
$stage4m_admin_db_smoke$;

select 'stage4m_admin_management_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MAdminDbSmokePlan(options = {}) {
  const config = { ...parseStage4MAdminDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-admin-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: admin clinic list, clinic create, duplicate-email account safety, created row visibility, clinic edit, clinic empty delete, analytics aggregate query, clinic-scoped audit isolation",
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

export function runStage4MAdminManagementDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MAdminDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) {
    return { ok: true, dryRun: true, output: renderStage4MAdminDbSmokePlan(config) };
  }
  if (config.command === "help") {
    return { ok: true, dryRun: true, output: usage() };
  }
  const sql = buildStage4MAdminDbSmokeSql({ suffix: config.suffix });
  const result = runPsql(config, {
    label: "Admin management database smoke",
    input: sql,
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_admin_management_db_smoke_ok")) {
    throw new Error("Admin management database smoke did not return its OK marker.");
  }
  console.log("[stage4m-admin-db-smoke] verified admin clinic create/list/edit, duplicate-email account safety and audit isolation journey against PostgreSQL");
  return { ok: true, dryRun: false };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-admin-management-db-smoke.mjs verify",
    "  node scripts/stage4m-admin-management-db-smoke.mjs verify --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MAdminDbSmokeArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MAdminManagementDbSmoke(options);
    if (result.dryRun) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(`[stage4m-admin-db-smoke] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

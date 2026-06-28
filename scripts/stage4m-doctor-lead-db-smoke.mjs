#!/usr/bin/env node
// Stage 4M · Doctor lead database smoke.
// Exercises the lead create/update/book SQL against PostgreSQL inside a
// transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildBookLeadAppointmentSql,
  buildCreateLeadSql,
  buildUpdateLeadStatusSql,
} from "../backend/self-hosted/leads-appointments-write-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];
const CLINIC_ID = "10000000-0000-4000-8000-000000000101";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000201";
const PATIENT_ID = "10000000-0000-4000-8000-000000000301";
const LEAD_ID_PLACEHOLDER = "10000000-0000-4000-8000-000000000501";

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

export function parseStage4MDoctorLeadDbSmokeArgs(argv = []) {
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
    throw new Error(`Unknown doctor lead database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function buildStage4MDoctorLeadDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicSlug = `stage4m-doctor-lead-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const leadSummary = `Stage 4M doctor lead smoke ${safeSuffix}`;
  const createLeadSql = withoutTrailingSemicolon(buildCreateLeadSql({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    source: "operator",
    safeSummary: leadSummary,
    actorUserId: DOCTOR_ID,
  }));
  const updateLeadSql = withoutTrailingSemicolon(buildUpdateLeadStatusSql({
    leadId: LEAD_ID_PLACEHOLDER,
    status: "qualified",
    clinicIds: [CLINIC_ID],
  }));
  const bookLeadSql = withoutTrailingSemicolon(buildBookLeadAppointmentSql({
    leadId: LEAD_ID_PLACEHOLDER,
    clinicIds: [CLINIC_ID],
    patientId: PATIENT_ID,
    doctorUserId: DOCTOR_ID,
    startedAt: "2026-06-28T09:00:00.000Z",
    chiefComplaint: leadSummary,
  }));

  return `
begin;

do $stage4m_doctor_lead_db_smoke$
declare
  payload text;
  lead_id text;
begin
  insert into clinics (id, slug, name, timezone, address)
  values (${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(clinicSlug)}, 'Stage 4M doctor lead smoke clinic', 'Europe/Moscow', 'Stage 4M doctor lead smoke address');

  insert into app_users (id, email, display_name)
  values (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(`stage4m-doctor-${safeSuffix}@example.invalid`)}, 'Stage 4M doctor lead smoke doctor');

  insert into user_roles (user_id, clinic_id, role)
  values (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, 'doctor'::app_role);

  insert into patients (id, clinic_id, code, full_name, imaging_consent, created_by)
  values (${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(`STAGE4M-${safeSuffix}`)}, 'Stage 4M smoke patient', false, ${sqlLiteral(DOCTOR_ID)}::uuid);

  execute $sql$${createLeadSql}$sql$ into payload;
  if payload is null or position(${sqlLiteral(leadSummary)} in payload) = 0 then
    raise exception 'doctor lead create did not return the created lead';
  end if;

  lead_id := payload::jsonb->0->>'id';
  if lead_id is null or lead_id = '' then
    raise exception 'doctor lead create did not return a lead id';
  end if;

  execute replace($sql$${updateLeadSql}$sql$, ${sqlLiteral(LEAD_ID_PLACEHOLDER)}, lead_id) into payload;
  if payload is null or position('"qualified"' in payload) = 0 then
    raise exception 'doctor lead status update did not return qualified status';
  end if;

  execute replace($sql$${bookLeadSql}$sql$, ${sqlLiteral(LEAD_ID_PLACEHOLDER)}, lead_id) into payload;
  if payload is null or position('"appointment"' in payload) = 0 or position('"booked"' in payload) = 0 then
    raise exception 'doctor lead booking did not return booked lead and appointment';
  end if;
end
$stage4m_doctor_lead_db_smoke$;

select 'stage4m_doctor_lead_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MDoctorLeadDbSmokePlan(options = {}) {
  const config = { ...parseStage4MDoctorLeadDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-doctor-lead-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: doctor lead create, lead status update, and lead booking SQL against PostgreSQL",
    "- Safety: wrapped in one transaction and rolled back; no real patient rows, credentials, tokens, storage paths, or signed URLs are printed",
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

export function runStage4MDoctorLeadDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MDoctorLeadDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) {
    return { ok: true, dryRun: true, output: renderStage4MDoctorLeadDbSmokePlan(config) };
  }
  if (config.command === "help") {
    return { ok: true, dryRun: true, output: usage() };
  }
  const sql = buildStage4MDoctorLeadDbSmokeSql({ suffix: config.suffix });
  const result = runPsql(config, {
    label: "Doctor lead database smoke",
    input: sql,
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_doctor_lead_db_smoke_ok")) {
    throw new Error("Doctor lead database smoke did not return its OK marker.");
  }
  console.log("[stage4m-doctor-lead-db-smoke] verified doctor lead create/update/book journey against PostgreSQL");
  return { ok: true, dryRun: false };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-doctor-lead-db-smoke.mjs verify",
    "  node scripts/stage4m-doctor-lead-db-smoke.mjs verify --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MDoctorLeadDbSmokeArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MDoctorLeadDbSmoke(options);
    if (result.dryRun) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(`[stage4m-doctor-lead-db-smoke] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

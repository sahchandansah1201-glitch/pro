#!/usr/bin/env node
// Stage 4M · Doctor patient database smoke.
// Exercises patient create/update/archive SQL against PostgreSQL inside a
// transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildArchivePatientSql,
  buildCreatePatientSql,
  buildUpdatePatientSql,
} from "../backend/self-hosted/patients-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];
const CLINIC_ID = "10000000-0000-4000-8000-000000000111";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000211";
const PATIENT_ID_PLACEHOLDER = "10000000-0000-4000-8000-000000000311";

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

export function parseStage4MDoctorPatientDbSmokeArgs(argv = []) {
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
    throw new Error(`Unknown doctor patient database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function buildStage4MDoctorPatientDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicSlug = `stage4m-doctor-patient-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const patientCode = `STAGE4M-PATIENT-${safeSuffix}`.slice(0, 48).replace(/-+$/g, "");
  const patientName = `Stage 4M patient smoke ${safeSuffix}`;
  const updatedPatientName = `Stage 4M patient smoke updated ${safeSuffix}`;
  const createPatientSql = withoutTrailingSemicolon(buildCreatePatientSql({
    clinicId: CLINIC_ID,
    code: patientCode,
    fullName: patientName,
    birthDate: "1990-06-15",
    sex: "male",
    phototype: "III",
    imagingConsent: true,
    actorUserId: DOCTOR_ID,
  }));
  const updatePatientSql = withoutTrailingSemicolon(buildUpdatePatientSql({
    patientId: PATIENT_ID_PLACEHOLDER,
    changes: {
      fullName: updatedPatientName,
      imagingConsent: false,
    },
    clinicIds: [CLINIC_ID],
  }));
  const archivePatientSql = withoutTrailingSemicolon(buildArchivePatientSql({
    patientId: PATIENT_ID_PLACEHOLDER,
    clinicIds: [CLINIC_ID],
  }));

  return `
begin;

do $stage4m_doctor_patient_db_smoke$
declare
  payload text;
  patient_id text;
begin
  insert into clinics (id, slug, name, timezone, address)
  values (${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(clinicSlug)}, 'Stage 4M doctor patient smoke clinic', 'Europe/Moscow', 'Stage 4M doctor patient smoke address');

  insert into app_users (id, email, display_name)
  values (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(`stage4m-doctor-patient-${safeSuffix}@example.invalid`)}, 'Stage 4M doctor patient smoke doctor');

  insert into user_roles (user_id, clinic_id, role)
  values (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, 'doctor'::app_role);

  execute $sql$${createPatientSql}$sql$ into payload;
  if payload is null or position(${sqlLiteral(patientName)} in payload) = 0 then
    raise exception 'doctor patient create did not return the created patient';
  end if;

  patient_id := payload::jsonb->0->>'id';
  if patient_id is null or patient_id = '' then
    raise exception 'doctor patient create did not return a patient id';
  end if;

  execute replace($sql$${updatePatientSql}$sql$, ${sqlLiteral(PATIENT_ID_PLACEHOLDER)}, patient_id) into payload;
  if payload is null or position(${sqlLiteral(updatedPatientName)} in payload) = 0 or position('"imagingConsent":false' in payload) = 0 then
    raise exception 'doctor patient update did not return updated patient';
  end if;

  execute replace($sql$${archivePatientSql}$sql$, ${sqlLiteral(PATIENT_ID_PLACEHOLDER)}, patient_id) into payload;
  if payload is null or position('"deletedAt"' in payload) = 0 then
    raise exception 'doctor patient archive did not return archived patient';
  end if;
end
$stage4m_doctor_patient_db_smoke$;

select 'stage4m_doctor_patient_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MDoctorPatientDbSmokePlan(options = {}) {
  const config = { ...parseStage4MDoctorPatientDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-doctor-patient-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: doctor patient create, patient edit, and patient archive SQL against PostgreSQL",
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

export function runStage4MDoctorPatientDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MDoctorPatientDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) {
    return { ok: true, dryRun: true, output: renderStage4MDoctorPatientDbSmokePlan(config) };
  }
  if (config.command === "help") {
    return { ok: true, dryRun: true, output: usage() };
  }
  const sql = buildStage4MDoctorPatientDbSmokeSql({ suffix: config.suffix });
  const result = runPsql(config, {
    label: "Doctor patient database smoke",
    input: sql,
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_doctor_patient_db_smoke_ok")) {
    throw new Error("Doctor patient database smoke did not return its OK marker.");
  }
  console.log("[stage4m-doctor-patient-db-smoke] verified doctor patient create/update/archive journey against PostgreSQL");
  return { ok: true, dryRun: false };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-doctor-patient-db-smoke.mjs verify",
    "  node scripts/stage4m-doctor-patient-db-smoke.mjs verify --dry-run",
    "",
    "Options:",
    "  --project-name <name>",
    "  --compose-env-file <path>",
    "  --compose-file <path>   repeatable",
    "  --suffix <safe-id>",
  ].join("\n");
}

function main() {
  try {
    const parsed = parseStage4MDoctorPatientDbSmokeArgs(process.argv.slice(2));
    const result = runStage4MDoctorPatientDbSmoke(parsed);
    if (result.output) console.log(result.output);
  } catch (error) {
    console.error(redact(error.message));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

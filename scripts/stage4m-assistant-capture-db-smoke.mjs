#!/usr/bin/env node
// Stage 4M · Assistant capture database smoke.
// Exercises assistant capture fixture and asset metadata SQL against PostgreSQL
// inside a transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildCreateVisitAssetSql } from "../backend/self-hosted/asset-write-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];
const CLINIC_ID = "10000000-0000-4000-8000-000000000121";
const ASSISTANT_ID = "10000000-0000-4000-8000-000000000221";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000222";
const PATIENT_ID = "10000000-0000-4000-8000-000000000321";
const VISIT_ID = "10000000-0000-4000-8000-000000000421";
const LESION_ID = "10000000-0000-4000-8000-000000000521";

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

export function parseStage4MAssistantCaptureDbSmokeArgs(argv = []) {
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
    throw new Error(`Unknown assistant capture database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function buildStage4MAssistantCaptureDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicSlug = `stage4m-assistant-capture-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const assetObjectKey = `stage4m/assistant/${safeSuffix}/capture.png`;
  const createAssetSql = withoutTrailingSemicolon(buildCreateVisitAssetSql({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: VISIT_ID,
    lesionId: LESION_ID,
    kind: "dermoscopy",
    objectBucket: "clinical-assets",
    objectKey: assetObjectKey,
    contentType: "image/png",
    byteSize: 9,
    checksumSha256: "64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c",
    capturedAt: "2026-06-29T10:05:00.000Z",
    uploadedBy: ASSISTANT_ID,
  }));

  return `
begin;

do $stage4m_assistant_capture_db_smoke$
declare
  payload text;
begin
  insert into clinics (id, slug, name, timezone, address)
  values (${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(clinicSlug)}, 'Stage 4M assistant capture smoke clinic', 'Europe/Moscow', 'Stage 4M assistant capture smoke address');

  insert into app_users (id, email, display_name)
  values
    (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(`stage4m-capture-doctor-${safeSuffix}@example.invalid`)}, 'Stage 4M capture smoke doctor'),
    (${sqlLiteral(ASSISTANT_ID)}::uuid, ${sqlLiteral(`stage4m-capture-assistant-${safeSuffix}@example.invalid`)}, 'Stage 4M capture smoke assistant');

  insert into user_roles (user_id, clinic_id, role)
  values
    (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, 'doctor'::app_role),
    (${sqlLiteral(ASSISTANT_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, 'assistant'::app_role);

  insert into patients (id, clinic_id, code, full_name, imaging_consent, created_by)
  values (${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(`STAGE4M-CAPTURE-${safeSuffix}`)}, 'Stage 4M capture smoke patient', true, ${sqlLiteral(DOCTOR_ID)}::uuid);

  insert into visits (id, clinic_id, patient_id, doctor_user_id, status, started_at, chief_complaint)
  values (${sqlLiteral(VISIT_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'in_progress'::visit_status, '2026-06-29T10:00:00.000Z', 'Stage 4M capture smoke visit');

  insert into lesions (id, clinic_id, patient_id, visit_id, label, body_zone, body_surface)
  values (${sqlLiteral(LESION_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(VISIT_ID)}::uuid, 'Stage 4M capture lesion', 'forearm', 'front');

  execute $sql$${createAssetSql}$sql$ into payload;
  if payload is null or position('"dermoscopy"' in payload) = 0 then
    raise exception 'assistant capture asset create did not return dermoscopy asset';
  end if;
  if payload::jsonb->0->>'uploadedBy' <> ${sqlLiteral(ASSISTANT_ID)} then
    raise exception 'assistant capture asset create did not preserve assistant uploader';
  end if;
  if payload::jsonb::text like '%objectKey%' or payload::jsonb::text like '%objectBucket%' then
    raise exception 'assistant capture asset safe DTO exposed object storage details';
  end if;
end
$stage4m_assistant_capture_db_smoke$;

select 'stage4m_assistant_capture_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MAssistantCaptureDbSmokePlan(options = {}) {
  const config = { ...parseStage4MAssistantCaptureDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-assistant-capture-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: assistant fixture, visit context, lesion context, and asset metadata SQL against PostgreSQL",
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

export function runStage4MAssistantCaptureDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MAssistantCaptureDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) {
    return { ok: true, dryRun: true, output: renderStage4MAssistantCaptureDbSmokePlan(config) };
  }
  if (config.command === "help") {
    return { ok: true, dryRun: true, output: usage() };
  }
  const sql = buildStage4MAssistantCaptureDbSmokeSql({ suffix: config.suffix });
  const result = runPsql(config, {
    label: "Assistant capture database smoke",
    input: sql,
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_assistant_capture_db_smoke_ok")) {
    throw new Error("Assistant capture database smoke did not return its OK marker.");
  }
  console.log("[stage4m-assistant-capture-db-smoke] verified assistant capture asset journey against PostgreSQL");
  return { ok: true, dryRun: false };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-assistant-capture-db-smoke.mjs verify",
    "  node scripts/stage4m-assistant-capture-db-smoke.mjs verify --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MAssistantCaptureDbSmokeArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MAssistantCaptureDbSmoke(options);
    if (result.output) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(`[stage4m-assistant-capture-db-smoke] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

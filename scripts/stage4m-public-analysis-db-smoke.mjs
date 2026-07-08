#!/usr/bin/env node
// Stage 4M · Public analysis link database smoke.
// Exercises the public summary-link read SQL against PostgreSQL inside a
// transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildGetPublicAnalysisByTokenHashSql,
  hashPublicAnalysisToken,
} from "../backend/self-hosted/public-analysis-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];
const CLINIC_ID = "10000000-0000-4000-8000-000000000711";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000712";
const PATIENT_ID = "10000000-0000-4000-8000-000000000713";
const VISIT_ID = "10000000-0000-4000-8000-000000000714";
const REPORT_ID = "10000000-0000-4000-8000-000000000715";

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

export function parseStage4MPublicAnalysisDbSmokeArgs(argv = []) {
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
    throw new Error(`Unknown public analysis database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function buildStage4MPublicAnalysisDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicSlug = `stage4m-public-analysis-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const safeSummary = `Stage 4M public summary smoke ${safeSuffix}: contact the clinic for follow-up.`;
  const nowIso = "2026-07-08T10:00:00.000Z";
  const validHash = hashPublicAnalysisToken(`stage4m-public-valid-${safeSuffix}`);
  const expiredHash = hashPublicAnalysisToken(`stage4m-public-expired-${safeSuffix}`);
  const missingHash = hashPublicAnalysisToken(`stage4m-public-missing-${safeSuffix}`);
  const validSql = withoutTrailingSemicolon(buildGetPublicAnalysisByTokenHashSql({
    tokenHash: validHash,
    nowIso,
  }));
  const expiredSql = withoutTrailingSemicolon(buildGetPublicAnalysisByTokenHashSql({
    tokenHash: expiredHash,
    nowIso,
  }));
  const missingSql = withoutTrailingSemicolon(buildGetPublicAnalysisByTokenHashSql({
    tokenHash: missingHash,
    nowIso,
  }));

  return `
begin;

do $stage4m_public_analysis_db_smoke$
declare
  payload text;
begin
  insert into clinics (id, slug, name, timezone, address)
  values (${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(clinicSlug)}, 'Stage 4M public analysis smoke clinic', 'Europe/Moscow', 'Stage 4M public analysis smoke address');

  insert into app_users (id, email, display_name)
  values (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(`stage4m-public-analysis-${safeSuffix}@example.invalid`)}, 'Stage 4M public analysis smoke doctor');

  insert into user_roles (user_id, clinic_id, role)
  values (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, 'doctor'::app_role);

  insert into patients (id, clinic_id, code, full_name, imaging_consent, created_by)
  values (${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(`STAGE4M-PUBLIC-${safeSuffix}`)}, 'Stage 4M public analysis smoke patient', true, ${sqlLiteral(DOCTOR_ID)}::uuid);

  insert into visits (id, clinic_id, patient_id, doctor_user_id, status, started_at, signed_at, chief_complaint)
  values (${sqlLiteral(VISIT_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed'::visit_status, now(), now(), 'Stage 4M public analysis smoke');

  insert into clinical_assets (clinic_id, patient_id, visit_id, kind, object_bucket, object_key, content_type, byte_size, captured_at, uploaded_by)
  values (${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(VISIT_ID)}::uuid, 'overview_photo'::asset_kind, 'stage4m-public-analysis', ${sqlLiteral(`asset-${safeSuffix}.jpg`)}, 'image/jpeg', 128, now(), ${sqlLiteral(DOCTOR_ID)}::uuid);

  insert into reports (id, clinic_id, patient_id, visit_id, doctor_user_id, status, physician_text, patient_safe_text, signed_at)
  values (${sqlLiteral(REPORT_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(VISIT_ID)}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed', 'internal physician smoke text', ${sqlLiteral(safeSummary)}, ${sqlLiteral(nowIso)}::timestamptz);

  insert into public_analysis_links (clinic_id, report_id, token_hash, status, expires_at, created_by_user_id)
  values
    (${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(REPORT_ID)}::uuid, ${sqlLiteral(validHash)}, 'active', ${sqlLiteral("2026-07-09T10:00:00.000Z")}::timestamptz, ${sqlLiteral(DOCTOR_ID)}::uuid),
    (${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(REPORT_ID)}::uuid, ${sqlLiteral(expiredHash)}, 'active', ${sqlLiteral("2026-07-07T10:00:00.000Z")}::timestamptz, ${sqlLiteral(DOCTOR_ID)}::uuid);

  execute $sql$${validSql}$sql$ into payload;
  if payload is null
    or payload::jsonb->>'status' is distinct from 'valid'
    or payload::jsonb->>'safeSummary' is distinct from ${sqlLiteral(safeSummary)}
    or payload::jsonb->>'clinicName' is distinct from 'Stage 4M public analysis smoke clinic'
    or payload::jsonb->>'qualityPassed' is distinct from 'true' then
    raise exception 'public analysis valid link did not return patient-safe summary';
  end if;

  execute $sql$${expiredSql}$sql$ into payload;
  if payload is null
    or payload::jsonb->>'status' is distinct from 'expired'
    or payload::jsonb->>'safeSummary' is not null then
    raise exception 'public analysis expired link did not return expired status without summary';
  end if;

  execute $sql$${missingSql}$sql$ into payload;
  if payload is null or payload::jsonb->>'status' is distinct from 'not_found' then
    raise exception 'public analysis missing link did not return not_found status';
  end if;
end
$stage4m_public_analysis_db_smoke$;

select 'stage4m_public_analysis_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MPublicAnalysisDbSmokePlan(options = {}) {
  const config = { ...parseStage4MPublicAnalysisDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-public-analysis-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: public analysis valid, expired, and missing link SQL against PostgreSQL",
    "- Safety: wrapped in one transaction and rolled back; no raw link tokens, credentials, storage paths, signed URLs, or physician-only text are printed",
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

export function runStage4MPublicAnalysisDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MPublicAnalysisDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) {
    return { ok: true, dryRun: true, output: renderStage4MPublicAnalysisDbSmokePlan(config) };
  }
  if (config.command === "help") {
    return { ok: true, dryRun: true, output: usage() };
  }
  const sql = buildStage4MPublicAnalysisDbSmokeSql({ suffix: config.suffix });
  const result = runPsql(config, {
    label: "Public analysis database smoke",
    input: sql,
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_public_analysis_db_smoke_ok")) {
    throw new Error("Public analysis database smoke did not return its OK marker.");
  }
  console.log("[stage4m-public-analysis-db-smoke] verified public analysis link read journey against PostgreSQL");
  return { ok: true, dryRun: false };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-public-analysis-db-smoke.mjs verify",
    "  node scripts/stage4m-public-analysis-db-smoke.mjs verify --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MPublicAnalysisDbSmokeArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MPublicAnalysisDbSmoke(options);
    if (result.dryRun) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(`[stage4m-public-analysis-db-smoke] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

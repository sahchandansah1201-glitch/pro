#!/usr/bin/env node
// Stage 4M · Operator dialog database smoke.
// Exercises the production booking-request detail and update SQL inside a
// transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildClinicBookingRequestDetailSql,
  buildUpdateClinicBookingRequestSql,
} from "../backend/self-hosted/clinic-booking-requests-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];
const REQUEST_ID_PLACEHOLDER = "10000000-0000-4000-8000-000000000501";
const OPERATOR_ID_PLACEHOLDER = "10000000-0000-4000-8000-000000000601";
const CLINIC_ID_PLACEHOLDER = "10000000-0000-4000-8000-000000000701";

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

export function parseStage4MOperatorDialogDbSmokeArgs(argv = []) {
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
    throw new Error(`Unknown operator dialog database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) {
    throw new Error("compose file is required.");
  }
  return parsed;
}

export function buildStage4MOperatorDialogDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicSlug = `stage4m-operator-dialog-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const patientName = `Stage 4M operator dialog patient ${safeSuffix}`;
  const requestReason = `Stage 4M operator dialog reason ${safeSuffix}`;
  const clinicNote = `Stage 4M operator dialog note ${safeSuffix}`;
  const detailSql = withoutTrailingSemicolon(buildClinicBookingRequestDetailSql({
    requestId: REQUEST_ID_PLACEHOLDER,
    clinicIds: [CLINIC_ID_PLACEHOLDER],
  }));
  const updateSql = withoutTrailingSemicolon(buildUpdateClinicBookingRequestSql({
    requestId: REQUEST_ID_PLACEHOLDER,
    status: "reviewing",
    clinicNote,
    reviewedByUserId: OPERATOR_ID_PLACEHOLDER,
    clinicIds: [CLINIC_ID_PLACEHOLDER],
  }));

  return `
begin;

do $stage4m_operator_dialog_db_smoke$
declare
  payload text;
  fixture_clinic_id uuid := gen_random_uuid();
  fixture_operator_id uuid := gen_random_uuid();
  fixture_patient_user_id uuid := gen_random_uuid();
  fixture_patient_id uuid := gen_random_uuid();
  fixture_request_id uuid := gen_random_uuid();
begin
  insert into clinics (id, slug, name, timezone, address)
  values (fixture_clinic_id, ${sqlLiteral(clinicSlug)}, 'Stage 4M operator dialog clinic', 'Europe/Moscow', 'Stage 4M operator dialog address');

  insert into app_users (id, email, display_name, disabled_at)
  values (fixture_operator_id, ${sqlLiteral(`stage4m-operator-${safeSuffix}@example.invalid`)}, 'Stage 4M operator dialog user', null);

  insert into app_users (id, email, display_name, disabled_at)
  values (fixture_patient_user_id, ${sqlLiteral(`stage4m-operator-patient-${safeSuffix}@example.invalid`)}, 'Stage 4M operator dialog patient user', null);

  insert into user_roles (user_id, clinic_id, role)
  values (fixture_operator_id, fixture_clinic_id, 'operator'::app_role);

  insert into user_roles (user_id, clinic_id, role)
  values (fixture_patient_user_id, fixture_clinic_id, 'patient'::app_role);

  insert into patients (id, clinic_id, code, full_name, imaging_consent, created_by)
  values (fixture_patient_id, fixture_clinic_id, ${sqlLiteral(`STAGE4M-OPERATOR-${safeSuffix}`)}, ${sqlLiteral(patientName)}, false, fixture_operator_id);

  insert into patient_user_links (user_id, patient_id)
  values (fixture_patient_user_id, fixture_patient_id);

  insert into patient_portal_booking_requests (
    id,
    clinic_id,
    patient_id,
    requested_by_user_id,
    preferred_from,
    preferred_to,
    reason,
    status
  ) values (
    fixture_request_id,
    fixture_clinic_id,
    fixture_patient_id,
    fixture_patient_user_id,
    now() + interval '1 day',
    now() + interval '1 day 1 hour',
    ${sqlLiteral(requestReason)},
    'requested'
  );

  execute replace(
    replace(
      $sql$${detailSql}$sql$,
      ${sqlLiteral(REQUEST_ID_PLACEHOLDER)},
      fixture_request_id::text
    ),
    ${sqlLiteral(CLINIC_ID_PLACEHOLDER)},
    fixture_clinic_id::text
  ) into payload;
  if payload is null
    or payload::jsonb->>'reason' is distinct from ${sqlLiteral(requestReason)}
    or payload::jsonb->>'status' is distinct from 'requested' then
    raise exception 'operator dialog detail did not return the scoped request';
  end if;

  execute replace(
    replace(
      replace(
        $sql$${updateSql}$sql$,
        ${sqlLiteral(REQUEST_ID_PLACEHOLDER)},
        fixture_request_id::text
      ),
      ${sqlLiteral(OPERATOR_ID_PLACEHOLDER)},
      fixture_operator_id::text
    ),
    ${sqlLiteral(CLINIC_ID_PLACEHOLDER)},
    fixture_clinic_id::text
  ) into payload;
  if payload is null
    or payload::jsonb->>'clinicNote' is distinct from ${sqlLiteral(clinicNote)}
    or payload::jsonb->>'status' is distinct from 'reviewing' then
    raise exception 'operator dialog update did not persist note and status';
  end if;

  execute replace(
    replace(
      $sql$${detailSql}$sql$,
      ${sqlLiteral(REQUEST_ID_PLACEHOLDER)},
      fixture_request_id::text
    ),
    ${sqlLiteral(CLINIC_ID_PLACEHOLDER)},
    fixture_clinic_id::text
  ) into payload;
  if payload is null
    or payload::jsonb->>'clinicNote' is distinct from ${sqlLiteral(clinicNote)}
    or payload::jsonb->>'status' is distinct from 'reviewing' then
    raise exception 'operator dialog detail did not return the persisted update';
  end if;
end
$stage4m_operator_dialog_db_smoke$;

select 'stage4m_operator_dialog_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MOperatorDialogDbSmokePlan(options = {}) {
  const config = { ...parseStage4MOperatorDialogDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-operator-dialog-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: operator booking-request detail read plus note and status update persistence",
    "- Safety: wrapped in one transaction and rolled back; no real patient rows or protected connection values are printed",
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

export function runStage4MOperatorDialogDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MOperatorDialogDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) return { ok: true, dryRun: true, output: renderStage4MOperatorDialogDbSmokePlan(config) };
  if (config.command === "help") return { ok: true, dryRun: true, output: usage() };

  const result = runPsql(config, {
    input: buildStage4MOperatorDialogDbSmokeSql({ suffix: config.suffix }),
    label: "Stage 4M operator dialog DB smoke",
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_operator_dialog_db_smoke_ok")) {
    throw new Error("Stage 4M operator dialog DB smoke did not return its OK marker.");
  }
  console.log("[stage4m-operator-dialog-db-smoke] verified operator dialog read/update journey against PostgreSQL");
  return { ok: true, dryRun: false, output: redact(result.stdout || "") };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-operator-dialog-db-smoke.mjs verify",
    "  node scripts/stage4m-operator-dialog-db-smoke.mjs verify --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MOperatorDialogDbSmokeArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MOperatorDialogDbSmoke(options);
    if (result.dryRun) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(`[stage4m-operator-dialog-db-smoke] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}

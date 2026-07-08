#!/usr/bin/env node
// Stage 4M · Admin governance database smoke.
// Exercises patient photo/protocol release governance SQL against PostgreSQL
// inside a transaction that is rolled back.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  buildExecutePatientPhotoProtocolReleaseGovernanceBlockMissingExpirySql,
  buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnapprovedRetentionSql,
  buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnsafeSessionArtifactsSql,
  buildExecutePatientPhotoProtocolReleaseGovernanceIssueAccessCredentialHashSql,
  buildExecutePatientPhotoProtocolReleaseGovernancePrepareAccessArtifactRotationSql,
  buildExecutePatientPhotoProtocolReleaseGovernanceRevokeExpiredSql,
  buildGetPatientPhotoProtocolReleaseGovernanceSql,
} from "../backend/self-hosted/patient-photo-protocol-release-repository.mjs";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_COMPOSE_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_COMPOSE_FILES = [
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
];

const CLINIC_ID = "10000000-0000-4000-8000-000000000721";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000722";
const PATIENT_ID = "10000000-0000-4000-8000-000000000723";
const VISIT_IDS = [
  "10000000-0000-4000-8000-000000000724",
  "10000000-0000-4000-8000-000000000725",
  "10000000-0000-4000-8000-000000000726",
  "10000000-0000-4000-8000-000000000727",
];
const REPORT_IDS = [
  "10000000-0000-4000-8000-000000000728",
  "10000000-0000-4000-8000-000000000729",
  "10000000-0000-4000-8000-000000000730",
  "10000000-0000-4000-8000-000000000731",
];
const RELEASE_IDS = [
  "10000000-0000-4000-8000-000000000732",
  "10000000-0000-4000-8000-000000000733",
  "10000000-0000-4000-8000-000000000734",
  "10000000-0000-4000-8000-000000000735",
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

export function parseStage4MAdminGovernanceDbSmokeArgs(argv = []) {
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
    throw new Error(`Unknown admin governance database smoke command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.composeEnvFile) throw new Error("compose env file is required.");
  if (!parsed.composeFiles.length || parsed.composeFiles.some((file) => !file)) throw new Error("compose file is required.");
  return parsed;
}

export function buildStage4MAdminGovernanceDbSmokeSql({ suffix = safeSmokeSuffix() } = {}) {
  const safeSuffix = safeSmokeSuffix(suffix);
  const clinicSlug = `stage4m-governance-${safeSuffix}`.slice(0, 80).replace(/-+$/g, "");
  const actorUserId = DOCTOR_ID;
  const clinicIds = [CLINIC_ID];
  const governanceSql = withoutTrailingSemicolon(buildGetPatientPhotoProtocolReleaseGovernanceSql({
    clinicIds,
    limit: 10,
  }));
  const blockRetentionSql = withoutTrailingSemicolon(buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnapprovedRetentionSql({
    actorUserId,
    clinicIds,
    limit: 5,
  }));
  const blockMissingExpirySql = withoutTrailingSemicolon(buildExecutePatientPhotoProtocolReleaseGovernanceBlockMissingExpirySql({
    actorUserId,
    clinicIds,
    limit: 5,
  }));
  const blockUnsafeSql = withoutTrailingSemicolon(buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnsafeSessionArtifactsSql({
    actorUserId,
    clinicIds,
    limit: 5,
  }));
  const prepareRotationSql = withoutTrailingSemicolon(buildExecutePatientPhotoProtocolReleaseGovernancePrepareAccessArtifactRotationSql({
    actorUserId,
    clinicIds,
    limit: 5,
  }));
  const issueCredentialSql = withoutTrailingSemicolon(buildExecutePatientPhotoProtocolReleaseGovernanceIssueAccessCredentialHashSql({
    actorUserId,
    clinicIds,
    limit: 5,
  }));
  const revokeExpiredSql = withoutTrailingSemicolon(buildExecutePatientPhotoProtocolReleaseGovernanceRevokeExpiredSql({
    actorUserId,
    clinicIds,
    limit: 5,
  }));

  return `
begin;

set local app.patient_photo_protocol_credential_pepper = ${sqlLiteral(`stage4m-governance-pepper-${safeSuffix}`)};

do $stage4m_admin_governance_db_smoke$
declare
  payload text;
begin
  insert into clinics (id, slug, name, timezone, address)
  values (${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(clinicSlug)}, 'Stage 4M governance smoke clinic', 'Europe/Moscow', 'Stage 4M governance smoke address');

  insert into app_users (id, email, display_name)
  values (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(`stage4m-governance-${safeSuffix}@example.invalid`)}, 'Stage 4M governance smoke doctor');

  insert into user_roles (user_id, clinic_id, role)
  values (${sqlLiteral(DOCTOR_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, 'doctor'::app_role);

  insert into patients (id, clinic_id, code, full_name, imaging_consent, created_by)
  values (${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(`STAGE4M-GOV-${safeSuffix}`)}, 'Stage 4M governance smoke patient', true, ${sqlLiteral(DOCTOR_ID)}::uuid);

  insert into visits (id, clinic_id, patient_id, doctor_user_id, status, started_at, signed_at, chief_complaint)
  values
    (${sqlLiteral(VISIT_IDS[0])}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed'::visit_status, now(), now(), 'Stage 4M governance retention'),
    (${sqlLiteral(VISIT_IDS[1])}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed'::visit_status, now(), now(), 'Stage 4M governance expiry'),
    (${sqlLiteral(VISIT_IDS[2])}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed'::visit_status, now(), now(), 'Stage 4M governance session'),
    (${sqlLiteral(VISIT_IDS[3])}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed'::visit_status, now() - interval '4 days', now() - interval '4 days', 'Stage 4M governance expired');

  insert into reports (id, clinic_id, patient_id, visit_id, doctor_user_id, status, physician_text, patient_safe_text, signed_at)
  values
    (${sqlLiteral(REPORT_IDS[0])}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(VISIT_IDS[0])}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed', 'internal retention text', 'Stage 4M governance safe retention summary', now()),
    (${sqlLiteral(REPORT_IDS[1])}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(VISIT_IDS[1])}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed', 'internal expiry text', 'Stage 4M governance safe expiry summary', now()),
    (${sqlLiteral(REPORT_IDS[2])}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(VISIT_IDS[2])}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed', 'internal session text', 'Stage 4M governance safe session summary', now()),
    (${sqlLiteral(REPORT_IDS[3])}::uuid, ${sqlLiteral(CLINIC_ID)}::uuid, ${sqlLiteral(PATIENT_ID)}::uuid, ${sqlLiteral(VISIT_IDS[3])}::uuid, ${sqlLiteral(DOCTOR_ID)}::uuid, 'signed', 'internal expired text', 'Stage 4M governance safe expired summary', now());

  insert into patient_photo_protocol_releases (
    id,
    clinic_id,
    patient_id,
    visit_id,
    report_id,
    status,
    selected_photo_count,
    overview_photo_count,
    dermoscopy_photo_count,
    report_attachment_count,
    release_blockers,
    prepared_by_user_id,
    prepared_at,
    expires_at,
    metadata_json
  )
  values
    (
      ${sqlLiteral(RELEASE_IDS[0])}::uuid,
      ${sqlLiteral(CLINIC_ID)}::uuid,
      ${sqlLiteral(PATIENT_ID)}::uuid,
      ${sqlLiteral(VISIT_IDS[0])}::uuid,
      ${sqlLiteral(REPORT_IDS[0])}::uuid,
      'prepared',
      2,
      1,
      1,
      0,
      array[]::text[],
      ${sqlLiteral(DOCTOR_ID)}::uuid,
      now(),
      now() + interval '7 days',
      '{"patientFileProxyEnabled":true,"patientCopyApproved":true,"retentionPolicyApproved":false}'::jsonb
    ),
    (
      ${sqlLiteral(RELEASE_IDS[1])}::uuid,
      ${sqlLiteral(CLINIC_ID)}::uuid,
      ${sqlLiteral(PATIENT_ID)}::uuid,
      ${sqlLiteral(VISIT_IDS[1])}::uuid,
      ${sqlLiteral(REPORT_IDS[1])}::uuid,
      'prepared',
      1,
      1,
      0,
      0,
      array[]::text[],
      ${sqlLiteral(DOCTOR_ID)}::uuid,
      now(),
      null,
      '{"patientFileProxyEnabled":true,"patientCopyApproved":true,"retentionPolicyApproved":true}'::jsonb
    ),
    (
      ${sqlLiteral(RELEASE_IDS[2])}::uuid,
      ${sqlLiteral(CLINIC_ID)}::uuid,
      ${sqlLiteral(PATIENT_ID)}::uuid,
      ${sqlLiteral(VISIT_IDS[2])}::uuid,
      ${sqlLiteral(REPORT_IDS[2])}::uuid,
      'prepared',
      3,
      2,
      1,
      0,
      array[]::text[],
      ${sqlLiteral(DOCTOR_ID)}::uuid,
      now(),
      now() + interval '5 days',
      '{"patientFileProxyEnabled":true,"patientCopyApproved":true,"retentionPolicyApproved":true,"temporaryCredentialIssued":true,"sessionIssued":true,"sessionRotationRequired":true}'::jsonb
    ),
    (
      ${sqlLiteral(RELEASE_IDS[3])}::uuid,
      ${sqlLiteral(CLINIC_ID)}::uuid,
      ${sqlLiteral(PATIENT_ID)}::uuid,
      ${sqlLiteral(VISIT_IDS[3])}::uuid,
      ${sqlLiteral(REPORT_IDS[3])}::uuid,
      'prepared',
      1,
      1,
      0,
      0,
      array[]::text[],
      ${sqlLiteral(DOCTOR_ID)}::uuid,
      now() - interval '3 days',
      now() - interval '1 day',
      '{"patientFileProxyEnabled":true,"patientCopyApproved":true,"retentionPolicyApproved":true}'::jsonb
    );

  execute $sql$${governanceSql}$sql$ into payload;
  if payload is null
    or (payload::jsonb->0->'summary'->>'releasesTotal')::int < 4
    or (payload::jsonb->0->'queue') is null
    or jsonb_array_length(payload::jsonb->0->'queue') < 4
    or payload::jsonb::text ~* '"(storagePath|signedUrl|accessToken|sessionId|credentialHash|credentialFingerprint|storage_path|signed_url|access_token|session_id|credential_hash|credential_fingerprint)"[[:space:]]*:' then
    raise exception 'admin governance read did not return aggregate metadata only';
  end if;

  execute $sql$${blockRetentionSql}$sql$ into payload;
  if payload is null
    or payload::jsonb->0->>'operation' is distinct from 'block_unapproved_retention_windows'
    or (payload::jsonb->0->>'affectedCount')::int < 1
    or (payload::jsonb->0->'boundaries'->>'patientDeliveryAllowed') is distinct from 'false' then
    raise exception 'admin governance block unapproved retention did not close retention gaps safely';
  end if;

  execute $sql$${blockMissingExpirySql}$sql$ into payload;
  if payload is null
    or payload::jsonb->0->>'operation' is distinct from 'block_missing_expiry_access_windows'
    or (payload::jsonb->0->>'affectedCount')::int < 1
    or (payload::jsonb->0->'boundaries'->>'sessionIdsExposed') is distinct from 'false' then
    raise exception 'admin governance block missing expiry did not close expiry gaps safely';
  end if;

  execute $sql$${blockUnsafeSql}$sql$ into payload;
  if payload is null
    or payload::jsonb->0->>'operation' is distinct from 'block_unsafe_session_artifacts'
    or (payload::jsonb->0->>'affectedCount')::int < 1
    or (payload::jsonb->0->'boundaries'->>'temporaryCredentialsExposed') is distinct from 'false' then
    raise exception 'admin governance block unsafe session artifacts did not close temporary codes safely';
  end if;

  execute $sql$${prepareRotationSql}$sql$ into payload;
  if payload is null
    or payload::jsonb->0->>'operation' is distinct from 'prepare_access_artifact_rotation'
    or (payload::jsonb->0->>'affectedCount')::int < 1
    or (payload::jsonb->0->'boundaries'->>'signedUrlsIssued') is distinct from 'false' then
    raise exception 'admin governance access-artifact rotation was not prepared safely';
  end if;

  execute $sql$${issueCredentialSql}$sql$ into payload;
  if payload is null
    or payload::jsonb->0->>'operation' is distinct from 'issue_access_credential_hash'
    or (payload::jsonb->0->>'affectedCount')::int < 1
    or (payload::jsonb->0->'boundaries'->>'rawCredentialExposed') is distinct from 'false'
    or payload::jsonb::text ~* '"(credential_hash|credential_fingerprint|rawCredential|credentialValue|credentialPlaintext)"[[:space:]]*:' then
    raise exception 'admin governance credential-hash operation was not metadata-only';
  end if;

  execute $sql$${revokeExpiredSql}$sql$ into payload;
  if payload is null
    or payload::jsonb->0->>'operation' is distinct from 'revoke_expired_access_windows'
    or (payload::jsonb->0->>'affectedCount')::int < 1
    or (payload::jsonb->0->'boundaries'->>'revokeReasonExposed') is distinct from 'false' then
    raise exception 'admin governance revoke expired windows did not keep revoke reason hidden';
  end if;
end
$stage4m_admin_governance_db_smoke$;

select 'stage4m_admin_governance_db_smoke_ok' as status;

rollback;
`.trim();
}

export function renderStage4MAdminGovernanceDbSmokePlan(options = {}) {
  const config = { ...parseStage4MAdminGovernanceDbSmokeArgs(["verify"]), ...options };
  return [
    "[stage4m-admin-governance-db-smoke] verify plan",
    "",
    `- Project: ${config.projectName}`,
    `- Compose env file: ${config.composeEnvFile}`,
    "- Scope: admin governance aggregate read, blocked delivery gates, expiry control, session code blocking, access rotation, credential-hash preparation, and expired-window revoke",
    "- Safety: wrapped in one transaction and rolled back; no patient rows, raw credentials, tokens, storage paths, signed URLs, or session identifiers are printed",
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

export function runStage4MAdminGovernanceDbSmoke(options = {}, io = {}) {
  const config = { ...parseStage4MAdminGovernanceDbSmokeArgs(["verify"]), ...options };
  if (config.dryRun) return { ok: true, dryRun: true, output: renderStage4MAdminGovernanceDbSmokePlan(config) };
  if (config.command === "help") return { ok: true, dryRun: true, output: usage() };

  const result = runPsql(config, {
    input: buildStage4MAdminGovernanceDbSmokeSql({ suffix: config.suffix }),
    label: "Stage 4M admin governance DB smoke",
    spawn: io.spawn || spawnSync,
  });
  if (!String(result.stdout || "").includes("stage4m_admin_governance_db_smoke_ok")) {
    throw new Error("Stage 4M admin governance DB smoke did not return its OK marker.");
  }
  console.log("[stage4m-admin-governance-db-smoke] verified admin governance read/write journey against PostgreSQL");
  return { ok: true, dryRun: false, output: redact(result.stdout || "") };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-admin-governance-db-smoke.mjs verify",
    "  node scripts/stage4m-admin-governance-db-smoke.mjs verify --dry-run",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MAdminGovernanceDbSmokeArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4MAdminGovernanceDbSmoke(options);
    if (result.dryRun) console.log(result.output);
    return 0;
  } catch (error) {
    console.error(`[stage4m-admin-governance-db-smoke] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

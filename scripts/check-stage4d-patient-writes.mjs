#!/usr/bin/env node
// Stage 4D · Self-hosted backend patient write API guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/patient-write-service.mjs",
  "backend/self-hosted/patient-write-service.test.mjs",
  "backend/self-hosted/openapi.stage4d.json",
  "backend/self-hosted/db/migrations/0004_stage4d_patient_writes.sql",
  "docs/backend/stage-4d-patient-writes.md",
  ".github/workflows/stage4d-patient-writes.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/patient-write-service.mjs": [
    "createPatientWriteService",
    "normalizeCreatePatientPayload",
    "normalizeUpdatePatientPayload",
    "PatientValidationError",
    "PatientNotFoundError",
    "patient.create",
    "patient.update",
    "patient.archive",
  ],
  "backend/self-hosted/patients-repository.mjs": [
    "buildCreatePatientSql",
    "buildUpdatePatientSql",
    "buildArchivePatientSql",
    "deleted_at = now()",
  ],
  "backend/self-hosted/rbac.mjs": [
    "PATIENT_WRITE_ROLES",
    "patientWriteScope",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4d.json",
    "rbac-read-write-postgres",
    "createPatient",
    "updatePatient",
    "archivePatient",
    "invalid_json",
    "validation_error",
  ],
  "backend/self-hosted/openapi.stage4d.json": [
    "4D-patient-writes",
    "PatientWriteRequest",
    "PatientPatchRequest",
    "archivePatient",
    "bearerAuth",
  ],
  "backend/self-hosted/db/migrations/0004_stage4d_patient_writes.sql": [
    "Stage 4D patient write API support",
    "deleted_at",
    "Soft archive",
    "stage4d.patient_writes_enabled",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "location /openapi.stage4d.json",
  ],
  "docs/backend/stage-4d-patient-writes.md": [
    "Stage 4D",
    "POST /api/v1/patients",
    "PATCH /api/v1/patients/:patientId",
    "DELETE /api/v1/patients/:patientId",
    "No managed backend runtime dependency",
  ],
  ".github/workflows/stage4d-patient-writes.yml": [
    "name: stage4d-patient-writes",
    "npm run preflight:stage4d",
    "GITHUB_STEP_SUMMARY",
  ],
};

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bsupabase\b/i,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bproject-ref\b/i,
  /\bSUPABASE_/,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function requireText(errors, root, file, expected) {
  const content = read(root, file);
  for (const text of expected) {
    if (!content.includes(text)) {
      errors.push(`${file} missing required text: ${text}`);
    }
  }
}

function scanRuntimeCoupling(errors, root) {
  const protectedFiles = [
    "backend/self-hosted/patient-write-service.mjs",
    "backend/self-hosted/patients-repository.mjs",
    "backend/self-hosted/routes.mjs",
    "backend/self-hosted/openapi.stage4d.json",
    "deploy/self-hosted/docker-compose.stage4a.yml",
    "deploy/self-hosted/nginx.stage4a.conf",
  ];
  for (const file of protectedFiles) {
    if (!existsSync(join(root, file))) continue;
    const content = read(root, file);
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden managed-runtime coupling: ${pattern}`);
      }
    }
  }
}

function validateOpenApi(errors, root) {
  try {
    const parsed = JSON.parse(read(root, "backend/self-hosted/openapi.stage4d.json"));
    if (parsed.openapi !== "3.1.0") {
      errors.push("openapi.stage4d.json must use OpenAPI 3.1.0");
    }
    if (parsed.info?.version !== "4D-patient-writes") {
      errors.push("openapi.stage4d.json must expose version 4D-patient-writes");
    }
    if (!parsed.components?.securitySchemes?.bearerAuth) {
      errors.push("openapi.stage4d.json must define bearerAuth security scheme");
    }
    if (!parsed.paths?.["/api/v1/patients"]?.post?.responses?.["201"]) {
      errors.push("openapi.stage4d.json must define POST /api/v1/patients 201");
    }
    const patientIdPath = parsed.paths?.["/api/v1/patients/{patientId}"];
    if (!patientIdPath?.get || !patientIdPath?.patch || !patientIdPath?.delete) {
      errors.push("openapi.stage4d.json must define GET/PATCH/DELETE /api/v1/patients/{patientId}");
    }
  } catch (error) {
    errors.push(`openapi.stage4d.json is not valid JSON: ${error.message}`);
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage4d\"",
    "\"check:stage4d\"",
    "\"preflight:stage4d\"",
  ]) {
    if (!packageJson.includes(script)) {
      errors.push(`package.json missing ${script}`);
    }
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4D patient writes preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4D patient writes preflight");
  }
}

export function collectStage4DChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) {
      requireText(errors, root, file, expected);
    }
  }
  scanRuntimeCoupling(errors, root);
  validateOpenApi(errors, root);
  validatePackageScripts(errors, root);
  return {
    ok: errors.length === 0,
    errors,
    checkedFiles: REQUIRED_FILES.length,
  };
}

export function main() {
  const result = collectStage4DChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4d-patient-writes] failed:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }
  console.log(
    `[check-stage4d-patient-writes] OK (${result.checkedFiles} files, patient write guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

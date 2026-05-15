#!/usr/bin/env node
// Stage 5T · external intake hardening guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0023_stage5t_external_intake_hardening.sql",
  "backend/self-hosted/external-intake-import-repository.mjs",
  "backend/self-hosted/external-intake-import-service.mjs",
  "backend/self-hosted/external-intake-import-repository.test.mjs",
  "backend/self-hosted/external-intake-import-service.test.mjs",
  "backend/self-hosted/openapi.stage5t.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-external-intake-api.ts",
  "src/lib/self-hosted-external-intake-api.test.ts",
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx",
  "src/pages/operator/OperatorBookingRequestsPage.production.test.tsx",
  "docs/backend/stage-5t-external-intake-hardening.md",
  "scripts/check-stage5t-external-intake-hardening.mjs",
  "scripts/check-stage5t-external-intake-hardening.test.mjs",
  ".github/workflows/stage5t-external-intake-hardening.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0023_stage5t_external_intake_hardening.sql": [
    "external_booking_import_batches_idempotency_idx",
    "duplicate_count",
    "external_request_id",
    "third-party runtime",
  ],
  "backend/self-hosted/external-intake-import-repository.mjs": [
    "buildExternalIntakeStatusSql",
    "idempotency_key",
    "duplicate_count",
    "runtimeCallsExternalSystems",
  ],
  "backend/self-hosted/external-intake-import-service.mjs": [
    "FORBIDDEN_IMPORT_VALUE_PATTERNS",
    "Raw external URLs",
    "external_intake.import.status",
    "stage5t",
  ],
  "backend/self-hosted/routes.mjs": [
    "OPENAPI_5T",
    "/api/v1/integrations/booking-imports/status",
    "stage: \"5T\"",
    "externalBookingImportStatus",
  ],
  "backend/self-hosted/openapi.stage5t.json": [
    "5T-external-intake-hardening",
    "/api/v1/integrations/booking-imports/status",
    "idempotencyKey",
    "runtimeCallsExternalSystems",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": ["/openapi.stage5t.json"],
  "src/lib/self-hosted-external-intake-api.ts": [
    "getSelfHostedExternalIntakeStatus",
    "/api/v1/integrations/booking-imports/status",
    "runtimeCallsExternalSystems",
  ],
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx": [
    "Hardening:",
    "Дубликаты 24ч",
    "runtime calls",
    "getSelfHostedExternalIntakeStatus",
  ],
  "docs/backend/stage-5t-external-intake-hardening.md": [
    "Stage 5T",
    "npm run preflight:stage5t",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage5t-external-intake-hardening.yml": [
    "name: stage5t-external-intake-hardening",
    "npm run preflight:stage5t",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/external-intake-import-repository.mjs",
  "backend/self-hosted/external-intake-import-service.mjs",
  "backend/self-hosted/openapi.stage5t.json",
  "src/lib/self-hosted-external-intake-api.ts",
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx",
];

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bSUPABASE_/,
  /\bnavigator\.usb\b/i,
  /\bnavigator\.bluetooth\b/i,
  /\bnavigator\.serial\b/i,
  /\bstorage_object_path\b/i,
  /\bsigned_url\b/i,
  /\bmock-data\b/i,
  /\bphysician_text\b/i,
  /\bphysicianText\b/i,
  /\bdoctorVersionText\b/i,
  /fetch\s*\(\s*["'`]https?:\/\//i,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function requireText(errors, root, file, expected) {
  const content = read(root, file);
  for (const text of expected) {
    if (!content.includes(text)) errors.push(`${file} missing required text: ${text}`);
  }
}

function scanRuntimeCoupling(errors, root) {
  for (const file of PROTECTED_RUNTIME_FILES) {
    if (!existsSync(join(root, file))) continue;
    const content = read(root, file);
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden production runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of ['"test:stage5t"', '"check:stage5t"', '"preflight:stage5t"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5T external intake hardening preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5T external intake hardening preflight");
  }
}

export function collectStage5TChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required file (text check): ${file}`);
  }
  scanRuntimeCoupling(errors, root);
  validatePackageScripts(errors, root);
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectStage5TChecks();
  if (!result.ok) {
    console.error("[stage5t-external-intake-hardening] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5t-external-intake-hardening] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

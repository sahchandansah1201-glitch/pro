#!/usr/bin/env node
// Stage 5R · clinic available slots contract guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0021_stage5r_clinic_available_slots_contract.sql",
  "backend/self-hosted/clinic-available-slots-repository.mjs",
  "backend/self-hosted/clinic-available-slots-service.mjs",
  "backend/self-hosted/clinic-available-slots-repository.test.mjs",
  "backend/self-hosted/clinic-available-slots-service.test.mjs",
  "backend/self-hosted/openapi.stage5r.json",
  "backend/self-hosted/routes.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-clinic-availability-api.ts",
  "src/lib/self-hosted-clinic-availability-api.test.ts",
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx",
  "src/pages/operator/OperatorBookingRequestsPage.production.test.tsx",
  "docs/backend/stage-5r-clinic-available-slots-contract.md",
  "scripts/check-stage5r-clinic-available-slots-contract.mjs",
  "scripts/check-stage5r-clinic-available-slots-contract.test.mjs",
  ".github/workflows/stage5r-clinic-available-slots-contract.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0021_stage5r_clinic_available_slots_contract.sql": [
    "clinic_available_slots_clinic_status_started_idx",
    "third-party managed service",
  ],
  "backend/self-hosted/clinic-available-slots-repository.mjs": [
    "buildClinicAvailableSlotsSql",
    "clinic_available_slots",
    "normalizeClinicAvailableSlotParams",
  ],
  "backend/self-hosted/clinic-available-slots-service.mjs": [
    "clinic_available_slot.list",
    "never calls the clinic CRM",
  ],
  "backend/self-hosted/routes.mjs": [
    "OPENAPI_5R",
    "/api/v1/clinic/available-slots",
    "stage: \"5R\"",
    "clinicAvailableSlots",
  ],
  "backend/self-hosted/openapi.stage5r.json": [
    "5R-clinic-available-slots-contract",
    "/api/v1/clinic/available-slots",
    "ClinicAvailableSlot",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": ["/openapi.stage5r.json"],
  "src/lib/self-hosted-clinic-availability-api.ts": [
    "listSelfHostedClinicAvailableSlots",
    "/api/v1/clinic/available-slots",
  ],
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx": [
    "Свободные окна клиники",
    "listSelfHostedClinicAvailableSlots",
    "локальный кэш",
  ],
  "docs/backend/stage-5r-clinic-available-slots-contract.md": [
    "Stage 5R",
    "npm run preflight:stage5r",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage5r-clinic-available-slots-contract.yml": [
    "name: stage5r-clinic-available-slots-contract",
    "npm run preflight:stage5r",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/clinic-available-slots-repository.mjs",
  "backend/self-hosted/clinic-available-slots-service.mjs",
  "backend/self-hosted/openapi.stage5r.json",
  "src/lib/self-hosted-clinic-availability-api.ts",
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
  for (const script of ['"test:stage5r"', '"check:stage5r"', '"preflight:stage5r"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5R clinic available slots contract preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5R clinic available slots contract preflight");
  }
}

export function collectStage5RChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5RChecks();
  if (!result.ok) {
    console.error("[stage5r-clinic-available-slots-contract] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5r-clinic-available-slots-contract] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

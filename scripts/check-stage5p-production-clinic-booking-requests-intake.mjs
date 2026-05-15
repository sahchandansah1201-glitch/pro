#!/usr/bin/env node
// Stage 5P · production clinic booking requests intake guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0019_stage5p_clinic_booking_requests_intake.sql",
  "backend/self-hosted/clinic-booking-requests-repository.mjs",
  "backend/self-hosted/clinic-booking-requests-service.mjs",
  "backend/self-hosted/clinic-booking-requests-repository.test.mjs",
  "backend/self-hosted/clinic-booking-requests-service.test.mjs",
  "backend/self-hosted/openapi.stage5p.json",
  "backend/self-hosted/routes.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-clinic-booking-api.ts",
  "src/lib/self-hosted-clinic-booking-api.test.ts",
  "src/pages/operator/OperatorBookingRequestsPage.tsx",
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx",
  "src/pages/operator/OperatorBookingRequestsPageDemo.tsx",
  "src/pages/operator/OperatorBookingRequestsPage.production.test.tsx",
  "src/App.tsx",
  "src/components/shell/AppSidebar.tsx",
  "docs/backend/stage-5p-production-clinic-booking-requests-intake.md",
  "scripts/check-stage5p-production-clinic-booking-requests-intake.mjs",
  "scripts/check-stage5p-production-clinic-booking-requests-intake.test.mjs",
  ".github/workflows/stage5p-production-clinic-booking-requests-intake.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0019_stage5p_clinic_booking_requests_intake.sql": [
    "assigned_visit_id",
    "reviewed_by_user_id",
    "clinic_note",
    "patient_portal_booking_requests_clinic_status_created_idx",
  ],
  "backend/self-hosted/clinic-booking-requests-repository.mjs": [
    "buildClinicBookingRequestsSql",
    "buildUpdateClinicBookingRequestSql",
    "patient_portal_booking_requests",
    "assigned_visit_id",
  ],
  "backend/self-hosted/clinic-booking-requests-service.mjs": [
    "normalizeClinicBookingRequestUpdatePayload",
    "clinic_booking_request.list",
    "clinic_booking_request.read",
    "clinic_booking_request.update",
  ],
  "backend/self-hosted/routes.mjs": [
    "OPENAPI_5P",
    "/api/v1/clinic/booking-requests",
    "stage: \"5P\"",
    "clinicBookingRequests",
  ],
  "backend/self-hosted/openapi.stage5p.json": [
    "5P-clinic-booking-requests-intake",
    "/api/v1/clinic/booking-requests",
    "ClinicBookingRequest",
  ],
  "src/lib/self-hosted-clinic-booking-api.ts": [
    "listSelfHostedClinicBookingRequests",
    "getSelfHostedClinicBookingRequest",
    "updateSelfHostedClinicBookingRequest",
    "/api/v1/clinic/booking-requests",
  ],
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx": [
    "Production booking requests",
    "listSelfHostedClinicBookingRequests",
    "updateSelfHostedClinicBookingRequest",
    "Подтвердить запись",
  ],
  "src/App.tsx": ["/operator/booking-requests", "OperatorBookingRequestsPage"],
  "src/components/shell/AppSidebar.tsx": ["Запросы на запись", "/operator/booking-requests"],
  "docs/backend/stage-5p-production-clinic-booking-requests-intake.md": [
    "Stage 5P",
    "npm run preflight:stage5p",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage5p-production-clinic-booking-requests-intake.yml": [
    "name: stage5p-production-clinic-booking-requests-intake",
    "npm run preflight:stage5p",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/clinic-booking-requests-repository.mjs",
  "backend/self-hosted/clinic-booking-requests-service.mjs",
  "backend/self-hosted/openapi.stage5p.json",
  "src/lib/self-hosted-clinic-booking-api.ts",
  "src/pages/operator/OperatorBookingRequestsPage.tsx",
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx",
  "src/pages/operator/OperatorBookingRequestsPageDemo.tsx",
  "src/components/shell/AppSidebar.tsx",
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
  /https:\/\/[^"`']+/i,
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
  for (const script of ['"test:stage5p"', '"check:stage5p"', '"preflight:stage5p"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5P production clinic booking requests intake preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5P production clinic booking requests intake preflight");
  }
}

export function collectStage5PChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5PChecks();
  if (!result.ok) {
    console.error("[stage5p-production-clinic-booking-requests-intake] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5p-production-clinic-booking-requests-intake] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

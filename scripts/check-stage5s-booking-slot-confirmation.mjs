#!/usr/bin/env node
// Stage 5S · booking slot confirmation guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0022_stage5s_booking_slot_confirmation.sql",
  "backend/self-hosted/clinic-booking-requests-repository.mjs",
  "backend/self-hosted/clinic-booking-requests-service.mjs",
  "backend/self-hosted/clinic-booking-requests-repository.test.mjs",
  "backend/self-hosted/clinic-booking-requests-service.test.mjs",
  "backend/self-hosted/openapi.stage5s.json",
  "backend/self-hosted/routes.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-clinic-booking-api.ts",
  "src/lib/self-hosted-clinic-booking-api.test.ts",
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx",
  "src/pages/operator/OperatorBookingRequestsPage.production.test.tsx",
  "docs/backend/stage-5s-booking-slot-confirmation.md",
  "scripts/check-stage5s-booking-slot-confirmation.mjs",
  "scripts/check-stage5s-booking-slot-confirmation.test.mjs",
  ".github/workflows/stage5s-booking-slot-confirmation.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0022_stage5s_booking_slot_confirmation.sql": [
    "patient_portal_booking_requests_open_assignment_idx",
    "clinic_available_slots_available_id_idx",
    "no CRM runtime call",
  ],
  "backend/self-hosted/clinic-booking-requests-repository.mjs": [
    "buildBookClinicBookingRequestFromSlotSql",
    "clinic_available_slots",
    "insert into visits",
    "status = 'booked'",
  ],
  "backend/self-hosted/clinic-booking-requests-service.mjs": [
    "normalizeClinicBookingRequestSlotBookingPayload",
    "bookBookingRequestFromSlot",
    "clinic_booking_request.book_from_slot",
    "local_slot_cache",
  ],
  "backend/self-hosted/routes.mjs": [
    "OPENAPI_5S",
    "/api/v1/clinic/booking-requests/{requestId}/book-from-slot",
    "/book-from-slot",
    "stage: \"5S\"",
    "clinicBookingSlotConfirmation",
  ],
  "backend/self-hosted/openapi.stage5s.json": [
    "5S-booking-slot-confirmation",
    "/api/v1/clinic/booking-requests/{requestId}/book-from-slot",
    "BookClinicBookingRequestFromSlot",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": ["/openapi.stage5s.json"],
  "src/lib/self-hosted-clinic-booking-api.ts": [
    "bookSelfHostedClinicBookingRequestFromSlot",
    "/book-from-slot",
  ],
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx": [
    "Свободное окно для записи",
    "bookSelfHostedClinicBookingRequestFromSlot",
    "локальный кэш",
  ],
  "docs/backend/stage-5s-booking-slot-confirmation.md": [
    "Stage 5S",
    "npm run preflight:stage5s",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage5s-booking-slot-confirmation.yml": [
    "name: stage5s-booking-slot-confirmation",
    "npm run preflight:stage5s",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/clinic-booking-requests-repository.mjs",
  "backend/self-hosted/clinic-booking-requests-service.mjs",
  "backend/self-hosted/openapi.stage5s.json",
  "src/lib/self-hosted-clinic-booking-api.ts",
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
  for (const script of ['"test:stage5s"', '"check:stage5s"', '"preflight:stage5s"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5S booking slot confirmation preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5S booking slot confirmation preflight");
  }
}

export function collectStage5SChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5SChecks();
  if (!result.ok) {
    console.error("[stage5s-booking-slot-confirmation] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5s-booking-slot-confirmation] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

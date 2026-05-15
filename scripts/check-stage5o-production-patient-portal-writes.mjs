#!/usr/bin/env node
// Stage 5O · production patient portal writes guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0018_stage5o_patient_portal_writes.sql",
  "backend/self-hosted/patient-portal-repository.mjs",
  "backend/self-hosted/patient-portal-service.mjs",
  "backend/self-hosted/patient-portal-repository.test.mjs",
  "backend/self-hosted/patient-portal-service.test.mjs",
  "backend/self-hosted/openapi.stage5o.json",
  "backend/self-hosted/routes.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-patient-portal-api.ts",
  "src/lib/self-hosted-patient-portal-api.test.ts",
  "src/pages/patient/MeBookingPageLive.tsx",
  "src/pages/patient/MeRemindersPageLive.tsx",
  "src/pages/patient/MePages.production.test.tsx",
  "docs/backend/stage-5o-production-patient-portal-writes.md",
  "scripts/check-stage5o-production-patient-portal-writes.mjs",
  "scripts/check-stage5o-production-patient-portal-writes.test.mjs",
  ".github/workflows/stage5o-production-patient-portal-writes.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0018_stage5o_patient_portal_writes.sql": [
    "create table if not exists patient_portal_booking_requests",
    "create table if not exists patient_portal_reminder_preferences",
    "No external notification provider dependency",
  ],
  "backend/self-hosted/patient-portal-repository.mjs": [
    "buildCreatePatientPortalBookingRequestSql",
    "buildUpdatePatientPortalReminderPreferencesSql",
    "patient_portal_booking_requests",
    "patient_portal_reminder_preferences",
  ],
  "backend/self-hosted/patient-portal-service.mjs": [
    "normalizePatientPortalBookingRequestPayload",
    "normalizePatientPortalReminderPreferencesPayload",
    "patient_portal.booking_request.create",
    "patient_portal.reminder_preferences.update",
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/me/booking-requests",
    "/api/v1/me/reminder-preferences",
    "OPENAPI_5O",
    "stage: \"5O\"",
  ],
  "backend/self-hosted/openapi.stage5o.json": [
    "5O-patient-portal-writes",
    "/api/v1/me/booking-requests",
    "/api/v1/me/reminder-preferences",
  ],
  "src/lib/self-hosted-patient-portal-api.ts": [
    "createSelfHostedPatientPortalBookingRequest",
    "updateSelfHostedPatientPortalReminderPreferences",
    "/api/v1/me/booking-requests",
    "/api/v1/me/reminder-preferences",
  ],
  "src/pages/patient/MeBookingPageLive.tsx": [
    "Отправить запрос",
    "createSelfHostedPatientPortalBookingRequest",
  ],
  "src/pages/patient/MeRemindersPageLive.tsx": [
    "Сохранить настройки",
    "updateSelfHostedPatientPortalReminderPreferences",
  ],
  "docs/backend/stage-5o-production-patient-portal-writes.md": [
    "Stage 5O",
    "npm run preflight:stage5o",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage5o-production-patient-portal-writes.yml": [
    "name: stage5o-production-patient-portal-writes",
    "npm run preflight:stage5o",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/patient-portal-repository.mjs",
  "backend/self-hosted/patient-portal-service.mjs",
  "backend/self-hosted/openapi.stage5o.json",
  "src/lib/self-hosted-patient-portal-api.ts",
  "src/pages/patient/MeBookingPage.tsx",
  "src/pages/patient/MeBookingPageLive.tsx",
  "src/pages/patient/MeRemindersPage.tsx",
  "src/pages/patient/MeRemindersPageLive.tsx",
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
  /\bcrm\b/i,
  /\bexternal notification provider\b/i,
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
  for (const script of ['"test:stage5o"', '"check:stage5o"', '"preflight:stage5o"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5O production patient portal writes preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5O production patient portal writes preflight");
  }
}

export function collectStage5OChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5OChecks();
  if (!result.ok) {
    console.error("[stage5o-production-patient-portal-writes] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5o-production-patient-portal-writes] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

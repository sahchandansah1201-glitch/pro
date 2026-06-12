#!/usr/bin/env node
// Stage 5I · production doctor dashboard contracts guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/doctor-dashboard-repository.mjs",
  "backend/self-hosted/doctor-dashboard-repository.test.mjs",
  "backend/self-hosted/doctor-dashboard-service.mjs",
  "backend/self-hosted/doctor-dashboard-service.test.mjs",
  "backend/self-hosted/openapi.stage5i.json",
  "src/lib/self-hosted-dashboard-api.ts",
  "src/lib/self-hosted-dashboard-api.test.ts",
  "src/pages/doctor/DeskPage.tsx",
  "src/pages/doctor/DeskPageLive.tsx",
  "src/pages/doctor/DeskPageDemo.tsx",
  "src/pages/doctor/DeskPage.test.tsx",
  "docs/backend/stage-5i-production-doctor-dashboard-contracts.md",
  "scripts/check-stage5i-production-doctor-dashboard-contracts.mjs",
  "scripts/check-stage5i-production-doctor-dashboard-contracts.test.mjs",
  ".github/workflows/stage5i-production-doctor-dashboard-contracts.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/doctor-dashboard-repository.mjs": [
    "buildDoctorDashboardSql",
    "createDoctorDashboardRepository",
    "normalizeDoctorDashboard",
    "clinical_assets",
    "medical_devices",
  ],
  "backend/self-hosted/doctor-dashboard-service.mjs": [
    "createDoctorDashboardService",
    "doctor.dashboard.read",
    "visitReadScope",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage5i.json",
    "doctorDashboardService",
    "/api/v1/doctor/dashboard",
    "stage: \"5I\"",
  ],
  "backend/self-hosted/openapi.stage5i.json": [
    "5I-doctor-dashboard-contracts",
    "/api/v1/doctor/dashboard",
    "DoctorDashboardResponse",
  ],
  "src/lib/self-hosted-dashboard-api.ts": [
    "getSelfHostedDoctorDashboard",
    "toSelfHostedDoctorDashboard",
    "/api/v1/doctor/dashboard",
  ],
  "src/pages/doctor/DeskPage.tsx": [
    "isProductionAppMode",
    "DeskPageLive",
    "DeskPageDemo",
  ],
  "src/pages/doctor/DeskPageLive.tsx": [
    "getSelfHostedDoctorDashboard",
    "Источник данных: система клиники.",
    "Рабочий стол",
  ],
  "docs/backend/stage-5i-production-doctor-dashboard-contracts.md": [
    "Stage 5I",
    "GET /api/v1/doctor/dashboard",
    "npm run preflight:stage5i",
  ],
  ".github/workflows/stage5i-production-doctor-dashboard-contracts.yml": [
    "name: stage5i-production-doctor-dashboard-contracts",
    "npm run preflight:stage5i",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/doctor-dashboard-repository.mjs",
  "backend/self-hosted/doctor-dashboard-service.mjs",
  "backend/self-hosted/openapi.stage5i.json",
  "src/lib/self-hosted-dashboard-api.ts",
  "src/pages/doctor/DeskPage.tsx",
  "src/pages/doctor/DeskPageLive.tsx",
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
  for (const script of ['"test:stage5i"', '"check:stage5i"', '"preflight:stage5i"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5I production doctor dashboard contracts preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5I production doctor dashboard contracts preflight");
  }
}

export function collectStage5IChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5IChecks();
  if (!result.ok) {
    console.error("[stage5i-production-doctor-dashboard-contracts] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5i-production-doctor-dashboard-contracts] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

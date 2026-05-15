#!/usr/bin/env node
// Stage 5J · production visit schedule contracts guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/visit-schedule-repository.mjs",
  "backend/self-hosted/visit-schedule-repository.test.mjs",
  "backend/self-hosted/visit-schedule-service.mjs",
  "backend/self-hosted/visit-schedule-service.test.mjs",
  "backend/self-hosted/openapi.stage5j.json",
  "src/lib/self-hosted-visit-api.ts",
  "src/lib/self-hosted-visit-api.test.ts",
  "src/pages/doctor/VisitsPage.tsx",
  "src/pages/doctor/VisitsPageLive.tsx",
  "src/pages/doctor/VisitsPageDemo.tsx",
  "src/pages/doctor/VisitsPage.test.tsx",
  "docs/backend/stage-5j-production-visit-schedule-contracts.md",
  "scripts/check-stage5j-production-visit-schedule-contracts.mjs",
  "scripts/check-stage5j-production-visit-schedule-contracts.test.mjs",
  ".github/workflows/stage5j-production-visit-schedule-contracts.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/visit-schedule-repository.mjs": [
    "buildVisitScheduleSql",
    "createVisitScheduleRepository",
    "normalizeVisitSchedule",
    "visits v",
    "patients p",
  ],
  "backend/self-hosted/visit-schedule-service.mjs": [
    "createVisitScheduleService",
    "visit.schedule.list",
    "visitReadScope",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage5j.json",
    "visitScheduleService",
    "/api/v1/visits",
    "stage: \"5J\"",
  ],
  "backend/self-hosted/openapi.stage5j.json": [
    "5J-visit-schedule-contracts",
    "/api/v1/visits",
    "VisitScheduleItem",
  ],
  "src/lib/self-hosted-visit-api.ts": [
    "listSelfHostedVisits",
    "SelfHostedVisitScheduleResult",
    "/api/v1/visits",
  ],
  "src/pages/doctor/VisitsPage.tsx": [
    "isProductionAppMode",
    "VisitsPageLive",
    "VisitsPageDemo",
  ],
  "src/pages/doctor/VisitsPageLive.tsx": [
    "listSelfHostedVisits",
    "Источник данных: self-hosted backend /api/v1/visits",
    "Production расписание",
  ],
  "docs/backend/stage-5j-production-visit-schedule-contracts.md": [
    "Stage 5J",
    "GET /api/v1/visits",
    "npm run preflight:stage5j",
  ],
  ".github/workflows/stage5j-production-visit-schedule-contracts.yml": [
    "name: stage5j-production-visit-schedule-contracts",
    "npm run preflight:stage5j",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/visit-schedule-repository.mjs",
  "backend/self-hosted/visit-schedule-service.mjs",
  "backend/self-hosted/openapi.stage5j.json",
  "src/lib/self-hosted-visit-api.ts",
  "src/pages/doctor/VisitsPage.tsx",
  "src/pages/doctor/VisitsPageLive.tsx",
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
  for (const script of ['"test:stage5j"', '"check:stage5j"', '"preflight:stage5j"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5J production visit schedule contracts preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5J production visit schedule contracts preflight");
  }
}

export function collectStage5JChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5JChecks();
  if (!result.ok) {
    console.error("[stage5j-production-visit-schedule-contracts] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5j-production-visit-schedule-contracts] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

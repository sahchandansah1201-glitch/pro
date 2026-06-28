#!/usr/bin/env node
// Stage 5K · production leads/appointments contracts guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0015_stage5k_leads_appointments_contract.sql",
  "backend/self-hosted/leads-appointments-repository.mjs",
  "backend/self-hosted/leads-appointments-repository.test.mjs",
  "backend/self-hosted/leads-appointments-service.mjs",
  "backend/self-hosted/leads-appointments-service.test.mjs",
  "backend/self-hosted/openapi.stage5k.json",
  "src/lib/self-hosted-leads-appointments-api.ts",
  "src/lib/self-hosted-leads-appointments-api.test.ts",
  "src/pages/doctor/DeskPageLive.tsx",
  "src/pages/doctor/DeskPage.test.tsx",
  "docs/backend/stage-5k-production-leads-appointments-contracts.md",
  "scripts/check-stage5k-production-leads-appointments-contracts.mjs",
  "scripts/check-stage5k-production-leads-appointments-contracts.test.mjs",
  ".github/workflows/stage5k-production-leads-appointments-contracts.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0015_stage5k_leads_appointments_contract.sql": [
    "create table if not exists leads",
    "Stage 5K self-hosted lead intake contract",
  ],
  "backend/self-hosted/leads-appointments-repository.mjs": [
    "buildLeadsAppointmentsSql",
    "createLeadsAppointmentsRepository",
    "from leads l",
    "from visits v",
  ],
  "backend/self-hosted/leads-appointments-service.mjs": [
    "createLeadsAppointmentsService",
    "leads.appointments.overview.read",
    "leadsAppointmentsReadScope",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage5k.json",
    "/api/v1/leads/appointments",
    "leadsAppointmentsService",
    "stage: \"5K\"",
  ],
  "backend/self-hosted/openapi.stage5k.json": [
    "5K-leads-appointments-contracts",
    "/api/v1/leads/appointments",
    "LeadsAppointmentsResponse",
  ],
  "src/lib/self-hosted-leads-appointments-api.ts": [
    "listSelfHostedLeadsAppointments",
    "SelfHostedLeadsAppointmentsOverview",
    "/api/v1/leads/appointments",
  ],
  "src/pages/doctor/DeskPageLive.tsx": [
    "listSelfHostedLeadsAppointments",
    "Источник данных: система клиники.",
    "Заявки и записи",
  ],
  "docs/backend/stage-5k-production-leads-appointments-contracts.md": [
    "Stage 5K",
    "GET /api/v1/leads/appointments",
    "npm run preflight:stage5k",
  ],
  ".github/workflows/stage5k-production-leads-appointments-contracts.yml": [
    "name: stage5k-production-leads-appointments-contracts",
    "npm run preflight:stage5k",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/leads-appointments-repository.mjs",
  "backend/self-hosted/leads-appointments-service.mjs",
  "backend/self-hosted/openapi.stage5k.json",
  "src/lib/self-hosted-leads-appointments-api.ts",
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
  for (const script of ['"test:stage5k"', '"check:stage5k"', '"preflight:stage5k"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5K production leads/appointments contracts preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5K production leads/appointments contracts preflight");
  }
}

export function collectStage5KChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5KChecks();
  if (!result.ok) {
    console.error("[stage5k-production-leads-appointments-contracts] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5k-production-leads-appointments-contracts] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

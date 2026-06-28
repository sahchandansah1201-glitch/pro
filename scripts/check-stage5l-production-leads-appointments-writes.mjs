#!/usr/bin/env node
// Stage 5L · production leads/appointments write contracts guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0016_stage5l_leads_appointments_write_contract.sql",
  "backend/self-hosted/leads-appointments-write-repository.mjs",
  "backend/self-hosted/leads-appointments-write-repository.test.mjs",
  "backend/self-hosted/leads-appointments-write-service.mjs",
  "backend/self-hosted/leads-appointments-write-service.test.mjs",
  "backend/self-hosted/openapi.stage5l.json",
  "src/lib/self-hosted-leads-appointments-api.ts",
  "src/lib/self-hosted-leads-appointments-api.test.ts",
  "src/pages/doctor/DeskPageLive.tsx",
  "src/pages/doctor/DeskPage.test.tsx",
  "docs/backend/stage-5l-production-leads-appointments-writes.md",
  "scripts/check-stage5l-production-leads-appointments-writes.mjs",
  "scripts/check-stage5l-production-leads-appointments-writes.test.mjs",
  ".github/workflows/stage5l-production-leads-appointments-writes.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0016_stage5l_leads_appointments_write_contract.sql": [
    "Stage 5L",
    "leads_created_by_created_idx",
    "operator-owned PostgreSQL",
  ],
  "backend/self-hosted/leads-appointments-write-repository.mjs": [
    "buildCreateLeadSql",
    "buildUpdateLeadStatusSql",
    "buildBookLeadAppointmentSql",
    "with inserted as",
    "with updated as",
    "with selected_lead as",
    "insert into visits",
  ],
  "backend/self-hosted/leads-appointments-write-service.mjs": [
    "createLeadsAppointmentsWriteService",
    "lead.create",
    "lead.status.update",
    "lead.appointment.book",
    "leadsAppointmentsWriteScope",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage5l.json",
    "/api/v1/leads",
    "/book-appointment",
    "leadsAppointmentsWriteService",
    "stage: \"5L\"",
  ],
  "backend/self-hosted/openapi.stage5l.json": [
    "5L-leads-appointments-writes",
    "/api/v1/leads/{leadId}/book-appointment",
    "BookLeadAppointmentRequest",
  ],
  "src/lib/self-hosted-leads-appointments-api.ts": [
    "createSelfHostedLead",
    "updateSelfHostedLeadStatus",
    "bookSelfHostedLeadAppointment",
    "/api/v1/leads",
  ],
  "src/pages/doctor/DeskPageLive.tsx": [
    "createSelfHostedLead",
    "Краткое описание заявки",
    "Квалифицировать заявку",
    "Создать запись из заявки",
  ],
  "docs/backend/stage-5l-production-leads-appointments-writes.md": [
    "Stage 5L",
    "POST /api/v1/leads",
    "POST /api/v1/leads/{leadId}/book-appointment",
    "npm run preflight:stage5l",
  ],
  ".github/workflows/stage5l-production-leads-appointments-writes.yml": [
    "name: stage5l-production-leads-appointments-writes",
    "npm run preflight:stage5l",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/leads-appointments-write-repository.mjs",
  "backend/self-hosted/leads-appointments-write-service.mjs",
  "backend/self-hosted/openapi.stage5l.json",
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
  /\bcrm\b/i,
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
  for (const script of ['"test:stage5l"', '"check:stage5l"', '"preflight:stage5l"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5L production leads/appointments writes preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5L production leads/appointments writes preflight");
  }
}

export function collectStage5LChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5LChecks();
  if (!result.ok) {
    console.error("[stage5l-production-leads-appointments-writes] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5l-production-leads-appointments-writes] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

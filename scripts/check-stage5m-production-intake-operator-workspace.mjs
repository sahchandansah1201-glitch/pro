#!/usr/bin/env node
// Stage 5M · production intake operator workspace guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "src/pages/operator/OperatorConsolePage.tsx",
  "src/pages/operator/OperatorConsolePageDemo.tsx",
  "src/pages/operator/OperatorConsolePageLive.tsx",
  "src/pages/operator/OperatorConsolePage.production.test.tsx",
  "src/pages/operator/OperatorConsolePage.live.test.tsx",
  "src/lib/self-hosted-leads-appointments-api.ts",
  "src/components/shell/AppSidebar.tsx",
  "docs/backend/stage-5m-production-intake-operator-workspace.md",
  "scripts/check-stage5m-production-intake-operator-workspace.mjs",
  "scripts/check-stage5m-production-intake-operator-workspace.test.mjs",
  ".github/workflows/stage5m-production-intake-operator-workspace.yml",
];

const REQUIRED_TEXT = {
  "src/pages/operator/OperatorConsolePage.tsx": [
    "isProductionAppMode",
    "OperatorConsolePageLive",
    "OperatorConsolePageDemo",
  ],
  "src/pages/operator/OperatorConsolePageDemo.tsx": [
    "OperatorConsolePageDemo",
    "getDialogs",
  ],
  "src/pages/operator/OperatorConsolePageLive.tsx": [
    "Консоль оператора",
    "Данные загружены из системы клиники.",
    "listSelfHostedLeadsAppointments",
    "createSelfHostedLead",
    "updateSelfHostedLeadStatus",
    "bookSelfHostedLeadAppointment",
    "Создать заявку",
    "Уточнить",
    "Записать",
    "Экран показывает только рабочие заявки оператора.",
  ],
  "src/pages/operator/OperatorConsolePage.production.test.tsx": [
    "Stage 5M production intake",
    "https://clinic.local/api/v1/leads/appointments?limit=20",
    "https://clinic.local/api/v1/leads",
    "https://clinic.local/api/v1/leads/lead-live-1",
    "https://clinic.local/api/v1/leads/lead-live-1/book-appointment",
  ],
  "src/lib/self-hosted-leads-appointments-api.ts": [
    "listSelfHostedLeadsAppointments",
    "createSelfHostedLead",
    "updateSelfHostedLeadStatus",
    "bookSelfHostedLeadAppointment",
    "/api/v1/leads/appointments",
  ],
  "src/components/shell/AppSidebar.tsx": [
    "PRODUCTION_NAV_BY_ROLE",
    "Заявки",
    "Запросы на запись",
  ],
  "docs/backend/stage-5m-production-intake-operator-workspace.md": [
    "Stage 5M",
    "/operator",
    "npm run preflight:stage5m",
    "self-hosted backend",
  ],
  ".github/workflows/stage5m-production-intake-operator-workspace.yml": [
    "name: stage5m-production-intake-operator-workspace",
    "npm run preflight:stage5m",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "src/pages/operator/OperatorConsolePage.tsx",
  "src/pages/operator/OperatorConsolePageLive.tsx",
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
  for (const script of ['"test:stage5m"', '"check:stage5m"', '"preflight:stage5m"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5M production intake operator workspace preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5M production intake operator workspace preflight");
  }
}

export function collectStage5MChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5MChecks();
  if (!result.ok) {
    console.error("[stage5m-production-intake-operator-workspace] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5m-production-intake-operator-workspace] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

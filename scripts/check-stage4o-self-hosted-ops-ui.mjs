#!/usr/bin/env node
// Stage 4O · Self-hosted operations UI guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "src/lib/self-hosted-ops-api.ts",
  "src/lib/self-hosted-ops-api.test.ts",
  "src/pages/sys/SysSelfHostedOpsPage.tsx",
  "src/pages/sys/SysSelfHostedOpsPage.test.tsx",
  "e2e/sys-self-hosted-ops.pw.ts",
  "scripts/check-stage4o-self-hosted-ops-ui.mjs",
  "scripts/check-stage4o-self-hosted-ops-ui.test.mjs",
  "docs/backend/stage-4o-self-hosted-ops-ui.md",
  ".github/workflows/stage4o-self-hosted-ops-ui.yml",
];

const REQUIRED_TEXT = {
  "src/lib/self-hosted-ops-api.ts": [
    "/api/v1/ops/status",
    "buildStage4OAuditExportPreview",
    "STAGE4O_AUDIT_EXPORT_COMMAND",
    "ops:stage4n:audit-export:dry-run",
  ],
  "src/pages/sys/SysSelfHostedOpsPage.tsx": [
    "Рабочий контур",
    "Граница рабочего контура",
    "Зависимости рабочего контура",
    "Договор наблюдаемости",
    "План экспорта аудита",
    "Рабочая сессия не подключена",
    "служебная проверка",
  ],
  "src/App.tsx": [
    "SysSelfHostedOpsPage",
    "/sys/self-hosted-ops",
  ],
  "src/components/shell/AppSidebar.tsx": [
    "Рабочий контур",
    "/sys/self-hosted-ops",
  ],
  "e2e/sys-self-hosted-ops.pw.ts": [
    "/sys/self-hosted-ops",
    "Скачать предпросмотр",
    "self-hosted|PostgreSQL|backend-owned",
    "clinic_admin demo role is blocked by route guard",
  ],
  "docs/backend/stage-4o-self-hosted-ops-ui.md": [
    "Stage 4O",
    "npm run preflight:stage4o",
    "/sys/self-hosted-ops",
    "/api/v1/ops/status",
    "e2e:stage4o",
  ],
  ".github/workflows/stage4o-self-hosted-ops-ui.yml": [
    "name: stage4o-self-hosted-ops-ui",
    "npm run preflight:stage4o",
    "npm run e2e:stage4o",
    "GITHUB_STEP_SUMMARY",
  ],
};

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bsupabase\b/i,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bSUPABASE_/,
];

const PROTECTED_RUNTIME_FILES = [
  "src/lib/self-hosted-ops-api.ts",
  "src/pages/sys/SysSelfHostedOpsPage.tsx",
  "e2e/sys-self-hosted-ops.pw.ts",
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
        errors.push(`${file} contains forbidden managed-runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage4o"',
    '"check:stage4o"',
    '"preflight:stage4o"',
    '"e2e:stage4o"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4O self-hosted ops UI preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4O self-hosted ops UI preflight");
  }
}

export function collectStage4OChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4OChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4o-self-hosted-ops-ui] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4o-self-hosted-ops-ui] OK (${result.checkedFiles} files, self-hosted ops UI verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

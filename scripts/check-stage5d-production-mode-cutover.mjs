#!/usr/bin/env node
// Stage 5D · production mode cutover guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "src/lib/app-mode.ts",
  "src/lib/app-mode.test.ts",
  "src/lib/self-hosted-role.ts",
  "src/lib/self-hosted-role.test.ts",
  "src/components/shell/AppLayout.tsx",
  "src/components/shell/AppLayout.test.tsx",
  "src/components/shell/AppSidebar.tsx",
  "src/components/shell/RoleGuard.tsx",
  "src/components/shell/RoleGuard.test.tsx",
  "src/components/shell/RoleHome.tsx",
  "src/components/shell/RoleHome.test.tsx",
  "docs/backend/stage-5d-production-mode-cutover.md",
  ".github/workflows/stage5d-production-mode-cutover.yml",
  "scripts/preflight-all.mjs",
  "package.json",
];

const REQUIRED_TEXT = {
  "src/lib/app-mode.ts": [
    "VITE_APP_MODE",
    "\"production\"",
    "\"demo\"",
    "isProductionAppMode",
  ],
  "src/lib/self-hosted-role.ts": [
    "selfHostedRoles",
    "selfHostedHomePath",
    "canSelfHostedSessionAccessPath",
  ],
  "src/components/shell/AppLayout.tsx": [
    "!productionMode ? <DemoNotice /> : null",
    "productionMode ? (",
    "ProductionSessionChip",
    "clearSelfHostedApiSession",
  ],
  "src/components/shell/AppLayout.test.tsx": [
    "hides demo shell controls",
    "production-session-chip",
    "VITE_APP_MODE",
  ],
  "src/components/shell/RoleGuard.tsx": [
    "if (productionMode)",
    "to=\"/self-hosted/login\"",
    "canSelfHostedSessionAccessPath",
    "ProductionNoAccessScreen",
  ],
  "src/components/shell/RoleHome.tsx": [
    "isProductionAppMode",
    "selfHostedHomePath",
    "to=\"/self-hosted/login\"",
  ],
  "docs/backend/stage-5d-production-mode-cutover.md": [
    "Stage 5D",
    "VITE_APP_MODE=production",
    "npm run preflight:stage5d",
    "managed runtime: none",
    "managed database: none",
  ],
  ".github/workflows/stage5d-production-mode-cutover.yml": [
    "name: stage5d-production-mode-cutover",
    "npm run preflight:stage5d",
    "GITHUB_STEP_SUMMARY",
  ],
};

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bSUPABASE_/,
  /\bnavigator\.usb\b/i,
  /\bnavigator\.bluetooth\b/i,
  /\bnavigator\.serial\b/i,
];

const PROTECTED_RUNTIME_FILES = [
  "src/lib/app-mode.ts",
  "src/lib/self-hosted-role.ts",
  "src/components/shell/AppLayout.tsx",
  "src/components/shell/AppSidebar.tsx",
  "src/components/shell/RoleHome.tsx",
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
  for (const script of ['"test:stage5d"', '"check:stage5d"', '"preflight:stage5d"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5D production mode cutover preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5D production mode cutover preflight");
  }
}

export function collectStage5DChecks({ root = process.cwd() } = {}) {
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
  return {
    ok: errors.length === 0,
    errors,
    checkedFiles: REQUIRED_FILES.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = collectStage5DChecks();
  if (!result.ok) {
    console.error("[stage5d-production-mode-cutover] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage5d-production-mode-cutover] OK (${result.checkedFiles} files checked)`);
}

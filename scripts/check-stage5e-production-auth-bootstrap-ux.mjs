#!/usr/bin/env node
// Stage 5E · production auth/bootstrap UX guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "src/lib/self-hosted-bootstrap-api.ts",
  "src/lib/self-hosted-bootstrap-api.test.ts",
  "src/pages/SelfHostedLoginPage.tsx",
  "src/pages/SelfHostedLoginPage.test.tsx",
  "docs/backend/stage-5e-production-auth-bootstrap-ux.md",
  ".github/workflows/stage5e-production-auth-bootstrap-ux.yml",
  "scripts/check-stage5e-production-auth-bootstrap-ux.mjs",
  "scripts/check-stage5e-production-auth-bootstrap-ux.test.mjs",
  "scripts/preflight-all.mjs",
  "package.json",
];

const REQUIRED_TEXT = {
  "src/lib/self-hosted-bootstrap-api.ts": [
    "fetchSelfHostedBootstrapStatus",
    "buildProductionBootstrapChecklist",
    "/healthz",
    "/readyz",
    "/api/v1/meta",
    "Stage 5B admin-sql",
  ],
  "src/pages/SelfHostedLoginPage.tsx": [
    "Дерматолог Pro — production вход",
    "Production bootstrap",
    "fetchSelfHostedBootstrapStatus",
    "buildProductionBootstrapChecklist",
    "VITE_APP_MODE",
    "navigate(productionMode ? \"/\" : \"/patients\"",
  ],
  "docs/backend/stage-5e-production-auth-bootstrap-ux.md": [
    "Stage 5E",
    "Production Auth & Role Bootstrap UX",
    "npm run preflight:stage5e",
    "Stage 5B",
    "Stage 5C",
    "managed runtime: none",
    "managed database: none",
  ],
  ".github/workflows/stage5e-production-auth-bootstrap-ux.yml": [
    "name: stage5e-production-auth-bootstrap-ux",
    "npm run preflight:stage5e",
    "GITHUB_STEP_SUMMARY",
  ],
  "backend/self-hosted/README.md": [
    "Stage 5E",
    "production login",
    "npm run preflight:stage5e",
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
  "src/lib/self-hosted-bootstrap-api.ts",
  "src/pages/SelfHostedLoginPage.tsx",
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
  for (const script of ['"test:stage5e"', '"check:stage5e"', '"preflight:stage5e"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5E production auth/bootstrap UX preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5E production auth/bootstrap UX preflight");
  }
}

export function collectStage5EChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5EChecks();
  if (!result.ok) {
    console.error("[stage5e-production-auth-bootstrap-ux] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage5e-production-auth-bootstrap-ux] OK (${result.checkedFiles} files checked)`);
}

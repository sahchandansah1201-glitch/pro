#!/usr/bin/env node
// Stage 4F · Self-hosted frontend auth bridge.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "src/lib/self-hosted-auth-api.ts",
  "src/lib/self-hosted-auth-api.test.ts",
  "src/pages/SelfHostedLoginPage.tsx",
  "src/pages/SelfHostedLoginPage.test.tsx",
  "e2e/self-hosted-stage4f.pw.ts",
  "docs/backend/stage-4f-self-hosted-auth-bridge.md",
  "scripts/check-stage4f-self-hosted-auth-bridge.mjs",
  "scripts/check-stage4f-self-hosted-auth-bridge.test.mjs",
  ".github/workflows/stage4f-self-hosted-auth-bridge.yml",
  ".github/workflows/stage4f-self-hosted-smoke-nightly.yml",
];

const REQUIRED_TEXT = {
  "src/lib/self-hosted-auth-api.ts": [
    "loginToSelfHostedBackend",
    "fetchSelfHostedMe",
    "/api/v1/auth/login",
    "/api/v1/auth/me",
  ],
  "src/lib/self-hosted-api-session.ts": [
    "writeSelfHostedApiSession",
    "clearSelfHostedApiSession",
    "SELF_HOSTED_API_USER_KEY",
  ],
  "src/pages/SelfHostedLoginPage.tsx": [
    "SELF_HOSTED_LOGIN_HEADING",
    "Дерматолог Pro — production вход",
    "loginToSelfHostedBackend",
    "writeSelfHostedApiSession",
    "/patients",
  ],
  "src/pages/SelfHostedLoginPage.test.tsx": [
    "logs into the self-hosted backend",
    "surfaces invalid_credentials backend error",
    "shows active session and lets the user sign out",
  ],
  "src/App.tsx": [
    "/self-hosted/login",
    "SelfHostedLoginPage",
  ],
  "src/pages/doctor/PatientsPage.tsx": [
    "clearSelfHostedApiSession",
    "/self-hosted/login",
    "Выйти из self-hosted",
    "Войти в self-hosted backend",
  ],
  "e2e/self-hosted-stage4f.pw.ts": [
    "/api/v1/auth/login",
    "/api/v1/patients",
    "Stage 4F self-hosted patient flow",
  ],
  "docs/backend/stage-4f-self-hosted-auth-bridge.md": [
    "Stage 4F",
    "Self-hosted frontend auth bridge",
    "/self-hosted/login",
    "docker-compose",
    "npm run preflight:stage4f",
    "Stage 4G",
  ],
  ".github/workflows/stage4f-self-hosted-auth-bridge.yml": [
    "name: stage4f-self-hosted-auth-bridge",
    "npm run preflight:stage4f",
    "GITHUB_STEP_SUMMARY",
  ],
  ".github/workflows/stage4f-self-hosted-smoke-nightly.yml": [
    "name: stage4f-self-hosted-smoke-nightly",
    "docker compose",
    "/healthz",
    "/readyz",
    "/api/v1/patients",
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
  "src/lib/self-hosted-auth-api.ts",
  "src/pages/SelfHostedLoginPage.tsx",
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function requireText(errors, root, file, expected) {
  const content = read(root, file);
  for (const text of expected) {
    if (!content.includes(text)) {
      errors.push(`${file} missing required text: ${text}`);
    }
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
  for (const script of ['"test:stage4f"', '"check:stage4f"', '"preflight:stage4f"']) {
    if (!packageJson.includes(script)) {
      errors.push(`package.json missing ${script}`);
    }
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4F self-hosted auth bridge preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4F self-hosted auth bridge preflight");
  }
}

export function collectStage4FChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) {
      requireText(errors, root, file, expected);
    } else {
      errors.push(`Missing required file (text check): ${file}`);
    }
  }
  scanRuntimeCoupling(errors, root);
  validatePackageScripts(errors, root);
  return {
    ok: errors.length === 0,
    errors,
    checkedFiles: REQUIRED_FILES.length,
  };
}

export function main() {
  const result = collectStage4FChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4f-self-hosted-auth-bridge] failed:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }
  console.log(
    `[check-stage4f-self-hosted-auth-bridge] OK (${result.checkedFiles} files, frontend auth bridge guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

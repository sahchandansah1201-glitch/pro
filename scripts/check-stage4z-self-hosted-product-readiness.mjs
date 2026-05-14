#!/usr/bin/env node
// Stage 4Z · self-hosted product readiness guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/product-readiness.mjs",
  "backend/self-hosted/product-readiness.test.mjs",
  "backend/self-hosted/openapi.stage4z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "deploy/self-hosted/docker-compose.production.example.yml",
  "src/lib/self-hosted-ops-api.ts",
  "src/lib/self-hosted-ops-api.test.ts",
  "src/pages/sys/SysSelfHostedOpsPage.tsx",
  "src/pages/sys/SysSelfHostedOpsPage.test.tsx",
  "e2e/sys-self-hosted-ops.pw.ts",
  "docs/backend/stage-4z-self-hosted-product-readiness.md",
  "scripts/check-stage4z-self-hosted-product-readiness.mjs",
  "scripts/check-stage4z-self-hosted-product-readiness.test.mjs",
  ".github/workflows/stage4z-self-hosted-product-readiness.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/product-readiness.mjs": [
    "buildSelfHostedProductReadiness",
    "managedRuntime: \"none\"",
    "managedDatabase: \"none\"",
    "supabaseRuntimeCoupling: false",
    "browserHardwareApis: false",
    "npm run preflight:all",
    "npm run smoke:stage4k",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4z.json",
    "/api/v1/product/readiness",
    "product.readiness.read",
    "token-auth-heartbeat-poll-ack-complete-telemetry-hardening-recovery-audit-replay-export-product-readiness",
  ],
  "backend/self-hosted/openapi.stage4z.json": [
    "4Z-self-hosted-product-readiness",
    "/api/v1/product/readiness",
    "operator-owned PostgreSQL",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage4z.json",
  ],
  "src/lib/self-hosted-ops-api.ts": [
    "fetchSelfHostedProductReadiness",
    "toSelfHostedProductReadiness",
    "buildStage4ZProductReadinessPreview",
    "/api/v1/product/readiness",
  ],
  "src/pages/sys/SysSelfHostedOpsPage.tsx": [
    "Product readiness",
    "fetchSelfHostedProductReadiness",
    "Скачать readiness",
    "/api/v1/product/readiness",
  ],
  "e2e/sys-self-hosted-ops.pw.ts": [
    "/api/v1/product/readiness",
    "Stage 4Z product readiness preview",
    "stage4z-product-readiness-preview.md",
  ],
  "docs/backend/stage-4z-self-hosted-product-readiness.md": [
    "Stage 4Z",
    "npm run preflight:stage4z",
    "/api/v1/product/readiness",
    "self-hosted product boundary",
  ],
  ".github/workflows/stage4z-self-hosted-product-readiness.yml": [
    "name: stage4z-self-hosted-product-readiness",
    "npm run preflight:stage4z",
  ],
};

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bsupabase\b/i,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bSUPABASE_/,
  /\bnavigator\.usb\b/i,
  /\bnavigator\.bluetooth\b/i,
  /\bnavigator\.serial\b/i,
];

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/product-readiness.mjs",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/openapi.stage4z.json",
  "src/lib/self-hosted-ops-api.ts",
  "src/pages/sys/SysSelfHostedOpsPage.tsx",
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
        errors.push(`${file} contains forbidden self-hosted boundary violation: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of ['"test:stage4z"', '"check:stage4z"', '"preflight:stage4z"', '"e2e:stage4z"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4Z self-hosted product readiness preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4Z self-hosted product readiness preflight");
  }
}

export function collectStage4ZChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4ZChecks();
  if (!result.ok) {
    console.error("[stage4z-self-hosted-product-readiness] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage4z-self-hosted-product-readiness] OK (${result.checkedFiles} files checked)`);
}

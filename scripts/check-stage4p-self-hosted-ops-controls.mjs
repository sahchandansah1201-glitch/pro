#!/usr/bin/env node
// Stage 4P · Self-hosted operations controls guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/ops-runtime-checks.mjs",
  "backend/self-hosted/ops-runtime-checks.test.mjs",
  "backend/self-hosted/openapi.stage4p.json",
  "src/lib/self-hosted-ops-api.ts",
  "src/lib/self-hosted-ops-api.test.ts",
  "src/pages/sys/SysSelfHostedOpsPage.tsx",
  "src/pages/sys/SysSelfHostedOpsPage.test.tsx",
  "e2e/sys-self-hosted-ops.pw.ts",
  "scripts/check-stage4p-self-hosted-ops-controls.mjs",
  "scripts/check-stage4p-self-hosted-ops-controls.test.mjs",
  "docs/backend/stage-4p-self-hosted-ops-controls.md",
  ".github/workflows/stage4p-self-hosted-ops-controls.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/ops-runtime-checks.mjs": [
    "collectSelfHostedOpsRuntimeChecks",
    "postgres_connectivity",
    "object_storage_runtime",
    "migration_bundle",
    "npm run ops:stage4l:backup:dry-run",
    "npm run smoke:stage4k:dry-run",
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/ops/runtime-checks",
    "ops.runtime_checks.read",
    "openapi.stage4p.json",
    "collectSelfHostedOpsRuntimeChecks",
  ],
  "backend/self-hosted/openapi.stage4p.json": [
    "4P-ops-runtime-checks",
    "/api/v1/ops/runtime-checks",
    "bearerAuth",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage4p.json",
    "proxy_pass http://backend:3001/openapi.stage4p.json",
  ],
  "src/lib/self-hosted-ops-api.ts": [
    "/api/v1/ops/runtime-checks",
    "fetchSelfHostedOpsRuntimeChecks",
    "buildStage4POperationsPreview",
    "npm run ops:stage4l:backup:dry-run",
  ],
  "src/pages/sys/SysSelfHostedOpsPage.tsx": [
    "Self-hosted runtime checks",
    "Self-hosted operations dry-runs",
    "stage4p-operations-preview.md",
    "/openapi.stage4p.json",
  ],
  "e2e/sys-self-hosted-ops.pw.ts": [
    "/api/v1/ops/runtime-checks",
    "Stage 4P operations preview",
    "npm run smoke:stage4k:dry-run",
  ],
  "docs/backend/stage-4p-self-hosted-ops-controls.md": [
    "Stage 4P",
    "npm run preflight:stage4p",
    "/api/v1/ops/runtime-checks",
    "e2e:stage4p",
  ],
  ".github/workflows/stage4p-self-hosted-ops-controls.yml": [
    "name: stage4p-self-hosted-ops-controls",
    "npm run preflight:stage4p",
    "npm run e2e:stage4p",
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
  "backend/self-hosted/ops-runtime-checks.mjs",
  "backend/self-hosted/openapi.stage4p.json",
  "src/lib/self-hosted-ops-api.ts",
  "src/pages/sys/SysSelfHostedOpsPage.tsx",
  "e2e/sys-self-hosted-ops.pw.ts",
  "deploy/self-hosted/nginx.stage4a.conf",
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
    '"test:stage4p"',
    '"check:stage4p"',
    '"preflight:stage4p"',
    '"e2e:stage4p"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4P self-hosted ops controls preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4P self-hosted ops controls preflight");
  }
}

export function collectStage4PChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4PChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4p-self-hosted-ops-controls] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4p-self-hosted-ops-controls] OK (${result.checkedFiles} files, self-hosted ops controls verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

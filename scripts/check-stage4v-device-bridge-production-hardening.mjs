#!/usr/bin/env node
// Stage 4V · Device Bridge production hardening guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0011_stage4v_device_bridge_production_hardening.sql",
  "backend/self-hosted/device-bridge-worker-repository.mjs",
  "backend/self-hosted/device-bridge-worker-repository.test.mjs",
  "backend/self-hosted/device-bridge-worker-service.mjs",
  "backend/self-hosted/device-bridge-worker-service.test.mjs",
  "backend/self-hosted/openapi.stage4v.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "e2e/sys-devices-stage4q.pw.ts",
  "docs/backend/stage-4v-device-bridge-production-hardening.md",
  "scripts/check-stage4v-device-bridge-production-hardening.mjs",
  "scripts/check-stage4v-device-bridge-production-hardening.test.mjs",
  ".github/workflows/stage4v-device-bridge-production-hardening.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0011_stage4v_device_bridge_production_hardening.sql": [
    "idempotency_key",
    "attempt_count",
    "next_attempt_at",
    "cleanup_after",
  ],
  "backend/self-hosted/device-bridge-worker-repository.mjs": [
    "buildListWorkerHardeningSql",
    "listWorkerHardening",
    "rate_limited_commands",
    "cleanup_candidates",
    "resolved as",
  ],
  "backend/self-hosted/device-bridge-worker-service.mjs": [
    "normalizeWorkerHardeningQuery",
    "listWorkerHardening",
    "device_bridge.worker.hardening.read",
    "idempotent",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4v.json",
    "/api/v1/device-bridge-worker/hardening",
    "token-auth-heartbeat-poll-ack-complete-telemetry-hardening",
  ],
  "backend/self-hosted/openapi.stage4v.json": [
    "4V-device-bridge-production-hardening",
    "/api/v1/device-bridge-worker/hardening",
    "Only system_admin can read worker hardening metrics",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "getSelfHostedDeviceBridgeWorkerHardening",
    "toSelfHostedDeviceBridgeWorkerHardeningDTO",
    "/api/v1/device-bridge-worker/hardening",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Device Bridge worker production hardening",
    "Device Bridge worker hardening policy",
    "Device Bridge worker hardening privacy boundary",
  ],
  "e2e/sys-devices-stage4q.pw.ts": [
    "4V",
    "Device Bridge worker production hardening",
    "linear-capped",
  ],
  "docs/backend/stage-4v-device-bridge-production-hardening.md": [
    "Stage 4V",
    "npm run preflight:stage4v",
    "/api/v1/device-bridge-worker/hardening",
    "self-hosted product boundary",
  ],
  ".github/workflows/stage4v-device-bridge-production-hardening.yml": [
    "name: stage4v-device-bridge-production-hardening",
    "npm run preflight:stage4v",
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
  "backend/self-hosted/device-bridge-worker-repository.mjs",
  "backend/self-hosted/device-bridge-worker-service.mjs",
  "backend/self-hosted/openapi.stage4v.json",
  "src/lib/self-hosted-device-api.ts",
  "src/pages/sys/SysDevicesPage.tsx",
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
  for (const script of ['"test:stage4v"', '"check:stage4v"', '"preflight:stage4v"', '"e2e:stage4v"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4V Device Bridge production hardening preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4V Device Bridge production hardening preflight");
  }
}

export function collectStage4VChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4VChecks();
  if (!result.ok) {
    console.error("[stage4v-device-bridge-production-hardening] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage4v-device-bridge-production-hardening] OK (${result.checkedFiles} files checked)`);
}

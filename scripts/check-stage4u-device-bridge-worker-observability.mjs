#!/usr/bin/env node
// Stage 4U · Device Bridge worker observability guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/device-bridge-worker-repository.mjs",
  "backend/self-hosted/device-bridge-worker-repository.test.mjs",
  "backend/self-hosted/device-bridge-worker-service.mjs",
  "backend/self-hosted/device-bridge-worker-service.test.mjs",
  "backend/self-hosted/openapi.stage4u.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "e2e/sys-devices-stage4q.pw.ts",
  "docs/backend/stage-4u-device-bridge-worker-observability.md",
  "scripts/check-stage4u-device-bridge-worker-observability.mjs",
  "scripts/check-stage4u-device-bridge-worker-observability.test.mjs",
  ".github/workflows/stage4u-device-bridge-worker-observability.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/device-bridge-worker-repository.mjs": [
    "buildListWorkerTelemetrySql",
    "listWorkerTelemetry",
    "queued_count",
    "recent_commands",
  ],
  "backend/self-hosted/device-bridge-worker-service.mjs": [
    "normalizeWorkerTelemetryQuery",
    "listWorkerTelemetry",
    "device_bridge.worker.telemetry.read",
    "opsStatusScope",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4u.json",
    "/api/v1/device-bridge-worker/status",
    "token-auth-heartbeat-poll-ack-complete-telemetry",
  ],
  "backend/self-hosted/openapi.stage4u.json": [
    "4U-device-bridge-worker-observability",
    "/api/v1/device-bridge-worker/status",
    "Only system_admin can read worker observability",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "getSelfHostedDeviceBridgeWorkerStatus",
    "toSelfHostedDeviceBridgeWorkerStatusDTO",
    "/api/v1/device-bridge-worker/status",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Device Bridge worker observability",
    "Device Bridge worker command lifecycle",
    "Device Bridge worker privacy boundary",
  ],
  "e2e/sys-devices-stage4q.pw.ts": [
    "stage4t-local-worker",
    "Device Bridge worker command lifecycle",
    "payload_json",
    "result_json",
  ],
  "docs/backend/stage-4u-device-bridge-worker-observability.md": [
    "Stage 4U",
    "npm run preflight:stage4u",
    "/api/v1/device-bridge-worker/status",
    "self-hosted product boundary",
  ],
  ".github/workflows/stage4u-device-bridge-worker-observability.yml": [
    "name: stage4u-device-bridge-worker-observability",
    "npm run preflight:stage4u",
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
  "backend/self-hosted/openapi.stage4u.json",
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
  for (const script of ['"test:stage4u"', '"check:stage4u"', '"preflight:stage4u"', '"e2e:stage4u"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4U Device Bridge worker observability preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4U Device Bridge worker observability preflight");
  }
}

export function collectStage4UChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4UChecks();
  if (!result.ok) {
    console.error("[stage4u-device-bridge-worker-observability] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage4u-device-bridge-worker-observability] OK (${result.checkedFiles} files checked)`);
}

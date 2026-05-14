#!/usr/bin/env node
// Stage 4T · local Device Bridge worker runtime guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "worker/device-bridge/worker.mjs",
  "worker/device-bridge/worker.test.mjs",
  "worker/device-bridge/README.md",
  "deploy/self-hosted/device-bridge-worker.stage4t.env.example",
  "deploy/self-hosted/device-bridge-worker.stage4t.service",
  "docs/backend/stage-4t-device-bridge-worker-runtime.md",
  "scripts/check-stage4t-device-bridge-worker-runtime.mjs",
  "scripts/check-stage4t-device-bridge-worker-runtime.test.mjs",
  ".github/workflows/stage4t-device-bridge-worker-runtime.yml",
];

const REQUIRED_TEXT = {
  "worker/device-bridge/worker.mjs": [
    "parseDeviceBridgeWorkerArgs",
    "createDeviceBridgeWorkerClient",
    "runDeviceBridgeWorkerOnce",
    "createNoopDeviceBridgeAdapter",
    "/api/v1/device-bridge-worker/heartbeat",
    "/api/v1/device-bridge-worker/commands",
    "DEVICE_BRIDGE_WORKER_TOKEN",
    "adapter_missing",
  ],
  "worker/device-bridge/worker.test.mjs": [
    "cli dry-run exits 0 without leaking env token",
    "run once heartbeats, polls, acknowledges",
  ],
  "deploy/self-hosted/device-bridge-worker.stage4t.env.example": [
    "SELF_HOSTED_API_BASE_URL=",
    "DEVICE_BRIDGE_WORKER_TOKEN=",
    "DEVICE_BRIDGE_CLINIC_ID=",
    "DEVICE_BRIDGE_CODE=",
  ],
  "deploy/self-hosted/device-bridge-worker.stage4t.service": [
    "EnvironmentFile=/etc/dermatolog-pro/device-bridge-worker.env",
    "ExecStart=/usr/bin/env node worker/device-bridge/worker.mjs --loop",
  ],
  "docs/backend/stage-4t-device-bridge-worker-runtime.md": [
    "Stage 4T",
    "npm run preflight:stage4t",
    "worker:stage4t:dry-run",
    "DEVICE_BRIDGE_WORKER_TOKEN",
  ],
  ".github/workflows/stage4t-device-bridge-worker-runtime.yml": [
    "name: stage4t-device-bridge-worker-runtime",
    "npm run preflight:stage4t",
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
  "worker/device-bridge/worker.mjs",
  "deploy/self-hosted/device-bridge-worker.stage4t.env.example",
  "deploy/self-hosted/device-bridge-worker.stage4t.service",
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
  for (const script of [
    '"test:stage4t"',
    '"check:stage4t"',
    '"preflight:stage4t"',
    '"worker:stage4t:dry-run"',
    '"worker:stage4t:once"',
    '"worker:stage4t:loop"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4T Device Bridge worker runtime preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4T Device Bridge worker runtime preflight");
  }
}

export function collectStage4TChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4TChecks();
  if (!result.ok) {
    console.error("[stage4t-device-bridge-worker-runtime] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage4t-device-bridge-worker-runtime] OK (${result.checkedFiles} files checked)`);
}

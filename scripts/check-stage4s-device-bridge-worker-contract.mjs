#!/usr/bin/env node
// Stage 4S · Self-hosted Device Bridge worker contract guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0010_stage4s_device_bridge_worker_contract.sql",
  "backend/self-hosted/device-bridge-worker-auth.mjs",
  "backend/self-hosted/device-bridge-worker-auth.test.mjs",
  "backend/self-hosted/device-bridge-worker-repository.mjs",
  "backend/self-hosted/device-bridge-worker-repository.test.mjs",
  "backend/self-hosted/device-bridge-worker-service.mjs",
  "backend/self-hosted/device-bridge-worker-service.test.mjs",
  "backend/self-hosted/openapi.stage4s.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/.env.production.example",
  "scripts/check-stage4s-device-bridge-worker-contract.mjs",
  "scripts/check-stage4s-device-bridge-worker-contract.test.mjs",
  "docs/backend/stage-4s-device-bridge-worker-contract.md",
  ".github/workflows/stage4s-device-bridge-worker-contract.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0010_stage4s_device_bridge_worker_contract.sql": [
    "worker_last_seen_at",
    "worker_status",
    "device_bridge_commands_worker_queue_idx",
  ],
  "backend/self-hosted/device-bridge-worker-auth.mjs": [
    "DEVICE_BRIDGE_WORKER_TOKEN",
    "authenticateDeviceBridgeWorker",
    "worker_auth_required",
    "worker_token_invalid",
  ],
  "backend/self-hosted/device-bridge-worker-repository.mjs": [
    "createDeviceBridgeWorkerRepository",
    "buildWorkerHeartbeatSql",
    "buildListWorkerCommandsSql",
    "buildUpdateWorkerCommandStatusSql",
    "for update skip locked",
  ],
  "backend/self-hosted/device-bridge-worker-service.mjs": [
    "createDeviceBridgeWorkerService",
    "device_bridge.worker.heartbeat",
    "device_bridge.command.poll",
    "device_bridge.command.ack",
    "device_bridge.command.complete",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4s.json",
    "/api/v1/device-bridge-worker/heartbeat",
    "/api/v1/device-bridge-worker/commands",
    "token-auth-heartbeat-poll-ack-complete",
  ],
  "backend/self-hosted/openapi.stage4s.json": [
    "4S-device-bridge-worker-contract",
    "workerBearerAuth",
    "/api/v1/device-bridge-worker/heartbeat",
    "/api/v1/device-bridge-worker/commands/{commandId}",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage4s.json",
    "proxy_pass http://backend:3001/openapi.stage4s.json",
  ],
  "deploy/self-hosted/docker-compose.stage4a.yml": [
    "DEVICE_BRIDGE_WORKER_TOKEN",
  ],
  "deploy/self-hosted/.env.production.example": [
    "DEVICE_BRIDGE_WORKER_TOKEN=replace-me-with-64-random-characters-worker-token",
  ],
  "docs/backend/stage-4s-device-bridge-worker-contract.md": [
    "Stage 4S",
    "npm run preflight:stage4s",
    "DEVICE_BRIDGE_WORKER_TOKEN",
    "/api/v1/device-bridge-worker/heartbeat",
  ],
  ".github/workflows/stage4s-device-bridge-worker-contract.yml": [
    "name: stage4s-device-bridge-worker-contract",
    "npm run preflight:stage4s",
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
  "backend/self-hosted/device-bridge-worker-auth.mjs",
  "backend/self-hosted/device-bridge-worker-repository.mjs",
  "backend/self-hosted/device-bridge-worker-service.mjs",
  "backend/self-hosted/openapi.stage4s.json",
  "backend/self-hosted/routes.mjs",
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
        errors.push(`${file} contains forbidden self-hosted boundary violation: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of ['"test:stage4s"', '"check:stage4s"', '"preflight:stage4s"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4S Device Bridge worker contract preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4S Device Bridge worker contract preflight");
  }
}

export function collectStage4SChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4SChecks();
  if (!result.ok) {
    console.error("[stage4s-device-bridge-worker-contract] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage4s-device-bridge-worker-contract] OK (${result.checkedFiles} files checked)`);
}

#!/usr/bin/env node
// Stage 4W · Device Bridge command safety guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0012_stage4w_device_bridge_command_safety.sql",
  "backend/self-hosted/device-bridge-worker-repository.mjs",
  "backend/self-hosted/device-bridge-worker-repository.test.mjs",
  "backend/self-hosted/device-bridge-worker-service.mjs",
  "backend/self-hosted/device-bridge-worker-service.test.mjs",
  "backend/self-hosted/openapi.stage4w.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "e2e/sys-devices-stage4q.pw.ts",
  "docs/backend/stage-4w-device-bridge-command-safety.md",
  "scripts/check-stage4w-device-bridge-command-safety.mjs",
  "scripts/check-stage4w-device-bridge-command-safety.test.mjs",
  ".github/workflows/stage4w-device-bridge-command-safety.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0012_stage4w_device_bridge_command_safety.sql": [
    "lease_owner",
    "lease_expires_at",
    "recovery_action",
    "recovered_by",
  ],
  "backend/self-hosted/device-bridge-worker-repository.mjs": [
    "buildListWorkerRecoverySql",
    "buildRecoverWorkerCommandSql",
    "listWorkerRecovery",
    "recoverCommand",
    "lease_expired_commands",
  ],
  "backend/self-hosted/device-bridge-worker-service.mjs": [
    "normalizeWorkerRecoveryQuery",
    "normalizeWorkerRecoveryAction",
    "device_bridge.worker.recovery.read",
    "device_bridge.command.${payload.action}",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4w.json",
    "/api/v1/device-bridge-worker/recovery",
    "/api/v1/device-bridge-worker/commands/",
    "token-auth-heartbeat-poll-ack-complete-telemetry-hardening-recovery",
  ],
  "backend/self-hosted/openapi.stage4w.json": [
    "4W-device-bridge-command-safety",
    "/api/v1/device-bridge-worker/recovery",
    "/api/v1/device-bridge-worker/commands/{commandId}/recovery",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "getSelfHostedDeviceBridgeWorkerRecovery",
    "recoverSelfHostedDeviceBridgeWorkerCommand",
    "/api/v1/device-bridge-worker/recovery",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Device Bridge command recovery",
    "Device Bridge command recovery policy",
    "Device Bridge command recovery privacy boundary",
  ],
  "e2e/sys-devices-stage4q.pw.ts": [
    "4W",
    "Device Bridge command recovery",
    "cmd-recovery-e2e",
  ],
  "docs/backend/stage-4w-device-bridge-command-safety.md": [
    "Stage 4W",
    "npm run preflight:stage4w",
    "/api/v1/device-bridge-worker/recovery",
    "self-hosted product boundary",
  ],
  ".github/workflows/stage4w-device-bridge-command-safety.yml": [
    "name: stage4w-device-bridge-command-safety",
    "npm run preflight:stage4w",
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
  "backend/self-hosted/openapi.stage4w.json",
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
  for (const script of ['"test:stage4w"', '"check:stage4w"', '"preflight:stage4w"', '"e2e:stage4w"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4W Device Bridge command safety preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4W Device Bridge command safety preflight");
  }
}

export function collectStage4WChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4WChecks();
  if (!result.ok) {
    console.error("[stage4w-device-bridge-command-safety] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage4w-device-bridge-command-safety] OK (${result.checkedFiles} files checked)`);
}

#!/usr/bin/env node
// Stage 4X · Device Bridge audit/replay guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0013_stage4x_device_bridge_audit_replay.sql",
  "backend/self-hosted/device-bridge-worker-repository.mjs",
  "backend/self-hosted/device-bridge-worker-repository.test.mjs",
  "backend/self-hosted/device-bridge-worker-service.mjs",
  "backend/self-hosted/device-bridge-worker-service.test.mjs",
  "backend/self-hosted/openapi.stage4x.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "e2e/sys-devices-stage4q.pw.ts",
  "docs/backend/stage-4x-device-bridge-audit-replay.md",
  "scripts/check-stage4x-device-bridge-audit-replay.mjs",
  "scripts/check-stage4x-device-bridge-audit-replay.test.mjs",
  ".github/workflows/stage4x-device-bridge-audit-replay.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0013_stage4x_device_bridge_audit_replay.sql": [
    "replay_of_command_id",
    "replay_requested_at",
    "replay_policy",
    "audit_log_device_bridge_command_idx",
  ],
  "backend/self-hosted/device-bridge-worker-repository.mjs": [
    "buildListWorkerCommandAuditSql",
    "buildReplayWorkerCommandSql",
    "listWorkerCommandAudit",
    "replayCommand",
    "manual_system_admin",
    "payloadVisibility",
  ],
  "backend/self-hosted/device-bridge-worker-service.mjs": [
    "normalizeWorkerCommandAuditQuery",
    "normalizeWorkerReplayAction",
    "device_bridge.command.audit.read",
    "device_bridge.command.replay",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4x.json",
    "/api/v1/device-bridge-worker/audit",
    "/api/v1/device-bridge-worker/commands/",
    "token-auth-heartbeat-poll-ack-complete-telemetry-hardening-recovery-audit-replay",
  ],
  "backend/self-hosted/openapi.stage4x.json": [
    "4X-device-bridge-audit-replay",
    "/api/v1/device-bridge-worker/audit",
    "/api/v1/device-bridge-worker/commands/{commandId}/replay",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "getSelfHostedDeviceBridgeCommandAudit",
    "replaySelfHostedDeviceBridgeCommand",
    "/api/v1/device-bridge-worker/audit",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Device Bridge command audit and replay",
    "Device Bridge replay policy",
    "Device Bridge command audit privacy boundary",
  ],
  "e2e/sys-devices-stage4q.pw.ts": [
    "4X",
    "Device Bridge command audit and replay",
    "cmd-replay-e2e",
  ],
  "docs/backend/stage-4x-device-bridge-audit-replay.md": [
    "Stage 4X",
    "npm run preflight:stage4x",
    "/api/v1/device-bridge-worker/audit",
    "self-hosted product boundary",
  ],
  ".github/workflows/stage4x-device-bridge-audit-replay.yml": [
    "name: stage4x-device-bridge-audit-replay",
    "npm run preflight:stage4x",
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
  "backend/self-hosted/openapi.stage4x.json",
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
  for (const script of ['"test:stage4x"', '"check:stage4x"', '"preflight:stage4x"', '"e2e:stage4x"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4X Device Bridge audit replay preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4X Device Bridge audit replay preflight");
  }
}

export function collectStage4XChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4XChecks();
  if (!result.ok) {
    console.error("[stage4x-device-bridge-audit-replay] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage4x-device-bridge-audit-replay] OK (${result.checkedFiles} files checked)`);
}

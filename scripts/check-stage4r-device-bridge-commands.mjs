#!/usr/bin/env node
// Stage 4R · Self-hosted Device Bridge command boundary guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0009_stage4r_device_bridge_commands.sql",
  "backend/self-hosted/device-bridge-command-repository.mjs",
  "backend/self-hosted/device-bridge-command-repository.test.mjs",
  "backend/self-hosted/device-bridge-command-service.mjs",
  "backend/self-hosted/device-bridge-command-service.test.mjs",
  "backend/self-hosted/openapi.stage4r.json",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "e2e/sys-devices-stage4q.pw.ts",
  "scripts/check-stage4r-device-bridge-commands.mjs",
  "scripts/check-stage4r-device-bridge-commands.test.mjs",
  "docs/backend/stage-4r-device-bridge-commands.md",
  ".github/workflows/stage4r-device-bridge-commands.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0009_stage4r_device_bridge_commands.sql": [
    "device_bridge_commands",
    "bridge_health_check",
    "device_calibration_request",
    "device_stream_open_request",
  ],
  "backend/self-hosted/device-bridge-command-repository.mjs": [
    "createDeviceBridgeCommandRepository",
    "buildCreateDeviceBridgeCommandSql",
    "device_bridge_commands",
  ],
  "backend/self-hosted/device-bridge-command-service.mjs": [
    "createDeviceBridgeCommandService",
    "deviceCommandScope",
    "device_bridge.command.create",
    "device.calibration.request",
    "device.stream.request",
    "local_device_bridge",
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/device-bridges",
    "/api/v1/devices",
    "openapi.stage4r.json",
    "browserHardwareAccess",
  ],
  "backend/self-hosted/openapi.stage4r.json": [
    "4R-device-bridge-commands",
    "/api/v1/device-bridges/{bridgeId}/commands",
    "/api/v1/devices/{deviceId}/commands",
    "bearerAuth",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage4r.json",
    "proxy_pass http://backend:3001/openapi.stage4r.json",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "requestSelfHostedBridgeCommand",
    "requestSelfHostedDeviceCommand",
    "/api/v1/device-bridges/",
    "/api/v1/devices/",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "поставлена в очередь Device Bridge",
    "requestSelfHostedBridgeCommand",
    "requestSelfHostedDeviceCommand",
  ],
  "e2e/sys-devices-stage4q.pw.ts": [
    "bridge_health_check",
    "device_calibration_request",
    "cmd-bridge-e2e",
    "cmd-device-e2e",
  ],
  "docs/backend/stage-4r-device-bridge-commands.md": [
    "Stage 4R",
    "npm run preflight:stage4r",
    "/api/v1/device-bridges/{bridgeId}/commands",
    "/api/v1/devices/{deviceId}/commands",
  ],
  ".github/workflows/stage4r-device-bridge-commands.yml": [
    "name: stage4r-device-bridge-commands",
    "npm run preflight:stage4r",
    "npm run e2e:stage4r",
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
  "backend/self-hosted/device-bridge-command-repository.mjs",
  "backend/self-hosted/device-bridge-command-service.mjs",
  "backend/self-hosted/openapi.stage4r.json",
  "src/lib/self-hosted-device-api.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "e2e/sys-devices-stage4q.pw.ts",
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
  for (const script of [
    '"test:stage4r"',
    '"check:stage4r"',
    '"preflight:stage4r"',
    '"e2e:stage4r"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4R Device Bridge commands preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4R Device Bridge commands preflight");
  }
}

export function collectStage4RChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4RChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4r-device-bridge-commands] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4r-device-bridge-commands] OK (${result.checkedFiles} files, command boundary verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

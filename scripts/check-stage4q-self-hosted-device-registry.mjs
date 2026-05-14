#!/usr/bin/env node
// Stage 4Q · Self-hosted Device Bridge registry guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0008_stage4q_device_registry.sql",
  "backend/self-hosted/device-registry-repository.mjs",
  "backend/self-hosted/device-registry-repository.test.mjs",
  "backend/self-hosted/openapi.stage4q.json",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "e2e/sys-devices-stage4q.pw.ts",
  "scripts/check-stage4q-self-hosted-device-registry.mjs",
  "scripts/check-stage4q-self-hosted-device-registry.test.mjs",
  "docs/backend/stage-4q-self-hosted-device-registry.md",
  ".github/workflows/stage4q-self-hosted-device-registry.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0008_stage4q_device_registry.sql": [
    "device_bridges",
    "medical_devices",
    "clinic_id",
    "deleted_at",
  ],
  "backend/self-hosted/device-registry-repository.mjs": [
    "createDeviceRegistryRepository",
    "buildListDeviceBridgesSql",
    "buildListMedicalDevicesSql",
    "calibrationDueAt",
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/device-bridges",
    "/api/v1/devices",
    "device_bridge.list",
    "device.list",
    "openapi.stage4q.json",
  ],
  "backend/self-hosted/openapi.stage4q.json": [
    "4Q-device-registry",
    "/api/v1/device-bridges",
    "/api/v1/devices",
    "bearerAuth",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage4q.json",
    "proxy_pass http://backend:3001/openapi.stage4q.json",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "/api/v1/device-bridges",
    "/api/v1/devices",
    "listSelfHostedDeviceBridges",
    "listSelfHostedDevices",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Self-hosted backend подключён",
    "серверного реестра PostgreSQL",
    "Браузер не подключается к драйверу напрямую",
  ],
  "e2e/sys-devices-stage4q.pw.ts": [
    "/api/v1/device-bridges",
    "/api/v1/devices",
    "WebUSB",
    "storage_object_path",
  ],
  "docs/backend/stage-4q-self-hosted-device-registry.md": [
    "Stage 4Q",
    "npm run preflight:stage4q",
    "/api/v1/device-bridges",
    "/api/v1/devices",
  ],
  ".github/workflows/stage4q-self-hosted-device-registry.yml": [
    "name: stage4q-self-hosted-device-registry",
    "npm run preflight:stage4q",
    "npm run e2e:stage4q",
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
  "backend/self-hosted/device-registry-repository.mjs",
  "backend/self-hosted/openapi.stage4q.json",
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
    '"test:stage4q"',
    '"check:stage4q"',
    '"preflight:stage4q"',
    '"e2e:stage4q"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4Q self-hosted device registry preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4Q self-hosted device registry preflight");
  }
}

export function collectStage4QChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4QChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4q-self-hosted-device-registry] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4q-self-hosted-device-registry] OK (${result.checkedFiles} files, device registry verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

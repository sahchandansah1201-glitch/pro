#!/usr/bin/env node
// Stage 8P-9A · Device Bridge operations continuity guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "backend/self-hosted/device-bridge-operations-continuity-service.mjs",
  "backend/self-hosted/device-bridge-operations-continuity-service.test.mjs",
  "backend/self-hosted/openapi.stage8p-9a.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "deploy/self-hosted/nginx.stage4a.conf",
  "deploy/self-hosted/device-ops-continuity.stage8p-9a.json",
  "scripts/stage8p-9a-device-ops-continuity.mjs",
  "scripts/stage8p-9a-device-ops-continuity.test.mjs",
  "scripts/check-stage8p-9a-device-ops-continuity.mjs",
  "scripts/check-stage8p-9a-device-ops-continuity.test.mjs",
  "docs/backend/stage-8p-9a-device-ops-continuity.md",
  ".github/workflows/stage8p-9a-device-ops-continuity.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/device-bridge-operations-continuity-service.mjs": [
    "buildDeviceBridgeOperationsContinuity",
    "createDeviceBridgeOperationsContinuityService",
    "device_bridge.operations_continuity.read",
    "nextBatchHypothesis: \"Stage 9B-9D\"",
    "managedRuntimeDependency: \"none\"",
    "managedDatabaseDependency: \"none\"",
    "payloadVisibility: \"backend-only\"",
  ],
  "backend/self-hosted/openapi.stage8p-9a.json": [
    "8P-9A-device-ops-continuity",
    "/api/v1/device-bridge-worker/operations-continuity",
    "DeviceBridgeOperationsContinuity",
    "managedRuntimeDependency",
  ],
  "backend/self-hosted/routes.mjs": [
    "OPENAPI_8P_9A",
    "deviceBridgeOperationsContinuityService",
    "/api/v1/device-bridge-worker/operations-continuity",
    "stage: \"8P-9A\"",
    "openapiStage8P9A",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "getSelfHostedDeviceBridgeOperationsContinuity",
    "toSelfHostedDeviceBridgeOperationsContinuityDTO",
    "/api/v1/device-bridge-worker/operations-continuity",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Device Bridge operations continuity",
    "Stage 8P-9A · Operations continuity",
    "getSelfHostedDeviceBridgeOperationsContinuity",
    "next batch hypothesis",
  ],
  "deploy/self-hosted/device-ops-continuity.stage8p-9a.json": [
    "stage8p-9a-device-ops-continuity",
    "Stage 8P",
    "Stage 9A",
    "Stage 9B-9D",
    "managedRuntimeDependency",
  ],
  "scripts/stage8p-9a-device-ops-continuity.mjs": [
    "buildDeviceOpsContinuityPackage",
    "buildStage8P9ALovablePrompt",
    "renderDeviceOpsContinuityMarkdown",
    "runStage8P9ADeviceOpsContinuity",
  ],
  "docs/backend/stage-8p-9a-device-ops-continuity.md": [
    "Stage 8P-9A",
    "Device Bridge operations continuity",
    "npm run preflight:stage8p-9a",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage8p-9a-device-ops-continuity.yml": [
    "name: stage8p-9a-device-ops-continuity",
    "npm run preflight:stage8p-9a",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage8p_9a_preflight",
    "device_bridge_operations_continuity_confirmed: true",
    "command: \"npm run preflight:stage8p-9a\"",
    "Stage 9B-9D",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 8P-9A",
    "Device Bridge operations continuity",
    "Stage 9B-9D",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 8P-9A",
    "Stage 9B-9D",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 8P-9A",
    "Device Bridge operations continuity",
    "x2 batch",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 8P-9A",
    "Device Bridge operations continuity",
    "Stage 9B-9D",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "device-bridge-operations-continuity-service.mjs",
    "device-ops-continuity.stage8p-9a.json",
    "stage-8p-9a-device-ops-continuity.md",
  ],
};

const PROTECTED_FILES = [
  "backend/self-hosted/device-bridge-operations-continuity-service.mjs",
  "backend/self-hosted/openapi.stage8p-9a.json",
  "src/lib/self-hosted-device-api.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "deploy/self-hosted/device-ops-continuity.stage8p-9a.json",
  "docs/backend/stage-8p-9a-device-ops-continuity.md",
];

const FORBIDDEN = [
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /edge function/i,
  /SUPABASE_/i,
  /navigator\.(usb|bluetooth|serial)/i,
  /storage_object_path/i,
  /signed_url/i,
  /access_token/i,
  /payload_json/i,
  /result_json/i,
  /worker_metadata_json/i,
  /patient_full_name/i,
  /object_bucket/i,
  /object_key/i,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function checkMarkers(root, errors, table, label = "marker") {
  for (const [file, markers] of Object.entries(table)) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing ${label} file: ${file}`);
      continue;
    }
    const text = read(root, file);
    for (const marker of markers) {
      if (!text.includes(marker)) errors.push(`${file} missing ${label}: ${marker}`);
    }
  }
}

export function checkStage8P9A(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) errors.push(`${file} contains forbidden runtime marker: ${pattern}`);
    }
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkStage8P9A(process.cwd());
  if (!result.ok) {
    console.error("[stage8p-9a-device-ops-continuity] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage8p-9a-device-ops-continuity] OK (${result.checkedFiles} files checked)`);
}

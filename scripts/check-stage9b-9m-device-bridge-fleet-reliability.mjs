#!/usr/bin/env node
// Stage 9B-9M · Device Bridge fleet reliability guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "backend/self-hosted/device-bridge-fleet-reliability-service.mjs",
  "backend/self-hosted/device-bridge-fleet-reliability-service.test.mjs",
  "backend/self-hosted/openapi.stage9b-9m.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "deploy/self-hosted/nginx.stage4a.conf",
  "deploy/self-hosted/device-bridge-fleet-reliability.stage9b-9m.json",
  "scripts/stage9b-9m-device-bridge-fleet-reliability.mjs",
  "scripts/stage9b-9m-device-bridge-fleet-reliability.test.mjs",
  "scripts/check-stage9b-9m-device-bridge-fleet-reliability.mjs",
  "scripts/check-stage9b-9m-device-bridge-fleet-reliability.test.mjs",
  "docs/backend/stage-9b-9m-device-bridge-fleet-reliability.md",
  ".github/workflows/stage9b-9m-device-bridge-fleet-reliability.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/device-bridge-fleet-reliability-service.mjs": [
    "buildDeviceBridgeFleetReliability",
    "createDeviceBridgeFleetReliabilityService",
    "device_bridge.fleet_reliability.read",
    "originalHypothesis: \"Stage 9B-9D\"",
    "nextBatchHypothesis: \"Stage 9N-9Z\"",
    "managedRuntimeDependency: \"none\"",
    "managedDatabaseDependency: \"none\"",
    "payloadVisibility: \"backend-only\"",
  ],
  "backend/self-hosted/openapi.stage9b-9m.json": [
    "9B-9M-device-bridge-fleet-reliability",
    "/api/v1/device-bridge-worker/fleet-reliability",
    "DeviceBridgeFleetReliability",
    "managedRuntimeDependency",
  ],
  "backend/self-hosted/routes.mjs": [
    "OPENAPI_9B_9M",
    "deviceBridgeFleetReliabilityService",
    "/api/v1/device-bridge-worker/fleet-reliability",
    "stage: \"9B-9M\"",
    "openapiStage9B9M",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "getSelfHostedDeviceBridgeFleetReliability",
    "toSelfHostedDeviceBridgeFleetReliabilityDTO",
    "/api/v1/device-bridge-worker/fleet-reliability",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Надёжность парка мостов устройств",
    "Шаги надёжности парка",
    "getSelfHostedDeviceBridgeFleetReliability",
    "следующий шаг скрыт из интерфейса",
  ],
  "deploy/self-hosted/device-bridge-fleet-reliability.stage9b-9m.json": [
    "stage9b-9m-device-bridge-fleet-reliability",
    "Stage 9B",
    "Stage 9M",
    "Stage 9B-9D",
    "Stage 9N-9Z",
    "managedRuntimeDependency",
  ],
  "scripts/stage9b-9m-device-bridge-fleet-reliability.mjs": [
    "buildDeviceBridgeFleetReliabilityPackage",
    "buildStage9B9MLovablePrompt",
    "renderDeviceBridgeFleetReliabilityMarkdown",
    "runStage9B9MDeviceBridgeFleetReliability",
  ],
  "docs/backend/stage-9b-9m-device-bridge-fleet-reliability.md": [
    "Stage 9B-9M",
    "Device Bridge fleet reliability",
    "npm run preflight:stage9b-9m",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage9b-9m-device-bridge-fleet-reliability.yml": [
    "name: stage9b-9m-device-bridge-fleet-reliability",
    "npm run preflight:stage9b-9m",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage9b_9m_preflight",
    "device_bridge_fleet_reliability_confirmed: true",
    "command: \"npm run preflight:stage9b-9m\"",
    "Stage 9N-9Z",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 9B-9M",
    "Device Bridge fleet reliability",
    "Stage 9N-9Z",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 9B-9M",
    "Stage 9N-9Z",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 9B-9M",
    "Device Bridge fleet reliability",
    "x2 batch",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 9B-9M",
    "Device Bridge fleet reliability",
    "Stage 9N-9Z",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "device-bridge-fleet-reliability-service.mjs",
    "device-bridge-fleet-reliability.stage9b-9m.json",
    "stage-9b-9m-device-bridge-fleet-reliability.md",
  ],
};

const PROTECTED_FILES = [
  "backend/self-hosted/device-bridge-fleet-reliability-service.mjs",
  "backend/self-hosted/openapi.stage9b-9m.json",
  "src/lib/self-hosted-device-api.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "deploy/self-hosted/device-bridge-fleet-reliability.stage9b-9m.json",
  "docs/backend/stage-9b-9m-device-bridge-fleet-reliability.md",
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

export function checkStage9B9M(root = process.cwd()) {
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
  const result = checkStage9B9M(process.cwd());
  if (!result.ok) {
    console.error("[stage9b-9m-device-bridge-fleet-reliability] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage9b-9m-device-bridge-fleet-reliability] OK (${result.checkedFiles} files checked)`);
}

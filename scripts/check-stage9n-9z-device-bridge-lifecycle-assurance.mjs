#!/usr/bin/env node
// Stage 9N-9Z · Device Bridge lifecycle assurance guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "backend/self-hosted/device-bridge-lifecycle-assurance-service.mjs",
  "backend/self-hosted/device-bridge-lifecycle-assurance-service.test.mjs",
  "backend/self-hosted/openapi.stage9n-9z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "deploy/self-hosted/nginx.stage4a.conf",
  "deploy/self-hosted/device-bridge-lifecycle-assurance.stage9n-9z.json",
  "scripts/stage9n-9z-device-bridge-lifecycle-assurance.mjs",
  "scripts/stage9n-9z-device-bridge-lifecycle-assurance.test.mjs",
  "scripts/check-stage9n-9z-device-bridge-lifecycle-assurance.mjs",
  "scripts/check-stage9n-9z-device-bridge-lifecycle-assurance.test.mjs",
  "docs/backend/stage-9n-9z-device-bridge-lifecycle-assurance.md",
  ".github/workflows/stage9n-9z-device-bridge-lifecycle-assurance.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/device-bridge-lifecycle-assurance-service.mjs": [
    "buildDeviceBridgeLifecycleAssurance",
    "createDeviceBridgeLifecycleAssuranceService",
    "device_bridge.lifecycle_assurance.read",
    "currentBatch: \"Stage 9N-9Z\"",
    "nextBatchHypothesis: \"Stage 10A-10L\"",
    "managedRuntimeDependency: \"none\"",
    "managedDatabaseDependency: \"none\"",
    "payloadVisibility: \"backend-only\"",
  ],
  "backend/self-hosted/openapi.stage9n-9z.json": [
    "9N-9Z-device-bridge-lifecycle-assurance",
    "/api/v1/device-bridge-worker/lifecycle-assurance",
    "DeviceBridgeLifecycleAssurance",
    "managedRuntimeDependency",
  ],
  "backend/self-hosted/routes.mjs": [
    "OPENAPI_9N_9Z",
    "deviceBridgeLifecycleAssuranceService",
    "/api/v1/device-bridge-worker/lifecycle-assurance",
    "stage: \"9N-9Z\"",
    "openapiStage9N9Z",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "getSelfHostedDeviceBridgeLifecycleAssurance",
    "toSelfHostedDeviceBridgeLifecycleAssuranceDTO",
    "/api/v1/device-bridge-worker/lifecycle-assurance",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Контроль жизненного цикла моста устройств",
    "Шаги жизненного цикла",
    "getSelfHostedDeviceBridgeLifecycleAssurance",
    "следующий шаг скрыт из интерфейса",
  ],
  "deploy/self-hosted/device-bridge-lifecycle-assurance.stage9n-9z.json": [
    "stage9n-9z-device-bridge-lifecycle-assurance",
    "Stage 9N",
    "Stage 9Z",
    "Stage 9B-9M",
    "Stage 10A-10L",
    "managedRuntimeDependency",
  ],
  "scripts/stage9n-9z-device-bridge-lifecycle-assurance.mjs": [
    "buildDeviceBridgeLifecycleAssurancePackage",
    "buildStage9N9ZLovablePrompt",
    "renderDeviceBridgeLifecycleAssuranceMarkdown",
    "runStage9N9ZDeviceBridgeLifecycleAssurance",
  ],
  "docs/backend/stage-9n-9z-device-bridge-lifecycle-assurance.md": [
    "Stage 9N-9Z",
    "Device Bridge lifecycle assurance",
    "npm run preflight:stage9n-9z",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage9n-9z-device-bridge-lifecycle-assurance.yml": [
    "name: stage9n-9z-device-bridge-lifecycle-assurance",
    "npm run preflight:stage9n-9z",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage9n_9z_preflight",
    "device_bridge_lifecycle_assurance_confirmed: true",
    "command: \"npm run preflight:stage9n-9z\"",
    "Stage 10A-10L",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 9N-9Z",
    "Device Bridge lifecycle assurance",
    "Stage 10A-10L",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 9N-9Z",
    "Stage 10A-10L",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 9N-9Z",
    "Device Bridge lifecycle assurance",
    "x2 batch",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 9N-9Z",
    "Device Bridge lifecycle assurance",
    "Stage 10A-10L",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "device-bridge-lifecycle-assurance-service.mjs",
    "device-bridge-lifecycle-assurance.stage9n-9z.json",
    "stage-9n-9z-device-bridge-lifecycle-assurance.md",
  ],
};

const PROTECTED_FILES = [
  "backend/self-hosted/device-bridge-lifecycle-assurance-service.mjs",
  "backend/self-hosted/openapi.stage9n-9z.json",
  "src/lib/self-hosted-device-api.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "deploy/self-hosted/device-bridge-lifecycle-assurance.stage9n-9z.json",
  "docs/backend/stage-9n-9z-device-bridge-lifecycle-assurance.md",
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

export function checkStage9N9Z(root = process.cwd()) {
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
  const result = checkStage9N9Z(process.cwd());
  if (!result.ok) {
    console.error("[stage9n-9z-device-bridge-lifecycle-assurance] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage9n-9z-device-bridge-lifecycle-assurance] OK (${result.checkedFiles} files checked)`);
}

#!/usr/bin/env node
// Stage 8J-8O · Device Bridge production readiness and operations handbook guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "backend/self-hosted/device-bridge-production-readiness-service.mjs",
  "backend/self-hosted/device-bridge-production-readiness-service.test.mjs",
  "backend/self-hosted/openapi.stage8j-8o.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "deploy/self-hosted/nginx.stage4a.conf",
  "deploy/self-hosted/operations-handbook.stage8m-8o.json",
  "scripts/stage8m-8o-server-operations-handbook.mjs",
  "scripts/stage8m-8o-server-operations-handbook.test.mjs",
  "docs/backend/stage-8j-8o-device-ops-hardening.md",
  ".github/workflows/stage8j-8o-device-ops-hardening.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/device-bridge-production-readiness-service.mjs": [
    "buildDeviceBridgeProductionReadiness",
    "createDeviceBridgeProductionReadinessService",
    "device_bridge.production_readiness.read",
    "managedRuntimeDependency: \"none\"",
    "managedDatabaseDependency: \"none\"",
    "payloadVisibility: \"backend-only\"",
  ],
  "backend/self-hosted/openapi.stage8j-8o.json": [
    "8J-8O-device-ops-hardening",
    "/api/v1/device-bridge-worker/production-readiness",
    "DeviceBridgeProductionReadiness",
    "managedRuntimeDependency",
  ],
  "backend/self-hosted/routes.mjs": [
    "OPENAPI_8J_8O",
    "deviceBridgeProductionReadinessService",
    "/api/v1/device-bridge-worker/production-readiness",
    "stage: \"8J-8L\"",
    "openapiStage8J8O",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "getSelfHostedDeviceBridgeProductionReadiness",
    "toSelfHostedDeviceBridgeProductionReadinessDTO",
    "/api/v1/device-bridge-worker/production-readiness",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Готовность моста устройств",
    "Проверки готовности моста устройств",
    "getSelfHostedDeviceBridgeProductionReadiness",
    "productionReadiness.readiness.policy.managedRuntimeDependency",
  ],
  "deploy/self-hosted/operations-handbook.stage8m-8o.json": [
    "Stage 8J",
    "Stage 8O",
    "serverOperationsHandbook",
    "Managed runtime/database dependency",
    "Stage 8P-8R",
  ],
  "scripts/stage8m-8o-server-operations-handbook.mjs": [
    "buildServerOperationsHandbook",
    "renderServerOperationsHandbookMarkdown",
    "runStage8M8OServerOperationsHandbook",
    "buildStage8J8OLovablePrompt",
  ],
  "docs/backend/stage-8j-8o-device-ops-hardening.md": [
    "Stage 8J-8O",
    "Device Bridge production readiness",
    "Server operations handbook",
    "npm run preflight:stage8j-8o",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage8j-8o-device-ops-hardening.yml": [
    "name: stage8j-8o-device-ops-hardening",
    "npm run preflight:stage8j-8o",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage8j_8o_preflight",
    "device_bridge_production_readiness_confirmed: true",
    "server_operations_handbook_confirmed: true",
    "command: \"npm run preflight:stage8j-8o\"",
    "Stage 8P-8R",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 8J-8O",
    "Device Bridge production readiness",
    "server operations handbook",
    "Stage 8P-8R",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 8J-8O",
    "Stage 8P-8R",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 8J-8O",
    "Device Bridge production readiness",
    "server operations handbook",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 8J-8O",
    "Device Bridge production readiness",
    "Stage 8P-8R",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "device-bridge-production-readiness-service.mjs",
    "operations-handbook.stage8m-8o.json",
    "stage-8j-8o-device-ops-hardening.md",
  ],
};

const PROTECTED_FILES = [
  "backend/self-hosted/device-bridge-production-readiness-service.mjs",
  "backend/self-hosted/openapi.stage8j-8o.json",
  "src/lib/self-hosted-device-api.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "deploy/self-hosted/operations-handbook.stage8m-8o.json",
  "docs/backend/stage-8j-8o-device-ops-hardening.md",
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

export function checkStage8J8O(root = process.cwd()) {
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
  const result = checkStage8J8O(process.cwd());
  if (!result.ok) {
    console.error("[stage8j-8o-device-ops-hardening] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage8j-8o-device-ops-hardening] OK (${result.checkedFiles} files checked)`);
}

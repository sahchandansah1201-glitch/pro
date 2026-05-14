#!/usr/bin/env node
// Stage 4Y · Device Bridge audit export guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/device-bridge-worker-service.mjs",
  "backend/self-hosted/device-bridge-worker-service.test.mjs",
  "backend/self-hosted/openapi.stage4y.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-device-api.ts",
  "src/lib/self-hosted-device-api.test.ts",
  "src/pages/sys/SysDevicesPage.tsx",
  "src/pages/sys/SysDevicesPage.test.tsx",
  "e2e/sys-devices-stage4q.pw.ts",
  "docs/backend/stage-4y-device-bridge-audit-export.md",
  "scripts/check-stage4y-device-bridge-audit-export.mjs",
  "scripts/check-stage4y-device-bridge-audit-export.test.mjs",
  ".github/workflows/stage4y-device-bridge-audit-export.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/device-bridge-worker-service.mjs": [
    "normalizeWorkerCommandAuditExportQuery",
    "buildWorkerCommandAuditExport",
    "exportWorkerCommandAudit",
    "device_bridge.command.audit.export",
    "metadata_json",
    "payload_json",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4y.json",
    "/api/v1/device-bridge-worker/audit/export",
    "token-auth-heartbeat-poll-ack-complete-telemetry-hardening-recovery-audit-replay-export",
  ],
  "backend/self-hosted/openapi.stage4y.json": [
    "4Y-device-bridge-audit-export",
    "/api/v1/device-bridge-worker/audit/export",
    "CSV export",
  ],
  "src/lib/self-hosted-device-api.ts": [
    "exportSelfHostedDeviceBridgeCommandAudit",
    "toSelfHostedDeviceBridgeCommandAuditExportDTO",
    "/api/v1/device-bridge-worker/audit/export",
  ],
  "src/pages/sys/SysDevicesPage.tsx": [
    "Экспорт audit CSV",
    "exportSelfHostedDeviceBridgeCommandAudit",
    "Экспорт Device Bridge command audit скачан",
  ],
  "e2e/sys-devices-stage4q.pw.ts": [
    "4Y",
    "Экспорт audit CSV",
    "device-bridge-command-audit-all-all-1-rows.csv",
  ],
  "docs/backend/stage-4y-device-bridge-audit-export.md": [
    "Stage 4Y",
    "npm run preflight:stage4y",
    "/api/v1/device-bridge-worker/audit/export",
    "self-hosted product boundary",
  ],
  ".github/workflows/stage4y-device-bridge-audit-export.yml": [
    "name: stage4y-device-bridge-audit-export",
    "npm run preflight:stage4y",
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
  "backend/self-hosted/device-bridge-worker-service.mjs",
  "backend/self-hosted/openapi.stage4y.json",
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
  for (const script of ['"test:stage4y"', '"check:stage4y"', '"preflight:stage4y"', '"e2e:stage4y"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4Y Device Bridge audit export preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4Y Device Bridge audit export preflight");
  }
}

export function collectStage4YChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4YChecks();
  if (!result.ok) {
    console.error("[stage4y-device-bridge-audit-export] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage4y-device-bridge-audit-export] OK (${result.checkedFiles} files checked)`);
}

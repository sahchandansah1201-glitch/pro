#!/usr/bin/env node
// Stage 4I · Self-hosted clinical assets write/download-url guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0006_stage4i_asset_write_contract.sql",
  "backend/self-hosted/asset-write-repository.mjs",
  "backend/self-hosted/asset-write-repository.test.mjs",
  "backend/self-hosted/asset-write-service.mjs",
  "backend/self-hosted/asset-write-service.test.mjs",
  "backend/self-hosted/openapi.stage4i.json",
  "src/lib/self-hosted-asset-api.ts",
  "src/lib/self-hosted-asset-api.test.ts",
  "src/lib/self-hosted-visit-api.ts",
  "src/lib/self-hosted-visit-api.test.ts",
  "src/pages/doctor/CapturePageLive.tsx",
  "src/pages/doctor/CapturePageLive.test.tsx",
  "docs/backend/stage-4i-self-hosted-assets.md",
  "docs/backend/rds3-folder-importer-windows.md",
  "scripts/rds3-folder-importer.mjs",
  "scripts/rds3-folder-importer.test.mjs",
  "scripts/windows/DermatologProRdsBridgeSetup.ps1",
  "scripts/rds3-windows-bridge-installer.test.mjs",
  "scripts/check-stage4i-self-hosted-assets.mjs",
  "scripts/check-stage4i-self-hosted-assets.test.mjs",
  ".github/workflows/stage4i-self-hosted-assets.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/asset-write-repository.mjs": [
    "createAssetWriteRepository",
    "buildCreateVisitAssetSql",
    "buildGetAssetInternalSql",
    "objectBucket",
    "objectKey",
  ],
  "backend/self-hosted/asset-write-service.mjs": [
    "createAssetWriteService",
    "normalizeCreateAssetPayload",
    "asset.create",
    "asset.download_url",
    "assetWriteScope",
    "visitReadScope",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4i.json",
    "assetWriteService",
    "assetDownloadUrlMatch",
    "stage: \"4I\"",
    "rbac-read-write-postgres-backend-url",
  ],
  "backend/self-hosted/openapi.stage4i.json": [
    "4I-assets-write",
    "/api/v1/visits/{visitId}/assets",
    "/api/v1/assets/{assetId}/download-url",
    "Raw object bucket/key is never exposed",
  ],
  "src/lib/self-hosted-asset-api.ts": [
    "listSelfHostedVisitAssets",
    "uploadSelfHostedVisitAsset",
    "getSelfHostedAssetDownloadUrl",
    "/api/v1/visits/",
    "/api/v1/assets/",
  ],
  "src/lib/self-hosted-visit-api.ts": [
    "captureSource",
    "input.captureSource",
  ],
  "src/pages/doctor/CapturePageLive.tsx": [
    "assetSourceLabel",
    "device_bridge",
    "Дерматоскопия",
    "Прибор",
  ],
  "src/pages/doctor/CapturePageLive.test.tsx": [
    "shows an RDS-3 imported asset as a device capture in the assistant queue",
    "Дерматоскопия · Прибор",
    "device_bridge|storagePath|signedUrl|checksumSha256",
  ],
  "src/pages/doctor/VisitImagingTab.tsx": [
    "listSelfHostedVisitAssets",
    "система клиники",
    "Снимки визита",
    "useSelfHostedApiSession",
  ],
  "scripts/rds3-folder-importer.mjs": [
    "Dermatolog Pro RDS-3 folder importer",
    "/api/v1/visits/",
    "/capture-metadata",
    "captureSource: \"device_bridge\"",
  ],
  "scripts/rds3-folder-importer.test.mjs": [
    "RDS-3 importer uploads a new RDS image",
    "storagePath|signedUrl",
    "already_imported",
  ],
  "scripts/windows/DermatologProRdsBridgeSetup.ps1": [
    "Dermatolog Pro RDS Bridge",
    "FolderBrowserDialog",
    "ConvertFrom-SecureString",
    "/api/v1/visits/$visit/assets",
    "/capture-metadata",
    "Dermatolog Pro RDS Bridge.lnk",
  ],
  "scripts/rds3-windows-bridge-installer.test.mjs": [
    "RDS-3 Windows bridge installer is a human-friendly setup file",
    "Read-Host \"Ключ доступа\" -AsSecureString",
    "existing safe asset contracts",
  ],
  "docs/backend/stage-4i-self-hosted-assets.md": [
    "Stage 4I",
    "POST /api/v1/visits/{visitId}/assets",
    "GET /api/v1/assets/{assetId}/download-url",
    "npm run preflight:stage4i",
  ],
  "docs/backend/rds3-folder-importer-windows.md": [
    "RDS-3 folder importer for Windows 11",
    "DermatologProRdsBridgeSetup.ps1",
    "POST /api/v1/visits/{visitId}/assets",
    "PATCH /api/v1/visits/{visitId}/assets/{assetId}/capture-metadata",
    "npm run test:rds3:import-folder",
  ],
  ".github/workflows/stage4i-self-hosted-assets.yml": [
    "name: stage4i-self-hosted-assets",
    "npm run preflight:stage4i",
    "GITHUB_STEP_SUMMARY",
  ],
};

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bsupabase\b/i,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bSUPABASE_/,
];

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/asset-write-repository.mjs",
  "backend/self-hosted/asset-write-service.mjs",
  "backend/self-hosted/openapi.stage4i.json",
  "src/lib/self-hosted-asset-api.ts",
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
        errors.push(`${file} contains forbidden managed-runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of ['"test:stage4i"', '"check:stage4i"', '"preflight:stage4i"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  for (const testFile of ["src/lib/self-hosted-visit-api.test.ts", "src/pages/doctor/CapturePageLive.test.tsx"]) {
    if (!packageJson.includes(testFile)) errors.push(`package.json Stage 4I tests missing ${testFile}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4I self-hosted assets preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4I self-hosted assets preflight");
  }
}

export function collectStage4IChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4IChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4i-self-hosted-assets] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4i-self-hosted-assets] OK (${result.checkedFiles} files, self-hosted asset guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

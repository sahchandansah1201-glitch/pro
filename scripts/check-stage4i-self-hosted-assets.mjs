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
  "docs/backend/stage-4i-self-hosted-assets.md",
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
    "visitWriteScope",
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
  "src/pages/doctor/VisitImagingTab.tsx": [
    "listSelfHostedVisitAssets",
    "self-hosted backend",
    "useSelfHostedApiSession",
  ],
  "docs/backend/stage-4i-self-hosted-assets.md": [
    "Stage 4I",
    "POST /api/v1/visits/{visitId}/assets",
    "GET /api/v1/assets/{assetId}/download-url",
    "npm run preflight:stage4i",
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

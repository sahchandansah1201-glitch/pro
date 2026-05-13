#!/usr/bin/env node
// Stage 4J · Self-hosted clinical asset binary guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/object-store.mjs",
  "backend/self-hosted/object-store.test.mjs",
  "backend/self-hosted/asset-write-service.mjs",
  "backend/self-hosted/asset-write-service.test.mjs",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "backend/self-hosted/openapi.stage4j.json",
  "src/lib/self-hosted-asset-api.ts",
  "src/lib/self-hosted-asset-api.test.ts",
  "docs/backend/stage-4j-self-hosted-asset-binaries.md",
  "scripts/check-stage4j-self-hosted-asset-binaries.mjs",
  "scripts/check-stage4j-self-hosted-asset-binaries.test.mjs",
  ".github/workflows/stage4j-self-hosted-asset-binaries.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/object-store.mjs": [
    "createLocalObjectStore",
    "localObjectPath",
    "putObject",
    "getObject",
    "local-filesystem",
  ],
  "backend/self-hosted/asset-write-service.mjs": [
    "dataBase64",
    "sha256Hex",
    "objectStore.putObject",
    "downloadAsset",
    "asset.download",
    "asset_binary_not_found",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4j.json",
    "assetDownloadMatch",
    "binaryResponse",
    "createLocalObjectStore",
    "rbac-read-write-postgres-backend-url-local-object-store",
  ],
  "backend/self-hosted/openapi.stage4j.json": [
    "4J-asset-binaries",
    "/api/v1/assets/{assetId}/download",
    "dataBase64",
    "no signed URL, access_token, bucket, object key, or storage path is exposed",
  ],
  "src/lib/self-hosted-asset-api.ts": [
    "fileToBase64",
    "dataBase64",
    "requestBlob",
    "URL.createObjectURL",
  ],
  "deploy/self-hosted/docker-compose.stage4a.yml": [
    "OBJECT_STORAGE_LOCAL_DIR",
    "backend-object-storage",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage4j.json",
  ],
  "docs/backend/stage-4j-self-hosted-asset-binaries.md": [
    "Stage 4J",
    "POST /api/v1/visits/{visitId}/assets",
    "GET /api/v1/assets/{assetId}/download",
    "npm run preflight:stage4j",
  ],
  ".github/workflows/stage4j-self-hosted-asset-binaries.yml": [
    "name: stage4j-self-hosted-asset-binaries",
    "npm run preflight:stage4j",
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
  "backend/self-hosted/object-store.mjs",
  "backend/self-hosted/asset-write-service.mjs",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/openapi.stage4j.json",
  "src/lib/self-hosted-asset-api.ts",
  "deploy/self-hosted/docker-compose.stage4a.yml",
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
        errors.push(`${file} contains forbidden managed-runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of ['"test:stage4j"', '"check:stage4j"', '"preflight:stage4j"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4J self-hosted asset binaries preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4J self-hosted asset binaries preflight");
  }
}

export function collectStage4JChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4JChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4j-self-hosted-asset-binaries] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4j-self-hosted-asset-binaries] OK (${result.checkedFiles} files, self-hosted asset binary guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

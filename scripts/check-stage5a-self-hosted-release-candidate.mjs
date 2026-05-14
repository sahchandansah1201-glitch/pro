#!/usr/bin/env node
// Stage 5A · self-hosted release candidate guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "scripts/stage5a-release-candidate.mjs",
  "scripts/stage5a-release-candidate.test.mjs",
  "scripts/check-stage5a-self-hosted-release-candidate.mjs",
  "scripts/check-stage5a-self-hosted-release-candidate.test.mjs",
  "deploy/self-hosted/release-candidate.stage5a.env.example",
  "docs/backend/stage-5a-self-hosted-release-candidate.md",
  ".github/workflows/stage5a-self-hosted-release-candidate.yml",
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
  "deploy/self-hosted/.env.production.example",
  "backend/self-hosted/openapi.stage4z.json",
];

const REQUIRED_TEXT = {
  "scripts/stage5a-release-candidate.mjs": [
    "buildStage5AReleaseCandidate",
    "managedRuntime: \"none\"",
    "managedDatabase: \"none\"",
    "operator-owned PostgreSQL",
    "docker-compose.production.example.yml",
    "npm run preflight:all",
  ],
  "deploy/self-hosted/release-candidate.stage5a.env.example": [
    "APP_PORT=8080",
    "DATABASE_URL=postgres://",
    "JWT_SECRET=",
    "OBJECT_STORAGE_LOCAL_DIR=",
    "DEVICE_BRIDGE_WORKER_TOKEN=",
    "VITE_SELF_HOSTED_API_BASE_URL=",
    "SELF_HOSTED_API_BASE_URL=",
    "THIRD_PARTY_MANAGED_SERVICES_REQUIRED=false",
  ],
  "docs/backend/stage-5a-self-hosted-release-candidate.md": [
    "Stage 5A",
    "npm run preflight:stage5a",
    "release-candidate.stage5a.env.example",
    "operator-owned PostgreSQL",
    "managed runtime: none",
    "npm run smoke:stage4k",
  ],
  ".github/workflows/stage5a-self-hosted-release-candidate.yml": [
    "name: stage5a-self-hosted-release-candidate",
    "npm run preflight:stage5a",
    "stage5a-release-candidate.md",
    "GITHUB_STEP_SUMMARY",
  ],
  "backend/self-hosted/README.md": [
    "Stage 5A",
    "npm run preflight:stage5a",
    "release-candidate.stage5a.env.example",
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
  "scripts/stage5a-release-candidate.mjs",
  "deploy/self-hosted/release-candidate.stage5a.env.example",
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
    '"test:stage5a"',
    '"check:stage5a"',
    '"preflight:stage5a"',
    '"release:stage5a:dry-run"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }

  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5A self-hosted release candidate preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5A self-hosted release candidate preflight");
  }
}

export function collectStage5AChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5AChecks();
  if (!result.ok) {
    console.error("[stage5a-self-hosted-release-candidate] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage5a-self-hosted-release-candidate] OK (${result.checkedFiles} files checked)`);
}

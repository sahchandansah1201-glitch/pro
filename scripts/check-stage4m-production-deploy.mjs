#!/usr/bin/env node
// Stage 4M · Production deployment verification guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "scripts/stage4m-production-deploy-verify.mjs",
  "scripts/stage4m-production-deploy-verify.test.mjs",
  "scripts/check-stage4m-production-deploy.mjs",
  "scripts/check-stage4m-production-deploy.test.mjs",
  "docs/backend/stage-4m-production-deployment-verification.md",
  ".github/workflows/stage4m-production-deployment-verification.yml",
  "deploy/self-hosted/.env.production.example",
  "deploy/self-hosted/update-production.sh",
  "deploy/self-hosted/docker-compose.production.example.yml",
  "scripts/stage4l-self-hosted-ops.mjs",
  "scripts/stage4k-self-hosted-compose-smoke.mjs",
];

const REQUIRED_TEXT = {
  "scripts/stage4m-production-deploy-verify.mjs": [
    "first-boot",
    "post-deploy",
    "backup-after-deploy",
    "rollback-drill",
    "update",
    "VITE_APP_MODE",
    "VITE_SELF_HOSTED_API_BASE_URL",
    "ROLLBACK_TO_SELF_HOSTED_BACKUP",
    "smoke:stage4k",
    "ops:stage4l:verify-env",
    "docker-compose.production.example.yml",
  ],
  "docs/backend/stage-4m-production-deployment-verification.md": [
    "Stage 4M",
    "npm run preflight:stage4m",
    "deploy:stage4m:first-boot:dry-run",
    "deploy:stage4m:post-deploy:dry-run",
    "deploy:stage4m:update:dry-run",
    "deploy:self-hosted:update",
    "deploy:stage4m:rollback-drill:dry-run",
    "ROLLBACK_TO_SELF_HOSTED_BACKUP",
  ],
  "deploy/self-hosted/update-production.sh": [
    "flock -n",
    "stage4m-production-deploy-verify.mjs update",
    "BACKUP_ROOT",
    "SUMMARY_PATH",
  ],
  "deploy/self-hosted/.env.production.example": [
    "VITE_APP_MODE=production",
    "VITE_SELF_HOSTED_API_BASE_URL=https://dermatolog.example.test",
  ],
  ".github/workflows/stage4m-production-deployment-verification.yml": [
    "name: stage4m-production-deployment-verification",
    "npm run preflight:stage4m",
    "deploy:stage4m:first-boot:dry-run",
    "deploy:stage4m:update:dry-run",
    "deploy:stage4m:rollback-drill:dry-run",
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
  "scripts/stage4m-production-deploy-verify.mjs",
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
  for (const script of [
    '"test:stage4m"',
    '"check:stage4m"',
    '"preflight:stage4m"',
    '"deploy:stage4m:first-boot:dry-run"',
    '"deploy:stage4m:post-deploy:dry-run"',
    '"deploy:stage4m:backup-after-deploy:dry-run"',
    '"deploy:stage4m:update:dry-run"',
    '"deploy:self-hosted:update"',
    '"deploy:stage4m:rollback-drill:dry-run"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4M production deployment verification preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4M production deployment verification preflight");
  }
}

export function collectStage4MChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4MChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4m-production-deploy] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4m-production-deploy] OK (${result.checkedFiles} files, production deploy verification guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

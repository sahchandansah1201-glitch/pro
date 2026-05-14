#!/usr/bin/env node
// Stage 4L · Self-hosted operations hardening guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/.env.production.example",
  "deploy/self-hosted/docker-compose.production.example.yml",
  "scripts/stage4l-self-hosted-ops.mjs",
  "scripts/stage4l-self-hosted-ops.test.mjs",
  "scripts/check-stage4l-self-hosted-ops.mjs",
  "scripts/check-stage4l-self-hosted-ops.test.mjs",
  "docs/backend/stage-4l-self-hosted-ops-hardening.md",
  ".github/workflows/stage4l-self-hosted-ops-hardening.yml",
  ".gitignore",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/.env.production.example": [
    "POSTGRES_PASSWORD=replace-me-postgres-password",
    "JWT_SECRET=replace-me-with-64-random-characters",
    "DEVICE_BRIDGE_WORKER_TOKEN=replace-me-with-64-random-characters-worker-token",
    "MINIO_ROOT_PASSWORD=replace-me-minio-password",
    "BACKUP_RETENTION_DAYS=14",
  ],
  "deploy/self-hosted/docker-compose.production.example.yml": [
    "restart: unless-stopped",
    ".env.production",
    "docker-compose.stage4a.yml",
  ],
  "scripts/stage4l-self-hosted-ops.mjs": [
    "RESTORE_SELF_HOSTED_DATA",
    "pg_dump",
    "pg_restore",
    "composeEnvFile",
    "object-storage.tgz",
    "stage4l-backup-manifest.json",
    "smoke:stage4k",
    "verifyEnvText",
    "DEVICE_BRIDGE_WORKER_TOKEN",
  ],
  "docs/backend/stage-4l-self-hosted-ops-hardening.md": [
    "Stage 4L",
    "npm run preflight:stage4l",
    "ops:stage4l:backup:dry-run",
    "--compose-env-file",
    "RESTORE_SELF_HOSTED_DATA",
    "post-restore verification",
  ],
  ".github/workflows/stage4l-self-hosted-ops-hardening.yml": [
    "name: stage4l-self-hosted-ops-hardening",
    "npm run preflight:stage4l",
    "ops:stage4l:backup:dry-run",
    "GITHUB_STEP_SUMMARY",
  ],
  ".gitignore": [
    "backups/self-hosted/",
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
  "deploy/self-hosted/.env.production.example",
  "deploy/self-hosted/docker-compose.production.example.yml",
  "scripts/stage4l-self-hosted-ops.mjs",
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
    '"test:stage4l"',
    '"check:stage4l"',
    '"preflight:stage4l"',
    '"ops:stage4l:backup:dry-run"',
    '"ops:stage4l:restore:dry-run"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4L self-hosted ops hardening preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4L self-hosted ops hardening preflight");
  }
}

export function collectStage4LChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4LChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4l-self-hosted-ops] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4l-self-hosted-ops] OK (${result.checkedFiles} files, ops hardening guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

#!/usr/bin/env node
// Stage 4K · Self-hosted deploy smoke guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0007_stage4k_deploy_smoke_seed.sql",
  "scripts/stage4k-self-hosted-compose-smoke.mjs",
  "scripts/stage4k-self-hosted-compose-smoke.test.mjs",
  "scripts/check-stage4k-self-hosted-deploy-smoke.mjs",
  "scripts/check-stage4k-self-hosted-deploy-smoke.test.mjs",
  "docs/backend/stage-4k-self-hosted-deploy-smoke.md",
  ".github/workflows/stage4k-self-hosted-deploy-smoke.yml",
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/nginx.stage4a.conf",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0007_stage4k_deploy_smoke_seed.sql": [
    "Stage 4K deploy smoke seed",
    "10000000-0000-4000-8000-000000000301",
    "L-STAGE4K",
    "on conflict (id) do nothing",
  ],
  "scripts/stage4k-self-hosted-compose-smoke.mjs": [
    "runStage4KSmoke",
    "dockerComposeArgs",
    "/healthz",
    "/readyz",
    "/api/v1/auth/login",
    "/api/v1/patients",
    "/api/v1/visits/",
    "/api/v1/assets/",
    "stage4k-smoke-asset",
    "--keep-up-on-fail",
  ],
  "docs/backend/stage-4k-self-hosted-deploy-smoke.md": [
    "Stage 4K",
    "npm run smoke:stage4k",
    "npm run preflight:stage4k",
    "docker compose",
    "login",
    "asset upload/download",
  ],
  ".github/workflows/stage4k-self-hosted-deploy-smoke.yml": [
    "name: stage4k-self-hosted-deploy-smoke",
    "npm run preflight:stage4k",
    "npm run smoke:stage4k",
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
  "backend/self-hosted/db/migrations/0007_stage4k_deploy_smoke_seed.sql",
  "scripts/stage4k-self-hosted-compose-smoke.mjs",
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
  for (const script of [
    '"test:stage4k"',
    '"check:stage4k"',
    '"preflight:stage4k"',
    '"smoke:stage4k"',
    '"smoke:stage4k:dry-run"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4K self-hosted deploy smoke preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4K self-hosted deploy smoke preflight");
  }
}

export function collectStage4KChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4KChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4k-self-hosted-deploy-smoke] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4k-self-hosted-deploy-smoke] OK (${result.checkedFiles} files, deploy smoke guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

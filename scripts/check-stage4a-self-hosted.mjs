#!/usr/bin/env node
// Stage 4A · Self-hosted backend foundation guard.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_FILES = [
  "backend/self-hosted/config.mjs",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/server.mjs",
  "backend/self-hosted/routes.test.mjs",
  "backend/self-hosted/openapi.stage4a.json",
  "backend/self-hosted/db/migrations/0001_stage4a_core.sql",
  "backend/self-hosted/Dockerfile",
  "backend/self-hosted/README.md",
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/nginx.stage4a.conf",
  "deploy/self-hosted/.env.example",
  "docs/backend/stage-4a-self-hosted-foundation.md",
  ".github/workflows/stage4a-self-hosted.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/config.mjs": [
    "readSelfHostedConfig",
    "readinessStatus",
    "publicConfig",
    "DATABASE_URL",
    "OBJECT_STORAGE_ENDPOINT",
  ],
  "backend/self-hosted/routes.mjs": [
    "handleSelfHostedRequest",
    "/healthz",
    "/readyz",
    "/api/v1/meta",
    "/openapi.stage4a.json",
  ],
  "backend/self-hosted/routes.test.mjs": [
    "healthz returns a safe self-hosted service status",
    "readyz reports degraded",
    "meta and openapi routes expose contracts",
  ],
  "backend/self-hosted/openapi.stage4a.json": [
    "Dermatolog Pro Self-hosted API",
    "/api/v1/meta",
    "/api/v1/patients",
    "/api/v1/assets/presign",
    "/api/v1/audit/events",
  ],
  "backend/self-hosted/db/migrations/0001_stage4a_core.sql": [
    "create table clinics",
    "create table app_users",
    "create table user_roles",
    "create table patients",
    "create table visits",
    "create table lesions",
    "create table clinical_assets",
    "create table reports",
    "create table audit_log",
    "audit_log is append-only",
  ],
  "deploy/self-hosted/docker-compose.stage4a.yml": [
    "reverse-proxy:",
    "backend:",
    "postgres:",
    "object-storage:",
    "dockerfile: backend/self-hosted/Dockerfile",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "location /api/",
    "location /healthz",
    "try_files $uri $uri/ /index.html",
  ],
  "docs/backend/stage-4a-self-hosted-foundation.md": [
    "Stage 4A",
    "Self-hosted",
    "docker compose",
    "PostgreSQL",
    "object storage",
    "No managed backend dependency",
  ],
  ".github/workflows/stage4a-self-hosted.yml": [
    "name: stage4a-self-hosted",
    "npm run preflight:stage4a",
    "GITHUB_STEP_SUMMARY",
  ],
};

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bsupabase\b/i,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bproject-ref\b/i,
  /\bSUPABASE_/,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function requireText(errors, root, file, expected) {
  const content = read(root, file);
  for (const text of expected) {
    if (!content.includes(text)) {
      errors.push(`${file} missing required text: ${text}`);
    }
  }
}

function scanRuntimeCoupling(errors, root) {
  const protectedFiles = REQUIRED_FILES.filter(
    (file) =>
      (file.startsWith("backend/self-hosted/") && !file.endsWith(".test.mjs")) ||
      file.startsWith("deploy/self-hosted/"),
  );
  for (const file of protectedFiles) {
    const content = read(root, file);
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden managed-runtime coupling: ${pattern}`);
      }
    }
  }
}

function validateOpenApi(errors, root) {
  try {
    const parsed = JSON.parse(read(root, "backend/self-hosted/openapi.stage4a.json"));
    if (parsed.openapi !== "3.1.0") {
      errors.push("openapi.stage4a.json must use OpenAPI 3.1.0");
    }
    if (!parsed.paths?.["/api/v1/meta"]) {
      errors.push("openapi.stage4a.json must define /api/v1/meta");
    }
    if (!parsed.paths?.["/api/v1/patients"]) {
      errors.push("openapi.stage4a.json must define /api/v1/patients");
    }
  } catch (error) {
    errors.push(`openapi.stage4a.json is not valid JSON: ${error.message}`);
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage4a\"",
    "\"check:stage4a\"",
    "\"preflight:stage4a\"",
  ]) {
    if (!packageJson.includes(script)) {
      errors.push(`package.json missing ${script}`);
    }
  }
}

export function collectStage4AChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) {
      requireText(errors, root, file, expected);
    }
  }
  scanRuntimeCoupling(errors, root);
  validateOpenApi(errors, root);
  validatePackageScripts(errors, root);
  return {
    ok: errors.length === 0,
    errors,
    checkedFiles: REQUIRED_FILES.length,
  };
}

export function main() {
  const result = collectStage4AChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4a-self-hosted] failed:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }
  console.log(
    `[check-stage4a-self-hosted] OK (${result.checkedFiles} files, self-hosted runtime guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

#!/usr/bin/env node
// Stage 4B · Self-hosted backend runtime guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/api-response.mjs",
  "backend/self-hosted/db-client.mjs",
  "backend/self-hosted/db-client.test.mjs",
  "backend/self-hosted/patients-repository.mjs",
  "backend/self-hosted/patients-repository.test.mjs",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "backend/self-hosted/openapi.stage4b.json",
  "backend/self-hosted/db/migrations/0002_stage4b_runtime_seed.sql",
  "docs/backend/stage-4b-backend-runtime.md",
  ".github/workflows/stage4b-backend-runtime.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/api-response.mjs": [
    "errorResponse",
    "notImplementedResponse",
    "error:",
    "correlationId",
  ],
  "backend/self-hosted/db-client.mjs": [
    "createPostgresClient",
    "runPsqlJson",
    "databaseUrlToPsqlEnv",
    "PGPASSWORD",
    "DatabaseUnavailableError",
  ],
  "backend/self-hosted/patients-repository.mjs": [
    "createPatientRepository",
    "buildListPatientsSql",
    "p.deleted_at is null",
    "source: \"postgres\"",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4b.json",
    "read-only-postgres",
    "/api/v1/patients",
    "runtimeReadiness",
    "database_unavailable",
  ],
  "backend/self-hosted/Dockerfile": [
    "postgresql-client",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "location /openapi.stage4b.json",
    "proxy_pass http://backend:3001/api/",
  ],
  "backend/self-hosted/openapi.stage4b.json": [
    "4B-runtime",
    "Read-only patient list from PostgreSQL",
    "\"ApiError\"",
    "\"PatientListItem\"",
  ],
  "backend/self-hosted/db/migrations/0002_stage4b_runtime_seed.sql": [
    "Stage 4B runtime seed",
    "demo-clinic",
    "DP-DEMO-0001",
  ],
  "docs/backend/stage-4b-backend-runtime.md": [
    "Stage 4B",
    "PostgreSQL-backed read path",
    "consistent JSON error",
    "No managed backend runtime dependency",
  ],
  ".github/workflows/stage4b-backend-runtime.yml": [
    "name: stage4b-backend-runtime",
    "npm run preflight:stage4b",
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
  const protectedFiles = [
    "backend/self-hosted/api-response.mjs",
    "backend/self-hosted/db-client.mjs",
    "backend/self-hosted/patients-repository.mjs",
    "backend/self-hosted/routes.mjs",
    "backend/self-hosted/server.mjs",
    "backend/self-hosted/openapi.stage4b.json",
    "deploy/self-hosted/docker-compose.stage4a.yml",
    "deploy/self-hosted/nginx.stage4a.conf",
  ];
  for (const file of protectedFiles) {
    if (!existsSync(join(root, file))) continue;
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
    const parsed = JSON.parse(read(root, "backend/self-hosted/openapi.stage4b.json"));
    if (parsed.openapi !== "3.1.0") {
      errors.push("openapi.stage4b.json must use OpenAPI 3.1.0");
    }
    if (parsed.info?.version !== "4B-runtime") {
      errors.push("openapi.stage4b.json must expose version 4B-runtime");
    }
    if (!parsed.paths?.["/api/v1/patients"]?.get?.responses?.["200"]) {
      errors.push("openapi.stage4b.json must define GET /api/v1/patients 200");
    }
    if (!parsed.components?.schemas?.ApiError) {
      errors.push("openapi.stage4b.json must define ApiError schema");
    }
  } catch (error) {
    errors.push(`openapi.stage4b.json is not valid JSON: ${error.message}`);
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage4b\"",
    "\"check:stage4b\"",
    "\"preflight:stage4b\"",
  ]) {
    if (!packageJson.includes(script)) {
      errors.push(`package.json missing ${script}`);
    }
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4B backend runtime preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4B backend runtime preflight");
  }
}

export function collectStage4BChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4BChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4b-backend-runtime] failed:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }
  console.log(
    `[check-stage4b-backend-runtime] OK (${result.checkedFiles} files, PostgreSQL runtime guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

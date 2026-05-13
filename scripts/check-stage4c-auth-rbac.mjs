#!/usr/bin/env node
// Stage 4C · Self-hosted backend auth/RBAC guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/auth-crypto.mjs",
  "backend/self-hosted/auth-crypto.test.mjs",
  "backend/self-hosted/auth-tokens.mjs",
  "backend/self-hosted/auth-tokens.test.mjs",
  "backend/self-hosted/auth-repository.mjs",
  "backend/self-hosted/auth-repository.test.mjs",
  "backend/self-hosted/auth-service.mjs",
  "backend/self-hosted/auth-service.test.mjs",
  "backend/self-hosted/audit-repository.mjs",
  "backend/self-hosted/audit-repository.test.mjs",
  "backend/self-hosted/rbac.mjs",
  "backend/self-hosted/rbac.test.mjs",
  "backend/self-hosted/openapi.stage4c.json",
  "backend/self-hosted/db/migrations/0003_stage4c_auth_seed.sql",
  "docs/backend/stage-4c-auth-rbac.md",
  ".github/workflows/stage4c-auth-rbac.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/auth-crypto.mjs": [
    "hashPassword",
    "verifyPasswordHash",
    "scryptSync",
    "timingSafeEqual",
  ],
  "backend/self-hosted/auth-tokens.mjs": [
    "signAccessToken",
    "verifyAccessToken",
    "extractBearerToken",
    "JWT_SECRET",
    "HS256",
  ],
  "backend/self-hosted/auth-service.mjs": [
    "createAuthService",
    "auth.login",
    "Bearer",
    "InvalidCredentialsError",
  ],
  "backend/self-hosted/rbac.mjs": [
    "PATIENT_READ_ROLES",
    "patientReadScope",
    "AuthRequiredError",
    "ForbiddenError",
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/auth/login",
    "/api/v1/auth/me",
    "rbac-read-only-postgres",
    "patientReadScope",
    "patient.list",
    "openapi.stage4c.json",
  ],
  "backend/self-hosted/openapi.stage4c.json": [
    "4C-auth-rbac",
    "bearerAuth",
    "/api/v1/auth/login",
    "/api/v1/auth/me",
    "RoleBinding",
  ],
  "backend/self-hosted/db/migrations/0003_stage4c_auth_seed.sql": [
    "Stage 4C auth seed",
    "$scrypt$",
    "stage4c.auth_seed",
  ],
  "deploy/self-hosted/docker-compose.stage4a.yml": [
    "JWT_SECRET",
    "JWT_EXPIRES_IN_SECONDS",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "location /openapi.stage4c.json",
  ],
  "docs/backend/stage-4c-auth-rbac.md": [
    "Stage 4C",
    "local JWT",
    "RBAC",
    "audit log",
    "No managed backend runtime dependency",
  ],
  ".github/workflows/stage4c-auth-rbac.yml": [
    "name: stage4c-auth-rbac",
    "npm run preflight:stage4c",
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
    "backend/self-hosted/auth-crypto.mjs",
    "backend/self-hosted/auth-tokens.mjs",
    "backend/self-hosted/auth-repository.mjs",
    "backend/self-hosted/auth-service.mjs",
    "backend/self-hosted/audit-repository.mjs",
    "backend/self-hosted/rbac.mjs",
    "backend/self-hosted/routes.mjs",
    "backend/self-hosted/openapi.stage4c.json",
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
    const parsed = JSON.parse(read(root, "backend/self-hosted/openapi.stage4c.json"));
    if (parsed.openapi !== "3.1.0") {
      errors.push("openapi.stage4c.json must use OpenAPI 3.1.0");
    }
    if (parsed.info?.version !== "4C-auth-rbac") {
      errors.push("openapi.stage4c.json must expose version 4C-auth-rbac");
    }
    if (!parsed.components?.securitySchemes?.bearerAuth) {
      errors.push("openapi.stage4c.json must define bearerAuth security scheme");
    }
    if (!parsed.paths?.["/api/v1/auth/login"]?.post) {
      errors.push("openapi.stage4c.json must define POST /api/v1/auth/login");
    }
    if (!parsed.paths?.["/api/v1/patients"]?.get?.responses?.["401"]) {
      errors.push("openapi.stage4c.json must define auth errors for GET /api/v1/patients");
    }
  } catch (error) {
    errors.push(`openapi.stage4c.json is not valid JSON: ${error.message}`);
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage4c\"",
    "\"check:stage4c\"",
    "\"preflight:stage4c\"",
  ]) {
    if (!packageJson.includes(script)) {
      errors.push(`package.json missing ${script}`);
    }
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4C auth/RBAC preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4C auth/RBAC preflight");
  }
}

export function collectStage4CChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4CChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4c-auth-rbac] failed:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }
  console.log(
    `[check-stage4c-auth-rbac] OK (${result.checkedFiles} files, local auth/RBAC guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

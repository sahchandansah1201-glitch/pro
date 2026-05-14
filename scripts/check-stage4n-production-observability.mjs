#!/usr/bin/env node
// Stage 4N · Production observability and audit guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/ops-logger.mjs",
  "backend/self-hosted/ops-logger.test.mjs",
  "backend/self-hosted/openapi.stage4n.json",
  "scripts/stage4n-audit-export.mjs",
  "scripts/stage4n-audit-export.test.mjs",
  "scripts/check-stage4n-production-observability.mjs",
  "scripts/check-stage4n-production-observability.test.mjs",
  "docs/backend/stage-4n-production-observability-audit.md",
  ".github/workflows/stage4n-production-observability-audit.yml",
  "deploy/self-hosted/nginx.stage4a.conf",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/ops-logger.mjs": [
    "createOpsLogger",
    "sanitizeOpsPayload",
    "safeRequestPath",
    "extractCorrelationId",
    "Bearer [redacted]",
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/ops/status",
    "ops.status.read",
    "openapi.stage4n.json",
    "structuredJsonLogs",
    "x-correlation-id",
  ],
  "backend/self-hosted/api-response.mjs": [
    "x-correlation-id",
  ],
  "backend/self-hosted/rbac.mjs": [
    "OPS_STATUS_ROLES",
    "opsStatusScope",
  ],
  "scripts/stage4n-audit-export.mjs": [
    "Stage 4N audit export dry-run",
    "created_at",
    "correlation_id",
    "Excluded: request bodies, tokens, passwords, patient names, object keys, storage paths, raw env values",
  ],
  "docs/backend/stage-4n-production-observability-audit.md": [
    "Stage 4N",
    "npm run preflight:stage4n",
    "/api/v1/ops/status",
    "ops:stage4n:audit-export:dry-run",
    "structured JSON logs",
  ],
  ".github/workflows/stage4n-production-observability-audit.yml": [
    "name: stage4n-production-observability-audit",
    "npm run preflight:stage4n",
    "ops:stage4n:audit-export:dry-run",
    "GITHUB_STEP_SUMMARY",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage4n.json",
    "proxy_pass http://backend:3001/openapi.stage4n.json",
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
  "backend/self-hosted/ops-logger.mjs",
  "backend/self-hosted/openapi.stage4n.json",
  "scripts/stage4n-audit-export.mjs",
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
    '"test:stage4n"',
    '"check:stage4n"',
    '"preflight:stage4n"',
    '"ops:stage4n:audit-export:dry-run"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4N production observability preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4N production observability preflight");
  }
}

export function collectStage4NChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage4NChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4n-production-observability] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4n-production-observability] OK (${result.checkedFiles} files, production observability guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

#!/usr/bin/env node
// Stage 5B · production server bootstrap guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "scripts/stage5b-server-bootstrap.mjs",
  "scripts/stage5b-server-bootstrap.test.mjs",
  "scripts/check-stage5b-production-server-bootstrap.mjs",
  "scripts/check-stage5b-production-server-bootstrap.test.mjs",
  "deploy/self-hosted/bootstrap-system-admin.stage5b.sql.example",
  "deploy/self-hosted/release-candidate.stage5a.env.example",
  "docs/backend/stage-5b-production-server-bootstrap.md",
  ".github/workflows/stage5b-production-server-bootstrap.yml",
  "scripts/preflight-all.mjs",
  "package.json",
];

const REQUIRED_TEXT = {
  "scripts/stage5b-server-bootstrap.mjs": [
    "buildStage5BPlan",
    "validateStage5BEnvText",
    "buildSystemAdminBootstrapSql",
    "managedRuntime: \"none\"",
    "managedDatabase: \"none\"",
    "THIRD_PARTY_MANAGED_SERVICES_REQUIRED",
    "docker compose version",
    "stage5b.system_admin_bootstrap",
  ],
  "deploy/self-hosted/bootstrap-system-admin.stage5b.sql.example": [
    "stage5b.system_admin_bootstrap",
    "'system_admin'::app_role",
    "Do not commit generated SQL",
  ],
  "docs/backend/stage-5b-production-server-bootstrap.md": [
    "Stage 5B",
    "npm run preflight:stage5b",
    "bootstrap:stage5b:dry-run",
    "bootstrap:stage5b:verify-env:example",
    "operator-owned PostgreSQL",
    "first system_admin",
    "managed runtime: none",
  ],
  ".github/workflows/stage5b-production-server-bootstrap.yml": [
    "name: stage5b-production-server-bootstrap",
    "npm run preflight:stage5b",
    "stage5b-server-bootstrap.md",
    "GITHUB_STEP_SUMMARY",
  ],
  "backend/self-hosted/README.md": [
    "Stage 5B",
    "npm run preflight:stage5b",
    "bootstrap-system-admin.stage5b.sql.example",
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
  "scripts/stage5b-server-bootstrap.mjs",
  "deploy/self-hosted/bootstrap-system-admin.stage5b.sql.example",
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
    '"test:stage5b"',
    '"check:stage5b"',
    '"preflight:stage5b"',
    '"bootstrap:stage5b:dry-run"',
    '"bootstrap:stage5b:verify-env:example"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5B production server bootstrap preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5B production server bootstrap preflight");
  }
}

export function collectStage5BChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5BChecks();
  if (!result.ok) {
    console.error("[stage5b-production-server-bootstrap] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage5b-production-server-bootstrap] OK (${result.checkedFiles} files checked)`);
}

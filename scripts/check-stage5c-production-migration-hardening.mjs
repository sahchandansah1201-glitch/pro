#!/usr/bin/env node
// Stage 5C · production migration/bootstrap hardening guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "scripts/stage5c-production-migration-hardening.mjs",
  "scripts/stage5c-production-migration-hardening.test.mjs",
  "scripts/check-stage5c-production-migration-hardening.mjs",
  "scripts/check-stage5c-production-migration-hardening.test.mjs",
  "deploy/self-hosted/prestart-schema-check.stage5c.sql",
  "docs/backend/stage-5c-production-migration-hardening.md",
  ".github/workflows/stage5c-production-migration-hardening.yml",
  "scripts/preflight-all.mjs",
  "package.json",
];

const REQUIRED_TEXT = {
  "scripts/stage5c-production-migration-hardening.mjs": [
    "buildStage5CMigrationInventory",
    "buildStage5CPrestartSchemaSql",
    "PRODUCTION_EXCLUDED_SEEDS",
    "managedRuntime: \"none\"",
    "managedDatabase: \"none\"",
    "doctor.demo@example.invalid",
    "audit_log_no_update",
  ],
  "deploy/self-hosted/prestart-schema-check.stage5c.sql": [
    "Stage 5C",
    "audit_log_no_update",
    "doctor.demo@example.invalid",
    "no system_admin role found",
  ],
  "docs/backend/stage-5c-production-migration-hardening.md": [
    "Stage 5C",
    "npm run preflight:stage5c",
    "migrate:stage5c:dry-run",
    "migrate:stage5c:schema-sql",
    "production seed policy",
    "operator-owned PostgreSQL",
    "managed runtime: none",
  ],
  ".github/workflows/stage5c-production-migration-hardening.yml": [
    "name: stage5c-production-migration-hardening",
    "npm run preflight:stage5c",
    "stage5c-production-migration-hardening.md",
    "GITHUB_STEP_SUMMARY",
  ],
  "backend/self-hosted/README.md": [
    "Stage 5C",
    "npm run preflight:stage5c",
    "prestart-schema-check.stage5c.sql",
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
  "scripts/stage5c-production-migration-hardening.mjs",
  "deploy/self-hosted/prestart-schema-check.stage5c.sql",
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
    '"test:stage5c"',
    '"check:stage5c"',
    '"preflight:stage5c"',
    '"migrate:stage5c:dry-run"',
    '"migrate:stage5c:schema-sql"',
    '"migrate:stage5c:seed-policy"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5C production migration hardening preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5C production migration hardening preflight");
  }
}

export function collectStage5CChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5CChecks();
  if (!result.ok) {
    console.error("[stage5c-production-migration-hardening] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage5c-production-migration-hardening] OK (${result.checkedFiles} files checked)`);
}

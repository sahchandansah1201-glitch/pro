#!/usr/bin/env node
// Stage 5V · external adapter operations guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/integrations/booking-import.stage5u.example.json",
  "deploy/self-hosted/integrations/booking-import-status.stage5v.example.json",
  "scripts/stage5u-external-adapter-pack.mjs",
  "scripts/stage5v-external-adapter-ops.mjs",
  "scripts/stage5v-external-adapter-ops.test.mjs",
  "scripts/check-stage5v-external-adapter-operations.mjs",
  "scripts/check-stage5v-external-adapter-operations.test.mjs",
  "docs/backend/stage-5v-external-adapter-operations.md",
  ".github/workflows/stage5v-external-adapter-operations.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/integrations/booking-import-status.stage5v.example.json": [
    "storedRawPayload",
    "runtimeCallsExternalSystems",
    "hardeningVersion",
    "latestBySource",
  ],
  "scripts/stage5v-external-adapter-ops.mjs": [
    "Stage 5V",
    "validateStatusSnapshot",
    "buildExternalAdapterOpsReport",
    "Operator checklist",
    "no network calls",
  ],
  "scripts/stage5v-external-adapter-ops.test.mjs": [
    "validates safe status snapshots",
    "CLI dry-run writes a local report file",
  ],
  "docs/backend/stage-5v-external-adapter-operations.md": [
    "Stage 5V",
    "npm run preflight:stage5v",
    "Managed runtime/database dependency: none",
    "operator report",
  ],
  ".github/workflows/stage5v-external-adapter-operations.yml": [
    "name: stage5v-external-adapter-operations",
    "npm run preflight:stage5v",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/integrations/booking-import-status.stage5v.example.json",
  "scripts/stage5v-external-adapter-ops.mjs",
  "docs/backend/stage-5v-external-adapter-operations.md",
];

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\baxios\b/i,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bSUPABASE_/,
  /\bnavigator\.usb\b/i,
  /\bnavigator\.bluetooth\b/i,
  /\bnavigator\.serial\b/i,
  /\bstorage_object_path\b/i,
  /\bsigned_url\b/i,
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

function scanProtectedFiles(errors, root) {
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const content = read(root, file);
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden Stage 5V runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage5v"',
    '"check:stage5v"',
    '"preflight:stage5v"',
    '"adapter:stage5v:ops:example"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5V external adapter operations preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5V external adapter operations preflight");
  }
}

export function collectStage5VChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required file (text check): ${file}`);
  }
  scanProtectedFiles(errors, root);
  validatePackageScripts(errors, root);
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectStage5VChecks();
  if (!result.ok) {
    console.error("[stage5v-external-adapter-operations] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5v-external-adapter-operations] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

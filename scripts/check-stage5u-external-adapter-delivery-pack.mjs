#!/usr/bin/env node
// Stage 5U · external adapter delivery pack guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/integrations/booking-import.stage5u.example.json",
  "scripts/stage5u-external-adapter-pack.mjs",
  "scripts/stage5u-external-adapter-pack.test.mjs",
  "scripts/check-stage5u-external-adapter-delivery-pack.mjs",
  "scripts/check-stage5u-external-adapter-delivery-pack.test.mjs",
  "docs/backend/stage-5u-external-adapter-delivery-pack.md",
  ".github/workflows/stage5u-external-adapter-delivery-pack.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/integrations/booking-import.stage5u.example.json": [
    "clinic_crm",
    "booking_request",
    "available_slot",
    "idempotencyKey",
  ],
  "scripts/stage5u-external-adapter-pack.mjs": [
    "Stage 5U",
    "validateExternalAdapterPayload",
    "runtimeCallsExternalSystems",
    "/api/v1/integrations/booking-imports",
    "no network calls",
  ],
  "scripts/stage5u-external-adapter-pack.test.mjs": [
    "dry-run renders local curl guidance",
    "rejects raw URLs, tokens, storage paths",
  ],
  "docs/backend/stage-5u-external-adapter-delivery-pack.md": [
    "Stage 5U",
    "npm run preflight:stage5u",
    "Managed runtime/database dependency: none",
    "inbound push",
  ],
  ".github/workflows/stage5u-external-adapter-delivery-pack.yml": [
    "name: stage5u-external-adapter-delivery-pack",
    "npm run preflight:stage5u",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/integrations/booking-import.stage5u.example.json",
  "scripts/stage5u-external-adapter-pack.mjs",
  "docs/backend/stage-5u-external-adapter-delivery-pack.md",
];

const FORBIDDEN_OUTBOUND_RUNTIME_PATTERNS = [
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
    for (const pattern of FORBIDDEN_OUTBOUND_RUNTIME_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden Stage 5U runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage5u"',
    '"check:stage5u"',
    '"preflight:stage5u"',
    '"adapter:stage5u:validate:example"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5U external adapter delivery pack preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5U external adapter delivery pack preflight");
  }
}

export function collectStage5UChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5UChecks();
  if (!result.ok) {
    console.error("[stage5u-external-adapter-delivery-pack] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5u-external-adapter-delivery-pack] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

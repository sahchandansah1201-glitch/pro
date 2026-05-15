#!/usr/bin/env node
// Stage 5Z · external adapter production handoff guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/integrations/adapter-handoff-manifest.stage5z.example.json",
  "scripts/stage5z-external-adapter-production-handoff.mjs",
  "scripts/stage5z-external-adapter-production-handoff.test.mjs",
  "scripts/check-stage5z-external-adapter-production-handoff.mjs",
  "scripts/check-stage5z-external-adapter-production-handoff.test.mjs",
  "docs/backend/stage-5z-external-adapter-production-handoff.md",
  ".github/workflows/stage5z-external-adapter-production-handoff.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/integrations/adapter-handoff-manifest.stage5z.example.json": [
    "requiredPackages",
    "operatorSignoff",
    "reconciliationManifestFile",
    "productRuntimeCallsExternalSystems",
    "managedRuntimeDependency",
    "managedDatabaseDependency",
  ],
  "scripts/stage5z-external-adapter-production-handoff.mjs": [
    "Stage 5Z",
    "buildExternalAdapterProductionHandoff",
    "detectHandoffLeaks",
    "handoff-summary.json",
    "handoff-checklist.json",
    "readyForProductionHandoff",
    "no network calls",
  ],
  "scripts/stage5z-external-adapter-production-handoff.test.mjs": [
    "green production handoff",
    "reconciliation is not signed off",
    "CLI dry-run writes production handoff files",
  ],
  "docs/backend/stage-5z-external-adapter-production-handoff.md": [
    "Stage 5Z",
    "npm run preflight:stage5z",
    "Managed runtime/database dependency: none",
    "self-hosted backend",
  ],
  ".github/workflows/stage5z-external-adapter-production-handoff.yml": [
    "name: stage5z-external-adapter-production-handoff",
    "npm run preflight:stage5z",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/integrations/adapter-handoff-manifest.stage5z.example.json",
  "scripts/stage5z-external-adapter-production-handoff.mjs",
  "docs/backend/stage-5z-external-adapter-production-handoff.md",
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
        errors.push(`${file} contains forbidden Stage 5Z runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage5z"',
    '"check:stage5z"',
    '"preflight:stage5z"',
    '"adapter:stage5z:handoff:example"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5Z external adapter production handoff preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5Z external adapter production handoff preflight");
  }
}

export function collectStage5ZChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5ZChecks();
  if (!result.ok) {
    console.error("[stage5z-external-adapter-production-handoff] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5z-external-adapter-production-handoff] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

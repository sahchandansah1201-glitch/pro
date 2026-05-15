#!/usr/bin/env node
// Stage 5Y · external adapter reconciliation package guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/integrations/adapter-reconciliation-manifest.stage5y.example.json",
  "scripts/stage5y-external-adapter-reconciliation-package.mjs",
  "scripts/stage5y-external-adapter-reconciliation-package.test.mjs",
  "scripts/check-stage5y-external-adapter-reconciliation-package.mjs",
  "scripts/check-stage5y-external-adapter-reconciliation-package.test.mjs",
  "docs/backend/stage-5y-external-adapter-reconciliation-package.md",
  ".github/workflows/stage5y-external-adapter-reconciliation-package.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/integrations/adapter-reconciliation-manifest.stage5y.example.json": [
    "auditManifestFile",
    "outcomes",
    "productRuntimeCallsExternalSystems",
    "managedRuntimeDependency",
    "managedDatabaseDependency",
  ],
  "scripts/stage5y-external-adapter-reconciliation-package.mjs": [
    "Stage 5Y",
    "buildExternalAdapterReconciliationPackage",
    "detectReconciliationLeaks",
    "reconciliation-summary.json",
    "reconciliation-ledger.json",
    "readyForOperatorSignoff",
    "no network calls",
  ],
  "scripts/stage5y-external-adapter-reconciliation-package.test.mjs": [
    "accepted/booked reconciliation package",
    "pending and unexpected outcomes",
    "CLI dry-run writes reconciliation files",
  ],
  "docs/backend/stage-5y-external-adapter-reconciliation-package.md": [
    "Stage 5Y",
    "npm run preflight:stage5y",
    "Managed runtime/database dependency: none",
    "self-hosted backend",
  ],
  ".github/workflows/stage5y-external-adapter-reconciliation-package.yml": [
    "name: stage5y-external-adapter-reconciliation-package",
    "npm run preflight:stage5y",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/integrations/adapter-reconciliation-manifest.stage5y.example.json",
  "scripts/stage5y-external-adapter-reconciliation-package.mjs",
  "docs/backend/stage-5y-external-adapter-reconciliation-package.md",
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
        errors.push(`${file} contains forbidden Stage 5Y runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage5y"',
    '"check:stage5y"',
    '"preflight:stage5y"',
    '"adapter:stage5y:reconcile:example"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5Y external adapter reconciliation package preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5Y external adapter reconciliation package preflight");
  }
}

export function collectStage5YChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5YChecks();
  if (!result.ok) {
    console.error("[stage5y-external-adapter-reconciliation-package] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5y-external-adapter-reconciliation-package] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

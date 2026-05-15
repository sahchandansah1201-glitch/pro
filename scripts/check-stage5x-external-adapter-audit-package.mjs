#!/usr/bin/env node
// Stage 5X · external adapter audit package guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/integrations/adapter-audit-manifest.stage5x.example.json",
  "scripts/stage5x-external-adapter-audit-package.mjs",
  "scripts/stage5x-external-adapter-audit-package.test.mjs",
  "scripts/check-stage5x-external-adapter-audit-package.mjs",
  "scripts/check-stage5x-external-adapter-audit-package.test.mjs",
  "docs/backend/stage-5x-external-adapter-audit-package.md",
  ".github/workflows/stage5x-external-adapter-audit-package.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/integrations/adapter-audit-manifest.stage5x.example.json": [
    "payloadFile",
    "statusFile",
    "policyFile",
    "requiredEvidence",
    "managedRuntimeDependency",
    "managedDatabaseDependency",
  ],
  "scripts/stage5x-external-adapter-audit-package.mjs": [
    "Stage 5X",
    "buildExternalAdapterAuditBundle",
    "detectAuditBundleLeaks",
    "payload-summary.json",
    "adapter-control-manifest.json",
    "audit-index.md",
    "no network calls",
  ],
  "scripts/stage5x-external-adapter-audit-package.test.mjs": [
    "complete six-file audit bundle",
    "leak scanner blocks unsafe audit content",
    "CLI dry-run writes the complete local bundle",
  ],
  "docs/backend/stage-5x-external-adapter-audit-package.md": [
    "Stage 5X",
    "npm run preflight:stage5x",
    "Managed runtime/database dependency: none",
    "self-hosted backend",
  ],
  ".github/workflows/stage5x-external-adapter-audit-package.yml": [
    "name: stage5x-external-adapter-audit-package",
    "npm run preflight:stage5x",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/integrations/adapter-audit-manifest.stage5x.example.json",
  "scripts/stage5x-external-adapter-audit-package.mjs",
  "docs/backend/stage-5x-external-adapter-audit-package.md",
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
        errors.push(`${file} contains forbidden Stage 5X runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage5x"',
    '"check:stage5x"',
    '"preflight:stage5x"',
    '"adapter:stage5x:audit:example"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5X external adapter audit package preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5X external adapter audit package preflight");
  }
}

export function collectStage5XChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5XChecks();
  if (!result.ok) {
    console.error("[stage5x-external-adapter-audit-package] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5x-external-adapter-audit-package] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

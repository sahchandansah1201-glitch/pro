#!/usr/bin/env node
// Stage 6A · production acceptance baseline guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/acceptance-baseline.stage6a.json",
  "scripts/stage6a-production-acceptance-baseline.mjs",
  "scripts/stage6a-production-acceptance-baseline.test.mjs",
  "scripts/check-stage6a-production-acceptance-baseline.mjs",
  "scripts/check-stage6a-production-acceptance-baseline.test.mjs",
  "docs/backend/stage-6a-production-acceptance-baseline.md",
  ".github/workflows/stage6a-production-acceptance-baseline.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/acceptance-baseline.stage6a.json": [
    "acceptanceDomains",
    "releaseGates",
    "managedRuntime",
    "managedDatabase",
    "demoFallbackInProduction",
    "external_adapter_flow",
  ],
  "scripts/stage6a-production-acceptance-baseline.mjs": [
    "Stage 6A",
    "buildProductionAcceptanceBaseline",
    "renderProductionAcceptanceBaselineMarkdown",
    "readyForServerInstallPackage",
    "no network calls",
  ],
  "scripts/stage6a-production-acceptance-baseline.test.mjs": [
    "accepted baseline",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe report content",
  ],
  "docs/backend/stage-6a-production-acceptance-baseline.md": [
    "Stage 6A",
    "npm run preflight:stage6a",
    "Production acceptance baseline",
    "single self-hosted product",
    "Stage 6B",
  ],
  ".github/workflows/stage6a-production-acceptance-baseline.yml": [
    "name: stage6a-production-acceptance-baseline",
    "npm run preflight:stage6a",
    "stage6a-production-acceptance-baseline.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/acceptance-baseline.stage6a.json",
  "scripts/stage6a-production-acceptance-baseline.mjs",
  "docs/backend/stage-6a-production-acceptance-baseline.md",
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
        errors.push(`${file} contains forbidden Stage 6A runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage6a\"",
    "\"check:stage6a\"",
    "\"preflight:stage6a\"",
    "\"acceptance:stage6a:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6A production acceptance baseline preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6A production acceptance baseline preflight");
  }
}

export function collectStage6AChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6AChecks();
  if (!result.ok) {
    console.error("[stage6a-production-acceptance-baseline] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6a-production-acceptance-baseline] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

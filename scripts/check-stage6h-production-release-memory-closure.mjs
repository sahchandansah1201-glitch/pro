#!/usr/bin/env node
// Stage 6H · production release memory closure guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-memory-closure.stage6h.json",
  "scripts/stage6h-production-release-memory-closure.mjs",
  "scripts/stage6h-production-release-memory-closure.test.mjs",
  "scripts/check-stage6h-production-release-memory-closure.mjs",
  "scripts/check-stage6h-production-release-memory-closure.test.mjs",
  "docs/backend/stage-6h-production-release-memory-closure.md",
  ".github/workflows/stage6h-production-release-memory-closure.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/release-memory-closure.stage6h.json": [
    "postGoLiveObservationManifest",
    "stage6g_post_go_live_observation",
    "closureInputs",
    "closureSections",
    "externalClosureFields",
    "closureGates",
    "closurePolicy",
    "releaseMemoryClosureBundledInRepository",
  ],
  "scripts/stage6h-production-release-memory-closure.mjs": [
    "Stage 6H",
    "buildProductionReleaseMemoryClosure",
    "renderProductionReleaseMemoryClosureMarkdown",
    "readyForExternalReleaseMemoryClosure",
    "no network calls",
    "does not approve or verify a live production go-live",
  ],
  "scripts/stage6h-production-release-memory-closure.test.mjs": [
    "ready release memory closure package",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe closure content",
  ],
  "docs/backend/stage-6h-production-release-memory-closure.md": [
    "Stage 6H",
    "npm run preflight:stage6h",
    "production release memory closure",
    "Stage 6G",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6h-production-release-memory-closure.yml": [
    "name: stage6h-production-release-memory-closure",
    "npm run preflight:stage6h",
    "stage6h-production-release-memory-closure.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-memory-closure.stage6h.json",
  "scripts/stage6h-production-release-memory-closure.mjs",
  "docs/backend/stage-6h-production-release-memory-closure.md",
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
  /\baccess_token\b/i,
  /\bpatient_full_name\b/i,
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
        errors.push(`${file} contains forbidden Stage 6H runtime or live closure evidence coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage6h\"",
    "\"check:stage6h\"",
    "\"preflight:stage6h\"",
    "\"closure:stage6h:dry-run\"",
    "\"closure:stage6h:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6H production release memory closure preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6H production release memory closure preflight");
  }
}

export function collectStage6HChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6HChecks();
  if (!result.ok) {
    console.error("[stage6h-production-release-memory-closure] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6h-production-release-memory-closure] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

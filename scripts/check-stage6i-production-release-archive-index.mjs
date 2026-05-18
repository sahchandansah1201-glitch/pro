#!/usr/bin/env node
// Stage 6I · production release archive index guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-index.stage6i.json",
  "scripts/stage6i-production-release-archive-index.mjs",
  "scripts/stage6i-production-release-archive-index.test.mjs",
  "scripts/check-stage6i-production-release-archive-index.mjs",
  "scripts/check-stage6i-production-release-archive-index.test.mjs",
  "docs/backend/stage-6i-production-release-archive-index.md",
  ".github/workflows/stage6i-production-release-archive-index.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/release-archive-index.stage6i.json": [
    "releaseMemoryClosureManifest",
    "stage6h_release_memory_closure",
    "archiveInputs",
    "archiveSections",
    "externalArchiveRecords",
    "archiveGates",
    "archivePolicy",
    "releaseArchiveContentsStoredOutsideGit",
  ],
  "scripts/stage6i-production-release-archive-index.mjs": [
    "Stage 6I",
    "buildProductionReleaseArchiveIndex",
    "renderProductionReleaseArchiveIndexMarkdown",
    "readyForExternalReleaseArchiveIndex",
    "no network calls",
    "does not approve or verify a live production go-live",
  ],
  "scripts/stage6i-production-release-archive-index.test.mjs": [
    "ready release archive index",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe archive content",
  ],
  "docs/backend/stage-6i-production-release-archive-index.md": [
    "Stage 6I",
    "npm run preflight:stage6i",
    "production release archive index",
    "Stage 6H",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6i-production-release-archive-index.yml": [
    "name: stage6i-production-release-archive-index",
    "npm run preflight:stage6i",
    "stage6i-production-release-archive-index.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-archive-index.stage6i.json",
  "scripts/stage6i-production-release-archive-index.mjs",
  "docs/backend/stage-6i-production-release-archive-index.md",
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
        errors.push(`${file} contains forbidden Stage 6I runtime or live archive evidence coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage6i\"",
    "\"check:stage6i\"",
    "\"preflight:stage6i\"",
    "\"archive:stage6i:dry-run\"",
    "\"archive:stage6i:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6I production release archive index preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6I production release archive index preflight");
  }
}

export function collectStage6IChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6IChecks();
  if (!result.ok) {
    console.error("[stage6i-production-release-archive-index] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6i-production-release-archive-index] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

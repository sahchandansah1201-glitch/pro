#!/usr/bin/env node
// Stage 6Q · production release archive retention cycle index guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-retention-cycle-index.stage6q.json",
  "scripts/stage6q-production-release-archive-retention-cycle-index.mjs",
  "scripts/stage6q-production-release-archive-retention-cycle-index.test.mjs",
  "scripts/check-stage6q-production-release-archive-retention-cycle-index.mjs",
  "scripts/check-stage6q-production-release-archive-retention-cycle-index.test.mjs",
  "docs/backend/stage-6q-production-release-archive-retention-cycle-index.md",
  ".github/workflows/stage6q-production-release-archive-retention-cycle-index.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/release-archive-retention-cycle-index.stage6q.json": [
    "releaseArchiveRetentionRegisterReceiptManifest",
    "stage6p_release_archive_retention_register_receipt",
    "cycleInputs",
    "cycleSections",
    "externalCycleFields",
    "cycleGates",
    "cyclePolicy",
    "externalArchiveRetentionCycleRecordsStoredOutsideGit",
    "archiveRetentionCycleOutcomeKnownToRepository",
  ],
  "scripts/stage6q-production-release-archive-retention-cycle-index.mjs": [
    "Stage 6Q",
    "buildProductionReleaseArchiveRetentionCycleIndex",
    "renderProductionReleaseArchiveRetentionCycleIndexMarkdown",
    "readyForExternalReleaseArchiveRetentionCycleIndex",
    "no network calls",
    "does not store live",
  ],
  "scripts/stage6q-production-release-archive-retention-cycle-index.test.mjs": [
    "ready cycle index",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe cycle content",
  ],
  "docs/backend/stage-6q-production-release-archive-retention-cycle-index.md": [
    "Stage 6Q",
    "npm run preflight:stage6q",
    "production release archive retention cycle index",
    "Stage 6P",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6q-production-release-archive-retention-cycle-index.yml": [
    "name: stage6q-production-release-archive-retention-cycle-index",
    "npm run preflight:stage6q",
    "stage6q-production-release-archive-retention-cycle-index.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-archive-retention-cycle-index.stage6q.json",
  "scripts/stage6q-production-release-archive-retention-cycle-index.mjs",
  "docs/backend/stage-6q-production-release-archive-retention-cycle-index.md",
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
  /https?:\/\/(?!github\.com\/sahchandansah1201-glitch\/pro)/i,
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
        errors.push(`${file} contains forbidden Stage 6Q runtime or live archive evidence coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  if (!existsSync(join(root, "package.json"))) {
    errors.push("Missing required file: package.json");
    return;
  }
  if (!existsSync(join(root, "scripts/preflight-all.mjs"))) {
    errors.push("Missing required file: scripts/preflight-all.mjs");
    return;
  }
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage6q\"",
    "\"check:stage6q\"",
    "\"preflight:stage6q\"",
    "\"cycle:stage6q:dry-run\"",
    "\"cycle:stage6q:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6Q production release archive retention cycle index preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6Q production release archive retention cycle index preflight");
  }
}

export function collectStage6QChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6QChecks();
  if (!result.ok) {
    console.error("[stage6q-production-release-archive-retention-cycle-index] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6q-production-release-archive-retention-cycle-index] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

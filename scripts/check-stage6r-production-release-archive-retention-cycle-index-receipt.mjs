#!/usr/bin/env node
// Stage 6R · production release archive retention cycle index receipt guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-retention-cycle-index-receipt.stage6r.json",
  "scripts/stage6r-production-release-archive-retention-cycle-index-receipt.mjs",
  "scripts/stage6r-production-release-archive-retention-cycle-index-receipt.test.mjs",
  "scripts/check-stage6r-production-release-archive-retention-cycle-index-receipt.mjs",
  "scripts/check-stage6r-production-release-archive-retention-cycle-index-receipt.test.mjs",
  "docs/backend/stage-6r-production-release-archive-retention-cycle-index-receipt.md",
  ".github/workflows/stage6r-production-release-archive-retention-cycle-index-receipt.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/release-archive-retention-cycle-index-receipt.stage6r.json": [
    "releaseArchiveRetentionCycleIndexManifest",
    "stage6q_release_archive_retention_cycle_index",
    "receiptInputs",
    "receiptSections",
    "externalReceiptFields",
    "receiptGates",
    "receiptPolicy",
    "externalArchiveRetentionCycleIndexReceiptStoredOutsideGit",
    "externalArchiveRetentionCycleRecordsStoredOutsideGit",
    "archiveRetentionCycleIndexReceiptOutcomeKnownToRepository",
    "archiveRetentionCycleOutcomeKnownToRepository",
  ],
  "scripts/stage6r-production-release-archive-retention-cycle-index-receipt.mjs": [
    "Stage 6R",
    "buildProductionReleaseArchiveRetentionCycleIndexReceipt",
    "renderProductionReleaseArchiveRetentionCycleIndexReceiptMarkdown",
    "readyForExternalReleaseArchiveRetentionCycleIndexReceipt",
    "no network calls",
    "does not store live",
  ],
  "scripts/stage6r-production-release-archive-retention-cycle-index-receipt.test.mjs": [
    "ready receipt",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe receipt content",
  ],
  "docs/backend/stage-6r-production-release-archive-retention-cycle-index-receipt.md": [
    "Stage 6R",
    "npm run preflight:stage6r",
    "production release archive retention cycle index receipt",
    "Stage 6Q",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6r-production-release-archive-retention-cycle-index-receipt.yml": [
    "name: stage6r-production-release-archive-retention-cycle-index-receipt",
    "npm run preflight:stage6r",
    "stage6r-production-release-archive-retention-cycle-index-receipt.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-archive-retention-cycle-index-receipt.stage6r.json",
  "scripts/stage6r-production-release-archive-retention-cycle-index-receipt.mjs",
  "docs/backend/stage-6r-production-release-archive-retention-cycle-index-receipt.md",
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
        errors.push(`${file} contains forbidden Stage 6R runtime or live archive evidence coupling: ${pattern}`);
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
    "\"test:stage6r\"",
    "\"check:stage6r\"",
    "\"preflight:stage6r\"",
    "\"receipt:stage6r:dry-run\"",
    "\"receipt:stage6r:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6R production release archive retention cycle index receipt preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6R production release archive retention cycle index receipt preflight");
  }
}

export function collectStage6RChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6RChecks();
  if (!result.ok) {
    console.error("[stage6r-production-release-archive-retention-cycle-index-receipt] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6r-production-release-archive-retention-cycle-index-receipt] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

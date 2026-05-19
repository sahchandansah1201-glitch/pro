#!/usr/bin/env node
// Stage 6P · production release archive retention register receipt guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-retention-register-receipt.stage6p.json",
  "scripts/stage6p-production-release-archive-retention-register-receipt.mjs",
  "scripts/stage6p-production-release-archive-retention-register-receipt.test.mjs",
  "scripts/check-stage6p-production-release-archive-retention-register-receipt.mjs",
  "scripts/check-stage6p-production-release-archive-retention-register-receipt.test.mjs",
  "docs/backend/stage-6p-production-release-archive-retention-register-receipt.md",
  ".github/workflows/stage6p-production-release-archive-retention-register-receipt.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/release-archive-retention-register-receipt.stage6p.json": [
    "releaseArchiveRetentionRegisterManifest",
    "stage6o_release_archive_retention_register",
    "receiptInputs",
    "receiptSections",
    "externalReceiptFields",
    "receiptGates",
    "receiptPolicy",
    "externalArchiveRetentionRegisterReceiptStoredOutsideGit",
    "externalArchiveRetentionRecordsStoredOutsideGit",
    "archiveRetentionRegisterReceiptOutcomeKnownToRepository",
    "archiveRetentionOutcomeKnownToRepository",
  ],
  "scripts/stage6p-production-release-archive-retention-register-receipt.mjs": [
    "Stage 6P",
    "buildProductionReleaseArchiveRetentionRegisterReceipt",
    "renderProductionReleaseArchiveRetentionRegisterReceiptMarkdown",
    "readyForExternalReleaseArchiveRetentionRegisterReceipt",
    "no network calls",
    "does not approve or",
  ],
  "scripts/stage6p-production-release-archive-retention-register-receipt.test.mjs": [
    "ready receipt",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe receipt content",
  ],
  "docs/backend/stage-6p-production-release-archive-retention-register-receipt.md": [
    "Stage 6P",
    "npm run preflight:stage6p",
    "production release archive retention register receipt",
    "Stage 6O",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6p-production-release-archive-retention-register-receipt.yml": [
    "name: stage6p-production-release-archive-retention-register-receipt",
    "npm run preflight:stage6p",
    "stage6p-production-release-archive-retention-register-receipt.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-archive-retention-register-receipt.stage6p.json",
  "scripts/stage6p-production-release-archive-retention-register-receipt.mjs",
  "docs/backend/stage-6p-production-release-archive-retention-register-receipt.md",
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
        errors.push(`${file} contains forbidden Stage 6P runtime or live archive evidence coupling: ${pattern}`);
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
    "\"test:stage6p\"",
    "\"check:stage6p\"",
    "\"preflight:stage6p\"",
    "\"receipt:stage6p:dry-run\"",
    "\"receipt:stage6p:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6P production release archive retention register receipt preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6P production release archive retention register receipt preflight");
  }
}

export function collectStage6PChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6PChecks();
  if (!result.ok) {
    console.error("[stage6p-production-release-archive-retention-register-receipt] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6p-production-release-archive-retention-register-receipt] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

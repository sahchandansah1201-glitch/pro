#!/usr/bin/env node
// Stage 6V · production release archive retention cycle final closure receipt guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-retention-cycle-final-closure-receipt.stage6v.json",
  "scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs",
  "scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.test.mjs",
  "scripts/check-stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs",
  "scripts/check-stage6v-production-release-archive-retention-cycle-final-closure-receipt.test.mjs",
  "docs/backend/stage-6v-production-release-archive-retention-cycle-final-closure-receipt.md",
  ".github/workflows/stage6v-production-release-archive-retention-cycle-final-closure-receipt.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/release-archive-retention-cycle-final-closure-receipt.stage6v.json": [
    "releaseArchiveRetentionCycleFinalClosureManifest",
    "stage6u_release_archive_retention_cycle_final_closure",
    "receiptInputs",
    "receiptSections",
    "externalReceiptFields",
    "receiptGates",
    "receiptPolicy",
    "externalArchiveRetentionCycleFinalClosureReceiptStoredOutsideGit",
    "externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit",
    "archiveRetentionCycleFinalClosureReceiptOutcomeKnownToRepository",
    "archiveRetentionCycleFinalClosureOutcomeKnownToRepository",
  ],
  "scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs": [
    "Stage 6V",
    "buildProductionReleaseArchiveRetentionCycleFinalClosureReceipt",
    "renderProductionReleaseArchiveRetentionCycleFinalClosureReceiptMarkdown",
    "readyForExternalReleaseArchiveRetentionCycleFinalClosureReceipt",
    "no network calls",
    "does not approve or",
  ],
  "scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.test.mjs": [
    "ready receipt",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe receipt content",
  ],
  "docs/backend/stage-6v-production-release-archive-retention-cycle-final-closure-receipt.md": [
    "Stage 6V",
    "npm run preflight:stage6v",
    "production release archive retention cycle final closure receipt",
    "Stage 6U",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6v-production-release-archive-retention-cycle-final-closure-receipt.yml": [
    "name: stage6v-production-release-archive-retention-cycle-final-closure-receipt",
    "npm run preflight:stage6v",
    "stage6v-production-release-archive-retention-cycle-final-closure-receipt.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-archive-retention-cycle-final-closure-receipt.stage6v.json",
  "scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs",
  "docs/backend/stage-6v-production-release-archive-retention-cycle-final-closure-receipt.md",
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
        errors.push(`${file} contains forbidden Stage 6V runtime or live archive evidence coupling: ${pattern}`);
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
    "\"test:stage6v\"",
    "\"check:stage6v\"",
    "\"preflight:stage6v\"",
    "\"receipt:stage6v:dry-run\"",
    "\"receipt:stage6v:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6V production release archive retention cycle final closure receipt preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6V production release archive retention cycle final closure receipt preflight");
  }
}

export function collectStage6VChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6VChecks();
  if (!result.ok) {
    console.error("[stage6v-production-release-archive-retention-cycle-final-closure-receipt] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6v-production-release-archive-retention-cycle-final-closure-receipt] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

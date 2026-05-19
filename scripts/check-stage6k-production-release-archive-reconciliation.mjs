#!/usr/bin/env node
// Stage 6K · production release archive reconciliation guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-reconciliation.stage6k.json",
  "scripts/stage6k-production-release-archive-reconciliation.mjs",
  "scripts/stage6k-production-release-archive-reconciliation.test.mjs",
  "scripts/check-stage6k-production-release-archive-reconciliation.mjs",
  "scripts/check-stage6k-production-release-archive-reconciliation.test.mjs",
  "docs/backend/stage-6k-production-release-archive-reconciliation.md",
  ".github/workflows/stage6k-production-release-archive-reconciliation.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/release-archive-reconciliation.stage6k.json": [
    "releaseArchiveHandoffReceiptManifest",
    "stage6j_release_archive_handoff_receipt",
    "reconciliationInputs",
    "reconciliationSections",
    "externalReconciliationFields",
    "reconciliationGates",
    "reconciliationPolicy",
    "externalArchiveReconciliationStoredOutsideGit",
    "archiveReconciliationOutcomeKnownToRepository",
  ],
  "scripts/stage6k-production-release-archive-reconciliation.mjs": [
    "Stage 6K",
    "buildProductionReleaseArchiveReconciliation",
    "renderProductionReleaseArchiveReconciliationMarkdown",
    "readyForExternalReleaseArchiveReconciliation",
    "no network calls",
    "does not approve or",
  ],
  "scripts/stage6k-production-release-archive-reconciliation.test.mjs": [
    "ready reconciliation",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe reconciliation content",
  ],
  "docs/backend/stage-6k-production-release-archive-reconciliation.md": [
    "Stage 6K",
    "npm run preflight:stage6k",
    "production release archive reconciliation",
    "Stage 6J",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6k-production-release-archive-reconciliation.yml": [
    "name: stage6k-production-release-archive-reconciliation",
    "npm run preflight:stage6k",
    "stage6k-production-release-archive-reconciliation.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-archive-reconciliation.stage6k.json",
  "scripts/stage6k-production-release-archive-reconciliation.mjs",
  "docs/backend/stage-6k-production-release-archive-reconciliation.md",
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
        errors.push(`${file} contains forbidden Stage 6K runtime or live archive evidence coupling: ${pattern}`);
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
    "\"test:stage6k\"",
    "\"check:stage6k\"",
    "\"preflight:stage6k\"",
    "\"reconcile:stage6k:dry-run\"",
    "\"reconcile:stage6k:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6K production release archive reconciliation preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6K production release archive reconciliation preflight");
  }
}

export function collectStage6KChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6KChecks();
  if (!result.ok) {
    console.error("[stage6k-production-release-archive-reconciliation] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6k-production-release-archive-reconciliation] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

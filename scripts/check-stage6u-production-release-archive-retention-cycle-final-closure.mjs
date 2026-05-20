#!/usr/bin/env node
// Stage 6U · production release archive retention cycle final closure guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-retention-cycle-final-closure.stage6u.json",
  "scripts/stage6u-production-release-archive-retention-cycle-final-closure.mjs",
  "scripts/stage6u-production-release-archive-retention-cycle-final-closure.test.mjs",
  "scripts/check-stage6u-production-release-archive-retention-cycle-final-closure.mjs",
  "scripts/check-stage6u-production-release-archive-retention-cycle-final-closure.test.mjs",
  "docs/backend/stage-6u-production-release-archive-retention-cycle-final-closure.md",
  ".github/workflows/stage6u-production-release-archive-retention-cycle-final-closure.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/release-archive-retention-cycle-final-closure.stage6u.json": [
    "releaseArchiveRetentionCycleClosureReceiptManifest",
    "stage6t_release_archive_retention_cycle_closure_receipt",
    "closureInputs",
    "closureSections",
    "externalClosureFields",
    "closureGates",
    "closurePolicy",
    "externalArchiveRetentionCycleFinalClosureRecordsStoredOutsideGit",
    "externalArchiveRetentionCycleClosureReceiptStoredOutsideGit",
    "archiveRetentionCycleFinalClosureOutcomeKnownToRepository",
    "archiveRetentionCycleClosureReceiptOutcomeKnownToRepository",
  ],
  "scripts/stage6u-production-release-archive-retention-cycle-final-closure.mjs": [
    "Stage 6U",
    "buildProductionReleaseArchiveRetentionCycleFinalClosure",
    "renderProductionReleaseArchiveRetentionCycleFinalClosureMarkdown",
    "readyForExternalReleaseArchiveRetentionCycleFinalClosure",
    "no network calls",
    "does not store live",
  ],
  "scripts/stage6u-production-release-archive-retention-cycle-final-closure.test.mjs": [
    "ready final closure",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe final closure content",
  ],
  "docs/backend/stage-6u-production-release-archive-retention-cycle-final-closure.md": [
    "Stage 6U",
    "npm run preflight:stage6u",
    "production release archive retention cycle final closure",
    "Stage 6T",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6u-production-release-archive-retention-cycle-final-closure.yml": [
    "name: stage6u-production-release-archive-retention-cycle-final-closure",
    "npm run preflight:stage6u",
    "stage6u-production-release-archive-retention-cycle-final-closure.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-archive-retention-cycle-final-closure.stage6u.json",
  "scripts/stage6u-production-release-archive-retention-cycle-final-closure.mjs",
  "docs/backend/stage-6u-production-release-archive-retention-cycle-final-closure.md",
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
        errors.push(`${file} contains forbidden Stage 6U runtime or live archive evidence coupling: ${pattern}`);
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
    "\"test:stage6u\"",
    "\"check:stage6u\"",
    "\"preflight:stage6u\"",
    "\"closure:stage6u:dry-run\"",
    "\"closure:stage6u:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6U production release archive retention cycle final closure preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6U production release archive retention cycle final closure preflight");
  }
}

export function collectStage6UChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6UChecks();
  if (!result.ok) {
    console.error("[stage6u-production-release-archive-retention-cycle-final-closure] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6u-production-release-archive-retention-cycle-final-closure] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

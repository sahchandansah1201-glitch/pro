#!/usr/bin/env node
// Stage 6O · production release archive retention register guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-retention-register.stage6o.json",
  "scripts/stage6o-production-release-archive-retention-register.mjs",
  "scripts/stage6o-production-release-archive-retention-register.test.mjs",
  "scripts/check-stage6o-production-release-archive-retention-register.mjs",
  "scripts/check-stage6o-production-release-archive-retention-register.test.mjs",
  "docs/backend/stage-6o-production-release-archive-retention-register.md",
  ".github/workflows/stage6o-production-release-archive-retention-register.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/release-archive-retention-register.stage6o.json": [
    "releaseArchiveFinalClosureReceiptManifest",
    "stage6n_release_archive_final_closure_receipt",
    "registerInputs",
    "registerSections",
    "externalRetentionFields",
    "registerGates",
    "retentionPolicy",
    "externalArchiveRetentionRecordsStoredOutsideGit",
    "archiveRetentionOutcomeKnownToRepository",
  ],
  "scripts/stage6o-production-release-archive-retention-register.mjs": [
    "Stage 6O",
    "buildProductionReleaseArchiveRetentionRegister",
    "renderProductionReleaseArchiveRetentionRegisterMarkdown",
    "readyForExternalReleaseArchiveRetentionRegister",
    "no network calls",
    "does not store live archive retention values",
  ],
  "scripts/stage6o-production-release-archive-retention-register.test.mjs": [
    "ready register",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe retention content",
  ],
  "docs/backend/stage-6o-production-release-archive-retention-register.md": [
    "Stage 6O",
    "npm run preflight:stage6o",
    "production release archive retention register",
    "Stage 6N",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6o-production-release-archive-retention-register.yml": [
    "name: stage6o-production-release-archive-retention-register",
    "npm run preflight:stage6o",
    "stage6o-production-release-archive-retention-register.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-archive-retention-register.stage6o.json",
  "scripts/stage6o-production-release-archive-retention-register.mjs",
  "docs/backend/stage-6o-production-release-archive-retention-register.md",
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
        errors.push(`${file} contains forbidden Stage 6O runtime or live archive retention coupling: ${pattern}`);
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
    "\"test:stage6o\"",
    "\"check:stage6o\"",
    "\"preflight:stage6o\"",
    "\"retention:stage6o:dry-run\"",
    "\"retention:stage6o:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6O production release archive retention register preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6O production release archive retention register preflight");
  }
}

export function collectStage6OChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6OChecks();
  if (!result.ok) {
    console.error("[stage6o-production-release-archive-retention-register] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6o-production-release-archive-retention-register] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

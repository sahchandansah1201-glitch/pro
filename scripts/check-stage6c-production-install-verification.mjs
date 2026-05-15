#!/usr/bin/env node
// Stage 6C · production install verification guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/install-verification.stage6c.json",
  "scripts/stage6c-production-install-verification.mjs",
  "scripts/stage6c-production-install-verification.test.mjs",
  "scripts/check-stage6c-production-install-verification.mjs",
  "scripts/check-stage6c-production-install-verification.test.mjs",
  "docs/backend/stage-6c-production-install-verification.md",
  ".github/workflows/stage6c-production-install-verification.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/install-verification.stage6c.json": [
    "serverInstallManifest",
    "verificationInputs",
    "verificationGates",
    "operatorEvidenceChecklist",
    "liveEvidencePolicy",
    "liveEvidenceNotBundled",
  ],
  "scripts/stage6c-production-install-verification.mjs": [
    "Stage 6C",
    "buildProductionInstallVerification",
    "renderProductionInstallVerificationMarkdown",
    "readyForLiveInstallVerification",
    "no network calls",
    "not verify a live server by itself",
  ],
  "scripts/stage6c-production-install-verification.test.mjs": [
    "ready verification package",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe verification content",
  ],
  "docs/backend/stage-6c-production-install-verification.md": [
    "Stage 6C",
    "npm run preflight:stage6c",
    "production install verification",
    "Stage 6B",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6c-production-install-verification.yml": [
    "name: stage6c-production-install-verification",
    "npm run preflight:stage6c",
    "stage6c-production-install-verification.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/install-verification.stage6c.json",
  "scripts/stage6c-production-install-verification.mjs",
  "docs/backend/stage-6c-production-install-verification.md",
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
        errors.push(`${file} contains forbidden Stage 6C runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage6c\"",
    "\"check:stage6c\"",
    "\"preflight:stage6c\"",
    "\"verify:stage6c:dry-run\"",
    "\"verify:stage6c:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6C production install verification preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6C production install verification preflight");
  }
}

export function collectStage6CChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6CChecks();
  if (!result.ok) {
    console.error("[stage6c-production-install-verification] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6c-production-install-verification] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

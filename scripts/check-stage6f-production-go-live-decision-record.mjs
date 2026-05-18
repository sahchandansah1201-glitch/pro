#!/usr/bin/env node
// Stage 6F · production go-live decision record guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/go-live-decision-record.stage6f.json",
  "scripts/stage6f-production-go-live-decision-record.mjs",
  "scripts/stage6f-production-go-live-decision-record.test.mjs",
  "scripts/check-stage6f-production-go-live-decision-record.mjs",
  "scripts/check-stage6f-production-go-live-decision-record.test.mjs",
  "docs/backend/stage-6f-production-go-live-decision-record.md",
  ".github/workflows/stage6f-production-go-live-decision-record.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/go-live-decision-record.stage6f.json": [
    "goLiveHandoffManifest",
    "decisionRecordInputs",
    "decisionRecordSections",
    "externalDecisionFields",
    "decisionGates",
    "decisionPolicy",
    "goLiveDecisionRecordBundledInRepository",
  ],
  "scripts/stage6f-production-go-live-decision-record.mjs": [
    "Stage 6F",
    "buildProductionGoLiveDecisionRecord",
    "renderProductionGoLiveDecisionRecordMarkdown",
    "readyForExternalGoLiveDecisionRecord",
    "no network calls",
    "does not approve or verify a live production go-live",
  ],
  "scripts/stage6f-production-go-live-decision-record.test.mjs": [
    "ready decision-record contract",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe decision-record content",
  ],
  "docs/backend/stage-6f-production-go-live-decision-record.md": [
    "Stage 6F",
    "npm run preflight:stage6f",
    "production go-live decision record",
    "Stage 6E",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6f-production-go-live-decision-record.yml": [
    "name: stage6f-production-go-live-decision-record",
    "npm run preflight:stage6f",
    "stage6f-production-go-live-decision-record.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/go-live-decision-record.stage6f.json",
  "scripts/stage6f-production-go-live-decision-record.mjs",
  "docs/backend/stage-6f-production-go-live-decision-record.md",
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
        errors.push(`${file} contains forbidden Stage 6F runtime or go-live evidence coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage6f\"",
    "\"check:stage6f\"",
    "\"preflight:stage6f\"",
    "\"decision:stage6f:dry-run\"",
    "\"decision:stage6f:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6F production go-live decision record preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6F production go-live decision record preflight");
  }
}

export function collectStage6FChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6FChecks();
  if (!result.ok) {
    console.error("[stage6f-production-go-live-decision-record] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6f-production-go-live-decision-record] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

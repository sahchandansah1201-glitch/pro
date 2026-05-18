#!/usr/bin/env node
// Stage 6E · production go-live handoff guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/go-live-handoff.stage6e.json",
  "scripts/stage6e-production-go-live-handoff.mjs",
  "scripts/stage6e-production-go-live-handoff.test.mjs",
  "scripts/check-stage6e-production-go-live-handoff.mjs",
  "scripts/check-stage6e-production-go-live-handoff.test.mjs",
  "docs/backend/stage-6e-production-go-live-handoff.md",
  ".github/workflows/stage6e-production-go-live-handoff.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/go-live-handoff.stage6e.json": [
    "liveInstallEvidenceManifest",
    "handoffInputs",
    "handoffSections",
    "decisionFields",
    "goLiveGates",
    "goLivePolicy",
    "goLiveDecisionBundledInRepository",
  ],
  "scripts/stage6e-production-go-live-handoff.mjs": [
    "Stage 6E",
    "buildProductionGoLiveHandoff",
    "renderProductionGoLiveHandoffMarkdown",
    "readyForOperatorGoLiveDecision",
    "no network calls",
    "does not approve or verify a live production go-live",
  ],
  "scripts/stage6e-production-go-live-handoff.test.mjs": [
    "ready handoff package",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe handoff content",
  ],
  "docs/backend/stage-6e-production-go-live-handoff.md": [
    "Stage 6E",
    "npm run preflight:stage6e",
    "production go-live handoff",
    "Stage 6D",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6e-production-go-live-handoff.yml": [
    "name: stage6e-production-go-live-handoff",
    "npm run preflight:stage6e",
    "stage6e-production-go-live-handoff.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/go-live-handoff.stage6e.json",
  "scripts/stage6e-production-go-live-handoff.mjs",
  "docs/backend/stage-6e-production-go-live-handoff.md",
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
        errors.push(`${file} contains forbidden Stage 6E runtime or go-live evidence coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage6e\"",
    "\"check:stage6e\"",
    "\"preflight:stage6e\"",
    "\"handoff:stage6e:dry-run\"",
    "\"handoff:stage6e:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6E production go-live handoff preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6E production go-live handoff preflight");
  }
}

export function collectStage6EChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6EChecks();
  if (!result.ok) {
    console.error("[stage6e-production-go-live-handoff] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6e-production-go-live-handoff] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

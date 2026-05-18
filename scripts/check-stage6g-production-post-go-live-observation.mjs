#!/usr/bin/env node
// Stage 6G · production post-go-live observation guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/post-go-live-observation.stage6g.json",
  "scripts/stage6g-production-post-go-live-observation.mjs",
  "scripts/stage6g-production-post-go-live-observation.test.mjs",
  "scripts/check-stage6g-production-post-go-live-observation.mjs",
  "scripts/check-stage6g-production-post-go-live-observation.test.mjs",
  "docs/backend/stage-6g-production-post-go-live-observation.md",
  ".github/workflows/stage6g-production-post-go-live-observation.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/post-go-live-observation.stage6g.json": [
    "goLiveDecisionRecordManifest",
    "observationInputs",
    "observationSections",
    "externalObservationFields",
    "observationGates",
    "observationPolicy",
    "postGoLiveObservationBundledInRepository",
  ],
  "scripts/stage6g-production-post-go-live-observation.mjs": [
    "Stage 6G",
    "buildProductionPostGoLiveObservation",
    "renderProductionPostGoLiveObservationMarkdown",
    "readyForExternalPostGoLiveObservation",
    "no network calls",
    "does not approve or verify a live production go-live",
  ],
  "scripts/stage6g-production-post-go-live-observation.test.mjs": [
    "ready post-go-live observation package",
    "CLI writes markdown and JSON outputs",
    "leak scanner blocks unsafe observation content",
  ],
  "docs/backend/stage-6g-production-post-go-live-observation.md": [
    "Stage 6G",
    "npm run preflight:stage6g",
    "production post-go-live observation",
    "Stage 6F",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage6g-production-post-go-live-observation.yml": [
    "name: stage6g-production-post-go-live-observation",
    "npm run preflight:stage6g",
    "stage6g-production-post-go-live-observation.md",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/post-go-live-observation.stage6g.json",
  "scripts/stage6g-production-post-go-live-observation.mjs",
  "docs/backend/stage-6g-production-post-go-live-observation.md",
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
        errors.push(`${file} contains forbidden Stage 6G runtime or live observation evidence coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage6g\"",
    "\"check:stage6g\"",
    "\"preflight:stage6g\"",
    "\"observation:stage6g:dry-run\"",
    "\"observation:stage6g:report\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 6G production post-go-live observation preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 6G production post-go-live observation preflight");
  }
}

export function collectStage6GChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage6GChecks();
  if (!result.ok) {
    console.error("[stage6g-production-post-go-live-observation] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6g-production-post-go-live-observation] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

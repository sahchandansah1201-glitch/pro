#!/usr/bin/env node
// Stage 7G-7I · batch verification loop drift guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/batch-verification-loop.stage7g-7i.json",
  "scripts/stage7g-7i-batch-readiness.mjs",
  "scripts/stage7g-7i-batch-readiness.test.mjs",
  "scripts/check-stage7g-7i-batch-verification-loop.mjs",
  "scripts/check-stage7g-7i-batch-verification-loop.test.mjs",
  "docs/backend/stage-7g-7i-batch-verification-loop.md",
  ".github/workflows/stage7g-7i-batch-verification-loop.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/batch-verification-loop.stage7g-7i.json": [
    "\"stage\": \"7G-7I\"",
    "stage7g-7i-batch-verification-loop",
    "Batch readiness reporter",
    "Lovable sync verification manifest",
    "Batch drift guard",
    "\"minimumRelatedStagesPerBatch\": 3",
    "\"validOnlyAfterMergeToMain\": true",
    "\"expectedConfirmation\": \"Confirmed: Stage 7G-7I synced from main, no conflicts.\"",
    "\"nextStageHypothesis\": \"Stage 7J\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
  ],
  "scripts/stage7g-7i-batch-readiness.mjs": [
    "buildStage7G7IBatchReadiness",
    "evaluateStage7G7ISyncReadiness",
    "buildStage7G7ILovablePrompt",
    "renderStage7G7IBatchReadinessMarkdown",
    "runStage7G7IBatchReadiness",
    "pull request must be merged into main",
    "Stage 7J",
  ],
  "docs/backend/stage-7g-7i-batch-verification-loop.md": [
    "Stage 7G-7I",
    "npm run preflight:stage7g-7i",
    "Batch readiness reporter",
    "Lovable sync verification manifest",
    "Batch drift guard",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage7g-7i-batch-verification-loop.yml": [
    "name: stage7g-7i-batch-verification-loop",
    "npm run preflight:stage7g-7i",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage7g_7i_preflight",
    "batch_readiness_reporter_confirmed: true",
    "lovable_sync_verification_manifest_confirmed: true",
    "batch_drift_guard_confirmed: true",
    "command: \"npm run preflight:stage7g-7i\"",
    "Stage 7J",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 7G-7I",
    "batch verification loop",
    "Stage 7J",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 7G-7I",
    "Stage 7J",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 7G-7I",
    "readiness reporter",
    "drift guard",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 7G-7I",
    "Stage 7J",
    "hypothesis",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "batch-verification-loop.stage7g-7i.json",
    "stage7g-7i-batch-readiness.mjs",
    "stage-7g-7i-batch-verification-loop.md",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 7G",
    "Stage 7H",
    "Stage 7I",
    "readiness reporter",
    "sync verification",
    "drift guard",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Readiness Reporter",
    "Lovable Verification Manifest",
    "Drift Guard",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/batch-verification-loop.stage7g-7i.json",
  "docs/backend/stage-7g-7i-batch-verification-loop.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
];

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bXMLHttpRequest\b/i,
  /\baxios\b/i,
  new RegExp(String.raw`\bapi-${"read"}\b`, "i"),
  new RegExp(String.raw`\bapi-${"write"}\b`, "i"),
  new RegExp(String.raw`\b${"edge"} ${"function"}\b`, "i"),
  new RegExp(String.raw`\b${"SUPABASE"}_\w+`),
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
        errors.push(`${file} contains forbidden Stage 7G-7I runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = existsSync(join(root, "package.json")) ? read(root, "package.json") : "";
  for (const script of [
    "\"test:stage7g-7i\"",
    "\"check:stage7g-7i\"",
    "\"readiness:stage7g-7i:dry-run\"",
    "\"preflight:stage7g-7i\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }

  const preflightAll = existsSync(join(root, "scripts/preflight-all.mjs"))
    ? read(root, "scripts/preflight-all.mjs")
    : "";
  if (!preflightAll.includes("Stage 7G-7I batch verification loop preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 7G-7I batch verification loop preflight");
  }
}

export function collectStage7G7IChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required file (text check): ${file}`);
  }
  for (const [file, expected] of Object.entries(PROJECT_MEMORY_REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required project-memory file: ${file}`);
  }
  scanProtectedFiles(errors, root);
  validatePackageScripts(errors, root);
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectStage7G7IChecks();
  if (!result.ok) {
    console.error("[stage7g-7i-batch-verification-loop] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage7g-7i-batch-verification-loop] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

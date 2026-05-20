#!/usr/bin/env node
// Stage 7A-7C · development workflow contract guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/development-workflow-contract.stage7a-7c.json",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/backend/stage-7a-7c-development-workflow-contract.md",
  "scripts/check-stage7a-7c-development-workflow-contract.mjs",
  "scripts/check-stage7a-7c-development-workflow-contract.test.mjs",
  ".github/workflows/stage7a-7c-development-workflow-contract.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/development-workflow-contract.stage7a-7c.json": [
    "\"stage\": \"7A-7C\"",
    "stage7a-7c-development-workflow-contract",
    "codexCreatesBranchCommitPushPullRequest",
    "codexWaitsForChecksBeforeMerge",
    "codexMergesPassingPullRequestIntoMain",
    "verifyLocalMainBeforeLovablePrompt",
    "lovablePromptOnlyAfterMainMerge",
    "pushPromptBeforeMergeForbidden",
    "minimumRelatedStagesPerBatch",
    "\"nextStageHypothesis\": \"Stage 7D\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "# WORKING_CONTRACT",
    "Stage 7A",
    "Stage 7B",
    "Stage 7C",
    "Lovable sync prompts are invalid while the stage exists only in an open Pull",
    "Minimum related stages per Pull request: `3`",
    "Product boundary",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "# BATCH_TEMPLATE",
    "Included stages",
    "Why One Pull Request",
    "Product Boundary",
    "Required Checks",
    "Lovable Sync Prompt",
    "Sync Mismatch Recovery",
  ],
  "docs/backend/stage-7a-7c-development-workflow-contract.md": [
    "Stage 7A-7C",
    "npm run preflight:stage7a-7c",
    "Managed runtime/database dependency: none",
    "at least three related stages",
    "Lovable prompt is sent only after",
  ],
  ".github/workflows/stage7a-7c-development-workflow-contract.yml": [
    "name: stage7a-7c-development-workflow-contract",
    "npm run preflight:stage7a-7c",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage7a_7c_preflight",
    "development_workflow_contract_confirmed: true",
    "minimum_related_stages_per_batch: 3",
    "command: \"npm run preflight:stage7a-7c\"",
    "Stage 7D",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 7A-7C",
    "codex/stage7a-7c-development-workflow-contract",
    "Lovable sync prompt",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 7A-7C",
    "minimum three related stages",
    "Stage 7D",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 7A-7C",
    "working contract",
    "batch planning template",
  ],
  "docs/project-memory/RISKS.md": [
    "micro-PR",
    "Lovable sync prompt",
    "Stage 7D",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "development-workflow-contract.stage7a-7c.json",
    "WORKING_CONTRACT.md",
    "BATCH_TEMPLATE.md",
    "stage-7a-7c-development-workflow-contract.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/development-workflow-contract.stage7a-7c.json",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/backend/stage-7a-7c-development-workflow-contract.md",
];

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bfetch\s*\(/i,
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
        errors.push(`${file} contains forbidden Stage 7A-7C runtime coupling: ${pattern}`);
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
    "\"test:stage7a-7c\"",
    "\"check:stage7a-7c\"",
    "\"preflight:stage7a-7c\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 7A-7C development workflow contract preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 7A-7C development workflow contract preflight");
  }
}

export function collectStage7A7CChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage7A7CChecks();
  if (!result.ok) {
    console.error("[stage7a-7c-development-workflow-contract] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage7a-7c-development-workflow-contract] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

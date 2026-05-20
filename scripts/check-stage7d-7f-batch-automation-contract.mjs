#!/usr/bin/env node
// Stage 7D-7F · batch automation contract guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/batch-automation-contract.stage7d-7f.json",
  "scripts/stage7d-7f-batch-handoff.mjs",
  "scripts/stage7d-7f-batch-handoff.test.mjs",
  "scripts/check-stage7d-7f-batch-automation-contract.mjs",
  "scripts/check-stage7d-7f-batch-automation-contract.test.mjs",
  "docs/backend/stage-7d-7f-batch-automation-contract.md",
  ".github/workflows/stage7d-7f-batch-automation-contract.yml",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/batch-automation-contract.stage7d-7f.json": [
    "\"stage\": \"7D-7F\"",
    "stage7d-7f-batch-automation-contract",
    "manifestRequiredBeforePrompt",
    "minimumRelatedStagesPerBatch",
    "pullRequestMustBeMerged",
    "lovablePromptAllowedBeforeMerge",
    "lovablePromptAllowedAfterVerifiedMain",
    "\"nextStageHypothesis\": \"Stage 7G\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
  ],
  "scripts/stage7d-7f-batch-handoff.mjs": [
    "buildStage7D7FBatchPlan",
    "evaluateStage7D7FHandoffReadiness",
    "renderStage7D7FBatchPlanMarkdown",
    "lovablePromptAllowed",
    "pull request must be merged",
    "local main must be verified",
  ],
  "docs/backend/stage-7d-7f-batch-automation-contract.md": [
    "Stage 7D-7F",
    "npm run preflight:stage7d-7f",
    "Managed runtime/database dependency: none",
    "Lovable prompt remains blocked",
    "three related stages",
  ],
  ".github/workflows/stage7d-7f-batch-automation-contract.yml": [
    "name: stage7d-7f-batch-automation-contract",
    "npm run preflight:stage7d-7f",
    "GITHUB_STEP_SUMMARY",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 7D",
    "Stage 7E",
    "Stage 7F",
    "Lovable prompt gate",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Batch Manifest",
    "Post-Merge Handoff Gate",
    "Project Memory Refresh",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage7d_7f_preflight",
    "batch_automation_contract_confirmed: true",
    "lovable_prompt_gate_confirmed: true",
    "project_memory_refresh_confirmed: true",
    "command: \"npm run preflight:stage7d-7f\"",
    "Stage 7G",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 7D-7F",
    "batch automation contract",
    "Lovable prompt gate",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 7D-7F",
    "Stage 7G",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 7D-7F",
    "batch manifest",
    "handoff gate",
  ],
  "docs/project-memory/RISKS.md": [
    "Lovable prompt",
    "Stage 7G",
    "hypothesis",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "batch-automation-contract.stage7d-7f.json",
    "stage7d-7f-batch-handoff.mjs",
    "stage-7d-7f-batch-automation-contract.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/batch-automation-contract.stage7d-7f.json",
  "docs/backend/stage-7d-7f-batch-automation-contract.md",
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
        errors.push(`${file} contains forbidden Stage 7D-7F runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = existsSync(join(root, "package.json")) ? read(root, "package.json") : "";
  for (const script of [
    "\"test:stage7d-7f\"",
    "\"check:stage7d-7f\"",
    "\"preflight:stage7d-7f\"",
    "\"handoff:stage7d-7f:dry-run\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = existsSync(join(root, "scripts/preflight-all.mjs"))
    ? read(root, "scripts/preflight-all.mjs")
    : "";
  if (!preflightAll.includes("Stage 7D-7F batch automation contract preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 7D-7F batch automation contract preflight");
  }
}

export function collectStage7D7FChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage7D7FChecks();
  if (!result.ok) {
    console.error("[stage7d-7f-batch-automation-contract] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage7d-7f-batch-automation-contract] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

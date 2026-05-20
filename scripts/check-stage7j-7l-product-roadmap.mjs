#!/usr/bin/env node
// Stage 7J-7L · product roadmap drift guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/product-roadmap.stage7j-7l.json",
  "scripts/stage7j-7l-product-roadmap.mjs",
  "scripts/stage7j-7l-product-roadmap.test.mjs",
  "scripts/check-stage7j-7l-product-roadmap.mjs",
  "scripts/check-stage7j-7l-product-roadmap.test.mjs",
  "docs/backend/stage-7j-7l-product-roadmap.md",
  ".github/workflows/stage7j-7l-product-roadmap.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/product-roadmap.stage7j-7l.json": [
    "\"stage\": \"7J-7L\"",
    "stage7j-7l-product-roadmap",
    "Product gap register",
    "Next product batch planner",
    "Product roadmap drift guard",
    "\"minimumRelatedStagesPerBatch\": 3",
    "\"validOnlyAfterMergeToMain\": true",
    "\"expectedConfirmation\": \"Confirmed: Stage 7J-7L synced from main, no conflicts.\"",
    "\"nextStageHypothesis\": \"Stage 8A-8C\"",
    "Stage 8A-8C",
    "Stage 8D-8F",
    "Stage 8G-8I",
    "Stage 8J-8L",
    "Stage 8M-8O",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
  ],
  "scripts/stage7j-7l-product-roadmap.mjs": [
    "buildStage7J7LProductRoadmap",
    "buildStage7J7LLovablePrompt",
    "renderStage7J7LProductRoadmapMarkdown",
    "runStage7J7LProductRoadmap",
    "Stage 8A-8C",
    "minimumRelatedStagesPerBatch",
  ],
  "docs/backend/stage-7j-7l-product-roadmap.md": [
    "Stage 7J-7L",
    "npm run preflight:stage7j-7l",
    "Product gap register",
    "Next product batch planner",
    "Product roadmap drift guard",
    "Managed runtime/database dependency: none",
  ],
  ".github/workflows/stage7j-7l-product-roadmap.yml": [
    "name: stage7j-7l-product-roadmap",
    "npm run preflight:stage7j-7l",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage7j_7l_preflight",
    "product_gap_register_confirmed: true",
    "next_product_batch_planner_confirmed: true",
    "product_roadmap_drift_guard_confirmed: true",
    "command: \"npm run preflight:stage7j-7l\"",
    "Stage 8A-8C",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 7J-7L",
    "product roadmap",
    "Stage 8A-8C",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 7J-7L",
    "Stage 8A-8C",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 7J-7L",
    "product gap register",
    "product roadmap drift guard",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 7J-7L",
    "Stage 8A-8C",
    "hypothesis",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "product-roadmap.stage7j-7l.json",
    "stage7j-7l-product-roadmap.mjs",
    "stage-7j-7l-product-roadmap.md",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 7J",
    "Stage 7K",
    "Stage 7L",
    "product gap register",
    "next product batch planner",
    "product roadmap drift guard",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Product Gap Register",
    "Next Product Batch Planner",
    "Roadmap Drift Guard",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/product-roadmap.stage7j-7l.json",
  "docs/backend/stage-7j-7l-product-roadmap.md",
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
        errors.push(`${file} contains forbidden Stage 7J-7L runtime coupling: ${pattern}`);
      }
    }
  }
}

function validateManifest(errors, root) {
  const file = "deploy/self-hosted/product-roadmap.stage7j-7l.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  const minStages = manifest.batchPlanPolicy?.minimumRelatedStagesPerBatch ?? 3;
  for (const batch of manifest.nextProductBatches ?? []) {
    if (!Array.isArray(batch.includedStages) || batch.includedStages.length < minStages) {
      errors.push(`${file} batch ${batch.batch} has fewer than ${minStages} stages`);
    }
    if (batch.minimumRelatedStagesSatisfied !== true) {
      errors.push(`${file} batch ${batch.batch} must set minimumRelatedStagesSatisfied: true`);
    }
  }
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push(`${file} must keep managedRuntimeDependency none`);
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push(`${file} must keep managedDatabaseDependency none`);
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = existsSync(join(root, "package.json")) ? read(root, "package.json") : "";
  for (const script of [
    "\"test:stage7j-7l\"",
    "\"check:stage7j-7l\"",
    "\"roadmap:stage7j-7l:dry-run\"",
    "\"preflight:stage7j-7l\"",
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }

  const preflightAll = existsSync(join(root, "scripts/preflight-all.mjs"))
    ? read(root, "scripts/preflight-all.mjs")
    : "";
  if (!preflightAll.includes("Stage 7J-7L product roadmap preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 7J-7L product roadmap preflight");
  }
}

export function collectStage7J7LChecks({ root = process.cwd() } = {}) {
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
  validateManifest(errors, root);
  scanProtectedFiles(errors, root);
  validatePackageScripts(errors, root);
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectStage7J7LChecks();
  if (!result.ok) {
    console.error("[stage7j-7l-product-roadmap] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage7j-7l-product-roadmap] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

#!/usr/bin/env node
// Stage 16A-16Z · Product cycle readiness guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/product-cycle-readiness.stage16a-16z.json",
  "scripts/stage16a-16z-product-cycle-readiness.mjs",
  "scripts/stage16a-16z-product-cycle-readiness.test.mjs",
  "scripts/check-stage16a-16z-product-cycle-readiness.mjs",
  "scripts/check-stage16a-16z-product-cycle-readiness.test.mjs",
  "docs/backend/stage-16a-16z-product-cycle-readiness.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  ".github/workflows/stage16a-16z-product-cycle-readiness.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/product-cycle-readiness.stage16a-16z.json": [
    "\"stage\": \"16A-16Z\"",
    "\"previousIncludedStages\": 26",
    "\"currentIncludedStages\": 26",
    "\"product_cycle_not_chat_memory\"",
    "\"product_facing_batch_required\"",
    "\"stage15_regression_required\"",
    "\"surface_inventory_required\"",
    "\"lovable_prompt_from_manifest\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 16A-16Z synced from main, no conflicts.\"",
    "\"previousConfirmation\": \"Confirmed: Stage 15A-15Z synced from main, no conflicts.\"",
    "\"candidate-stage17-clinical-followup\"",
  ],
  "scripts/stage16a-16z-product-cycle-readiness.mjs": [
    "buildStage16A16ZProductCycleReadiness",
    "buildStage16A16ZLovablePrompt",
    "renderStage16A16ZProductCycleReadinessMarkdown",
    "runStage16A16ZProductCycleReadiness",
    "previousIncludedStages === 26",
    "currentIncludedStages === 26",
  ],
  "docs/backend/stage-16a-16z-product-cycle-readiness.md": [
    "Stage 16A-16Z",
    "Product cycle readiness",
    "product_cycle_not_chat_memory",
    "clinical follow-up and patient communication loop",
    "Managed runtime/database dependency: none",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 16A: Post-sync baseline intake",
    "Stage 16N-16Z: Product-cycle handoff",
    "Product cycle readiness",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Product Cycle Readiness",
    "Recommended product candidate",
    "Surface inventory",
    "Product-facing batch required",
  ],
  ".github/workflows/stage16a-16z-product-cycle-readiness.yml": [
    "name: stage16a-16z-product-cycle-readiness",
    "npm run preflight:stage16a-16z",
    "GITHUB_STEP_SUMMARY",
  ],
  "package.json": [
    "\"test:stage16a-16z\"",
    "\"check:stage16a-16z\"",
    "\"readiness:stage16a-16z:dry-run\"",
    "\"preflight:stage16a-16z\"",
  ],
  "scripts/preflight-all.mjs": [
    "Stage 16A-16Z product cycle readiness preflight",
    "preflight:stage16a-16z",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage16a_16z_preflight",
    "product_cycle_readiness_confirmed: true",
    "command: \"npm run preflight:stage16a-16z\"",
    "Stage 16A-16Z",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 16A-16Z",
    "product cycle readiness",
    "Stage 17A-17Z",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 16A-16Z",
    "Stage 17A-17Z",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 16A-16Z",
    "product cycle readiness",
    "x2 batch",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 16A-16Z",
    "product-facing",
    "Stage 17A-17Z",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "product-cycle-readiness.stage16a-16z.json",
    "stage16a-16z-product-cycle-readiness.mjs",
    "stage-16a-16z-product-cycle-readiness.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/product-cycle-readiness.stage16a-16z.json",
  "docs/backend/stage-16a-16z-product-cycle-readiness.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
];

const FORBIDDEN = [
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /edge function/i,
  /SUPABASE_/i,
  /navigator\.(usb|bluetooth|serial)/i,
  /storage_object_path/i,
  /signed_url/i,
  /access_token/i,
  /payload_json/i,
  /result_json/i,
  /worker_metadata_json/i,
  /patient_full_name/i,
  /object_bucket/i,
  /object_key/i,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function checkMarkers(root, errors, table, label = "marker") {
  for (const [file, markers] of Object.entries(table)) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing ${label} file: ${file}`);
      continue;
    }
    const text = read(root, file);
    for (const marker of markers) {
      if (!text.includes(marker)) errors.push(`${file} missing ${label}: ${marker}`);
    }
  }
}

function validateManifest(root, errors) {
  const path = join(root, "deploy/self-hosted/product-cycle-readiness.stage16a-16z.json");
  if (!existsSync(path)) return;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.includedStages?.length !== 26) errors.push("Stage 16A-16Z manifest must include 26 stages");
  if (manifest.batchScale?.previousIncludedStages !== 26) errors.push("Stage 16A-16Z must follow a 26-stage previous batch");
  if (manifest.batchScale?.currentIncludedStages !== 26) errors.push("Stage 16A-16Z must sustain 26 current stages");
  if (manifest.previousBatch !== "Stage 15A-15Z") errors.push("Stage 16A-16Z previous batch must be Stage 15A-15Z");
  if (manifest.nextBatchHypothesis !== "Stage 17A-17Z") errors.push("Stage 16A-16Z next hypothesis must be Stage 17A-17Z");
  if ((manifest.readinessSections || []).length < 6) errors.push("Stage 16A-16Z must include at least 6 readiness sections");
  if (!(manifest.readinessSections || []).every((section) => (section.requiredEvidence || []).length >= 8)) {
    errors.push("Stage 16A-16Z readiness sections must include at least 8 evidence items");
  }
  if ((manifest.readinessRules || []).length < 10) errors.push("Stage 16A-16Z must include at least 10 readiness rules");
  for (const id of [
    "product_cycle_not_chat_memory",
    "product_facing_batch_required",
    "stage15_regression_required",
    "surface_inventory_required",
    "lovable_prompt_from_manifest",
    "next_stage_hypothesis_recorded",
  ]) {
    if (!manifest.readinessRules?.some((rule) => rule.id === id)) errors.push(`Stage 16A-16Z must include ${id}`);
  }
  if (!manifest.selectedProductCandidates?.some((candidate) => candidate.status === "recommended-hypothesis")) {
    errors.push("Stage 16A-16Z must include a recommended product candidate");
  }
  if (!manifest.lovableHandoff?.promptAllowedOnlyAfterMerge) {
    errors.push("Stage 16A-16Z Lovable handoff must be blocked before merge");
  }
  if (!manifest.lovableHandoff?.promptGeneratedFromManifest) {
    errors.push("Stage 16A-16Z Lovable prompt must be generated from manifest");
  }
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push("Stage 16A-16Z managed runtime dependency must be none");
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push("Stage 16A-16Z managed database dependency must be none");
  }
}

export function checkStage16A16Z(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  validateManifest(root, errors);
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) errors.push(`${file} contains forbidden runtime marker: ${pattern}`);
    }
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkStage16A16Z(process.cwd());
  if (!result.ok) {
    console.error("[stage16a-16z-product-cycle-readiness] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage16a-16z-product-cycle-readiness] OK (${result.checkedFiles} files checked)`);
}

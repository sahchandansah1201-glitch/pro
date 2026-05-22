#!/usr/bin/env node
// Stage 13A-13Z · Execution evidence closure guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/execution-evidence-closure.stage13a-13z.json",
  "scripts/stage13a-13z-execution-evidence-closure.mjs",
  "scripts/stage13a-13z-execution-evidence-closure.test.mjs",
  "scripts/check-stage13a-13z-execution-evidence-closure.mjs",
  "scripts/check-stage13a-13z-execution-evidence-closure.test.mjs",
  "docs/backend/stage-13a-13z-execution-evidence-closure.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  ".github/workflows/stage13a-13z-execution-evidence-closure.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/execution-evidence-closure.stage13a-13z.json": [
    "\"stage\": \"13A-13Z\"",
    "\"previousIncludedStages\": 26",
    "\"currentIncludedStages\": 26",
    "\"closure_not_assumption\"",
    "\"prompt_after_merge_only\"",
    "\"previous_evidence_regression\"",
    "\"next_batch_handoff_generated\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 13A-13Z synced from main, no conflicts.\"",
  ],
  "scripts/stage13a-13z-execution-evidence-closure.mjs": [
    "buildStage13A13ZExecutionEvidenceClosure",
    "buildStage13A13ZLovablePrompt",
    "renderStage13A13ZExecutionEvidenceClosureMarkdown",
    "runStage13A13ZExecutionEvidenceClosure",
    "previousIncludedStages === 26",
    "currentIncludedStages === 26",
  ],
  "docs/backend/stage-13a-13z-execution-evidence-closure.md": [
    "Stage 13A-13Z",
    "Execution evidence closure",
    "Closure Schema",
    "closure_not_assumption",
    "Managed runtime/database dependency: none",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 13A: Closure schema",
    "Stage 13Z: Next x2 handoff closure",
    "Execution evidence closure",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Execution Evidence Closure",
    "Closure sections",
    "Prompt-after-merge proof",
    "Previous evidence regression",
  ],
  ".github/workflows/stage13a-13z-execution-evidence-closure.yml": [
    "name: stage13a-13z-execution-evidence-closure",
    "npm run preflight:stage13a-13z",
    "GITHUB_STEP_SUMMARY",
  ],
  "package.json": [
    "\"test:stage13a-13z\"",
    "\"check:stage13a-13z\"",
    "\"closure:stage13a-13z:dry-run\"",
    "\"preflight:stage13a-13z\"",
  ],
  "scripts/preflight-all.mjs": [
    "Stage 13A-13Z execution evidence closure preflight",
    "preflight:stage13a-13z",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage13a_13z_preflight",
    "execution_evidence_closure_confirmed: true",
    "command: \"npm run preflight:stage13a-13z\"",
    "Stage 14A-14Z",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 13A-13Z",
    "execution evidence closure",
    "Stage 14A-14Z",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 13A-13Z",
    "Stage 14A-14Z",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 13A-13Z",
    "execution evidence closure",
    "x2 batch",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 13A-13Z",
    "execution evidence closure",
    "Stage 14A-14Z",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "execution-evidence-closure.stage13a-13z.json",
    "stage13a-13z-execution-evidence-closure.mjs",
    "stage-13a-13z-execution-evidence-closure.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/execution-evidence-closure.stage13a-13z.json",
  "docs/backend/stage-13a-13z-execution-evidence-closure.md",
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
  const path = join(root, "deploy/self-hosted/execution-evidence-closure.stage13a-13z.json");
  if (!existsSync(path)) return;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.includedStages?.length !== 26) errors.push("Stage 13A-13Z manifest must include 26 stages");
  if (manifest.batchScale?.previousIncludedStages !== 26) errors.push("Stage 13A-13Z must follow a 26-stage previous batch");
  if (manifest.batchScale?.currentIncludedStages !== 26) errors.push("Stage 13A-13Z must sustain 26 current stages");
  if ((manifest.closureSections || []).length < 6) errors.push("Stage 13A-13Z must include at least 6 closure sections");
  if (!(manifest.closureSections || []).every((section) => (section.requiredEvidence || []).length >= 6)) {
    errors.push("Stage 13A-13Z closure sections must include at least 6 evidence items");
  }
  if ((manifest.closureRules || []).length < 10) errors.push("Stage 13A-13Z must include at least 10 closure rules");
  for (const id of [
    "closure_not_assumption",
    "prompt_after_merge_only",
    "previous_evidence_regression",
    "next_batch_handoff_generated",
    "lovable_prompt_source_locked",
  ]) {
    if (!manifest.closureRules?.some((rule) => rule.id === id)) errors.push(`Stage 13A-13Z must include ${id}`);
  }
  if (!manifest.lovableHandoff?.promptAllowedOnlyAfterMerge) {
    errors.push("Stage 13A-13Z Lovable handoff must be blocked before merge");
  }
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push("Stage 13A-13Z managed runtime dependency must be none");
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push("Stage 13A-13Z managed database dependency must be none");
  }
}

export function checkStage13A13Z(root = process.cwd()) {
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
  const result = checkStage13A13Z(process.cwd());
  if (!result.ok) {
    console.error("[stage13a-13z-execution-evidence-closure] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage13a-13z-execution-evidence-closure] OK (${result.checkedFiles} files checked)`);
}

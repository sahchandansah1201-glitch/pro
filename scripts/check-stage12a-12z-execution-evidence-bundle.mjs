#!/usr/bin/env node
// Stage 12A-12Z · Execution evidence bundle guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/execution-evidence-bundle.stage12a-12z.json",
  "scripts/stage12a-12z-execution-evidence-bundle.mjs",
  "scripts/stage12a-12z-execution-evidence-bundle.test.mjs",
  "scripts/check-stage12a-12z-execution-evidence-bundle.mjs",
  "scripts/check-stage12a-12z-execution-evidence-bundle.test.mjs",
  "docs/backend/stage-12a-12z-execution-evidence-bundle.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  ".github/workflows/stage12a-12z-execution-evidence-bundle.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/execution-evidence-bundle.stage12a-12z.json": [
    "\"stage\": \"12A-12Z\"",
    "\"previousIncludedStages\": 26",
    "\"currentIncludedStages\": 26",
    "\"evidence_not_assertion\"",
    "\"checks_before_ready\"",
    "\"merge_before_prompt\"",
    "\"lovable_prompt_generated\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 12A-12Z synced from main, no conflicts.\"",
  ],
  "scripts/stage12a-12z-execution-evidence-bundle.mjs": [
    "buildStage12A12ZExecutionEvidenceBundle",
    "buildStage12A12ZLovablePrompt",
    "renderStage12A12ZExecutionEvidenceBundleMarkdown",
    "runStage12A12ZExecutionEvidenceBundle",
    "previousIncludedStages === 26",
    "currentIncludedStages === 26",
  ],
  "docs/backend/stage-12a-12z-execution-evidence-bundle.md": [
    "Stage 12A-12Z",
    "Execution evidence bundle",
    "Implementation Evidence",
    "evidence_not_assertion",
    "Managed runtime/database dependency: none",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 12A: Evidence bundle schema",
    "Stage 12Z: Next x2 execution handoff evidence",
    "Execution evidence bundle",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Execution Evidence Bundle",
    "Implementation evidence",
    "GitHub evidence",
    "Lovable evidence",
  ],
  ".github/workflows/stage12a-12z-execution-evidence-bundle.yml": [
    "name: stage12a-12z-execution-evidence-bundle",
    "npm run preflight:stage12a-12z",
    "GITHUB_STEP_SUMMARY",
  ],
  "package.json": [
    "\"test:stage12a-12z\"",
    "\"check:stage12a-12z\"",
    "\"evidence:stage12a-12z:dry-run\"",
    "\"preflight:stage12a-12z\"",
  ],
  "scripts/preflight-all.mjs": [
    "Stage 12A-12Z execution evidence bundle preflight",
    "preflight:stage12a-12z",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage12a_12z_preflight",
    "execution_evidence_bundle_confirmed: true",
    "command: \"npm run preflight:stage12a-12z\"",
    "Stage 13A-13Z",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 12A-12Z",
    "execution evidence bundle",
    "Stage 13A-13Z",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 12A-12Z",
    "Stage 13A-13Z",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 12A-12Z",
    "execution evidence bundle",
    "x2 batch",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 12A-12Z",
    "execution evidence bundle",
    "Stage 13A-13Z",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "execution-evidence-bundle.stage12a-12z.json",
    "stage12a-12z-execution-evidence-bundle.mjs",
    "stage-12a-12z-execution-evidence-bundle.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/execution-evidence-bundle.stage12a-12z.json",
  "docs/backend/stage-12a-12z-execution-evidence-bundle.md",
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
  const path = join(root, "deploy/self-hosted/execution-evidence-bundle.stage12a-12z.json");
  if (!existsSync(path)) return;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.includedStages?.length !== 26) errors.push("Stage 12A-12Z manifest must include 26 stages");
  if (manifest.batchScale?.previousIncludedStages !== 26) errors.push("Stage 12A-12Z must follow a 26-stage previous batch");
  if (manifest.batchScale?.currentIncludedStages !== 26) errors.push("Stage 12A-12Z must sustain 26 current stages");
  if ((manifest.evidenceSections || []).length < 5) errors.push("Stage 12A-12Z must include at least 5 evidence sections");
  if (!(manifest.evidenceSections || []).every((section) => (section.requiredEvidence || []).length >= 6)) {
    errors.push("Stage 12A-12Z evidence sections must include at least 6 evidence items");
  }
  if ((manifest.evidenceRules || []).length < 8) errors.push("Stage 12A-12Z must include at least 8 evidence rules");
  for (const id of ["evidence_not_assertion", "checks_before_ready", "merge_before_prompt", "lovable_prompt_generated"]) {
    if (!manifest.evidenceRules?.some((rule) => rule.id === id)) errors.push(`Stage 12A-12Z must include ${id}`);
  }
  if (!manifest.lovableHandoff?.promptAllowedOnlyAfterMerge) {
    errors.push("Stage 12A-12Z Lovable handoff must be blocked before merge");
  }
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push("Stage 12A-12Z managed runtime dependency must be none");
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push("Stage 12A-12Z managed database dependency must be none");
  }
}

export function checkStage12A12Z(root = process.cwd()) {
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
  const result = checkStage12A12Z(process.cwd());
  if (!result.ok) {
    console.error("[stage12a-12z-execution-evidence-bundle] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage12a-12z-execution-evidence-bundle] OK (${result.checkedFiles} files checked)`);
}

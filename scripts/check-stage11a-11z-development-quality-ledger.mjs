#!/usr/bin/env node
// Stage 11A-11Z · Development quality ledger guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/development-quality-ledger.stage11a-11z.json",
  "scripts/stage11a-11z-development-quality-ledger.mjs",
  "scripts/stage11a-11z-development-quality-ledger.test.mjs",
  "scripts/check-stage11a-11z-development-quality-ledger.mjs",
  "scripts/check-stage11a-11z-development-quality-ledger.test.mjs",
  "docs/backend/stage-11a-11z-development-quality-ledger.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  ".github/workflows/stage11a-11z-development-quality-ledger.yml"
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/development-quality-ledger.stage11a-11z.json": [
    "\"stage\": \"11A-11Z\"",
    "\"previousIncludedStages\": 26",
    "\"currentIncludedStages\": 26",
    "\"defect_requires_prevention\"",
    "\"preflight_all_alignment\"",
    "\"merge_before_lovable\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 11A-11Z synced from main, no conflicts.\""
  ],
  "scripts/stage11a-11z-development-quality-ledger.mjs": [
    "buildStage11A11ZDevelopmentQualityLedger",
    "buildStage11A11ZLovablePrompt",
    "renderStage11A11ZDevelopmentQualityLedgerMarkdown",
    "runStage11A11ZDevelopmentQualityLedger",
    "previousIncludedStages === 26",
    "currentIncludedStages === 26"
  ],
  "docs/backend/stage-11a-11z-development-quality-ledger.md": [
    "Stage 11A-11Z",
    "Development quality ledger",
    "Batch Intake",
    "defect_requires_prevention",
    "Managed runtime/database dependency: none"
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 11A: Batch intake ledger",
    "Stage 11Z: Next x2 batch handoff ledger",
    "Development quality ledger"
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Development Quality Ledger",
    "Batch intake evidence",
    "Pull request evidence"
  ],
  ".github/workflows/stage11a-11z-development-quality-ledger.yml": [
    "name: stage11a-11z-development-quality-ledger",
    "npm run preflight:stage11a-11z",
    "GITHUB_STEP_SUMMARY"
  ],
  "package.json": [
    "\"test:stage11a-11z\"",
    "\"check:stage11a-11z\"",
    "\"ledger:stage11a-11z:dry-run\"",
    "\"preflight:stage11a-11z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 11A-11Z development quality ledger preflight",
    "preflight:stage11a-11z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage11a_11z_preflight",
    "development_quality_ledger_confirmed: true",
    "command: \"npm run preflight:stage11a-11z\"",
    "Stage 12A-12Z"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 11A-11Z",
    "development quality ledger",
    "Stage 12A-12Z"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 11A-11Z",
    "Stage 12A-12Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 11A-11Z",
    "development quality ledger",
    "x2 batch"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 11A-11Z",
    "development quality ledger",
    "Stage 12A-12Z"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "development-quality-ledger.stage11a-11z.json",
    "stage11a-11z-development-quality-ledger.mjs",
    "stage-11a-11z-development-quality-ledger.md"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/development-quality-ledger.stage11a-11z.json",
  "docs/backend/stage-11a-11z-development-quality-ledger.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md"
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
  /object_key/i
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
  const path = join(root, "deploy/self-hosted/development-quality-ledger.stage11a-11z.json");
  if (!existsSync(path)) return;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.includedStages?.length !== 26) errors.push("Stage 11A-11Z manifest must include 26 stages");
  if (manifest.batchScale?.previousIncludedStages !== 26) errors.push("Stage 11A-11Z must follow a 26-stage previous batch");
  if (manifest.batchScale?.currentIncludedStages !== 26) errors.push("Stage 11A-11Z must sustain 26 current stages");
  if ((manifest.ledgerSections || []).length < 4) errors.push("Stage 11A-11Z must include at least 4 ledger sections");
  if ((manifest.qualityRules || []).length < 7) errors.push("Stage 11A-11Z must include at least 7 quality rules");
  if (!manifest.qualityRules?.some((rule) => rule.id === "defect_requires_prevention")) {
    errors.push("Stage 11A-11Z must include defect_requires_prevention");
  }
  if (!manifest.lovableHandoff?.promptAllowedOnlyAfterMerge) {
    errors.push("Stage 11A-11Z Lovable handoff must be blocked before merge");
  }
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push("Stage 11A-11Z managed runtime dependency must be none");
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push("Stage 11A-11Z managed database dependency must be none");
  }
}

export function checkStage11A11Z(root = process.cwd()) {
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
  const result = checkStage11A11Z(process.cwd());
  if (!result.ok) {
    console.error("[stage11a-11z-development-quality-ledger] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage11a-11z-development-quality-ledger] OK (${result.checkedFiles} files checked)`);
}

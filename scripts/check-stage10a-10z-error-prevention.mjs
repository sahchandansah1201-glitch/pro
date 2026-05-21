#!/usr/bin/env node
// Stage 10A-10Z · Error prevention guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/error-prevention.stage10a-10z.json",
  "scripts/stage10a-10z-error-prevention.mjs",
  "scripts/stage10a-10z-error-prevention.test.mjs",
  "scripts/check-stage10a-10z-error-prevention.mjs",
  "scripts/check-stage10a-10z-error-prevention.test.mjs",
  "docs/backend/stage-10a-10z-error-prevention.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  ".github/workflows/stage10a-10z-error-prevention.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/error-prevention.stage10a-10z.json": [
    "\"stage\": \"10A-10Z\"",
    "\"previousIncludedStages\": 13",
    "\"currentIncludedStages\": 26",
    "\"scaleFactor\": 2",
    "\"stage9n-ui-fetch-count\"",
    "\"stage9n-shared-ui-type\"",
    "\"stage9n-preflight-all-drift\"",
    "\"stage9n-temp-artifact\"",
    "\"stage9n-project-memory-wording\"",
    "\"github-graphql-timeout\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 10A-10Z synced from main, no conflicts.\"",
  ],
  "scripts/stage10a-10z-error-prevention.mjs": [
    "buildStage10A10ZErrorPreventionPackage",
    "buildStage10A10ZLovablePrompt",
    "renderStage10A10ZErrorPreventionMarkdown",
    "runStage10A10ZErrorPrevention",
    "previousIncludedStages === 13",
    "currentIncludedStages === 26",
  ],
  "docs/backend/stage-10a-10z-error-prevention.md": [
    "Stage 10A-10Z",
    "x2 batch",
    "Diagnosed defects",
    "Prevention gates",
    "Managed runtime/database dependency: none",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 10A: Error taxonomy register",
    "Stage 10Z: Next x2 batch handoff",
    "Failure-to-prevention rule",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Error Prevention",
    "Diagnosed defects",
    "Prevention rule or guard",
  ],
  ".github/workflows/stage10a-10z-error-prevention.yml": [
    "name: stage10a-10z-error-prevention",
    "npm run preflight:stage10a-10z",
    "GITHUB_STEP_SUMMARY",
  ],
  "package.json": [
    "\"test:stage10a-10z\"",
    "\"check:stage10a-10z\"",
    "\"prevention:stage10a-10z:dry-run\"",
    "\"preflight:stage10a-10z\"",
  ],
  "scripts/preflight-all.mjs": [
    "Stage 10A-10Z error prevention preflight",
    "preflight:stage10a-10z",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage10a_10z_preflight",
    "error_prevention_confirmed: true",
    "command: \"npm run preflight:stage10a-10z\"",
    "Stage 11A-11Z",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 10A-10Z",
    "error prevention",
    "Stage 11A-11Z",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 10A-10Z",
    "Stage 11A-11Z",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 10A-10Z",
    "x2 batch",
    "diagnosed defects",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 10A-10Z",
    "error prevention",
    "Stage 11A-11Z",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "error-prevention.stage10a-10z.json",
    "stage10a-10z-error-prevention.mjs",
    "stage-10a-10z-error-prevention.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/error-prevention.stage10a-10z.json",
  "docs/backend/stage-10a-10z-error-prevention.md",
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
  const path = join(root, "deploy/self-hosted/error-prevention.stage10a-10z.json");
  if (!existsSync(path)) return;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.includedStages?.length !== 26) errors.push("Stage 10A-10Z manifest must include 26 stages");
  if (manifest.batchScale?.scaleFactor !== 2) errors.push("Stage 10A-10Z manifest must record scaleFactor 2");
  if ((manifest.diagnosedDefects || []).length < 6) errors.push("Stage 10A-10Z must record at least 6 diagnosed defects");
  if ((manifest.preventionRules || []).length < 6) errors.push("Stage 10A-10Z must record at least 6 prevention rules");
  if (!manifest.lovableHandoff?.promptAllowedOnlyAfterMerge) {
    errors.push("Stage 10A-10Z Lovable handoff must be blocked before merge");
  }
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push("Stage 10A-10Z managed runtime dependency must be none");
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push("Stage 10A-10Z managed database dependency must be none");
  }
}

export function checkStage10A10Z(root = process.cwd()) {
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
  const result = checkStage10A10Z(process.cwd());
  if (!result.ok) {
    console.error("[stage10a-10z-error-prevention] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage10a-10z-error-prevention] OK (${result.checkedFiles} files checked)`);
}

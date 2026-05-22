#!/usr/bin/env node
// Stage 15A-15Z · Post-sync handoff readiness guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/post-sync-handoff-readiness.stage15a-15z.json",
  "scripts/stage15a-15z-post-sync-handoff-readiness.mjs",
  "scripts/stage15a-15z-post-sync-handoff-readiness.test.mjs",
  "scripts/check-stage15a-15z-post-sync-handoff-readiness.mjs",
  "scripts/check-stage15a-15z-post-sync-handoff-readiness.test.mjs",
  "docs/backend/stage-15a-15z-post-sync-handoff-readiness.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  ".github/workflows/stage15a-15z-post-sync-handoff-readiness.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/post-sync-handoff-readiness.stage15a-15z.json": [
    "\"stage\": \"15A-15Z\"",
    "\"previousIncludedStages\": 26",
    "\"currentIncludedStages\": 26",
    "\"post_sync_confirmation_not_memory\"",
    "\"main_verified_before_next_handoff\"",
    "\"sync_delay_not_conflict\"",
    "\"stage14_regression_required\"",
    "\"lovable_prompt_replay_manifest\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 15A-15Z synced from main, no conflicts.\"",
    "\"previousConfirmation\": \"Confirmed: Stage 14A-14Z synced from main, no conflicts.\"",
  ],
  "scripts/stage15a-15z-post-sync-handoff-readiness.mjs": [
    "buildStage15A15ZPostSyncHandoffReadiness",
    "buildStage15A15ZLovablePrompt",
    "renderStage15A15ZPostSyncHandoffReadinessMarkdown",
    "runStage15A15ZPostSyncHandoffReadiness",
    "previousIncludedStages === 26",
    "currentIncludedStages === 26",
  ],
  "docs/backend/stage-15a-15z-post-sync-handoff-readiness.md": [
    "Stage 15A-15Z",
    "Post-sync handoff readiness",
    "post_sync_confirmation_not_memory",
    "Stage 14A-14Z confirmation",
    "Managed runtime/database dependency: none",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 15A: Previous sync confirmation intake",
    "Stage 15W-15Z: Handoff readiness",
    "Post-sync handoff readiness",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Sync Confirmation Ledger",
    "Confirmed previous sync",
    "Duplicate CI handling",
    "Sync delay diagnostic",
  ],
  ".github/workflows/stage15a-15z-post-sync-handoff-readiness.yml": [
    "name: stage15a-15z-post-sync-handoff-readiness",
    "npm run preflight:stage15a-15z",
    "GITHUB_STEP_SUMMARY",
  ],
  "package.json": [
    "\"test:stage15a-15z\"",
    "\"check:stage15a-15z\"",
    "\"readiness:stage15a-15z:dry-run\"",
    "\"preflight:stage15a-15z\"",
  ],
  "scripts/preflight-all.mjs": [
    "Stage 15A-15Z post-sync handoff readiness preflight",
    "preflight:stage15a-15z",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage15a_15z_preflight",
    "sync_confirmation_ledger_confirmed: true",
    "command: \"npm run preflight:stage15a-15z\"",
    "Stage 15A-15Z",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 15A-15Z",
    "post-sync handoff readiness",
    "Stage 15A-15Z",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 15A-15Z",
    "Stage 15A-15Z",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 15A-15Z",
    "post-sync handoff readiness",
    "x2 batch",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 15A-15Z",
    "post-sync handoff readiness",
    "Stage 15A-15Z",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "post-sync-handoff-readiness.stage15a-15z.json",
    "stage15a-15z-post-sync-handoff-readiness.mjs",
    "stage-15a-15z-post-sync-handoff-readiness.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/post-sync-handoff-readiness.stage15a-15z.json",
  "docs/backend/stage-15a-15z-post-sync-handoff-readiness.md",
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
  const path = join(root, "deploy/self-hosted/post-sync-handoff-readiness.stage15a-15z.json");
  if (!existsSync(path)) return;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.includedStages?.length !== 26) errors.push("Stage 15A-15Z manifest must include 26 stages");
  if (manifest.batchScale?.previousIncludedStages !== 26) errors.push("Stage 15A-15Z must follow a 26-stage previous batch");
  if (manifest.batchScale?.currentIncludedStages !== 26) errors.push("Stage 15A-15Z must sustain 26 current stages");
  if (manifest.confirmedPreviousSync?.mergeCommit !== manifest.previousBatchCommit) {
    errors.push("Stage 15A-15Z previous sync commit must match previous batch commit");
  }
  if (manifest.confirmedPreviousSync?.confirmation !== manifest.lovableHandoff?.previousConfirmation) {
    errors.push("Stage 15A-15Z previous confirmation must match Lovable handoff record");
  }
  if ((manifest.ledgerSections || []).length < 6) errors.push("Stage 15A-15Z must include at least 6 ledger sections");
  if (!(manifest.ledgerSections || []).every((section) => (section.requiredEvidence || []).length >= 7)) {
    errors.push("Stage 15A-15Z ledger sections must include at least 7 evidence items");
  }
  if ((manifest.ledgerRules || []).length < 10) errors.push("Stage 15A-15Z must include at least 10 ledger rules");
  for (const id of [
    "post_sync_confirmation_not_memory",
    "main_verified_before_next_handoff",
    "sync_delay_not_conflict",
    "stage14_regression_required",
    "lovable_prompt_replay_manifest",
    "next_batch_hypothesis_recorded",
  ]) {
    if (!manifest.ledgerRules?.some((rule) => rule.id === id)) errors.push(`Stage 15A-15Z must include ${id}`);
  }
  if (!manifest.lovableHandoff?.promptAllowedOnlyAfterMerge) {
    errors.push("Stage 15A-15Z Lovable handoff must be blocked before merge");
  }
  if (!manifest.lovableHandoff?.promptGeneratedFromManifest) {
    errors.push("Stage 15A-15Z Lovable prompt must be generated from manifest");
  }
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push("Stage 15A-15Z managed runtime dependency must be none");
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push("Stage 15A-15Z managed database dependency must be none");
  }
}

export function checkStage15A15Z(root = process.cwd()) {
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
  const result = checkStage15A15Z(process.cwd());
  if (!result.ok) {
    console.error("[stage15a-15z-post-sync-handoff-readiness] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage15a-15z-post-sync-handoff-readiness] OK (${result.checkedFiles} files checked)`);
}

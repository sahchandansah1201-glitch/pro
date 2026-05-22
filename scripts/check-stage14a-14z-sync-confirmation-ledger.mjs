#!/usr/bin/env node
// Stage 14A-14Z · Sync confirmation ledger guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/sync-confirmation-ledger.stage14a-14z.json",
  "scripts/stage14a-14z-sync-confirmation-ledger.mjs",
  "scripts/stage14a-14z-sync-confirmation-ledger.test.mjs",
  "scripts/check-stage14a-14z-sync-confirmation-ledger.mjs",
  "scripts/check-stage14a-14z-sync-confirmation-ledger.test.mjs",
  "docs/backend/stage-14a-14z-sync-confirmation-ledger.md",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  ".github/workflows/stage14a-14z-sync-confirmation-ledger.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/sync-confirmation-ledger.stage14a-14z.json": [
    "\"stage\": \"14A-14Z\"",
    "\"previousIncludedStages\": 26",
    "\"currentIncludedStages\": 26",
    "\"sync_confirmation_not_memory\"",
    "\"main_before_confirmation\"",
    "\"sync_delay_not_conflict\"",
    "\"previous_closure_regression\"",
    "\"post_merge_verification_required\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 14A-14Z synced from main, no conflicts.\"",
    "\"previousConfirmation\": \"Confirmed: Stage 13A-13Z synced from main, no conflicts.\"",
  ],
  "scripts/stage14a-14z-sync-confirmation-ledger.mjs": [
    "buildStage14A14ZSyncConfirmationLedger",
    "buildStage14A14ZLovablePrompt",
    "renderStage14A14ZSyncConfirmationLedgerMarkdown",
    "runStage14A14ZSyncConfirmationLedger",
    "previousIncludedStages === 26",
    "currentIncludedStages === 26",
  ],
  "docs/backend/stage-14a-14z-sync-confirmation-ledger.md": [
    "Stage 14A-14Z",
    "Sync confirmation ledger",
    "sync_confirmation_not_memory",
    "Stage 13A-13Z confirmation",
    "Managed runtime/database dependency: none",
  ],
  "docs/project-memory/WORKING_CONTRACT.md": [
    "Stage 14A: Sync ledger schema",
    "Stage 14Z: Stage 15 hypothesis",
    "Sync confirmation ledger",
  ],
  "docs/project-memory/BATCH_TEMPLATE.md": [
    "Sync Confirmation Ledger",
    "Confirmed previous sync",
    "Duplicate CI handling",
    "Sync delay diagnostic",
  ],
  ".github/workflows/stage14a-14z-sync-confirmation-ledger.yml": [
    "name: stage14a-14z-sync-confirmation-ledger",
    "npm run preflight:stage14a-14z",
    "GITHUB_STEP_SUMMARY",
  ],
  "package.json": [
    "\"test:stage14a-14z\"",
    "\"check:stage14a-14z\"",
    "\"ledger:stage14a-14z:dry-run\"",
    "\"preflight:stage14a-14z\"",
  ],
  "scripts/preflight-all.mjs": [
    "Stage 14A-14Z sync confirmation ledger preflight",
    "preflight:stage14a-14z",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage14a_14z_preflight",
    "sync_confirmation_ledger_confirmed: true",
    "command: \"npm run preflight:stage14a-14z\"",
    "Stage 15A-15Z",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 14A-14Z",
    "sync confirmation ledger",
    "Stage 15A-15Z",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 14A-14Z",
    "Stage 15A-15Z",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 14A-14Z",
    "sync confirmation ledger",
    "x2 batch",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 14A-14Z",
    "sync confirmation ledger",
    "Stage 15A-15Z",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "sync-confirmation-ledger.stage14a-14z.json",
    "stage14a-14z-sync-confirmation-ledger.mjs",
    "stage-14a-14z-sync-confirmation-ledger.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/sync-confirmation-ledger.stage14a-14z.json",
  "docs/backend/stage-14a-14z-sync-confirmation-ledger.md",
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
  const path = join(root, "deploy/self-hosted/sync-confirmation-ledger.stage14a-14z.json");
  if (!existsSync(path)) return;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.includedStages?.length !== 26) errors.push("Stage 14A-14Z manifest must include 26 stages");
  if (manifest.batchScale?.previousIncludedStages !== 26) errors.push("Stage 14A-14Z must follow a 26-stage previous batch");
  if (manifest.batchScale?.currentIncludedStages !== 26) errors.push("Stage 14A-14Z must sustain 26 current stages");
  if (manifest.confirmedPreviousSync?.mergeCommit !== manifest.previousBatchCommit) {
    errors.push("Stage 14A-14Z previous sync commit must match previous batch commit");
  }
  if (manifest.confirmedPreviousSync?.confirmation !== manifest.lovableHandoff?.previousConfirmation) {
    errors.push("Stage 14A-14Z previous confirmation must match Lovable handoff record");
  }
  if ((manifest.ledgerSections || []).length < 6) errors.push("Stage 14A-14Z must include at least 6 ledger sections");
  if (!(manifest.ledgerSections || []).every((section) => (section.requiredEvidence || []).length >= 7)) {
    errors.push("Stage 14A-14Z ledger sections must include at least 7 evidence items");
  }
  if ((manifest.ledgerRules || []).length < 10) errors.push("Stage 14A-14Z must include at least 10 ledger rules");
  for (const id of [
    "sync_confirmation_not_memory",
    "main_before_confirmation",
    "sync_delay_not_conflict",
    "previous_closure_regression",
    "post_merge_verification_required",
    "next_batch_hypothesis_recorded",
  ]) {
    if (!manifest.ledgerRules?.some((rule) => rule.id === id)) errors.push(`Stage 14A-14Z must include ${id}`);
  }
  if (!manifest.lovableHandoff?.promptAllowedOnlyAfterMerge) {
    errors.push("Stage 14A-14Z Lovable handoff must be blocked before merge");
  }
  if (!manifest.lovableHandoff?.promptGeneratedFromManifest) {
    errors.push("Stage 14A-14Z Lovable prompt must be generated from manifest");
  }
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push("Stage 14A-14Z managed runtime dependency must be none");
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push("Stage 14A-14Z managed database dependency must be none");
  }
}

export function checkStage14A14Z(root = process.cwd()) {
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
  const result = checkStage14A14Z(process.cwd());
  if (!result.ok) {
    console.error("[stage14a-14z-sync-confirmation-ledger] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage14a-14z-sync-confirmation-ledger] OK (${result.checkedFiles} files checked)`);
}

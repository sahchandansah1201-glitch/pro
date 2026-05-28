#!/usr/bin/env node
// Final backlog / terminal completion criterion guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST = "deploy/self-hosted/final-backlog-terminal-completion-criterion.json";
const MEMORY_DOC = "docs/project-memory/FINAL_BACKLOG_TERMINAL_COMPLETION.md";
const BACKEND_DOC = "docs/backend/final-backlog-terminal-completion-criterion.md";
const WORKFLOW = ".github/workflows/final-backlog-terminal-completion-criterion.yml";
const GUARD = "scripts/check-final-backlog-terminal-completion-criterion.mjs";
const GUARD_TEST = "scripts/check-final-backlog-terminal-completion-criterion.test.mjs";

const REQUIRED_FILES = [
  MANIFEST,
  MEMORY_DOC,
  BACKEND_DOC,
  WORKFLOW,
  GUARD,
  GUARD_TEST,
  "package.json",
  "scripts/preflight-all.mjs",
  "scripts/preflight-all.test.mjs",
  "docs/project-memory/PLAN_RECONCILIATION.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
];

const REQUIRED_TEXT = {
  [MANIFEST]: [
    "\"id\": \"final-backlog-terminal-completion-criterion\"",
    "\"previousRepositoryBatch\": \"Stage 48A-48Z\"",
    "\"terminalCompletionCriterionDefined\": true",
    "\"terminalStageCountDefined\": false",
    "\"stage49Defined\": false",
    "\"automaticNextStageDisabled\": true",
    "\"futureNumberedBatchRequiresNewPlanDecision\": true",
    "\"runtimeBehaviorAdded\": false",
    "\"databaseMigrationAdded\": false",
    "\"openApiContractAdded\": false",
    "\"expectedConfirmation\": \"Confirmed: final backlog / terminal completion criterion synced from main, no conflicts.\"",
  ],
  [MEMORY_DOC]: [
    "# FINAL_BACKLOG_TERMINAL_COMPLETION",
    "The current repository plan is terminal when all of the following are true:",
    "No repository file defines Stage 49A-49Z",
    "This document does not define Stage 49A-49Z.",
    "Confirmed: final backlog / terminal completion criterion synced from main, no conflicts.",
  ],
  [BACKEND_DOC]: [
    "Runtime behavior added: false.",
    "Database migration added: false.",
    "OpenAPI contract added: false.",
    "Frontend workflow added: false.",
    "no repository file defines Stage 49A-49Z",
  ],
  [WORKFLOW]: [
    "name: final-backlog-terminal-completion-criterion",
    "npm run preflight:final-backlog",
  ],
  "package.json": [
    "\"test:final-backlog\"",
    "\"check:final-backlog\"",
    "\"preflight:final-backlog\"",
  ],
  "scripts/preflight-all.mjs": [
    "Final backlog terminal completion criterion preflight",
    "preflight:final-backlog",
  ],
  "scripts/preflight-all.test.mjs": [
    "preflight:final-backlog",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PLAN_RECONCILIATION.md": [
    "The final backlog / terminal completion criterion is now defined by repository files.",
    "No automatic Stage 49A-49Z exists.",
  ],
  "docs/project-memory/PROJECT_STATE.yaml": [
    "final_backlog_terminal_completion:",
    "terminal_completion_criterion_defined: true",
    "automatic_next_stage_disabled: true",
    "stage49_defined: false",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Final backlog / terminal completion criterion is defined",
    "No automatic Stage 49A-49Z exists",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "No automatic next numbered stage is active.",
    "future product-change intake through a new explicit plan decision",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Defined final backlog / terminal completion criterion",
  ],
  "docs/project-memory/RISKS.md": [
    "Final backlog terminal completion risks",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "final-backlog-terminal-completion-criterion.json",
    "FINAL_BACKLOG_TERMINAL_COMPLETION.md",
    "check-final-backlog-terminal-completion-criterion.mjs",
  ],
};

const PROTECTED_FILES = [
  MANIFEST,
  MEMORY_DOC,
  BACKEND_DOC,
  "docs/project-memory/PLAN_RECONCILIATION.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
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
  /object_bucket/i,
  /object_key/i,
  /vendor\s+(sms|email|notification)/i,
  /Stage 49A-49Z is (defined|approved|confirmed|required)/i,
  /next_hypothesis:\s*"Stage 49A-49Z"/i,
  /nextBatchHypothesis"\s*:\s*"Stage 49A-49Z"/i,
  /stage49_defined:\s*true/i,
  /"stage49Defined":\s*true/i,
  /preflight:stage49/i,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function checkMarkers(root, errors, table, label = "marker") {
  for (const [file, markers] of Object.entries(table)) {
    if (!existsSync(join(root, file))) {
      errors.push("Missing " + label + " file: " + file);
      continue;
    }
    const text = read(root, file);
    for (const marker of markers) if (!text.includes(marker)) errors.push(file + " missing " + label + ": " + marker);
  }
}

function validateManifest(root, errors) {
  if (!existsSync(join(root, MANIFEST))) return;
  let manifest;
  try {
    manifest = JSON.parse(read(root, MANIFEST));
  } catch {
    errors.push("Final backlog manifest must be valid JSON");
    return;
  }
  if (manifest.id !== "final-backlog-terminal-completion-criterion") errors.push("Final backlog manifest id mismatch");
  if (manifest.status !== "ready") errors.push("Final backlog manifest status must be ready");
  if (manifest.previousRepositoryBatch !== "Stage 48A-48Z") errors.push("Final backlog must follow Stage 48A-48Z");
  if (!manifest.stagePolicy?.terminalCompletionCriterionDefined) errors.push("Terminal completion criterion must be defined");
  if (manifest.stagePolicy?.terminalStageCountDefined !== false) errors.push("Terminal stage count must remain undefined");
  if (manifest.stagePolicy?.stage49Defined !== false) errors.push("Stage 49A-49Z must remain undefined");
  if (!manifest.stagePolicy?.automaticNextStageDisabled) errors.push("Automatic next stage must be disabled");
  if (!manifest.stagePolicy?.futureNumberedBatchRequiresNewPlanDecision) errors.push("Future numbered batch must require a new plan decision");
  if ((manifest.terminalCompletionCriterion?.repositoryTerminalWhen || []).length < 5) errors.push("Terminal completion criterion must include at least five repository terminal conditions");
  if ((manifest.terminalCompletionCriterion?.notTerminalIf || []).length < 3) errors.push("Terminal completion criterion must include at least three not-terminal conditions");
  if ((manifest.finalBacklog || []).length < 4) errors.push("Final backlog must include at least four backlog entries");
  if (manifest.runtimeBoundary?.runtimeBehaviorAdded !== false) errors.push("Runtime behavior boundary must be false");
  if (manifest.runtimeBoundary?.databaseMigrationAdded !== false) errors.push("Database migration boundary must be false");
  if (manifest.runtimeBoundary?.openApiContractAdded !== false) errors.push("OpenAPI boundary must be false");
  if (manifest.runtimeBoundary?.frontendWorkflowAdded !== false) errors.push("Frontend workflow boundary must be false");
  if (!manifest.privacy?.repositoryMetadataOnly) errors.push("Final backlog must be repository metadata only");
  if (manifest.privacy?.medicalCorrectnessProof !== false) errors.push("Final backlog must not claim medical correctness proof");
  if (manifest.privacy?.externalApprovalProof !== false) errors.push("Final backlog must not claim external approval proof");
  if (!manifest.repoOwnedCompletionChecklist?.includes("npm run preflight:final-backlog")) errors.push("Final backlog preflight command missing");
}

export function checkFinalBacklogTerminalCompletion(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) if (!existsSync(join(root, file))) errors.push("Missing required file: " + file);
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  validateManifest(root, errors);
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) if (pattern.test(text)) errors.push(file + " contains forbidden terminal marker: " + pattern);
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkFinalBacklogTerminalCompletion(process.cwd());
  if (!result.ok) {
    console.error("[final-backlog-terminal-completion-criterion] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[final-backlog-terminal-completion-criterion] OK (${result.checkedFiles} files checked)`);
  }
}

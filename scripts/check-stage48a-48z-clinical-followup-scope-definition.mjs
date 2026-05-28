#!/usr/bin/env node
// Stage 48A-48Z - Clinical follow-up scope definition guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST = "deploy/self-hosted/clinical-followup-stage48-scope.stage48a-48z.json";
const DOC = "docs/backend/stage-48a-48z-clinical-followup-scope-definition.md";
const WORKFLOW = ".github/workflows/stage48a-48z-clinical-followup-scope-definition.yml";
const GUARD = "scripts/check-stage48a-48z-clinical-followup-scope-definition.mjs";
const GUARD_TEST = "scripts/check-stage48a-48z-clinical-followup-scope-definition.test.mjs";

const REQUIRED_FILES = [
  MANIFEST,
  DOC,
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
    "\"stage\": \"48A-48Z\"",
    "\"previousBatch\": \"Stage 47A-47Z\"",
    "\"nextRepositoryAction\": \"final backlog / terminal completion criterion\"",
    "\"runtimeBehaviorAdded\": false",
    "\"databaseMigrationAdded\": false",
    "\"openApiContractAdded\": false",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 48A-48Z synced from main, no conflicts.\"",
  ],
  [DOC]: [
    "Stage 48A-48Z turns the post-Stage 47 hypothesis into a real repository-defined",
    "Runtime behavior added: false.",
    "Database migration added: false.",
    "OpenAPI contract added: false.",
    "Stage 49A-49Z is not defined by this repository.",
    "Expected Lovable confirmation: `Confirmed: Stage 48A-48Z synced from main, no conflicts.`",
  ],
  [WORKFLOW]: [
    "name: stage48a-48z-clinical-followup-scope-definition",
    "npm run preflight:stage48a-48z",
  ],
  "package.json": [
    "\"test:stage48a-48z\"",
    "\"check:stage48a-48z\"",
    "\"preflight:stage48a-48z\"",
  ],
  "scripts/preflight-all.mjs": [
    "Stage 48A-48Z clinical follow-up scope definition preflight",
    "preflight:stage48a-48z",
  ],
  "scripts/preflight-all.test.mjs": [
    "preflight:stage48a-48z",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PLAN_RECONCILIATION.md": [
    "Stage 48A-48Z is now a repository-defined scope batch.",
    "final backlog / terminal completion criterion",
  ],
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage48a_48z:",
    "stage48_scope_definition_confirmed: true",
    "next_repository_action: \"final backlog / terminal completion criterion\"",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 48A-48Z is defined as a repository scope batch",
    "Stage 49A-49Z is not defined",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 48A-48Z is now the current product-memory batch",
    "final backlog / terminal completion criterion",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Created Stage 48A-48Z clinical follow-up scope definition",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 48A-48Z scope risks",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-stage48-scope.stage48a-48z.json",
    "stage-48a-48z-clinical-followup-scope-definition.md",
    "check-stage48a-48z-clinical-followup-scope-definition.mjs",
  ],
};

const PROTECTED_FILES = [
  MANIFEST,
  DOC,
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
  /Stage 49A-49Z is (defined|approved|confirmed)/i,
  /nextBatchHypothesis"\s*:\s*"Stage 49A-49Z"/i,
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
    errors.push("Stage 48 manifest must be valid JSON");
    return;
  }
  if (manifest.stage !== "48A-48Z") errors.push("Stage 48 manifest stage must be 48A-48Z");
  if (manifest.status !== "ready") errors.push("Stage 48 manifest status must be ready");
  if (manifest.previousBatch !== "Stage 47A-47Z") errors.push("Stage 48 previous batch must be Stage 47A-47Z");
  if (manifest.nextRepositoryAction !== "final backlog / terminal completion criterion") errors.push("Stage 48 next repository action must be final backlog / terminal completion criterion");
  if (manifest.nextBatchHypothesis) errors.push("Stage 48 must not define a next numbered batch hypothesis");
  if (!manifest.scopeDecision?.stage48IsDefinedScope) errors.push("Stage 48 must mark itself as defined scope");
  if (manifest.scopeDecision?.stage48IsRuntimeClinicalFeature !== false) errors.push("Stage 48 must not claim runtime clinical feature scope");
  if (!manifest.scopeDecision?.stage49IsNotDefined) errors.push("Stage 48 must explicitly avoid defining Stage 49A-49Z");
  if (manifest.runtimeBoundary?.runtimeBehaviorAdded !== false) errors.push("Stage 48 runtime behavior boundary must be false");
  if (manifest.runtimeBoundary?.databaseMigrationAdded !== false) errors.push("Stage 48 database migration boundary must be false");
  if (manifest.runtimeBoundary?.openApiContractAdded !== false) errors.push("Stage 48 OpenAPI boundary must be false");
  if ((manifest.implementedSurfaces || []).length < 8) errors.push("Stage 48 must include at least 8 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 48 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 48 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 48 managed notification dependency must be none");
  if (!manifest.privacy?.stage48ScopeIsRepositoryMetadataOnly) errors.push("Stage 48 scope must be repository metadata only");
  if (manifest.privacy?.medicalCorrectnessProof !== false) errors.push("Stage 48 must not claim medical correctness proof");
  if (!manifest.verification?.preflight?.includes("preflight:stage48a-48z")) errors.push("Stage 48 preflight command missing");
}

export function checkStage48A48Z(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) if (!existsSync(join(root, file))) errors.push("Missing required file: " + file);
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  validateManifest(root, errors);
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) if (pattern.test(text)) errors.push(file + " contains forbidden scope marker: " + pattern);
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkStage48A48Z(process.cwd());
  if (!result.ok) {
    console.error("[stage48a-48z-clinical-followup-scope-definition] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[stage48a-48z-clinical-followup-scope-definition] OK (${result.checkedFiles} files checked)`);
  }
}

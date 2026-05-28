#!/usr/bin/env node
// Operator Acceptance / Clinic Go-No-Go checklist guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST = "deploy/self-hosted/operator-acceptance-clinic-go-no-go.json";
const MEMORY_DOC = "docs/project-memory/OPERATOR_ACCEPTANCE_CLINIC_GO_NO_GO.md";
const BACKEND_DOC = "docs/backend/operator-acceptance-clinic-go-no-go.md";
const WORKFLOW = ".github/workflows/operator-acceptance-clinic-go-no-go.yml";
const GUARD = "scripts/check-operator-acceptance-clinic-go-no-go.mjs";
const GUARD_TEST = "scripts/check-operator-acceptance-clinic-go-no-go.test.mjs";

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
  "docs/project-memory/LOVABLE_PROGRESS_LEDGER.md",
];

const REQUIRED_TEXT = {
  [MANIFEST]: [
    "\"id\": \"operator-acceptance-clinic-go-no-go\"",
    "\"previousRepositoryArtifact\": \"final-backlog-terminal-completion-criterion\"",
    "\"isStage49\": false",
    "\"stage49Defined\": false",
    "\"automaticNextStageDisabled\": true",
    "\"repositoryOwnedChecklistOnly\": true",
    "\"requiresExternalExecution\": true",
    "\"repositoryCanRecordTemplateOnly\": true",
    "\"runtimeBehaviorAdded\": false",
    "\"databaseMigrationAdded\": false",
    "\"openApiContractAdded\": false",
    "\"expectedConfirmation\": \"Confirmed: Operator Acceptance / Clinic Go-No-Go checklist synced from main, no conflicts.\"",
  ],
  [MEMORY_DOC]: [
    "# OPERATOR_ACCEPTANCE_CLINIC_GO_NO_GO",
    "This is not Stage 49A-49Z.",
    "## Go Criteria",
    "## No-Go Criteria",
    "External legal approval proof: false.",
    "Medical correctness proof: false.",
  ],
  [BACKEND_DOC]: [
    "Runtime behavior added: false.",
    "Database migration added: false.",
    "OpenAPI contract added: false.",
    "Frontend workflow added: false.",
    "Stage 49A-49Z defined: false.",
  ],
  [WORKFLOW]: [
    "name: operator-acceptance-clinic-go-no-go",
    "npm run preflight:operator-acceptance",
  ],
  "package.json": [
    "\"test:operator-acceptance\"",
    "\"check:operator-acceptance\"",
    "\"preflight:operator-acceptance\"",
  ],
  "scripts/preflight-all.mjs": [
    "Operator Acceptance / Clinic Go-No-Go preflight",
    "preflight:operator-acceptance",
  ],
  "scripts/preflight-all.test.mjs": [
    "preflight:operator-acceptance",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "operator_acceptance_clinic_go_no_go:",
    "clinic_operator_acceptance_defined: true",
    "stage49_defined: false",
    "requires_external_execution: true",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Operator Acceptance / Clinic Go-No-Go checklist is defined",
    "requires external clinic execution",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Operator Acceptance / Clinic Go-No-Go checklist",
    "external clinic execution",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Defined Operator Acceptance / Clinic Go-No-Go checklist",
  ],
  "docs/project-memory/RISKS.md": [
    "Operator acceptance risks",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "operator-acceptance-clinic-go-no-go.json",
    "OPERATOR_ACCEPTANCE_CLINIC_GO_NO_GO.md",
    "check-operator-acceptance-clinic-go-no-go.mjs",
  ],
  "docs/project-memory/LOVABLE_PROGRESS_LEDGER.md": [
    "План реализации",
    "Сделано / проверено",
    "Граница достоверности",
  ],
};

const PROTECTED_FILES = [
  MANIFEST,
  MEMORY_DOC,
  BACKEND_DOC,
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
  /medicalCorrectnessProof"\s*:\s*true/i,
  /externalApprovalProof"\s*:\s*true/i,
  /legalSufficiencyProof"\s*:\s*true/i,
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
    errors.push("Operator acceptance manifest must be valid JSON");
    return;
  }
  if (manifest.id !== "operator-acceptance-clinic-go-no-go") errors.push("Operator acceptance manifest id mismatch");
  if (manifest.status !== "ready") errors.push("Operator acceptance manifest status must be ready");
  if (manifest.previousRepositoryArtifact !== "final-backlog-terminal-completion-criterion") errors.push("Operator acceptance must follow final backlog terminal criterion");
  if (manifest.planBoundary?.isStage49 !== false) errors.push("Operator acceptance must not be Stage 49A-49Z");
  if (manifest.planBoundary?.stage49Defined !== false) errors.push("Stage 49A-49Z must remain undefined");
  if (!manifest.planBoundary?.automaticNextStageDisabled) errors.push("Automatic next stage must remain disabled");
  if (!manifest.planBoundary?.futureNumberedBatchRequiresNewPlanDecision) errors.push("Future numbered batch must require a new plan decision");
  if (!manifest.planBoundary?.repositoryOwnedChecklistOnly) errors.push("Operator acceptance must be repository checklist only");
  if (!manifest.operatorAcceptanceScope?.requiresExternalExecution) errors.push("Operator acceptance must require external execution");
  if (!manifest.operatorAcceptanceScope?.repositoryCanRecordTemplateOnly) errors.push("Repository must record template only");
  if ((manifest.goCriteria || []).length < 6) errors.push("Operator acceptance must include at least six go criteria");
  if ((manifest.noGoCriteria || []).length < 5) errors.push("Operator acceptance must include at least five no-go criteria");
  if (manifest.runtimeBoundary?.runtimeBehaviorAdded !== false) errors.push("Runtime behavior boundary must be false");
  if (manifest.runtimeBoundary?.databaseMigrationAdded !== false) errors.push("Database migration boundary must be false");
  if (manifest.runtimeBoundary?.openApiContractAdded !== false) errors.push("OpenAPI boundary must be false");
  if (manifest.runtimeBoundary?.frontendWorkflowAdded !== false) errors.push("Frontend workflow boundary must be false");
  if (!manifest.privacy?.repositoryMetadataOnly) errors.push("Operator acceptance must be repository metadata only");
  if (manifest.privacy?.medicalCorrectnessProof !== false) errors.push("Operator acceptance must not claim medical correctness proof");
  if (manifest.privacy?.externalApprovalProof !== false) errors.push("Operator acceptance must not claim external approval proof");
  if (manifest.privacy?.legalSufficiencyProof !== false) errors.push("Operator acceptance must not claim legal sufficiency proof");
  if (!manifest.repoOwnedVerification?.includes("npm run preflight:operator-acceptance")) errors.push("Operator acceptance preflight command missing");
}

export function checkOperatorAcceptanceClinicGoNoGo(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) if (!existsSync(join(root, file))) errors.push("Missing required file: " + file);
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  validateManifest(root, errors);
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) if (pattern.test(text)) errors.push(file + " contains forbidden operator acceptance marker: " + pattern);
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkOperatorAcceptanceClinicGoNoGo(process.cwd());
  if (!result.ok) {
    console.error("[operator-acceptance-clinic-go-no-go] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[operator-acceptance-clinic-go-no-go] OK (${result.checkedFiles} files checked)`);
  }
}

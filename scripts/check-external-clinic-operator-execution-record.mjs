#!/usr/bin/env node
// External Clinic Operator Execution Record guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST = "deploy/self-hosted/external-clinic-operator-execution-record.json";
const MEMORY_DOC = "docs/project-memory/EXTERNAL_CLINIC_OPERATOR_EXECUTION_RECORD.md";
const BACKEND_DOC = "docs/backend/external-clinic-operator-execution-record.md";
const WORKFLOW = ".github/workflows/external-clinic-operator-execution-record.yml";
const GUARD = "scripts/check-external-clinic-operator-execution-record.mjs";
const GUARD_TEST = "scripts/check-external-clinic-operator-execution-record.test.mjs";

const REQUIRED_FILES = [
  MANIFEST,
  MEMORY_DOC,
  BACKEND_DOC,
  WORKFLOW,
  GUARD,
  GUARD_TEST,
  "deploy/self-hosted/operator-acceptance-clinic-go-no-go.json",
  "package.json",
  "scripts/preflight-all.mjs",
  "scripts/preflight-all.test.mjs",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  "docs/project-memory/LOVABLE_PROGRESS_LEDGER.md",
  "docs/project-memory/OPERATOR_ACCEPTANCE_CLINIC_GO_NO_GO.md",
];

const REQUIRED_TEXT = {
  [MANIFEST]: [
    "\"id\": \"external-clinic-operator-execution-record\"",
    "\"previousRepositoryArtifact\": \"operator-acceptance-clinic-go-no-go\"",
    "\"repositoryOwnedRecordTemplateOnly\": true",
    "\"sourceChecklist\": \"operator-acceptance-clinic-go-no-go\"",
    "\"requiresExternalExecution\": true",
    "\"repositoryCanRecordTemplateOnly\": true",
    "\"repositoryMustNotStorePatientData\": true",
    "\"realExecutionRequiresExternalArtifact\": true",
    "\"allowedDecisions\": [",
    "\"go\"",
    "\"no-go\"",
    "\"conditional-go\"",
    "\"runtimeBehaviorAdded\": false",
    "\"databaseMigrationAdded\": false",
    "\"openApiContractAdded\": false",
    "\"frontendWorkflowAdded\": false",
    "\"containsPatientData\": false",
    "\"storesSignedApprovalArtifact\": false",
    "\"actualGoLiveDecisionProof\": false",
    "\"expectedConfirmation\": \"Confirmed: External Clinic Operator Execution Record synced from main, no conflicts.\"",
  ],
  [MEMORY_DOC]: [
    "# EXTERNAL_CLINIC_OPERATOR_EXECUTION_RECORD",
    "This is not Stage 49A-49Z.",
    "## Allowed Decisions",
    "## Required External Record Fields",
    "## Repository Intake Rules",
    "## No-Go Triggers",
    "Actual go-live decision proof: false.",
  ],
  [BACKEND_DOC]: [
    "Runtime behavior added: false.",
    "Database migration added: false.",
    "OpenAPI contract added: false.",
    "Frontend workflow added: false.",
    "Actual go-live decision proof: false.",
  ],
  [WORKFLOW]: [
    "name: external-clinic-operator-execution-record",
    "npm run preflight:external-clinic-operator-record",
  ],
  "package.json": [
    "\"test:external-clinic-operator-record\"",
    "\"check:external-clinic-operator-record\"",
    "\"preflight:external-clinic-operator-record\"",
  ],
  "scripts/preflight-all.mjs": [
    "External Clinic Operator Execution Record preflight",
    "preflight:external-clinic-operator-record",
  ],
  "scripts/preflight-all.test.mjs": [
    "External Clinic Operator Execution Record preflight",
    "preflight:external-clinic-operator-record",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "external_clinic_operator_execution_record:",
    "source_checklist: \"operator-acceptance-clinic-go-no-go\"",
    "requires_external_execution: true",
    "repository_can_record_template_only: true",
    "actual_go_live_decision_proof: false",
  ],
  "docs/project-memory/HANDOFF.md": [
    "External Clinic Operator Execution Record is defined",
    "repository records the execution record template only",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "External Clinic Operator Execution Record",
    "external clinic operator execution outcome",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Defined External Clinic Operator Execution Record",
  ],
  "docs/project-memory/RISKS.md": [
    "External clinic operator execution record risks",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "external-clinic-operator-execution-record.json",
    "EXTERNAL_CLINIC_OPERATOR_EXECUTION_RECORD.md",
    "check-external-clinic-operator-execution-record.mjs",
  ],
  "docs/project-memory/LOVABLE_PROGRESS_LEDGER.md": [
    "Confirmed: Operator Acceptance / Clinic Go-No-Go checklist synced from main, no conflicts.",
    "External Clinic Operator Execution Record",
    "ожидается после Lovable sync",
  ],
};

const PROTECTED_FILES = [
  MANIFEST,
  MEMORY_DOC,
  BACKEND_DOC,
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/LOVABLE_PROGRESS_LEDGER.md",
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
  /containsPatientData"\s*:\s*true/i,
  /containsSecrets"\s*:\s*true/i,
  /containsProductionCredentials"\s*:\s*true/i,
  /storesSignedApprovalArtifact"\s*:\s*true/i,
  /medicalCorrectnessProof"\s*:\s*true/i,
  /externalApprovalProof"\s*:\s*true/i,
  /legalSufficiencyProof"\s*:\s*true/i,
  /actualGoLiveDecisionProof"\s*:\s*true/i,
  /actual_go_live_decision_proof:\s*true/i,
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
    errors.push("External clinic operator execution record manifest must be valid JSON");
    return;
  }
  if (manifest.id !== "external-clinic-operator-execution-record") errors.push("External clinic operator execution record manifest id mismatch");
  if (manifest.status !== "ready") errors.push("External clinic operator execution record manifest status must be ready");
  if (manifest.previousRepositoryArtifact !== "operator-acceptance-clinic-go-no-go") errors.push("Execution record must follow operator acceptance checklist");
  if (manifest.planBoundary?.isStage49 !== false) errors.push("Execution record must not be Stage 49A-49Z");
  if (manifest.planBoundary?.stage49Defined !== false) errors.push("Stage 49A-49Z must remain undefined");
  if (!manifest.planBoundary?.automaticNextStageDisabled) errors.push("Automatic next stage must remain disabled");
  if (!manifest.planBoundary?.futureNumberedBatchRequiresNewPlanDecision) errors.push("Future numbered batch must require a new plan decision");
  if (!manifest.planBoundary?.repositoryOwnedRecordTemplateOnly) errors.push("Execution record must be repository record template only");
  if (manifest.executionRecordScope?.sourceChecklist !== "operator-acceptance-clinic-go-no-go") errors.push("Execution record source checklist mismatch");
  if (!manifest.executionRecordScope?.requiresExternalExecution) errors.push("Execution record must require external execution");
  if (!manifest.executionRecordScope?.repositoryCanRecordTemplateOnly) errors.push("Repository must record template only");
  if (!manifest.executionRecordScope?.repositoryMustNotStorePatientData) errors.push("Repository must not store patient data");
  if (!manifest.executionRecordScope?.realExecutionRequiresExternalArtifact) errors.push("Real execution must require an external artifact");
  for (const decision of ["go", "no-go", "conditional-go"]) {
    if (!manifest.allowedDecisions?.includes(decision)) errors.push("Allowed decision missing: " + decision);
  }
  if ((manifest.recordSections || []).length < 6) errors.push("Execution record must include at least six record sections");
  if ((manifest.requiredExternalFields || []).length < 10) errors.push("Execution record must include required external fields");
  if ((manifest.noGoTriggers || []).length < 5) errors.push("Execution record must include at least five no-go triggers");
  if (manifest.runtimeBoundary?.runtimeBehaviorAdded !== false) errors.push("Runtime behavior boundary must be false");
  if (manifest.runtimeBoundary?.databaseMigrationAdded !== false) errors.push("Database migration boundary must be false");
  if (manifest.runtimeBoundary?.openApiContractAdded !== false) errors.push("OpenAPI boundary must be false");
  if (manifest.runtimeBoundary?.frontendWorkflowAdded !== false) errors.push("Frontend workflow boundary must be false");
  if (!manifest.privacy?.repositoryMetadataOnly) errors.push("Execution record must be repository metadata only");
  if (manifest.privacy?.containsSecrets !== false) errors.push("Execution record must not contain secrets");
  if (manifest.privacy?.containsPatientData !== false) errors.push("Execution record must not contain patient data");
  if (manifest.privacy?.containsProductionCredentials !== false) errors.push("Execution record must not contain production credentials");
  if (manifest.privacy?.storesSignedApprovalArtifact !== false) errors.push("Execution record must not store signed approval artifacts");
  if (manifest.privacy?.medicalCorrectnessProof !== false) errors.push("Execution record must not claim medical correctness proof");
  if (manifest.privacy?.externalApprovalProof !== false) errors.push("Execution record must not claim external approval proof");
  if (manifest.privacy?.legalSufficiencyProof !== false) errors.push("Execution record must not claim legal sufficiency proof");
  if (manifest.privacy?.actualGoLiveDecisionProof !== false) errors.push("Execution record must not claim actual go-live proof");
  if (!manifest.repoOwnedVerification?.includes("npm run preflight:external-clinic-operator-record")) errors.push("External clinic operator record preflight command missing");
}

export function checkExternalClinicOperatorExecutionRecord(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) if (!existsSync(join(root, file))) errors.push("Missing required file: " + file);
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  validateManifest(root, errors);
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) if (pattern.test(text)) errors.push(file + " contains forbidden external clinic operator record marker: " + pattern);
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkExternalClinicOperatorExecutionRecord(process.cwd());
  if (!result.ok) {
    console.error("[external-clinic-operator-execution-record] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[external-clinic-operator-execution-record] OK (${result.checkedFiles} files checked)`);
  }
}

#!/usr/bin/env node
// Stage 18A-18Z · Clinical follow-up operations hardening guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-operations.stage18a-18z.json",
  "backend/self-hosted/db/migrations/0025_stage18_followup_operations_hardening.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage18a-18z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-18a-18z-clinical-followup-operations-hardening.md",
  ".github/workflows/stage18a-18z-clinical-followup-operations-hardening.yml",
  "package.json",
  "scripts/preflight-all.mjs",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md"
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/clinical-followup-operations.stage18a-18z.json": [
    "\"stage\": \"18A-18Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 18A-18Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0025_stage18_followup_operations_hardening.sql": [
    "clinical_follow_up_operations_events",
    "triage_state",
    "delivery_evidence",
    "idx_clinical_follow_up_tasks_ops_queue"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildListClinicalFollowUpOperationsSql",
    "buildClinicalFollowUpOperationsSummarySql",
    "buildUpdateClinicalFollowUpOperationsSql",
    "clinical_follow_up_operations_events"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpOperationsUpdatePayload",
    "clinical_follow_up.operations.list",
    "clinical_follow_up.operations.summary",
    "clinical_follow_up.operations.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/operations",
    "/api/v1/clinical/follow-ups/operations/summary",
    "openapi.stage18a-18z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "listSelfHostedClinicalFollowUpOperations",
    "getSelfHostedClinicalFollowUpOperationsSummary",
    "updateSelfHostedClinicalFollowUpOperations"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Операционный контроль",
    "updateSelfHostedClinicalFollowUpOperations"
  ],
  "docs/backend/stage-18a-18z-clinical-followup-operations-hardening.md": [
    "Stage 18A-18Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage18a-18z-clinical-followup-operations-hardening.yml": [
    "name: stage18a-18z-clinical-followup-operations-hardening",
    "npm run preflight:stage18a-18z"
  ],
  "package.json": [
    "\"test:stage18a-18z\"",
    "\"check:stage18a-18z\"",
    "\"preflight:stage18a-18z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 18A-18Z clinical follow-up operations hardening preflight",
    "preflight:stage18a-18z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 18A-18Z",
    "clinical_followup_operations_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 18A-18Z",
    "follow-up operations"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 18A-18Z",
    "Stage 19A-19Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 18A-18Z",
    "operations hardening"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 18A-18Z",
    "notification provider"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-operations.stage18a-18z.json",
    "stage-18a-18z-clinical-followup-operations-hardening.md",
    "check-stage18a-18z-clinical-followup-operations-hardening.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-operations.stage18a-18z.json",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-18a-18z-clinical-followup-operations-hardening.md"
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
  /vendor\s+(sms|email|notification)/i
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
  const file = "deploy/self-hosted/clinical-followup-operations.stage18a-18z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "18A-18Z") errors.push("Stage 18 manifest stage must be 18A-18Z");
  if (manifest.previousBatch !== "Stage 17A-17Z") errors.push("Stage 18 previous batch must be Stage 17A-17Z");
  if (manifest.nextBatchHypothesis !== "Stage 19A-19Z") errors.push("Stage 18 must record Stage 19A-19Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 8) errors.push("Stage 18 must include at least 8 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 18 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 18 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 18 managed notification dependency must be none");
  if (!manifest.privacy?.operationsEvidenceIsLocalMetadataOnly) errors.push("Stage 18 operations evidence must be local metadata only");
  if (!manifest.verification?.preflight?.includes("preflight:stage18a-18z")) errors.push("Stage 18 preflight command missing");
}

export function checkStage18A18Z(root = process.cwd()) {
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
  const result = checkStage18A18Z(process.cwd());
  if (!result.ok) {
    console.error("[stage18a-18z-clinical-followup-operations-hardening] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage18a-18z-clinical-followup-operations-hardening] OK (${result.checkedFiles} files checked)`);
}

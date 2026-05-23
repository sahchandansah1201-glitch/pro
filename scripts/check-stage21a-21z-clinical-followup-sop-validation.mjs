#!/usr/bin/env node
// Stage 21A-21Z · Clinical follow-up clinic-specific SOP validation guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-validation.stage21a-21z.json",
  "backend/self-hosted/db/migrations/0028_stage21_followup_sop_validation.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage21a-21z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-21a-21z-clinical-followup-sop-validation.md",
  ".github/workflows/stage21a-21z-clinical-followup-sop-validation.yml",
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
  "deploy/self-hosted/clinical-followup-sop-validation.stage21a-21z.json": [
    "\"stage\": \"21A-21Z\"",
    "\"previousBatch\": \"Stage 20A-20Z\"",
    "\"nextBatchHypothesis\": \"Stage 22A-22Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 21A-21Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0028_stage21_followup_sop_validation.sql": [
    "sop_validation_state",
    "sop_policy_version",
    "clinical_follow_up_sop_validation_events",
    "idx_clinical_follow_up_tasks_sop_validation_queue"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopValidationSummarySql",
    "buildUpdateClinicalFollowUpSopValidationSql",
    "clinical_follow_up_sop_validation_events"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopValidationUpdatePayload",
    "clinical_follow_up.sop_validation.summary",
    "clinical_follow_up.sop_validation.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-validation/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-validation",
    "openapi.stage21a-21z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage21a-21z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopValidationSummary",
    "updateSelfHostedClinicalFollowUpSopValidation",
    "FollowUpSopValidationSummary"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "SOP validation",
    "updateSelfHostedClinicalFollowUpSopValidation"
  ],
  "docs/backend/stage-21a-21z-clinical-followup-sop-validation.md": [
    "Stage 21A-21Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage21a-21z-clinical-followup-sop-validation.yml": [
    "name: stage21a-21z-clinical-followup-sop-validation",
    "npm run preflight:stage21a-21z"
  ],
  "package.json": [
    "\"test:stage21a-21z\"",
    "\"check:stage21a-21z\"",
    "\"preflight:stage21a-21z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 21A-21Z clinical follow-up SOP validation preflight",
    "preflight:stage21a-21z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 21A-21Z",
    "clinical_followup_sop_validation_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 21A-21Z",
    "SOP validation"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 21A-21Z",
    "Stage 22A-22Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 21A-21Z",
    "SOP validation"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 21A-21Z",
    "SOP validation"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-validation.stage21a-21z.json",
    "stage-21a-21z-clinical-followup-sop-validation.md",
    "check-stage21a-21z-clinical-followup-sop-validation.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-validation.stage21a-21z.json",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-21a-21z-clinical-followup-sop-validation.md"
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
  /external\s+sop\s+completion\s+proof/i
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
  const file = "deploy/self-hosted/clinical-followup-sop-validation.stage21a-21z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "21A-21Z") errors.push("Stage 21 manifest stage must be 21A-21Z");
  if (manifest.previousBatch !== "Stage 20A-20Z") errors.push("Stage 21 previous batch must be Stage 20A-20Z");
  if (manifest.nextBatchHypothesis !== "Stage 22A-22Z") errors.push("Stage 21 must record Stage 22A-22Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 8) errors.push("Stage 21 must include at least 8 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 21 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 21 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 21 managed notification dependency must be none");
  if (!manifest.privacy?.sopValidationEvidenceIsLocalMetadataOnly) errors.push("Stage 21 SOP validation evidence must be local metadata only");
  if (!manifest.privacy?.clinicSpecificSopIsNotExternalProof) errors.push("Stage 21 clinic SOP boundary must avoid external proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage21a-21z")) errors.push("Stage 21 preflight command missing");
}

export function checkStage21A21Z(root = process.cwd()) {
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
  const result = checkStage21A21Z(process.cwd());
  if (!result.ok) {
    console.error("[stage21a-21z-clinical-followup-sop-validation] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage21a-21z-clinical-followup-sop-validation] OK (${result.checkedFiles} files checked)`);
}

#!/usr/bin/env node
// Stage 20A-20Z · Clinical follow-up retention and clinic review guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-retention-clinic-review.stage20a-20z.json",
  "backend/self-hosted/db/migrations/0027_stage20_followup_retention_clinic_review.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage20a-20z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-20a-20z-clinical-followup-retention-clinic-review.md",
  ".github/workflows/stage20a-20z-clinical-followup-retention-clinic-review.yml",
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
  "deploy/self-hosted/clinical-followup-retention-clinic-review.stage20a-20z.json": [
    "\"stage\": \"20A-20Z\"",
    "\"previousBatch\": \"Stage 19A-19Z\"",
    "\"nextBatchHypothesis\": \"Stage 21A-21Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 20A-20Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0027_stage20_followup_retention_clinic_review.sql": [
    "retention_review_state",
    "clinic_review_state",
    "clinical_follow_up_retention_review_events",
    "idx_clinical_follow_up_tasks_retention_review_queue"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpClinicReviewSummarySql",
    "buildUpdateClinicalFollowUpClinicReviewSql",
    "clinical_follow_up_retention_review_events"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpClinicReviewUpdatePayload",
    "clinical_follow_up.clinic_review.summary",
    "clinical_follow_up.clinic_review.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/clinic-review/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/clinic-review",
    "openapi.stage20a-20z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage20a-20z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpClinicReviewSummary",
    "updateSelfHostedClinicalFollowUpClinicReview",
    "FollowUpClinicReviewSummary"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Retention и clinic review",
    "updateSelfHostedClinicalFollowUpClinicReview"
  ],
  "docs/backend/stage-20a-20z-clinical-followup-retention-clinic-review.md": [
    "Stage 20A-20Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage20a-20z-clinical-followup-retention-clinic-review.yml": [
    "name: stage20a-20z-clinical-followup-retention-clinic-review",
    "npm run preflight:stage20a-20z"
  ],
  "package.json": [
    "\"test:stage20a-20z\"",
    "\"check:stage20a-20z\"",
    "\"preflight:stage20a-20z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 20A-20Z clinical follow-up retention clinic review preflight",
    "preflight:stage20a-20z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 20A-20Z",
    "clinical_followup_retention_clinic_review_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 20A-20Z",
    "retention and clinic review"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 20A-20Z",
    "Stage 21A-21Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 20A-20Z",
    "retention clinic review"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 20A-20Z",
    "retention review"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-retention-clinic-review.stage20a-20z.json",
    "stage-20a-20z-clinical-followup-retention-clinic-review.md",
    "check-stage20a-20z-clinical-followup-retention-clinic-review.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-retention-clinic-review.stage20a-20z.json",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-20a-20z-clinical-followup-retention-clinic-review.md"
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
  const file = "deploy/self-hosted/clinical-followup-retention-clinic-review.stage20a-20z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "20A-20Z") errors.push("Stage 20 manifest stage must be 20A-20Z");
  if (manifest.previousBatch !== "Stage 19A-19Z") errors.push("Stage 20 previous batch must be Stage 19A-19Z");
  if (manifest.nextBatchHypothesis !== "Stage 21A-21Z") errors.push("Stage 20 must record Stage 21A-21Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 8) errors.push("Stage 20 must include at least 8 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 20 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 20 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 20 managed notification dependency must be none");
  if (!manifest.privacy?.retentionEvidenceIsLocalMetadataOnly) errors.push("Stage 20 retention evidence must be local metadata only");
  if (!manifest.privacy?.clinicReviewEvidenceIsLocalMetadataOnly) errors.push("Stage 20 clinic review evidence must be local metadata only");
  if (!manifest.verification?.preflight?.includes("preflight:stage20a-20z")) errors.push("Stage 20 preflight command missing");
}

export function checkStage20A20Z(root = process.cwd()) {
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
  const result = checkStage20A20Z(process.cwd());
  if (!result.ok) {
    console.error("[stage20a-20z-clinical-followup-retention-clinic-review] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage20a-20z-clinical-followup-retention-clinic-review] OK (${result.checkedFiles} files checked)`);
}

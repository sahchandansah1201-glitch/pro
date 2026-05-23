#!/usr/bin/env node
// Stage 19A-19Z · Clinical follow-up outcome and quality guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-outcome-quality.stage19a-19z.json",
  "backend/self-hosted/db/migrations/0026_stage19_followup_outcome_quality.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage19a-19z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-19a-19z-clinical-followup-outcome-quality.md",
  ".github/workflows/stage19a-19z-clinical-followup-outcome-quality.yml",
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
  "deploy/self-hosted/clinical-followup-outcome-quality.stage19a-19z.json": [
    "\"stage\": \"19A-19Z\"",
    "\"previousBatch\": \"Stage 18A-18Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 19A-19Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0026_stage19_followup_outcome_quality.sql": [
    "clinical_follow_up_quality_events",
    "resolution_outcome",
    "quality_review_state",
    "idx_clinical_follow_up_tasks_quality_queue"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpOutcomeQualitySummarySql",
    "buildUpdateClinicalFollowUpQualitySql",
    "clinical_follow_up_quality_events"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpQualityUpdatePayload",
    "clinical_follow_up.outcomes.summary",
    "clinical_follow_up.quality.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/outcomes/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/quality",
    "openapi.stage19a-19z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpOutcomeQualitySummary",
    "updateSelfHostedClinicalFollowUpQuality",
    "FollowUpOutcomeQualitySummary"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Качество закрытия follow-up",
    "updateSelfHostedClinicalFollowUpQuality"
  ],
  "docs/backend/stage-19a-19z-clinical-followup-outcome-quality.md": [
    "Stage 19A-19Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage19a-19z-clinical-followup-outcome-quality.yml": [
    "name: stage19a-19z-clinical-followup-outcome-quality",
    "npm run preflight:stage19a-19z"
  ],
  "package.json": [
    "\"test:stage19a-19z\"",
    "\"check:stage19a-19z\"",
    "\"preflight:stage19a-19z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 19A-19Z clinical follow-up outcome quality preflight",
    "preflight:stage19a-19z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 19A-19Z",
    "clinical_followup_outcome_quality_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 19A-19Z",
    "outcome and quality"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 19A-19Z",
    "Stage 20A-20Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 19A-19Z",
    "outcome quality"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 19A-19Z",
    "quality review"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-outcome-quality.stage19a-19z.json",
    "stage-19a-19z-clinical-followup-outcome-quality.md",
    "check-stage19a-19z-clinical-followup-outcome-quality.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-outcome-quality.stage19a-19z.json",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-19a-19z-clinical-followup-outcome-quality.md"
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
  const file = "deploy/self-hosted/clinical-followup-outcome-quality.stage19a-19z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "19A-19Z") errors.push("Stage 19 manifest stage must be 19A-19Z");
  if (manifest.previousBatch !== "Stage 18A-18Z") errors.push("Stage 19 previous batch must be Stage 18A-18Z");
  if (manifest.nextBatchHypothesis !== "Stage 20A-20Z") errors.push("Stage 19 must record Stage 20A-20Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 8) errors.push("Stage 19 must include at least 8 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 19 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 19 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 19 managed notification dependency must be none");
  if (!manifest.privacy?.qualityEvidenceIsLocalMetadataOnly) errors.push("Stage 19 quality evidence must be local metadata only");
  if (!manifest.verification?.preflight?.includes("preflight:stage19a-19z")) errors.push("Stage 19 preflight command missing");
}

export function checkStage19A19Z(root = process.cwd()) {
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
  const result = checkStage19A19Z(process.cwd());
  if (!result.ok) {
    console.error("[stage19a-19z-clinical-followup-outcome-quality] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage19a-19z-clinical-followup-outcome-quality] OK (${result.checkedFiles} files checked)`);
}

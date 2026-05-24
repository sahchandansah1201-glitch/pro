#!/usr/bin/env node
// Stage 23A-23Z · Clinical follow-up local SOP policy application guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-application.stage23a-23z.json",
  "backend/self-hosted/db/migrations/0030_stage23_followup_sop_policy_application.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage23a-23z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-23a-23z-clinical-followup-sop-policy-application.md",
  ".github/workflows/stage23a-23z-clinical-followup-sop-policy-application.yml",
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
  "deploy/self-hosted/clinical-followup-sop-policy-application.stage23a-23z.json": [
    "\"stage\": \"23A-23Z\"",
    "\"previousBatch\": \"Stage 22A-22Z\"",
    "\"nextBatchHypothesis\": \"Stage 24A-24Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 23A-23Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0030_stage23_followup_sop_policy_application.sql": [
    "sop_policy_template_id",
    "sop_policy_drift_state",
    "clinical_follow_up_sop_policy_application_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyApplicationSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyApplicationSql",
    "getClinicalFollowUpSopPolicyApplicationSummary",
    "updateClinicalFollowUpSopPolicyApplication"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyApplicationPayload",
    "clinical_follow_up.sop_policy_application.summary",
    "clinical_follow_up.sop_policy_application.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-application/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-application",
    "openapi.stage23a-23z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage23a-23z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyApplicationSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyApplication",
    "FollowUpSopPolicyApplicationSummary",
    "FollowUpSopPolicyDriftState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Apply policy",
    "Drift review",
    "sopPolicyApplicationSummary"
  ],
  "docs/backend/stage-23a-23z-clinical-followup-sop-policy-application.md": [
    "Stage 23A-23Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage23a-23z-clinical-followup-sop-policy-application.yml": [
    "name: stage23a-23z-clinical-followup-sop-policy-application",
    "npm run preflight:stage23a-23z"
  ],
  "package.json": [
    "\"test:stage23a-23z\"",
    "\"check:stage23a-23z\"",
    "\"preflight:stage23a-23z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 23A-23Z clinical follow-up SOP policy application preflight",
    "preflight:stage23a-23z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 23A-23Z",
    "clinical_followup_sop_policy_application_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 23A-23Z",
    "SOP policy application"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 23A-23Z",
    "Stage 24A-24Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 23A-23Z",
    "SOP policy application"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 23A-23Z",
    "SOP policy application"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-application.stage23a-23z.json",
    "stage-23a-23z-clinical-followup-sop-policy-application.md",
    "check-stage23a-23z-clinical-followup-sop-policy-application.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-application.stage23a-23z.json",
  "backend/self-hosted/db/migrations/0030_stage23_followup_sop_policy_application.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-23a-23z-clinical-followup-sop-policy-application.md"
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
  /external\s+sop\s+(completion|approval)\s+proof/i
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-application.stage23a-23z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "23A-23Z") errors.push("Stage 23 manifest stage must be 23A-23Z");
  if (manifest.previousBatch !== "Stage 22A-22Z") errors.push("Stage 23 previous batch must be Stage 22A-22Z");
  if (manifest.nextBatchHypothesis !== "Stage 24A-24Z") errors.push("Stage 23 must record Stage 24A-24Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 9) errors.push("Stage 23 must include at least 9 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 23 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 23 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 23 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyApplicationIsLocalMetadataOnly) errors.push("Stage 23 SOP policy application must be local metadata only");
  if (!manifest.privacy?.clinicSpecificSopIsNotExternalProof) errors.push("Stage 23 clinic SOP boundary must avoid external proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage23a-23z")) errors.push("Stage 23 preflight command missing");
}

export function checkStage23A23Z(root = process.cwd()) {
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
  const result = checkStage23A23Z(process.cwd());
  if (!result.ok) {
    console.error("[stage23a-23z-clinical-followup-sop-policy-application] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage23a-23z-clinical-followup-sop-policy-application] OK (${result.checkedFiles} files checked)`);
}

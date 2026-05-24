#!/usr/bin/env node
// Stage 24A-24Z · Clinical follow-up local SOP policy exception closure guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-exception-closure.stage24a-24z.json",
  "backend/self-hosted/db/migrations/0031_stage24_followup_sop_policy_exception_closure.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage24a-24z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-24a-24z-clinical-followup-sop-policy-exception-closure.md",
  ".github/workflows/stage24a-24z-clinical-followup-sop-policy-exception-closure.yml",
  "scripts/check-stage24a-24z-clinical-followup-sop-policy-exception-closure.mjs",
  "scripts/check-stage24a-24z-clinical-followup-sop-policy-exception-closure.test.mjs",
  "package.json",
  "scripts/preflight-all.mjs",
  "scripts/preflight-all.test.mjs",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md"
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/clinical-followup-sop-policy-exception-closure.stage24a-24z.json": [
    "\"stage\": \"24A-24Z\"",
    "\"previousBatch\": \"Stage 23A-23Z\"",
    "\"nextBatchHypothesis\": \"Stage 25A-25Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 24A-24Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0031_stage24_followup_sop_policy_exception_closure.sql": [
    "sop_policy_exception_state",
    "sop_policy_exception_resolution",
    "clinical_follow_up_sop_policy_exception_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyExceptionClosureSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyExceptionClosureSql",
    "getClinicalFollowUpSopPolicyExceptionClosureSummary",
    "updateClinicalFollowUpSopPolicyExceptionClosure"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyExceptionClosurePayload",
    "clinical_follow_up.sop_policy_exception_closure.summary",
    "clinical_follow_up.sop_policy_exception_closure.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-exceptions/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-exception",
    "openapi.stage24a-24z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage24a-24z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyExceptionClosureSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyExceptionClosure",
    "FollowUpSopPolicyExceptionClosureSummary",
    "FollowUpSopPolicyExceptionState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Open exception",
    "Close exception",
    "sopPolicyExceptionClosureSummary"
  ],
  "docs/backend/stage-24a-24z-clinical-followup-sop-policy-exception-closure.md": [
    "Stage 24A-24Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage24a-24z-clinical-followup-sop-policy-exception-closure.yml": [
    "name: stage24a-24z-clinical-followup-sop-policy-exception-closure",
    "npm run preflight:stage24a-24z"
  ],
  "package.json": [
    "\"test:stage24a-24z\"",
    "\"check:stage24a-24z\"",
    "\"preflight:stage24a-24z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 24A-24Z clinical follow-up SOP policy exception closure preflight",
    "preflight:stage24a-24z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 24A-24Z clinical follow-up SOP policy exception closure preflight",
    "preflight:stage24a-24z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 24A-24Z",
    "clinical_followup_sop_policy_exception_closure_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 24A-24Z",
    "SOP policy exception closure"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 24A-24Z",
    "Stage 25A-25Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 24A-24Z",
    "SOP policy exception closure"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 24A-24Z",
    "SOP policy exception closure"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-exception-closure.stage24a-24z.json",
    "stage-24a-24z-clinical-followup-sop-policy-exception-closure.md",
    "check-stage24a-24z-clinical-followup-sop-policy-exception-closure.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-exception-closure.stage24a-24z.json",
  "backend/self-hosted/db/migrations/0031_stage24_followup_sop_policy_exception_closure.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-24a-24z-clinical-followup-sop-policy-exception-closure.md"
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
  /external\s+sop\s+(completion|approval)\s+proof/i,
  /medical\s+correctness\s+(proof|verification|guarantee)/i
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-exception-closure.stage24a-24z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "24A-24Z") errors.push("Stage 24 manifest stage must be 24A-24Z");
  if (manifest.previousBatch !== "Stage 23A-23Z") errors.push("Stage 24 previous batch must be Stage 23A-23Z");
  if (manifest.nextBatchHypothesis !== "Stage 25A-25Z") errors.push("Stage 24 must record Stage 25A-25Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 9) errors.push("Stage 24 must include at least 9 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 24 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 24 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 24 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyExceptionClosureIsLocalMetadataOnly) errors.push("Stage 24 SOP policy exception closure must be local metadata only");
  if (!manifest.privacy?.clinicSpecificSopIsNotExternalProof) errors.push("Stage 24 clinic SOP boundary must avoid external proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage24a-24z")) errors.push("Stage 24 preflight command missing");
}

export function checkStage24A24Z(root = process.cwd()) {
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
  const result = checkStage24A24Z(process.cwd());
  if (!result.ok) {
    console.error("[stage24a-24z-clinical-followup-sop-policy-exception-closure] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage24a-24z-clinical-followup-sop-policy-exception-closure] OK (${result.checkedFiles} files checked)`);
}

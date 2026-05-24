#!/usr/bin/env node
// Stage 27A-27Z - Clinical follow-up local SOP policy governance closure guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-closure.stage27a-27z.json",
  "backend/self-hosted/db/migrations/0034_stage27_followup_sop_policy_governance_closure.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage27a-27z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-27a-27z-clinical-followup-sop-policy-governance-closure.md",
  ".github/workflows/stage27a-27z-clinical-followup-sop-policy-governance-closure.yml",
  "scripts/check-stage27a-27z-clinical-followup-sop-policy-governance-closure.mjs",
  "scripts/check-stage27a-27z-clinical-followup-sop-policy-governance-closure.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-closure.stage27a-27z.json": [
    "\"stage\": \"27A-27Z\"",
    "\"previousBatch\": \"Stage 26A-26Z\"",
    "\"nextBatchHypothesis\": \"Stage 28A-28Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 27A-27Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0034_stage27_followup_sop_policy_governance_closure.sql": [
    "sop_policy_governance_closure_state",
    "sop_policy_governance_closed_at",
    "clinical_follow_up_sop_policy_governance_closure_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceClosureSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceClosureSql",
    "getClinicalFollowUpSopPolicyGovernanceClosureSummary",
    "updateClinicalFollowUpSopPolicyGovernanceClosure"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceClosurePayload",
    "clinical_follow_up.sop_policy_governance_closure.summary",
    "clinical_follow_up.sop_policy_governance_closure.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-closure",
    "openapi.stage27a-27z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage27a-27z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceClosureSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure",
    "FollowUpSopPolicyGovernanceClosureSummary",
    "FollowUpSopPolicyGovernanceClosureState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Close governance",
    "Closure follow-up",
    "sopPolicyGovernanceClosureSummary"
  ],
  "docs/backend/stage-27a-27z-clinical-followup-sop-policy-governance-closure.md": [
    "Stage 27A-27Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage27a-27z-clinical-followup-sop-policy-governance-closure.yml": [
    "name: stage27a-27z-clinical-followup-sop-policy-governance-closure",
    "npm run preflight:stage27a-27z"
  ],
  "package.json": [
    "\"test:stage27a-27z\"",
    "\"check:stage27a-27z\"",
    "\"preflight:stage27a-27z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 27A-27Z clinical follow-up SOP policy governance closure preflight",
    "preflight:stage27a-27z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 27A-27Z clinical follow-up SOP policy governance closure preflight",
    "preflight:stage27a-27z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 27A-27Z",
    "clinical_followup_sop_policy_governance_closure_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 27A-27Z",
    "SOP policy governance closure"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 27A-27Z",
    "Stage 28A-28Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 27A-27Z",
    "SOP policy governance closure"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 27A-27Z",
    "SOP policy governance closure"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-closure.stage27a-27z.json",
    "stage-27a-27z-clinical-followup-sop-policy-governance-closure.md",
    "check-stage27a-27z-clinical-followup-sop-policy-governance-closure.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-closure.stage27a-27z.json",
  "backend/self-hosted/db/migrations/0034_stage27_followup_sop_policy_governance_closure.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-27a-27z-clinical-followup-sop-policy-governance-closure.md"
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
  /external\s+governance\s+(approval|sign-off)\s+proof/i,
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-closure.stage27a-27z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "27A-27Z") errors.push("Stage 27 manifest stage must be 27A-27Z");
  if (manifest.previousBatch !== "Stage 26A-26Z") errors.push("Stage 27 previous batch must be Stage 26A-26Z");
  if (manifest.nextBatchHypothesis !== "Stage 28A-28Z") errors.push("Stage 27 must record Stage 28A-28Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 9) errors.push("Stage 27 must include at least 9 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 27 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 27 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 27 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceClosureIsLocalMetadataOnly) errors.push("Stage 27 governance closure must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceClosureIsNotExternalApprovalProof) errors.push("Stage 27 governance closure boundary must avoid external approval proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage27a-27z")) errors.push("Stage 27 preflight command missing");
}

export function checkStage27A27Z(root = process.cwd()) {
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
  const result = checkStage27A27Z(process.cwd());
  if (!result.ok) {
    console.error("[stage27a-27z-clinical-followup-sop-policy-governance-closure] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage27a-27z-clinical-followup-sop-policy-governance-closure] OK (${result.checkedFiles} files checked)`);
}

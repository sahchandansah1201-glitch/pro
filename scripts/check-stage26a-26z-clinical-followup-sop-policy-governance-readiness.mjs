#!/usr/bin/env node
// Stage 26A-26Z - Clinical follow-up local SOP policy governance readiness guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-readiness.stage26a-26z.json",
  "backend/self-hosted/db/migrations/0033_stage26_followup_sop_policy_governance_readiness.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage26a-26z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-26a-26z-clinical-followup-sop-policy-governance-readiness.md",
  ".github/workflows/stage26a-26z-clinical-followup-sop-policy-governance-readiness.yml",
  "scripts/check-stage26a-26z-clinical-followup-sop-policy-governance-readiness.mjs",
  "scripts/check-stage26a-26z-clinical-followup-sop-policy-governance-readiness.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-readiness.stage26a-26z.json": [
    "\"stage\": \"26A-26Z\"",
    "\"previousBatch\": \"Stage 25A-25Z\"",
    "\"nextBatchHypothesis\": \"Stage 27A-27Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 26A-26Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0033_stage26_followup_sop_policy_governance_readiness.sql": [
    "sop_policy_governance_state",
    "sop_policy_governance_reviewed_at",
    "clinical_follow_up_sop_policy_governance_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceReadinessSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceReadinessSql",
    "getClinicalFollowUpSopPolicyGovernanceReadinessSummary",
    "updateClinicalFollowUpSopPolicyGovernanceReadiness"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceReadinessPayload",
    "clinical_follow_up.sop_policy_governance_readiness.summary",
    "clinical_follow_up.sop_policy_governance_readiness.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance",
    "openapi.stage26a-26z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage26a-26z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceReadinessSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceReadiness",
    "FollowUpSopPolicyGovernanceReadinessSummary",
    "FollowUpSopPolicyGovernanceState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Governance reviewed",
    "Governance follow-up",
    "sopPolicyGovernanceReadinessSummary"
  ],
  "docs/backend/stage-26a-26z-clinical-followup-sop-policy-governance-readiness.md": [
    "Stage 26A-26Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage26a-26z-clinical-followup-sop-policy-governance-readiness.yml": [
    "name: stage26a-26z-clinical-followup-sop-policy-governance-readiness",
    "npm run preflight:stage26a-26z"
  ],
  "package.json": [
    "\"test:stage26a-26z\"",
    "\"check:stage26a-26z\"",
    "\"preflight:stage26a-26z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 26A-26Z clinical follow-up SOP policy governance readiness preflight",
    "preflight:stage26a-26z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 26A-26Z clinical follow-up SOP policy governance readiness preflight",
    "preflight:stage26a-26z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 26A-26Z",
    "clinical_followup_sop_policy_governance_readiness_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 26A-26Z",
    "SOP policy governance readiness"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 26A-26Z",
    "Stage 27A-27Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 26A-26Z",
    "SOP policy governance readiness"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 26A-26Z",
    "SOP policy governance readiness"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-readiness.stage26a-26z.json",
    "stage-26a-26z-clinical-followup-sop-policy-governance-readiness.md",
    "check-stage26a-26z-clinical-followup-sop-policy-governance-readiness.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-readiness.stage26a-26z.json",
  "backend/self-hosted/db/migrations/0033_stage26_followup_sop_policy_governance_readiness.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-26a-26z-clinical-followup-sop-policy-governance-readiness.md"
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-readiness.stage26a-26z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "26A-26Z") errors.push("Stage 26 manifest stage must be 26A-26Z");
  if (manifest.previousBatch !== "Stage 25A-25Z") errors.push("Stage 26 previous batch must be Stage 25A-25Z");
  if (manifest.nextBatchHypothesis !== "Stage 27A-27Z") errors.push("Stage 26 must record Stage 27A-27Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 9) errors.push("Stage 26 must include at least 9 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 26 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 26 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 26 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceReadinessIsLocalMetadataOnly) errors.push("Stage 26 governance readiness must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceIsNotExternalApprovalProof) errors.push("Stage 26 clinic governance boundary must avoid external approval proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage26a-26z")) errors.push("Stage 26 preflight command missing");
}

export function checkStage26A26Z(root = process.cwd()) {
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
  const result = checkStage26A26Z(process.cwd());
  if (!result.ok) {
    console.error("[stage26a-26z-clinical-followup-sop-policy-governance-readiness] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage26a-26z-clinical-followup-sop-policy-governance-readiness] OK (${result.checkedFiles} files checked)`);
}

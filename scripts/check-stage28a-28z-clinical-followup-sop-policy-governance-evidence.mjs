#!/usr/bin/env node
// Stage 28A-28Z - Clinical follow-up local SOP policy governance evidence export guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence.stage28a-28z.json",
  "backend/self-hosted/db/migrations/0035_stage28_followup_sop_policy_governance_evidence.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage28a-28z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-28a-28z-clinical-followup-sop-policy-governance-evidence.md",
  ".github/workflows/stage28a-28z-clinical-followup-sop-policy-governance-evidence.yml",
  "scripts/check-stage28a-28z-clinical-followup-sop-policy-governance-evidence.mjs",
  "scripts/check-stage28a-28z-clinical-followup-sop-policy-governance-evidence.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence.stage28a-28z.json": [
    "\"stage\": \"28A-28Z\"",
    "\"previousBatch\": \"Stage 27A-27Z\"",
    "\"nextBatchHypothesis\": \"Stage 29A-29Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 28A-28Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0035_stage28_followup_sop_policy_governance_evidence.sql": [
    "sop_policy_governance_evidence_state",
    "sop_policy_governance_evidence_reviewed_at",
    "clinical_follow_up_sop_policy_governance_evidence_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidence"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidencePayload",
    "clinical_follow_up.sop_policy_governance_evidence.summary",
    "clinical_follow_up.sop_policy_governance_evidence.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence",
    "openapi.stage28a-28z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage28a-28z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidence",
    "FollowUpSopPolicyGovernanceEvidenceSummary",
    "FollowUpSopPolicyGovernanceEvidenceState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Export evidence",
    "Evidence follow-up",
    "sopPolicyGovernanceEvidenceSummary"
  ],
  "docs/backend/stage-28a-28z-clinical-followup-sop-policy-governance-evidence.md": [
    "Stage 28A-28Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage28a-28z-clinical-followup-sop-policy-governance-evidence.yml": [
    "name: stage28a-28z-clinical-followup-sop-policy-governance-evidence",
    "npm run preflight:stage28a-28z"
  ],
  "package.json": [
    "\"test:stage28a-28z\"",
    "\"check:stage28a-28z\"",
    "\"preflight:stage28a-28z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 28A-28Z clinical follow-up SOP policy governance evidence preflight",
    "preflight:stage28a-28z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 28A-28Z clinical follow-up SOP policy governance evidence preflight",
    "preflight:stage28a-28z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 28A-28Z",
    "clinical_followup_sop_policy_governance_evidence_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 28A-28Z",
    "SOP policy governance evidence"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 28A-28Z",
    "Stage 29A-29Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 28A-28Z",
    "SOP policy governance evidence"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 28A-28Z",
    "SOP policy governance evidence"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence.stage28a-28z.json",
    "stage-28a-28z-clinical-followup-sop-policy-governance-evidence.md",
    "check-stage28a-28z-clinical-followup-sop-policy-governance-evidence.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence.stage28a-28z.json",
  "backend/self-hosted/db/migrations/0035_stage28_followup_sop_policy_governance_evidence.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-28a-28z-clinical-followup-sop-policy-governance-evidence.md"
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence.stage28a-28z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "28A-28Z") errors.push("Stage 28 manifest stage must be 28A-28Z");
  if (manifest.previousBatch !== "Stage 27A-27Z") errors.push("Stage 28 previous batch must be Stage 27A-27Z");
  if (manifest.nextBatchHypothesis !== "Stage 29A-29Z") errors.push("Stage 28 must record Stage 29A-29Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 28 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 28 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 28 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 28 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceIsLocalMetadataOnly) errors.push("Stage 28 governance evidence must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceEvidenceIsNotExternalApprovalProof) errors.push("Stage 28 governance evidence boundary must avoid external approval proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage28a-28z")) errors.push("Stage 28 preflight command missing");
}

export function checkStage28A28Z(root = process.cwd()) {
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
  const result = checkStage28A28Z(process.cwd());
  if (!result.ok) {
    console.error("[stage28a-28z-clinical-followup-sop-policy-governance-evidence] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage28a-28z-clinical-followup-sop-policy-governance-evidence] OK (${result.checkedFiles} files checked)`);
}

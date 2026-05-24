#!/usr/bin/env node
// Stage 29A-29Z - Clinical follow-up local SOP policy governance evidence reconciliation guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation.stage29a-29z.json",
  "backend/self-hosted/db/migrations/0036_stage29_followup_sop_policy_governance_evidence_reconciliation.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage29a-29z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.md",
  ".github/workflows/stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.yml",
  "scripts/check-stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.mjs",
  "scripts/check-stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation.stage29a-29z.json": [
    "\"stage\": \"29A-29Z\"",
    "\"previousBatch\": \"Stage 28A-28Z\"",
    "\"nextBatchHypothesis\": \"Stage 30A-30Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 29A-29Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0036_stage29_followup_sop_policy_governance_evidence_reconciliation.sql": [
    "sop_policy_governance_evidence_reconciliation_state",
    "sop_policy_governance_evidence_reconciled_at",
    "clinical_follow_up_sop_policy_governance_evidence_reconciliation_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationPayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation",
    "openapi.stage29a-29z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage29a-29z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Reconcile evidence",
    "Recon mismatch",
    "sopPolicyGovernanceEvidenceReconciliationSummary"
  ],
  "docs/backend/stage-29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.md": [
    "Stage 29A-29Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.yml": [
    "name: stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation",
    "npm run preflight:stage29a-29z"
  ],
  "package.json": [
    "\"test:stage29a-29z\"",
    "\"check:stage29a-29z\"",
    "\"preflight:stage29a-29z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 29A-29Z clinical follow-up SOP policy governance evidence reconciliation preflight",
    "preflight:stage29a-29z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 29A-29Z clinical follow-up SOP policy governance evidence reconciliation preflight",
    "preflight:stage29a-29z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 29A-29Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 29A-29Z",
    "SOP policy governance evidence reconciliation"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 29A-29Z",
    "Stage 30A-30Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 29A-29Z",
    "SOP policy governance evidence reconciliation"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 29A-29Z",
    "SOP policy governance evidence reconciliation"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation.stage29a-29z.json",
    "stage-29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.md",
    "check-stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation.stage29a-29z.json",
  "backend/self-hosted/db/migrations/0036_stage29_followup_sop_policy_governance_evidence_reconciliation.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.md"
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation.stage29a-29z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "29A-29Z") errors.push("Stage 29 manifest stage must be 29A-29Z");
  if (manifest.previousBatch !== "Stage 28A-28Z") errors.push("Stage 29 previous batch must be Stage 28A-28Z");
  if (manifest.nextBatchHypothesis !== "Stage 30A-30Z") errors.push("Stage 29 must record Stage 30A-30Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 29 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 29 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 29 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 29 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationIsLocalMetadataOnly) errors.push("Stage 29 reconciliation must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceEvidenceReconciliationIsNotExternalApprovalProof) errors.push("Stage 29 reconciliation boundary must avoid external approval proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage29a-29z")) errors.push("Stage 29 preflight command missing");
}

export function checkStage29A29Z(root = process.cwd()) {
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
  const result = checkStage29A29Z(process.cwd());
  if (!result.ok) {
    console.error("[stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation] OK (${result.checkedFiles} files checked)`);
}

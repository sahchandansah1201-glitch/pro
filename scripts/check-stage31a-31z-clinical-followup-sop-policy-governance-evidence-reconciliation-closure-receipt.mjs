#!/usr/bin/env node
// Stage 31A-31Z - Clinical follow-up local SOP policy governance evidence reconciliation closure receipt guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.stage31a-31z.json",
  "backend/self-hosted/db/migrations/0038_stage31_followup_sop_policy_governance_evidence_reconciliation_closure_receipt.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage31a-31z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.md",
  ".github/workflows/stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.yml",
  "scripts/check-stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.mjs",
  "scripts/check-stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.stage31a-31z.json": [
    "\"stage\": \"31A-31Z\"",
    "\"previousBatch\": \"Stage 30A-30Z\"",
    "\"nextBatchHypothesis\": \"Stage 32A-32Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 31A-31Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0038_stage31_followup_sop_policy_governance_evidence_reconciliation_closure_receipt.sql": [
    "sop_policy_governance_evidence_reconciliation_closure_receipt_state",
    "sop_policy_governance_evidence_reconciliation_closure_received_at",
    "references app_users(id) on delete set null",
    "clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt",
    "openapi.stage31a-31z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage31a-31z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Receive receipt",
    "Receipt rework",
    "sopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary"
  ],
  "docs/backend/stage-31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.md": [
    "Stage 31A-31Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.yml": [
    "name: stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt",
    "npm run preflight:stage31a-31z"
  ],
  "package.json": [
    "\"test:stage31a-31z\"",
    "\"check:stage31a-31z\"",
    "\"preflight:stage31a-31z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 31A-31Z clinical follow-up SOP policy governance evidence reconciliation closure receipt preflight",
    "preflight:stage31a-31z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 31A-31Z clinical follow-up SOP policy governance evidence reconciliation closure receipt preflight",
    "preflight:stage31a-31z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 31A-31Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 31A-31Z",
    "SOP policy governance evidence reconciliation closure receipt"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 31A-31Z",
    "Stage 32A-32Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 31A-31Z",
    "SOP policy governance evidence reconciliation closure receipt"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 31A-31Z",
    "SOP policy governance evidence reconciliation closure receipt"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.stage31a-31z.json",
    "stage-31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.md",
    "check-stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.stage31a-31z.json",
  "backend/self-hosted/db/migrations/0038_stage31_followup_sop_policy_governance_evidence_reconciliation_closure_receipt.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.md"
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
  /medical\s+correctness\s+(proof|verification|guarantee)/i,
  /references\s+users\s*\(/i
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.stage31a-31z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "31A-31Z") errors.push("Stage 31 manifest stage must be 31A-31Z");
  if (manifest.previousBatch !== "Stage 30A-30Z") errors.push("Stage 31 previous batch must be Stage 30A-30Z");
  if (manifest.nextBatchHypothesis !== "Stage 32A-32Z") errors.push("Stage 31 must record Stage 32A-32Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 31 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 31 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 31 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 31 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureReceiptIsLocalMetadataOnly) errors.push("Stage 31 closure receipt must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceEvidenceReconciliationClosureReceiptIsNotExternalApprovalProof) errors.push("Stage 31 closure receipt boundary must avoid external approval proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage31a-31z")) errors.push("Stage 31 preflight command missing");
}

export function checkStage31A31Z(root = process.cwd()) {
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
  const result = checkStage31A31Z(process.cwd());
  if (!result.ok) {
    console.error("[stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt] OK (${result.checkedFiles} files checked)`);
}

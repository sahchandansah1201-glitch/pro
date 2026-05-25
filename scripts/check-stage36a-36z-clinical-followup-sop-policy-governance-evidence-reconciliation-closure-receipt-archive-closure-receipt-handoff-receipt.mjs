#!/usr/bin/env node
// Stage 36A-36Z - Clinical follow-up local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.stage36a-36z.json",
  "backend/self-hosted/db/migrations/0043_stage36_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage36a-36z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.md",
  ".github/workflows/stage36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.yml",
  "scripts/check-stage36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.mjs",
  "scripts/check-stage36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.stage36a-36z.json": [
    "\"stage\": \"36A-36Z\"",
    "\"previousBatch\": \"Stage 35A-35Z\"",
    "\"nextBatchHypothesis\": \"Stage 37A-37Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 36A-36Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0043_stage36_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.sql": [
    "stage36_archive_handoff_receipt_state",
    "stage36_archive_handoff_received_at",
    "references app_users(id) on delete set null",
    "clinical_follow_up_stage36_archive_handoff_receipt_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt",
    "openapi.stage36a-36z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage36a-36z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Receive handoff receipt",
    "Handoff receipt rework",
    "Received handoff receipts",
    "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary"
  ],
  "docs/backend/stage-36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.md": [
    "Stage 36A-36Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.yml": [
    "name: stage36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt",
    "npm run preflight:stage36a-36z"
  ],
  "package.json": [
    "\"test:stage36a-36z\"",
    "\"check:stage36a-36z\"",
    "\"preflight:stage36a-36z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 36A-36Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt preflight",
    "preflight:stage36a-36z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 36A-36Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt preflight",
    "preflight:stage36a-36z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 36A-36Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 36A-36Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 36A-36Z",
    "Stage 37A-37Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 36A-36Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 36A-36Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.stage36a-36z.json",
    "stage-36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.md",
    "check-stage36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.stage36a-36z.json",
  "backend/self-hosted/db/migrations/0043_stage36_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.md"
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
  /legal\s+archive\s+sufficiency\s+proof/i,
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt.stage36a-36z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "36A-36Z") errors.push("Stage 36 manifest stage must be 36A-36Z");
  if (manifest.previousBatch !== "Stage 35A-35Z") errors.push("Stage 36 previous batch must be Stage 35A-35Z");
  if (manifest.nextBatchHypothesis !== "Stage 37A-37Z") errors.push("Stage 36 must record Stage 37A-37Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 36 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 36 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 36 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 36 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptIsLocalMetadataOnly) errors.push("Stage 36 handoff receipt must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptIsNotExternalApprovalProof) errors.push("Stage 36 handoff receipt boundary must avoid external approval proof claims");
  if (!manifest.privacy?.archiveClosureReceiptHandoffReceiptIsNotLegalArchiveSufficiencyProof) errors.push("Stage 36 handoff receipt must avoid legal archive sufficiency claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage36a-36z")) errors.push("Stage 36 preflight command missing");
}

export function checkStage36A36Z(root = process.cwd()) {
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
  const result = checkStage36A36Z(process.cwd());
  if (!result.ok) {
    console.error("[stage36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[stage36a-36z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt] OK (${result.checkedFiles} files checked)`);
  }
}

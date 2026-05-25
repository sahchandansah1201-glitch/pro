#!/usr/bin/env node
// Stage 34A-34Z - Clinical follow-up local SOP policy governance evidence reconciliation closure receipt archive closure receipt guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.stage34a-34z.json",
  "backend/self-hosted/db/migrations/0041_stage34_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage34a-34z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.md",
  ".github/workflows/stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.yml",
  "scripts/check-stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.mjs",
  "scripts/check-stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.stage34a-34z.json": [
    "\"stage\": \"34A-34Z\"",
    "\"previousBatch\": \"Stage 33A-33Z\"",
    "\"nextBatchHypothesis\": \"Stage 35A-35Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 34A-34Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0041_stage34_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.sql": [
    "stage34_archive_closure_receipt_state",
    "stage34_archive_closure_received_at",
    "references app_users(id) on delete set null",
    "clinical_follow_up_stage34_archive_closure_receipt_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt",
    "openapi.stage34a-34z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage34a-34z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Receive archive receipt",
    "Archive receipt rework",
    "Received archive receipts",
    "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary"
  ],
  "docs/backend/stage-34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.md": [
    "Stage 34A-34Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.yml": [
    "name: stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt",
    "npm run preflight:stage34a-34z"
  ],
  "package.json": [
    "\"test:stage34a-34z\"",
    "\"check:stage34a-34z\"",
    "\"preflight:stage34a-34z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 34A-34Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt preflight",
    "preflight:stage34a-34z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 34A-34Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt preflight",
    "preflight:stage34a-34z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 34A-34Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 34A-34Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 34A-34Z",
    "Stage 35A-35Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 34A-34Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 34A-34Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.stage34a-34z.json",
    "stage-34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.md",
    "check-stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.stage34a-34z.json",
  "backend/self-hosted/db/migrations/0041_stage34_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.md"
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.stage34a-34z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "34A-34Z") errors.push("Stage 34 manifest stage must be 34A-34Z");
  if (manifest.previousBatch !== "Stage 33A-33Z") errors.push("Stage 34 previous batch must be Stage 33A-33Z");
  if (manifest.nextBatchHypothesis !== "Stage 35A-35Z") errors.push("Stage 34 must record Stage 35A-35Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 34 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 34 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 34 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 34 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptIsLocalMetadataOnly) errors.push("Stage 34 archive closure receipt must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptIsNotExternalApprovalProof) errors.push("Stage 34 archive closure receipt boundary must avoid external approval proof claims");
  if (!manifest.privacy?.archiveClosureReceiptIsNotLegalArchiveSufficiencyProof) errors.push("Stage 34 archive closure receipt must avoid legal archive sufficiency claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage34a-34z")) errors.push("Stage 34 preflight command missing");
}

export function checkStage34A34Z(root = process.cwd()) {
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
  const result = checkStage34A34Z(process.cwd());
  if (!result.ok) {
    console.error("[stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt] OK (${result.checkedFiles} files checked)`);
  }
}

#!/usr/bin/env node
// Stage 38A-38Z - Clinical follow-up local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.stage38a-38z.json",
  "backend/self-hosted/db/migrations/0045_stage38_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage38a-38z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.md",
  ".github/workflows/stage38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.yml",
  "scripts/check-stage38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.mjs",
  "scripts/check-stage38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.stage38a-38z.json": [
    "\"stage\": \"38A-38Z\"",
    "\"previousBatch\": \"Stage 37A-37Z\"",
    "\"nextBatchHypothesis\": \"Stage 39A-39Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 38A-38Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0045_stage38_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure.sql": [
    "stage38_archive_handoff_receipt_reconciliation_closure_state",
    "stage38_archive_handoff_receipt_reconciliation_closed_at",
    "references app_users(id) on delete set null",
    "clinical_follow_up_stage38_archive_handoff_receipt_reconciliation_closure_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosurePayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure",
    "openapi.stage38a-38z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage38a-38z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Close receipt recon",
    "Receipt recon closure rework",
    "Closed receipt recons",
    "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary"
  ],
  "docs/backend/stage-38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.md": [
    "Stage 38A-38Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.yml": [
    "name: stage38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure",
    "npm run preflight:stage38a-38z"
  ],
  "package.json": [
    "\"test:stage38a-38z\"",
    "\"check:stage38a-38z\"",
    "\"preflight:stage38a-38z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 38A-38Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure preflight",
    "preflight:stage38a-38z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 38A-38Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure preflight",
    "preflight:stage38a-38z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 38A-38Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 38A-38Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 38A-38Z",
    "Stage 39A-39Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 38A-38Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 38A-38Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.stage38a-38z.json",
    "stage-38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.md",
    "check-stage38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.stage38a-38z.json",
  "backend/self-hosted/db/migrations/0045_stage38_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.md"
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.stage38a-38z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "38A-38Z") errors.push("Stage 38 manifest stage must be 38A-38Z");
  if (manifest.previousBatch !== "Stage 37A-37Z") errors.push("Stage 38 previous batch must be Stage 37A-37Z");
  if (manifest.nextBatchHypothesis !== "Stage 39A-39Z") errors.push("Stage 38 must record Stage 39A-39Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 38 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 38 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 38 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 38 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureIsLocalMetadataOnly) errors.push("Stage 38 handoff receipt reconciliation closure must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureIsNotExternalApprovalProof) errors.push("Stage 38 handoff receipt reconciliation closure boundary must avoid external approval proof claims");
  if (!manifest.privacy?.archiveClosureReceiptHandoffReceiptReconciliationClosureIsNotLegalArchiveSufficiencyProof) errors.push("Stage 38 handoff receipt reconciliation closure must avoid legal archive sufficiency claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage38a-38z")) errors.push("Stage 38 preflight command missing");
}

export function checkStage38A38Z(root = process.cwd()) {
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
  const result = checkStage38A38Z(process.cwd());
  if (!result.ok) {
    console.error("[stage38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[stage38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure] OK (${result.checkedFiles} files checked)`);
  }
}

#!/usr/bin/env node
// Stage 35A-35Z - Clinical follow-up local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.stage35a-35z.json",
  "backend/self-hosted/db/migrations/0042_stage35_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage35a-35z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.md",
  ".github/workflows/stage35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.yml",
  "scripts/check-stage35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.mjs",
  "scripts/check-stage35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.stage35a-35z.json": [
    "\"stage\": \"35A-35Z\"",
    "\"previousBatch\": \"Stage 34A-34Z\"",
    "\"nextBatchHypothesis\": \"Stage 36A-36Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 35A-35Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0042_stage35_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.sql": [
    "stage35_archive_receipt_handoff_state",
    "stage35_archive_receipt_handed_off_at",
    "references app_users(id) on delete set null",
    "clinical_follow_up_stage35_archive_receipt_handoff_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff",
    "openapi.stage35a-35z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage35a-35z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Handoff archive receipt",
    "Handoff rework",
    "Handed off receipts",
    "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary"
  ],
  "docs/backend/stage-35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.md": [
    "Stage 35A-35Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.yml": [
    "name: stage35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff",
    "npm run preflight:stage35a-35z"
  ],
  "package.json": [
    "\"test:stage35a-35z\"",
    "\"check:stage35a-35z\"",
    "\"preflight:stage35a-35z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 35A-35Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff preflight",
    "preflight:stage35a-35z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 35A-35Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff preflight",
    "preflight:stage35a-35z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 35A-35Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 35A-35Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 35A-35Z",
    "Stage 36A-36Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 35A-35Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 35A-35Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.stage35a-35z.json",
    "stage-35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.md",
    "check-stage35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.stage35a-35z.json",
  "backend/self-hosted/db/migrations/0042_stage35_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.md"
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.stage35a-35z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "35A-35Z") errors.push("Stage 35 manifest stage must be 35A-35Z");
  if (manifest.previousBatch !== "Stage 34A-34Z") errors.push("Stage 35 previous batch must be Stage 34A-34Z");
  if (manifest.nextBatchHypothesis !== "Stage 36A-36Z") errors.push("Stage 35 must record Stage 36A-36Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 35 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 35 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 35 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 35 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffIsLocalMetadataOnly) errors.push("Stage 35 handoff must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffIsNotExternalApprovalProof) errors.push("Stage 35 handoff boundary must avoid external approval proof claims");
  if (!manifest.privacy?.archiveClosureReceiptHandoffIsNotLegalArchiveSufficiencyProof) errors.push("Stage 35 handoff must avoid legal archive sufficiency claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage35a-35z")) errors.push("Stage 35 preflight command missing");
}

export function checkStage35A35Z(root = process.cwd()) {
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
  const result = checkStage35A35Z(process.cwd());
  if (!result.ok) {
    console.error("[stage35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[stage35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff] OK (${result.checkedFiles} files checked)`);
  }
}
